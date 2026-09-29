import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import {
  logJson,
  loggerRedactsSecrets,
  __setLogSinkForTests,
  __resetLoggerForTests
} from '../server/utils/logger.js';
import {
  incrementMetric,
  getMetrics,
  resetMetricsForTests,
  METRIC_NAMES
} from '../server/utils/metrics.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * R-15 — Logs estruturados e métricas em memória.
 *
 * Critérios da spec:
 *  (1) logs de tick parseáveis (JSON: nível, módulo, msg, ts, correlationId do tick);
 *  (2) métricas refletem bloqueios do kill-switch;
 *  (3) nenhum segredo em log.
 *
 * Sem dependência nova: linha JSON por evento (JSON.stringify) e contadores em memória
 * expostos em GET /api/system/metrics (JSON simples).
 */

const TEST_TOKEN = 'test-token-for-metrics-suite-0001';

function makeApp() {
  return createApp({
    botState: {
      isMonitoring: false,
      activeTickersCount: 0,
      lastTickTime: Date.now(),
      ticksProcessed: 0,
      signalsGenerated24h: 0,
      weights: {} as any,
      aiModels: [],
      aiAnalysisEnabled: false
    } as BotState,
    tickerStateCache: {} as Record<string, TickerData>,
    triggerMarketScan: async () => {}
  });
}

describe('R-15 — logger estruturado', () => {
  let lines: string[] = [];

  beforeEach(() => {
    lines = [];
    __resetLoggerForTests();
    __setLogSinkForTests(line => lines.push(line));
  });

  afterEach(() => {
    __resetLoggerForTests();
  });

  it('critério 1: emite linha única JSON parseável com nível, módulo, msg, ts e correlationId', () => {
    logJson('INFO', 'tick', 'tick processado', { symbols: 8, correlationId: 'tick-123' });

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]) as {
      level: string; module: string; msg: string; ts: number; correlationId?: string; data?: Record<string, unknown>;
    };
    expect(parsed.level).toBe('INFO');
    expect(parsed.module).toBe('tick');
    expect(parsed.msg).toBe('tick processado');
    expect(parsed.ts).toBeGreaterThan(0);
    expect(parsed.correlationId).toBe('tick-123');
    expect(parsed.data).toEqual({ symbols: 8 });
  });

  it('respeita o formato especificado: JSON.stringify com nível/módulo/msg/ts/correlationId', () => {
    logJson('WARN', 'binance', 'endpoint lento');
    const raw = String(lines[0]);
    expect(raw.startsWith('{')).toBe(true);
    expect(raw.endsWith('}')).toBe(true);
    // Uma linha só — sem \n embutido.
    expect(raw.includes('\n')).toBe(false);
    const keys = Object.keys(JSON.parse(raw));
    expect(keys).toEqual(expect.arrayContaining(['level', 'module', 'msg', 'ts']));
  });

  it('critério 3: segredos em dados são redigidos antes de serializar', () => {
    logJson('INFO', 'auth', 'request autenticada', {
      apiKey: 'sk-abc123',
      GEMINI_API_KEY: 'gem-secret',
      password: 'hunter2',
      authorization: 'Bearer tok-xyz',
      token: 'raw-token',
      safeField: 'permanece'
    });

    const parsed = JSON.parse(String(lines[0]));
    expect(parsed.data.apiKey).not.toContain('sk-abc123');
    expect(parsed.data.GEMINI_API_KEY).not.toContain('gem-secret');
    expect(parsed.data.password).not.toContain('hunter2');
    expect(parsed.data.authorization).not.toContain('tok-xyz');
    expect(parsed.data.token).not.toContain('raw-token');
    expect(parsed.data.safeField).toBe('permanece');
  });

  it('redige segredos que aparecem na própria mensagem (string)', () => {
    const raw = loggerRedactsSecrets('falha com apiKey=sk-live-999 e Bearer abc.def.ghi');
    expect(raw).not.toContain('sk-live-999');
    expect(raw).not.toContain('abc.def.ghi');
  });

  it('sem sink customizado, a linha vai para stdout via console.log (spy)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    __resetLoggerForTests(); // remove o sink, volta ao console
    try {
      logJson('INFO', 'tick', 'no console');
      expect(spy).toHaveBeenCalledTimes(1);
      const raw = spy.mock.calls[0][0] as string;
      expect(() => JSON.parse(raw)).not.toThrow();
    } finally {
      spy.mockRestore();
      __setLogSinkForTests(line => lines.push(line));
    }
  });

  it('msg e data com quebras de linha não quebram o formato de uma linha', () => {
    logJson('ERROR', 'ws', 'erro com \n quebra', { detail: 'linha1\nlinha2' });
    const raw = String(lines[0]);
    expect(raw.split('\n')).toHaveLength(1);
    expect(JSON.parse(raw).msg).toContain('\n');
  });
});

describe('R-15 — métricas em memória', () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it('contador inexistente começa em 0 e incrementa', () => {
    expect(getMetrics().counters[METRIC_NAMES.signalsEmitted]).toBe(0);
    incrementMetric(METRIC_NAMES.signalsEmitted);
    incrementMetric(METRIC_NAMES.signalsEmitted, 3);
    expect(getMetrics().counters[METRIC_NAMES.signalsEmitted]).toBe(4);
  });

  it('snapshot expõe startedAt, generatedAt e uptimeMs coerentes', () => {
    const m = getMetrics();
    expect(m.startedAt).toBeGreaterThan(0);
    expect(m.generatedAt).toBeGreaterThanOrEqual(m.startedAt);
    expect(m.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('expõe os nomes de métrica do domínio (ticks, sinais, bloqueios, erros por feed)', () => {
    const names = Object.values(METRIC_NAMES);
    expect(names).toEqual(expect.arrayContaining([
      'ticks_processed',
      'signals_emitted',
      'signals_suppressed_killswitch',
      'signals_blocked_datagate',
      'signals_blocked_risk_limit',
      'trading_schedule_blocks'
    ]));
    expect(names.some(n => n.startsWith('feed_errors'))).toBe(true);
  });

  it('erros por feed viram contador feed_errors.<feed>', () => {
    incrementMetric('feed_errors.depth');
    expect(getMetrics().counters['feed_errors.depth']).toBe(1);
  });
});

describe('R-15 — GET /api/system/metrics (protegido)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    resetMetricsForTests();
    incrementMetric(METRIC_NAMES.ticksProcessed, 42);
    incrementMetric(METRIC_NAMES.signalsSuppressedKillswitch, 2);
    app = makeApp();
  });

  it('sem token: 401', async () => {
    const res = await request(app).get('/api/system/metrics');
    expect([401, 403]).toContain(res.status);
  });

  it('com token: 200 com contadores e uptime', async () => {
    const res = await request(app)
      .get('/api/system/metrics')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metrics.counters[METRIC_NAMES.ticksProcessed]).toBe(42);
    expect(res.body.metrics.counters[METRIC_NAMES.signalsSuppressedKillswitch]).toBe(2);
    expect(res.body.metrics.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});
