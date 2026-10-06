/**
 * Chart Geometry Core Engine (Phase 12 - SDD/TDD)
 *
 * Implements pure geometric parsing of price series:
 * - Extrapolates alternating ZigZag fractals (Pivots)
 * - Linear regression trendline fitting with R^2 evaluation
 * - Channel geometry analysis (parallelism, convergence, wedge angles)
 */

export interface ChartPivot {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
  timestamp?: number;
}

export interface Trendline {
  slope: number;       // Price change per candle index (m)
  intercept: number;   // Projected price at index 0 (b)
  rSquared: number;    // Goodness of fit (0 to 1)
  pivots: ChartPivot[];
}

export interface TrendlinePair {
  upper: Trendline;
  lower: Trendline;
  isConverging: boolean;
  isParallel: boolean;
  angleSpreadPct: number;
}

/**
 * Extracts true alternating ZigZag pivots (swing highs and swing lows).
 * Eliminates consecutive pivots of the same type by keeping the most extreme point.
 */
export function extractZigZagPivots(
  klines: Array<{ high: number; low: number; close?: number; timestamp?: number }>,
  leftBars: number = 2,
  rightBars: number = 2
): ChartPivot[] {
  if (!Array.isArray(klines) || klines.length < leftBars + rightBars + 1) {
    return [];
  }

  const rawPivots: ChartPivot[] = [];

  for (let i = leftBars; i < klines.length - rightBars; i++) {
    const cur = klines[i];

    // Check High Pivot
    let isHigh = true;
    for (let j = 1; j <= leftBars; j++) {
      if (klines[i - j].high >= cur.high) { isHigh = false; break; }
    }
    if (isHigh) {
      for (let j = 1; j <= rightBars; j++) {
        if (klines[i + j].high > cur.high) { isHigh = false; break; }
      }
    }

    if (isHigh) {
      rawPivots.push({
        index: i,
        price: cur.high,
        type: 'HIGH',
        timestamp: cur.timestamp
      });
    }

    // Check Low Pivot
    let isLow = true;
    for (let j = 1; j <= leftBars; j++) {
      if (klines[i - j].low <= cur.low) { isLow = false; break; }
    }
    if (isLow) {
      for (let j = 1; j <= rightBars; j++) {
        if (klines[i + j].low < cur.low) { isLow = false; break; }
      }
    }

    if (isLow) {
      rawPivots.push({
        index: i,
        price: cur.low,
        type: 'LOW',
        timestamp: cur.timestamp
      });
    }
  }

  // Ensure strict chronological sorting
  rawPivots.sort((a, b) => a.index - b.index);

  // Enforce alternating ZigZag filter: never two highs or two lows consecutively
  const alternating: ChartPivot[] = [];

  for (const p of rawPivots) {
    if (alternating.length === 0) {
      alternating.push(p);
      continue;
    }

    const last = alternating[alternating.length - 1];

    if (last.type === p.type) {
      // Keep the more extreme one
      if (p.type === 'HIGH' && p.price > last.price) {
        alternating[alternating.length - 1] = p;
      } else if (p.type === 'LOW' && p.price < last.price) {
        alternating[alternating.length - 1] = p;
      }
    } else {
      alternating.push(p);
    }
  }

  return alternating;
}

/**
 * Fits a linear regression trendline across two or more pivots.
 */
export function fitTrendline(pivots: ChartPivot[]): Trendline | null {
  if (!Array.isArray(pivots) || pivots.length < 2) {
    return null;
  }

  const n = pivots.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of pivots) {
    sumX += p.index;
    sumY += p.price;
    sumXY += p.index * p.price;
    sumXX += p.index * p.index;
  }

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared (goodness of fit)
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (const p of pivots) {
    const predictedY = slope * p.index + intercept;
    ssTot += Math.pow(p.price - meanY, 2);
    ssRes += Math.pow(p.price - predictedY, 2);
  }

  const rSquared = ssTot === 0 ? 1.0 : Math.max(0, Math.min(1.0, 1 - (ssRes / ssTot)));

  return {
    slope,
    intercept,
    rSquared,
    pivots
  };
}

/**
 * Analyzes the dual-trendline channel geometry formed by upper and lower pivots.
 */
export function analyzeChannelGeometry(
  upperPivots: ChartPivot[],
  lowerPivots: ChartPivot[]
): TrendlinePair | null {
  const upper = fitTrendline(upperPivots);
  const lower = fitTrendline(lowerPivots);

  if (!upper || !lower) {
    return null;
  }

  // Slopes: upper line vs lower line
  const slopeDiff = Math.abs(upper.slope - lower.slope);
  const maxAbsSlope = Math.max(Math.abs(upper.slope), Math.abs(lower.slope), 0.0001);
  const angleSpreadPct = (slopeDiff / maxAbsSlope) * 100;

  // Parallel if relative slope difference <= 18%
  const isParallel = slopeDiff <= 0.15 || angleSpreadPct <= 18;

  // Lines converge if they are moving towards each other as index progresses:
  // e.g., upper slope is negative while lower slope is positive,
  // OR upper slope is more negative than lower slope,
  // OR lower slope is more positive than upper slope.
  // Evaluate distance over the actual observed pivot span
  const minIdx = Math.min(upperPivots[0]?.index ?? 0, lowerPivots[0]?.index ?? 0);
  const maxIdx = Math.max(
    upperPivots[upperPivots.length - 1]?.index ?? 10,
    lowerPivots[lowerPivots.length - 1]?.index ?? 10
  );

  const distanceStart = (upper.slope * minIdx + upper.intercept) - (lower.slope * minIdx + lower.intercept);
  const distanceEnd = (upper.slope * maxIdx + upper.intercept) - (lower.slope * maxIdx + lower.intercept);

  // Lines converge if the vertical gap shrinks across the observed span
  const isConverging = distanceEnd < distanceStart && (upper.slope < lower.slope);

  return {
    upper,
    lower,
    isConverging,
    isParallel,
    angleSpreadPct
  };
}
