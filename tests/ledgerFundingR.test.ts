/**
 * 6.3.5 / CA-3.5 — O R do ledger desconta os eventos de funding reais
 * atravessados durante a vida do sinal, com o mesmo método do backtest.
 * Um sinal que atravessou DOIS eventos de funding iguala o cálculo manual em
 * decimal.
 */
import { describe, it, expect } from 'vitest';

import { calculateSignalOutcomeR, type LedgerSignalParams, type LedgerEventRecord } from '../server/services/EvidenceService.js';

const HOUR8 = 8 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function baseSignal(): LedgerSignalParams {
  return {
    id: 'fund-r-1',
    symbol: 'BTCUSDT',
    category: 'INTRADAY',
    direction: 'LONG',
    entryPrice: 100,
    stopLoss: 90, // risco = 10 ⇒ 1R = 10% do notional
    takeProfit1: 105,
    takeProfit2: 110,
    score: 80,
    origin: 'LIVE',
    createdAt: T0
  };
}

describe('6.3.5 / CA-3.5 — R do ledger desconta funding real', () => {
  it('sinal que atravessa 2 eventos de 0.01% iguala o cálculo manual', () => {
    const signal = baseSignal();
    const events: LedgerEventRecord[] = [
      { signalId: signal.id, eventType: 'ENTRY', price: 100, timestamp: T0 },
      { signalId: signal.id, eventType: 'EXPIRED', price: 100, timestamp: T0 + 2 * HOUR8, metadata: { reason: 'TTL' } }
    ];

    const result = calculateSignalOutcomeR(signal, events, {
      funding: {
        records: [
          { symbol: 'BTCUSDT', fundingTime: T0 + HOUR8, fundingRate: 0.0001 },
          { symbol: 'BTCUSDT', fundingTime: T0 + 2 * HOUR8, fundingRate: 0.0001 }
        ]
      }
    });

    // Manual: grossR = 0 (expira na entrada); custos = 0.10%/10% = 0.01R;
    // funding = (0.0001 + 0.0001)×100% = 0.02% ⇒ 0.02/10 = 0.002R.
    // netR = 0 − 0.01 − 0.002 = −0.012.
    expect(result.grossR).toBeCloseTo(0, 6);
    expect(result.costsR).toBeCloseTo(0.01, 6);
    expect(result.fundingR).toBeCloseTo(0.002, 6);
    expect(result.netR).toBeCloseTo(-0.012, 6);
  });

  it('sem opções de funding, resultado permanece compatível (fundingR 0)', () => {
    const signal = baseSignal();
    const events: LedgerEventRecord[] = [
      { signalId: signal.id, eventType: 'ENTRY', price: 100, timestamp: T0 },
      { signalId: signal.id, eventType: 'TARGET2', price: 110, timestamp: T0 + HOUR8 }
    ];

    const result = calculateSignalOutcomeR(signal, events);

    expect(result.fundingR ?? 0).toBe(0);
    // Gross TP2 sem parcial: (110−100)/10 = 1.0R − custos 0.01R.
    expect(result.netR).toBeCloseTo(0.99, 4);
  });
});
