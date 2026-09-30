/**
 * 6.2.1 / CA-2.1 — Toda transição ACTIVE → EXPIRED grava um evento EXPIRED no
 * ledger com `reason` (TTL / STRATEGY_RESET / MANUAL_RESET) e fecha o sinal a
 * mercado pelo último preço conhecido (incluindo parcial já realizada), com as
 * mesmas taxas e slippage do backtest — de modo que o resumo conte o sinal
 * (sem viés de sobrevivência).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  expireStaleSignals,
  expireActiveSignalsByCategory,
  expireAllActiveSignals,
  signalLedgerDao
} from '../server/db.js';
import { calculateSignalOutcomeR } from '../server/services/EvidenceService.js';
import type { TradeSignal } from '../src/types.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-expired-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

function makeSignal(id: string, overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    id,
    symbol: 'BTCUSDT',
    marketType: 'crypto_futures',
    signalType: 'LONG',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [99, 101],
    currentPrice: 100,
    stopLoss: 90,
    target1: 105,
    target2: 110,
    riskRewardRatio: 2.0,
    confluenceScore: 80,
    confluenceFactors: ['volumeSurge'],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: 1000,
    expiresAt: 2000,
    ttlMinutes: 15,
    status: 'ACTIVE',
    ...overrides
  } as TradeSignal;
}

async function getEvents(signalId: string): Promise<Array<{ eventType: string; price: number; metadata?: any }>> {
  return signalLedgerDao.getRawEvents(signalId);
}

describe('6.2.1 / CA-2.1 — evento EXPIRED em toda transição ACTIVE → EXPIRED', () => {
  it('TTL sweep: grava EXPIRED com reason TTL, fecha a mercado pelo último preço e o resumo conta o sinal', async () => {
    const signal = makeSignal('exp-ttl-1');
    await saveSignalAndLedger(signal, { tradfiCategory: 'CRYPTO' });

    // Último preço conhecido: snapshot do ticker para o símbolo.
    const db = await getDb();
    db.run(
      `INSERT INTO ticker_snapshots (symbol, price, updated_at) VALUES (?, ?, ?)`,
      ['BTCUSDT', 101, 1500]
    );

    const swept = await expireStaleSignals(3000);
    expect(swept).toBeGreaterThanOrEqual(1);

    const statusRes = db.exec(`SELECT status, expiration_reason FROM trade_signals WHERE id = 'exp-ttl-1'`);
    expect(String(statusRes[0].values[0][0])).toBe('EXPIRED');

    const events = await getEvents('exp-ttl-1');
    const expiredEvents = events.filter(e => e.eventType === 'EXPIRED');
    expect(expiredEvents.length).toBe(1);
    expect(expiredEvents[0].metadata?.reason).toBe('TTL');
    expect(expiredEvents[0].price).toBe(101);

    // Fechamento a mercado: ENTRY + EXPIRED; R calculado com as mesmas taxas/slippage do backtest.
    const ledgerRows = db.exec(`SELECT entry_price, stop_loss FROM signal_ledger WHERE id = 'exp-ttl-1'`);
    const outcome = calculateSignalOutcomeR(
      {
        id: 'exp-ttl-1',
        symbol: 'BTCUSDT',
        category: 'INTRADAY',
        direction: 'LONG',
        entryPrice: Number(ledgerRows[0].values[0][0]),
        stopLoss: Number(ledgerRows[0].values[0][1]),
        takeProfit1: 105,
        takeProfit2: 110,
        score: 80,
        origin: 'LIVE'
      },
      events.map(e => ({
        signalId: 'exp-ttl-1',
        eventType: e.eventType as any,
        price: e.price,
        timestamp: 0,
        metadata: e.metadata
      }))
    );
    expect(outcome.isClosed).toBe(true);
    expect(outcome.outcomeType).toBe('EXPIRED');
    // LONG: entrada 100, fechamento 101, risco 10 → +0.1R bruto antes dos custos.
    expect(outcome.grossR).toBeCloseTo(0.1, 4);
  });

  it('Redefinição de estratégia: grava EXPIRED com reason STRATEGY_RESET', async () => {
    const signal = makeSignal('exp-strat-1', { strategyCategory: 'SCALP' });
    await saveSignalAndLedger(signal, { tradfiCategory: 'CRYPTO' });

    await expireActiveSignalsByCategory('SCALP');

    const events = await getEvents('exp-strat-1');
    const expiredEvents = events.filter(e => e.eventType === 'EXPIRED');
    expect(expiredEvents.length).toBe(1);
    expect(expiredEvents[0].metadata?.reason).toBe('STRATEGY_RESET');
  });

  it('Reset manual: grava EXPIRED com reason MANUAL_RESET', async () => {
    const signal = makeSignal('exp-manual-1');
    await saveSignalAndLedger(signal, { tradfiCategory: 'CRYPTO' });

    await expireAllActiveSignals();

    const events = await getEvents('exp-manual-1');
    const expiredEvents = events.filter(e => e.eventType === 'EXPIRED');
    expect(expiredEvents.length).toBe(1);
    expect(expiredEvents[0].metadata?.reason).toBe('MANUAL_RESET');
  });
});
