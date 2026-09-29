import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import {
  recordFeedSuccess,
  recordFeedFailure,
  getFeedHealth,
  resetFeedHealthForTests
} from '../server/services/feedHealth.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * R-13 — Health por feed com estado observável.
 *
 * Critérios da spec:
 *  (1) falha repetida muda o estado do feed para DEGRADED visível;
 *  (2) recuperação volta a OK com timestamp;
 *  (3) a UI mostra badge por feed.
 *
 * O registro é in-memory e central (`server/services/feedHealth.ts`); os feeds instrumentados
 * são: `ticker` (REST/WS), `klines`, `openInterest`, `funding`, `longShort`, `depth`, `ws`
 * (WebSocket de mercado) e `tradingSchedule` (R-11).
 */

const TEST_TOKEN = 'test-token-for-feed-health-suite-0001';

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

describe('R-13 — registro de health por feed', () => {
  beforeEach(() => {
    resetFeedHealthForTests();
  });

  it('feed sem registro nenhum nasce UNKNOWN (nunca OK inventado)', () => {
    const health = getFeedHealth();
    expect(health.feeds.ticker.status).toBe('UNKNOWN');
    expect(health.feeds.klines.status).toBe('UNKNOWN');
  });

  it('primeiro sucesso deixa o feed OK com timestamp e latência', () => {
    recordFeedSuccess('ticker', 120);
    const { feeds } = getFeedHealth();
    expect(feeds.ticker.status).toBe('OK');
    expect(feeds.ticker.lastSuccessAt).toBeGreaterThan(0);
    expect(feeds.ticker.lastLatencyMs).toBe(120);
    expect(feeds.ticker.consecutiveFailures).toBe(0);
  });

  it('critério 1: DEGRADAÇÃO_THRESHOLD falhas seguidas viram DEGRADED visível', () => {
    for (let i = 0; i < 3; i++) recordFeedFailure('klines', 'timeout');
    const { feeds } = getFeedHealth();
    expect(feeds.klines.status).toBe('DEGRADED');
    expect(feeds.klines.consecutiveFailures).toBe(3);
    expect(feeds.klines.lastError).toBe('timeout');
  });

  it('uma falha isolada ainda é OK (com lastError anotado)', () => {
    recordFeedSuccess('ticker', 50);
    recordFeedFailure('ticker', 'flash error');
    expect(getFeedHealth().feeds.ticker.status).toBe('OK');
  });

  it('critério 2: recuperação volta a OK com novo timestamp de sucesso', () => {
    recordFeedSuccess('funding', 30);
    recordFeedFailure('funding', 'e1');
    recordFeedFailure('funding', 'e2');
    recordFeedFailure('funding', 'e3');
    expect(getFeedHealth().feeds.funding.status).toBe('DEGRADED');

    const before = getFeedHealth().feeds.funding.lastSuccessAt;
    recordFeedSuccess('funding', 40);

    const feed = getFeedHealth().feeds.funding;
    expect(feed.status).toBe('OK');
    expect(feed.consecutiveFailures).toBe(0);
    expect(feed.lastSuccessAt).toBeGreaterThanOrEqual(before);
    expect(feed.lastLatencyMs).toBe(40);
  });

  it('idade de stale (sem sucesso recente) degrada o feed OK', () => {
    recordFeedSuccess('longShort', 10);
    // Idade máxima para OK é 90s; avançamos o relógio 5 min sem novo sucesso.
    const future = Date.now() + 5 * 60 * 1000;
    const health = getFeedHealth(future);
    expect(health.feeds.longShort.status).toBe('STALE');
    expect(health.feeds.longShort.lastSuccessAt).toBeGreaterThan(0);
  });

  it('getFeedHealth aceita now injetado (testável) e expõe payload estável', () => {
    recordFeedSuccess('depth', 12);
    const health = getFeedHealth(Date.now());
    expect(health.generatedAt).toBeGreaterThan(0);
    for (const key of ['ticker', 'klines', 'openInterest', 'funding', 'longShort', 'depth', 'ws', 'tradingSchedule']) {
      expect(health.feeds).toHaveProperty(key);
    }
  });
});

describe('R-13 — GET /api/system/feed-health (protegido por auth)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    resetFeedHealthForTests();
    recordFeedSuccess('ws', 5);
    // 3 falhas seguidas: cruza o threshold de DEGRADED (1 falha isolada ficaria OK).
    recordFeedFailure('depth', 'sem book');
    recordFeedFailure('depth', 'sem book');
    recordFeedFailure('depth', 'sem book');
    app = makeApp();
  });

  it('sem token: 401', async () => {
    const res = await request(app).get('/api/system/feed-health');
    expect([401, 403]).toContain(res.status);
  });

  it('com token: 200 com mapa por feed e resumo', async () => {
    const res = await request(app)
      .get('/api/system/feed-health')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.health.feeds.ws.status).toBe('OK');
    expect(res.body.health.feeds.depth.status).toBe('DEGRADED');
    expect(res.body.health.summary.totalFeeds).toBe(8);
    expect(res.body.health.summary.degraded).toBeGreaterThanOrEqual(1);
  });
});
