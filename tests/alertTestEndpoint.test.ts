import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';
import { resetOperationalAlertsForTests, setSinksForTests } from '../server/services/operationalAlerts.js';
import type { AlertSink, AlertPayload } from '../server/services/AlertService.js';

/**
 * 6.6.3 / CA-6.3 — endpoint autenticado POST /api/system/alerts/test dispara um
 * alerta de teste pelos sinks configurados e devolve o resultado POR SINK.
 */

const TEST_TOKEN = 'test-token-for-alert-endpoint-0001';

function makeBotState(): BotState {
  return {
    isMonitoring: false,
    activeTickersCount: 0,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: {} as any,
    aiModels: [],
    aiAnalysisEnabled: false
  } as BotState;
}

describe('6.6.3 — POST /api/system/alerts/test (CA-6.3)', () => {
  const originalEnv = { ...process.env };
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    resetOperationalAlertsForTests();
    app = createApp({
      botState: makeBotState(),
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('sem token responde 401 (autenticação obrigatória)', async () => {
    const res = await request(app).post('/api/system/alerts/test').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('com token dispara o alerta de teste e devolve resultado por sink', async () => {
    const sent: AlertPayload[] = [];
    const okSink: AlertSink = { name: 'ok-sink', send: async p => { sent.push(p); return true; } };
    const failSink: AlertSink = { name: 'fail-sink', send: async () => false };
    setSinksForTests([okSink, failSink]);

    const res = await request(app)
      .post('/api/system/alerts/test')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ message: 'ping de teste do operador' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    const ok = res.body.results.find((r: any) => r.sink === 'ok-sink');
    const fail = res.body.results.find((r: any) => r.sink === 'fail-sink');
    expect(ok).toMatchObject({ sink: 'ok-sink', delivered: true });
    expect(fail).toMatchObject({ sink: 'fail-sink', delivered: false });
    expect(sent.length).toBe(1);
    expect(sent[0].key).toContain('operational_test');
  });

  it('sem sinks configurados devolve ok com lista vazia (não falha)', async () => {
    setSinksForTests([]);
    const res = await request(app)
      .post('/api/system/alerts/test')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.results).toEqual([]);
  });
});
