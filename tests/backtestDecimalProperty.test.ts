import { describe, it, expect, beforeAll } from 'vitest';
import { BacktestEngine, resolveBacktestPosition } from '../server/services/BacktestEngine.js';
import { dAdd, dSub, dMul, dDiv, dRound } from '../server/utils/decimal.js';
import { IndicatorWeights, BacktestConfig, BacktestTrade } from '../src/types.js';
import { seedBacktestKlines, alignedNow } from './helpers/backtestSeed.js';

/**
 * 7.6.3 / CA-6.3 — a aritmética de PnL e custos do `BacktestEngine` usa decimal.
 * Propriedade: o PnL total de uma resolução iguala EXATAMENTE a soma decimal das
 * suas pernas, e o líquido fecha exato antes das taxas/funding — inclusive em
 * valores que quebram IEEE-754.
 */

const longPos = {
  direction: 'LONG' as const,
  entryPrice: 0.1,
  entryTime: 0,
  stopLoss: 0.04,
  target1: 0.16,
  target2: 0.22,
  openedThisCandle: false
};

const slipPct = 0.1;

describe('7.6.3 / CA-6.3 — propriedade decimal do PnL do backtest', () => {
  it('o grossPnlPct de uma resolução iguala a soma decimal das pernas', () => {
    // Candle que toca TP1 e TP2 juntos: duas pernas (parcial + runner).
    const res = resolveBacktestPosition(
      { high: 0.23, low: 0.09, close: 0.22, timestamp: 1000 },
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    )!;
    expect(res.exitLegs.length).toBe(2);

    const legSum = res.exitLegs.reduce((acc, leg) => {
      const diff = longPos.direction === 'LONG'
        ? dSub(leg.price, longPos.entryPrice)
        : dSub(longPos.entryPrice, leg.price);
      const legPct = dMul(dDiv(dMul(diff, 100), longPos.entryPrice), leg.size);
      return dAdd(acc, legPct);
    }, 0);

    expect(res.grossPnlPct).toBe(legSum);
  });

  it('o líquido (bruto − taxas − funding) fecha exato em decimal', () => {
    const res = resolveBacktestPosition(
      { high: 0.04, low: 0.04, close: 0.04, timestamp: 1000 },
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    )!;
    expect(res.hasClosedFull).toBe(true);

    const roundtripFee = 0.08; // 0.04% por lado, default do engine
    const closedSize = res.exitLegs.reduce((a, l) => a + l.size, 0);
    const fundingCostPct = 0.0123;

    const net = dSub(dSub(res.grossPnlPct, dMul(roundtripFee, closedSize)), fundingCostPct);
    // gross = -60.04 (LONG, stop 0.04 com slippage 0.1%) → -60.04 - 0.08 - 0.0123 = -60.1323 exato.
    expect(res.grossPnlPct).toBe(-60.04);
    expect(net).toBe(-60.1323);
  });

  it('integração: netProfit é finito, determinístico e composto em decimal', async () => {
    await seedBacktestKlines(['BTCUSDT'], 7);
    const base: BacktestConfig = {
      symbol: 'BTCUSDT',
      days: 5,
      profile: 'daytrade',
      weights: {
        volumeSurgeWeight: 20, openInterestWeight: 20, fundingRateWeight: 10,
        cvdImbalanceWeight: 15, fibonacciZoneWeight: 15, rangePocWeight: 10,
        supportResistanceWeight: 10, volumeProfileRange: 20, minRiskRewardRatio: 2.5
      } as IndicatorWeights,
      seed: 7,
      asOf: alignedNow(),
      entryConfirmation: true
    };

    const a = await BacktestEngine.runBacktest(base, false);
    const b = await BacktestEngine.runBacktest(base, false);

    expect(Number.isFinite(a.netProfit)).toBe(true);
    expect(a.netProfit).toBe(b.netProfit);
    expect(a.totalTrades).toBe(b.totalTrades);

    for (const t of (a.trades || []) as BacktestTrade[]) {
      expect(Number.isFinite(t.pnlPct)).toBe(true);
      expect(Number.isFinite(t.pnlValue)).toBe(true);
    }
  }, 60000);
});
