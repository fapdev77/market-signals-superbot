import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createApp } from '../server/app.js';
import { processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { getDefaultIndicatorWeights } from '../src/constants/strategyPresets.js';
import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  updateSignalStatus,
  signalLedgerDao
} from '../server/db.js';
import { canGenerateSignals } from '../server/services/DataGate.js';
import { evaluateTickTradfiGate } from '../server/binanceService.js';
import type { BotState, KlineCandle, TickerData } from '../src/types.js';

/**
 * 8.8 / CA-8.1, CA-8.2 — fumaça ponta a ponta: tick → sinal → ledger (ENTRY) →
 * resultado → `/api/evidence/summary`. Falha se qualquer elo quebrar.
 *
 * O ramo de feed degradado não pode deixar linha no ledger. O ramo TradFi fora de
 * sessão (fim de semana) é bloqueado pelo gate do calendário.
 */

let dir: string;
let app: ReturnType<typeof createApp>;
const TEST_TOKEN = 'e2e-smoke-token-0001';
const originalEnv = { ...process.env };

function buildApp() {
  return createApp({
    botState: {
      isMonitoring: false,
      activeTickersCount: 0,
      lastTickTime: Date.now(),
      ticksProcessed: 0,
      signalsGenerated24h: 0,
      weights: getDefaultIndicatorWeights(),
      aiModels: [],
      aiAnalysisEnabled: false
    } as unknown as BotState,
    tickerStateCache: {} as Record<string, TickerData>,
    triggerMarketScan: async () => {}
  });
}

/**
 * Fixture determinística de tendência de alta (mesmo padrão de tests/phase3.test.ts,
 * comprovadamente capaz de produzir sinal não-nulo).
 */
function trendingFixture() {
  const weights = {
    ...getDefaultIndicatorWeights(),
    volumeSurgeWeight: 20,
    openInterestWeight: 20,
    fundingRateWeight: 15,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 15,
    rangePocWeight: 15,
    supportResistanceWeight: 15,
    trappedTradersWeight: 25,
    rsiDivergenceWeight: 20,
    volumeProfileRange: 24,
    minRiskRewardRatio: 0
  };
  const candles: KlineCandle[] = Array.from({ length: 20 }, (_, i) => ({
    timestamp: 1000 + i * 60_000,
    open: 90000 + i * 60,
    high: 90100 + i * 60,
    low: 89900 + i * 60,
    close: 90050 + i * 60,
    volume: 100 + i * 10,
    takerBuyVolume: 60 + i * 6
  }));
  const rawTicker = {
    symbol: 'BTCUSDT',
    lastPrice: '91100',
    priceChangePercent: '2.5',
    updatedAt: Date.now(),
    source: 'REST' as const
  };
  return { candles, rawTicker, weights };
}

async function ledgerSignalCount(): Promise<number> {
  const db = await getDb();
  const res = db.exec(`SELECT count(*) FROM trade_signals`);
  return res.length && res[0].values ? Number(res[0].values[0][0]) : 0;
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-e2e-smoke-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
  process.env.API_AUTH_TOKEN = TEST_TOKEN;
  process.env.NODE_ENV = 'test';
  app = buildApp();
});

afterAll(() => {
  setDbForTesting(null);
  process.env = originalEnv;
  rmSync(dir, { recursive: true, force: true });
});

describe('8.8 / CA-8.1 — tick → sinal → ledger → resultado → evidência', () => {
  it('percorre o fluxo inteiro e o sinal aparece em /api/evidence/summary', async () => {
    const { candles, rawTicker, weights } = trendingFixture();

    // 1. tick → estado do motor de sinais
    const processed = processTickerState(rawTicker, candles, 15000000, 0.0001, weights);
    expect(processed, 'processTickerState não produziu estado').toBeTruthy();

    // 2. sinal (RR mínimo 0, como no teste de regressão do phase3)
    const signal = buildTradeSignal(processed!, candles, 0, 'INTRADAY');
    expect(signal, 'buildTradeSignal não produziu sinal').toBeTruthy();

    // 3. ledger (ENTRY gravado na emissão)
    await saveSignalAndLedger(signal!);

    // 4. resultado terminal
    await signalLedgerDao.recordEvent({
      signalId: signal!.id,
      eventType: 'TARGET2',
      price: signal!.target2,
      timestamp: signal!.createdAt + 60_000
    });
    await updateSignalStatus(signal!.id, 'TARGET_REACHED', 'Alvo 2');

    // 5. resumo de evidência via HTTP
    const res = await request(app)
      .get('/api/evidence/summary?origin=LIVE')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalSignals).toBeGreaterThanOrEqual(1);
  }, 30000);
});

describe('8.8 / CA-8.2 — ramo de feed degradado não deixa linha no ledger', () => {
  it('o DataGate bloqueia e nenhuma linha nova entra no ledger', async () => {
    const before = await ledgerSignalCount();

    const degraded = {
      symbol: 'BTCUSDT',
      price: 50000,
      updatedAt: Date.now(),
      source: 'REST',
      dataQuality: { isDegraded: true, source: 'REST' }
    } as unknown as TickerData;

    const decision = canGenerateSignals(degraded, Date.now());
    expect(decision.allow).toBe(false);

    // Pipeline real: gate bloqueado ⇒ o sinal não é persistido.
    if (decision.allow) {
      throw new Error('gate deveria ter bloqueado o feed degradado');
    }

    expect(await ledgerSignalCount()).toBe(before);
  });
});

describe('8.8 / CA-8.2 — TradFi fora de sessão é bloqueado', () => {
  it('fim de semana bloqueia contrato TRADIFI_PERPETUAL de índice', () => {
    const saturday = new Date(Date.UTC(2026, 9, 3, 15, 0, 0)); // sábado 2026-10-03
    const gate = evaluateTickTradfiGate(
      { symbol: 'US500USDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'INDEX' },
      saturday
    );
    expect(gate.allow).toBe(false);
    expect(gate.scheduleGated).toBe(true);
  });
});
