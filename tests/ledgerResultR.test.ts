import { describe, it, expect } from 'vitest';
import {
  calculateSignalOutcomeR,
  calculateMfeMaeFromCandles,
  type LedgerSignalParams,
  type LedgerEventRecord
} from '../server/services/EvidenceService.js';

describe('M3.2 & CA-3.2: Exact Decimal R, MFE & MAE Calculation for Closed Signals', () => {
  const baseSignal: LedgerSignalParams = {
    id: 'sig-synth-1',
    symbol: 'BTCUSDT',
    category: 'DAYTRADE',
    direction: 'LONG',
    entryPrice: 100,
    stopLoss: 90,
    takeProfit1: 115,
    takeProfit2: 130,
    score: 85,
    origin: 'LIVE'
  };

  it('calculates gross and net R for a full win sequence (Partial TP1 + Target TP2)', () => {
    // Risk = 100 - 90 = 10 (1 R = 10)
    // Partial @ 115: +1.5 R * 0.5 = +0.75 R
    // Target 2 @ 130: +3.0 R * 0.5 = +1.50 R
    // Total Gross R = 2.25 R
    const events: LedgerEventRecord[] = [
      { eventType: 'ENTRY', price: 100, timestamp: 1000 },
      { eventType: 'PARTIAL', price: 115, timestamp: 2000 },
      { eventType: 'BREAKEVEN', price: 100, timestamp: 2001 },
      { eventType: 'TARGET2', price: 130, timestamp: 3000 }
    ];

    const outcome = calculateSignalOutcomeR(baseSignal, events, {
      feePct: 0.04,
      slippagePct: 0.02
    });

    expect(outcome.grossR).toBe(2.25);
    expect(outcome.isClosed).toBe(true);
    expect(outcome.outcomeType).toBe('TP2');
    // Net R must be slightly less than gross R due to decimal deducted costs
    expect(outcome.netR).toBeLessThan(2.25);
    expect(outcome.netR).toBeGreaterThan(2.15);
    // Verified decimal computation
    expect(Number.isFinite(outcome.netR)).toBe(true);
  });

  it('calculates gross and net R for TP1 partial followed by Breakeven stop', () => {
    // Risk = 10
    // Partial @ 115: +1.5 R * 0.5 = +0.75 R
    // Stop @ 100: 0 R * 0.5 = 0 R
    // Total Gross R = +0.75 R
    const events: LedgerEventRecord[] = [
      { eventType: 'ENTRY', price: 100, timestamp: 1000 },
      { eventType: 'PARTIAL', price: 115, timestamp: 2000 },
      { eventType: 'BREAKEVEN', price: 100, timestamp: 2001 },
      { eventType: 'STOP', price: 100, timestamp: 2500 }
    ];

    const outcome = calculateSignalOutcomeR(baseSignal, events);

    expect(outcome.grossR).toBe(0.75);
    expect(outcome.isClosed).toBe(true);
    expect(outcome.outcomeType).toBe('BREAKEVEN');
    expect(outcome.netR).toBeLessThan(0.75);
    expect(outcome.netR).toBeGreaterThan(0.65);
  });

  it('calculates exact -1.0 R for direct stop-out on a LONG signal', () => {
    const events: LedgerEventRecord[] = [
      { eventType: 'ENTRY', price: 100, timestamp: 1000 },
      { eventType: 'STOP', price: 90, timestamp: 1500 }
    ];

    const outcome = calculateSignalOutcomeR(baseSignal, events);

    expect(outcome.grossR).toBe(-1.0);
    expect(outcome.isClosed).toBe(true);
    expect(outcome.outcomeType).toBe('STOP');
    // Net R is slightly more negative due to fees/slippage
    expect(outcome.netR).toBeLessThan(-1.0);
  });

  it('calculates correct R for a SHORT trade', () => {
    const shortSignal: LedgerSignalParams = {
      id: 'sig-synth-short',
      symbol: 'ETHUSDT',
      category: 'SCALP',
      direction: 'SHORT',
      entryPrice: 200,
      stopLoss: 220,
      takeProfit1: 170, // 30 down = +1.5 R
      takeProfit2: 140, // 60 down = +3.0 R
      score: 82,
      origin: 'LIVE'
    };

    const events: LedgerEventRecord[] = [
      { eventType: 'ENTRY', price: 200, timestamp: 1000 },
      { eventType: 'PARTIAL', price: 170, timestamp: 2000 },
      { eventType: 'BREAKEVEN', price: 200, timestamp: 2001 },
      { eventType: 'TARGET2', price: 140, timestamp: 3000 }
    ];

    const outcome = calculateSignalOutcomeR(shortSignal, events);

    expect(outcome.grossR).toBe(2.25);
    expect(outcome.isClosed).toBe(true);
    expect(outcome.outcomeType).toBe('TP2');
  });

  it('calculates MFE and MAE in R from candle ranges', () => {
    const candles = [
      { high: 108, low: 97 }, // Favorable: +8 (0.8R), Adverse: -3 (0.3R)
      { high: 118, low: 101 }, // Favorable: +18 (1.8R), Adverse: 0
      { high: 132, low: 114 }  // Favorable: +32 (3.2R), Adverse: 0
    ];

    const { mfeR, maeR } = calculateMfeMaeFromCandles(baseSignal, candles);

    expect(mfeR).toBe(3.2); // (132 - 100) / 10
    expect(maeR).toBe(-0.3); // (97 - 100) / 10 = -0.3
  });
});
