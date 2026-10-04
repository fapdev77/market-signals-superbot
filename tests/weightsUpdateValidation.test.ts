/**
 * HIGH-3 (auditoria 2026-10-04) — `POST /api/settings/weights` validava nada.
 *
 * O schema existia em `server/middleware/validation.ts` mas nunca foi aplicado, e o
 * merge da rota escrevia o payload cru direto em `botState.weights`. Dois defeitos
 * concretos, ambos silenciosos (HTTP 200, sem mensagem):
 *
 *  1. `maxStopLossAtrMultiple: -999` — `signalEngine` só aplica o teto de stop por ATR
 *     quando `capMultiple > 0`, então um valor negativo DESLIGA o teto de risco.
 *  2. `volumeProfileRange: 0` e pesos fora de [0,100] — degeneram o perfil de volume e
 *     anulam a confluência inteira.
 *
 * Este guard fixa o contrato HTTP nos dois formatos que a UI usa hoje: objeto de pesos
 * direto (BacktestDashboard ao aplicar pesos auto-tunados) e envelope
 * `{ weights, scope, resetCategory, activeStrategy }` (App.tsx).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

const originalEnv = { ...process.env };
const TOKEN = 'test-weights-validation-token-001';

const mockBotState: BotState = {
  isMonitoring: true,
  activeTickersCount: 3,
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
    volumeProfileRange: 24,
    maxStopLossAtrMultiple: 2.5
  },
  aiModels: [],
  aiAnalysisEnabled: false
};

describe('POST /api/settings/weights — validação do payload (HIGH-3)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TOKEN;
    app = createApp({
      botState: mockBotState,
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  const post = (body: unknown) =>
    request(app).post('/api/settings/weights').set('Authorization', `Bearer ${TOKEN}`).send(body as object);

  it('rejeita maxStopLossAtrMultiple <= 0 (que desligaria o teto de stop por ATR)', async () => {
    for (const value of [-999, -1, 0]) {
      const res = await post({ weights: { maxStopLossAtrMultiple: value } });
      expect(res.status, `maxStopLossAtrMultiple=${value}`).toBe(400);
      expect(res.body.details.some((d: { path: string }) => d.path.includes('maxStopLossAtrMultiple'))).toBe(true);
    }
    // E o teto realmente em vigor NÃO pode ter sido sobrescrito pelo payload recusado.
    expect(mockBotState.weights.maxStopLossAtrMultiple).toBe(2.5);
  });

  it('rejeita volumeProfileRange fora de inteiro >= 1', async () => {
    for (const value of [0, -5, 12.5]) {
      const res = await post({ weights: { volumeProfileRange: value } });
      expect(res.status, `volumeProfileRange=${value}`).toBe(400);
    }
    expect(mockBotState.weights.volumeProfileRange).toBe(24);
  });

  it('rejeita pesos de confluência fora de [0,100] e RR degenerado', async () => {
    const res = await post({ weights: { cvdImbalanceWeight: 5000 } });
    expect(res.status).toBe(400);

    const rr = await post({ weights: { minRiskRewardRatio: 0 } });
    expect(rr.status).toBe(400);
  });

  it('rejeita no formato de objeto direto, que é o que o BacktestDashboard envia', async () => {
    const res = await post({ maxStopLossAtrMultiple: -5 });
    expect(res.status).toBe(400);
  });

  it('aceita payload válido e preserva os campos estruturados', async () => {
    const res = await post({
      weights: {
        activeStrategy: 'intraday',
        maxStopLossAtrMultiple: 3,
        volumeProfileRange: 50,
        cvdImbalanceWeight: 20,
        minRiskRewardRatio: 2.5,
        signalTtlSettings: { scalpTtlMinutes: 25 }
      },
      scope: 'ALL_FUTURE'
    });
    // O fluxo de reset-and-rescan exige DB; o que importa aqui é que NÃO foi 400.
    expect(res.status).not.toBe(400);
  });
});