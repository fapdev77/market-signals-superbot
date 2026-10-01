import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';
import { getEffectiveAuthToken } from '../server/middleware/auth.js';

describe('Burn-In & Audit Report Export API', () => {
  const originalEnv = { ...process.env };
  const mockBotState: BotState = {
    isMonitoring: true,
    activeTickersCount: 13,
    lastTickTime: Date.now(),
    ticksProcessed: 100,
    signalsGenerated24h: 5,
    weights: {
      volumeSurgeWeight: 15,
      openInterestWeight: 15,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 15,
      fibonacciZoneWeight: 10,
      rangePocWeight: 10,
      supportResistanceWeight: 10,
      rsiDivergenceWeight: 10,
      trappedTradersWeight: 5,
      minRiskRewardRatio: 2.0,
      volumeProfileRange: 24
    },
    aiModels: [],
    aiAnalysisEnabled: false
  };

  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = 'test-burnin-token-001';
    app = createApp({
      botState: mockBotState,
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('serves JSON burn-in report via GET /api/evidence/burnin-report', async () => {
    const token = getEffectiveAuthToken();
    const res = await request(app)
      .get('/api/evidence/burnin-report')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.origin).toBe('LIVE');
    expect(typeof res.body.report.winRatePct).toBe('string');
    expect(typeof res.body.report.netExpectancyR).toBe('string');
    expect(Array.isArray(res.body.report.goNoGoReasons)).toBe(true);
    expect(typeof res.body.report.goNoGoStatus).toBe('string');
  });

  it('serves CSV burn-in report via GET /api/evidence/burnin-report?format=csv', async () => {
    const token = getEffectiveAuthToken();
    const res = await request(app)
      .get('/api/evidence/burnin-report?format=csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('burnin-report-');
    expect(res.text).toContain('# Market Signals SuperBot - Relatorio de Auditoria & Burn-In');
    expect(res.text).toContain('Veredito Go/No-Go');
  });
});
