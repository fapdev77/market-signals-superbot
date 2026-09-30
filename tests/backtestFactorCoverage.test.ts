import { describe, it, expect } from 'vitest';
import { calculateFactorCoverage } from '../server/services/factorCoverage.js';

describe('M2.2 & CA-2.2: Historical Factor Coverage & ReducedFactorSet in Backtest', () => {
  it('returns reducedFactorSet: true when OI or Long/Short history is missing or partial', () => {
    const totalCandles = 100;
    const factorStats = {
      totalCandles,
      candlesWithOi: 0,
      candlesWithFunding: 100,
      candlesWithLongShort: 0
    };

    const coverage = calculateFactorCoverage(factorStats);

    expect(coverage.reducedFactorSet).toBe(true);
    expect(coverage.factorCoverage.openInterest).toBe(0);
    expect(coverage.factorCoverage.funding).toBe(100);
    expect(coverage.factorCoverage.longShort).toBe(0);
    expect(coverage.missingFactors).toContain('openInterest');
    expect(coverage.missingFactors).toContain('longShort');
  });

  it('returns reducedFactorSet: false when all factors have 100% historical coverage', () => {
    const totalCandles = 200;
    const factorStats = {
      totalCandles,
      candlesWithOi: 200,
      candlesWithFunding: 200,
      candlesWithLongShort: 200
    };

    const coverage = calculateFactorCoverage(factorStats);

    expect(coverage.reducedFactorSet).toBe(false);
    expect(coverage.factorCoverage.openInterest).toBe(100);
    expect(coverage.factorCoverage.funding).toBe(100);
    expect(coverage.factorCoverage.longShort).toBe(100);
    expect(coverage.missingFactors.length).toBe(0);
  });
});
