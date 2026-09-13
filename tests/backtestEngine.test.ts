import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { IndicatorWeights, BacktestConfig } from '../src/types.js';

describe('Backtest Simulation & Quantitative Engine Suite', () => {
  const sampleWeights: IndicatorWeights = {
    volumeSurgeWeight: 20,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 15,
    fibonacciZoneWeight: 15,
    rangePocWeight: 10,
    supportResistanceWeight: 10,
    volumeProfileRange: 20,
    minRiskRewardRatio: 2.5
  };

  it('runs quantitative backtest on BTCUSDT and returns structured performance metrics', async () => {
    const config: BacktestConfig = {
      symbol: 'BTCUSDT',
      days: 7,
      profile: 'daytrade',
      weights: sampleWeights
    };

    const result = await BacktestEngine.runBacktest(config, false);

    expect(result).toBeDefined();
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.profile).toBe('daytrade');
    expect(typeof result.winRate).toBe('number');
    expect(typeof result.profitFactor).toBe('number');
    expect(typeof result.netProfit).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);

    // Diagnostic validation
    expect(result.diagnostic).toBeDefined();
    expect(Array.isArray(result.diagnostic.strengths)).toBe(true);
    expect(Array.isArray(result.diagnostic.weaknesses)).toBe(true);
    expect(Array.isArray(result.diagnostic.weightAnalysis)).toBe(true);
    expect(Array.isArray(result.diagnostic.suggestions)).toBe(true);
  }, 20000);

  it('properly adapts execution parameters when switching to scalp profile', async () => {
    const config: BacktestConfig = {
      symbol: 'ETHUSDT',
      days: 3,
      profile: 'scalp',
      weights: sampleWeights
    };

    const result = await BacktestEngine.runBacktest(config, false);

    expect(result).toBeDefined();
    expect(result.profile).toBe('scalp');
    expect(result.symbol).toBe('ETHUSDT');
    expect(result.equityCurve.length).toBeGreaterThan(0);
  }, 20000);
});
