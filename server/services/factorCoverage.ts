/**
 * Factor Coverage Calculator (M2.2 - Phase 5)
 *
 * Computes coverage % of historical factors (OI, Funding, Long/Short)
 * across the tested kline dataset.
 * Returns reducedFactorSet: true when any factor has < 100% coverage.
 */

export interface FactorStatsInput {
  totalCandles: number;
  candlesWithOi: number;
  candlesWithFunding: number;
  candlesWithLongShort: number;
}

export interface FactorCoverageResult {
  reducedFactorSet: boolean;
  factorCoverage: {
    openInterest: number;
    funding: number;
    longShort: number;
  };
  missingFactors: string[];
}

export function calculateFactorCoverage(stats: FactorStatsInput): FactorCoverageResult {
  const { totalCandles, candlesWithOi, candlesWithFunding, candlesWithLongShort } = stats;

  const total = Math.max(1, totalCandles);
  const oiPct = Math.min(100, Math.round((candlesWithOi / total) * 100));
  const fundingPct = Math.min(100, Math.round((candlesWithFunding / total) * 100));
  const lsPct = Math.min(100, Math.round((candlesWithLongShort / total) * 100));

  const missing: string[] = [];
  if (oiPct < 100) missing.push('openInterest');
  if (fundingPct < 100) missing.push('funding');
  if (lsPct < 100) missing.push('longShort');

  const reducedFactorSet = missing.length > 0;

  return {
    reducedFactorSet,
    factorCoverage: {
      openInterest: oiPct,
      funding: fundingPct,
      longShort: lsPct
    },
    missingFactors: missing
  };
}
