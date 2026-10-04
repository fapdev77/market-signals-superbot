/**
 * SDD Fase 9 / S2 — contrato HTTP da calibração de score.
 *
 * O endpoint é o que permite à UI PARAR de exibir "NN% CONFLUÊNCIA" como se fosse
 * probabilidade. Este teste trava o contrato: o que a tela precisa para ser honesta
 * (expectativa em R, tamanho da amostra, confiança e o piso de amostra) tem de estar na
 * resposta — inclusive quando o ledger está vazio, caso em que a resposta tem de dizer
 * "não calibrado" e não devolver 0 como se fosse uma medição.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

const originalEnv = { ...process.env };

const mockBotState: BotState = {
  isMonitoring: true,
  activeTickersCount: 5,
  lastTickTime: Date.now(),
  ticksProcessed: 0,
  signalsGenerated24h: 0,
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

describe('GET /api/evidence/calibration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = 'test-calibration-token-001';
    app = createApp({
      botState: mockBotState,
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('responde 200 com prior, piso de amostra e mapa de tiers', async () => {
    const res = await request(app).get('/api/evidence/calibration').set('Authorization', 'Bearer test-calibration-token-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.priorR).toBe('number');
    expect(typeof res.body.priorSampleSize).toBe('number');
    expect(res.body.minSampleForCalibration).toBeGreaterThan(0);
    expect(typeof res.body.tiers).toBe('object');
  });

  it('ledger vazio ⇒ tiers UNCALIBRATED, sem inventar expectativa', async () => {
    const res = await request(app).get('/api/evidence/calibration').set('Authorization', 'Bearer test-calibration-token-001');

    expect(res.body.priorSampleSize).toBe(0);
    expect(res.body.priorR).toBe(0);
    for (const tier of Object.values<Record<string, unknown>>(res.body.tiers)) {
      expect(tier).toMatchObject({ confidence: 'UNCALIBRATED', sampleSize: 0, basis: 'GLOBAL_PRIOR' });
    }
  });

  it('exige autenticação (o ledger é dado operacional)', async () => {
    const res = await request(app).get('/api/evidence/calibration');
    expect(res.status).toBe(401);
  });

  it('o rótulo devolvido nunca apresenta a expectativa como porcentagem', async () => {
    const res = await request(app).get('/api/evidence/calibration').set('Authorization', 'Bearer test-calibration-token-001');
    const tiers = Object.values<Record<string, unknown>>(res.body.tiers);
    for (const tier of tiers) {
      expect(String(tier.label)).not.toMatch(/\d+\s*%/);
    }
  });
});