import { describe, it, expect } from 'vitest';
import {
  calculateFitnessExpectancy,
  calculateBootstrapConfidenceInterval,
  evaluateAutoTuneHoldout
} from '../server/services/autoTuneOptimizer.js';

describe('M2.6, CA-2.5 & CA-2.6: Auto-Tune Net Expectancy, Holdout & Robustness', () => {
  it('calculates net expectancy fitness with drawdown and minimum trade penalty', () => {
    // 50 trades in training, avg net profit 1.5% per trade, max drawdown 4%
    const robustFitness = calculateFitnessExpectancy({
      totalTrades: 50,
      netProfitPct: 75,
      maxDrawdownPct: 4,
      trades: Array(50).fill({ pnlPct: 1.5 }),
      minRequiredTrades: 30
    });

    expect(robustFitness).toBeGreaterThan(0);

    // Insufficient trades (< 30) receives heavy penalty
    const fewTradesFitness = calculateFitnessExpectancy({
      totalTrades: 10,
      netProfitPct: 20,
      maxDrawdownPct: 3,
      trades: Array(10).fill({ pnlPct: 2.0 }),
      minRequiredTrades: 30
    });

    expect(fewTradesFitness).toBeLessThan(robustFitness);
  });

  it('calculates 95% bootstrap confidence interval of expectancy', () => {
    // Trades with positive mean
    const trades = [1.2, 2.5, -0.8, 1.4, 0.5, 3.1, -1.0, 1.8, 0.9, 2.2, 1.5, -0.5, 1.0, 2.0, 0.8];
    const ci = calculateBootstrapConfidenceInterval(trades, 500, 42);

    expect(ci.mean).toBeGreaterThan(0);
    expect(ci.lowerBound).toBeLessThan(ci.mean);
    expect(ci.upperBound).toBeGreaterThan(ci.mean);
  });

  it('marks isRobust: false if holdout lower bound CI is <= 0 or negative', () => {
    // Holdout trades with negative/inconsistent returns
    const holdoutTrades = [-1.5, -0.8, 0.2, -1.1, -0.5, 0.4, -2.0, 0.1, -0.9, -1.2];
    const evaluation = evaluateAutoTuneHoldout({
      holdoutTrades,
      trialsCount: 20,
      seed: 42
    });

    expect(evaluation.isRobust).toBe(false);
    expect(evaluation.confidenceInterval.lowerBound).toBeLessThanOrEqual(0);
    expect(evaluation.trialsCount).toBe(20);
  });

  it('preserves deterministic candidate evaluation with identical seed', () => {
    const holdoutTrades = [1.5, 2.0, 1.2, 0.8, 2.5, 1.1, 1.9, 0.9, 1.4, 2.1, 1.8, 1.3, 1.6, 2.2, 1.7];
    const eval1 = evaluateAutoTuneHoldout({ holdoutTrades, trialsCount: 20, seed: 123 });
    const eval2 = evaluateAutoTuneHoldout({ holdoutTrades, trialsCount: 20, seed: 123 });

    expect(eval1.confidenceInterval.mean).toBe(eval2.confidenceInterval.mean);
    expect(eval1.confidenceInterval.lowerBound).toBe(eval2.confidenceInterval.lowerBound);
    expect(eval1.confidenceInterval.upperBound).toBe(eval2.confidenceInterval.upperBound);
    expect(eval1.isRobust).toBe(true);
  });
});
