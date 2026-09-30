/**
 * Auto-Tune Optimizer with Holdout & Bootstrap Confidence Interval (M2.6 - Phase 5)
 *
 * Implements:
 * 1. Net expectancy fitness function with drawdown and trade count penalty.
 * 2. 95% Bootstrap Confidence Interval for holdout expectation.
 * 3. 3-way split: Training (search), Validation (candidate selection), Holdout (untouched test).
 * 4. `isRobust` certification requiring lower bound CI > 0.
 */

export interface FitnessParams {
  totalTrades: number;
  netProfitPct: number;
  maxDrawdownPct: number;
  trades: Array<{ pnlPct: number }>;
  minRequiredTrades?: number;
}

export function calculateFitnessExpectancy(params: FitnessParams): number {
  const { totalTrades, maxDrawdownPct, trades, minRequiredTrades = 30 } = params;

  if (totalTrades === 0 || trades.length === 0) return 0;

  // Average net return per trade
  const totalReturn = trades.reduce((acc, t) => acc + (t.pnlPct || 0), 0);
  const avgExpectancy = totalReturn / totalTrades;

  // Penalty for insufficient trade count
  const tradePenaltyFactor = totalTrades < minRequiredTrades
    ? Math.max(0.1, totalTrades / minRequiredTrades)
    : 1.0;

  // Drawdown penalty: penalize drawdowns above 5%
  const ddPenalty = Math.max(0, maxDrawdownPct - 5) * 0.5;

  const rawScore = (avgExpectancy * 10 - ddPenalty) * tradePenaltyFactor;

  return Math.max(0, parseFloat(rawScore.toFixed(4)));
}

export interface BootstrapCIResult {
  mean: number;
  lowerBound: number;
  upperBound: number;
  samples: number;
}

/**
 * Deterministic Mulberry32 PRNG for reproducible bootstrap resampling
 */
function createBootstrapPRNG(seed: number = 42) {
  let s = Math.floor(seed) || 42;
  return function() {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function calculateBootstrapConfidenceInterval(
  returns: number[],
  resamples: number = 1000,
  seed: number = 42
): BootstrapCIResult {
  if (returns.length === 0) {
    return { mean: 0, lowerBound: 0, upperBound: 0, samples: 0 };
  }

  const n = returns.length;
  const originalMean = returns.reduce((a, b) => a + b, 0) / n;
  const rng = createBootstrapPRNG(seed);

  const sampleMeans: number[] = [];

  for (let i = 0; i < resamples; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rng() * n);
      sum += returns[idx];
    }
    sampleMeans.push(sum / n);
  }

  sampleMeans.sort((a, b) => a - b);

  // 95% Confidence Interval (2.5th and 97.5th percentiles)
  const lowerIdx = Math.floor(resamples * 0.025);
  const upperIdx = Math.floor(resamples * 0.975);

  return {
    mean: parseFloat(originalMean.toFixed(4)),
    lowerBound: parseFloat(sampleMeans[lowerIdx].toFixed(4)),
    upperBound: parseFloat(sampleMeans[upperIdx].toFixed(4)),
    samples: resamples
  };
}

export interface EvaluateHoldoutParams {
  holdoutTrades: number[];
  trialsCount: number;
  seed?: number;
}

export interface HoldoutEvaluationResult {
  isRobust: boolean;
  confidenceInterval: BootstrapCIResult;
  trialsCount: number;
}

export function evaluateAutoTuneHoldout(params: EvaluateHoldoutParams): HoldoutEvaluationResult {
  const { holdoutTrades, trialsCount, seed = 42 } = params;
  const ci = calculateBootstrapConfidenceInterval(holdoutTrades, 1000, seed);

  // isRobust requires:
  // 1. Lower bound of 95% CI on holdout > 0 (statistically significant positive expectancy)
  // 2. Minimum number of holdout trades (e.g. >= 10)
  const isRobust = ci.lowerBound > 0 && holdoutTrades.length >= 10;

  return {
    isRobust,
    confidenceInterval: ci,
    trialsCount
  };
}
