import { extractZigZagPivots, ChartPivot } from '../chartGeometryCore.js';
import type { KlineCandle } from '../../types.js';

export interface DoublePatternMatch {
  type: 'DOUBLE_BOTTOM' | 'DOUBLE_TOP';
  point1: ChartPivot;
  neckline: ChartPivot;
  point2: ChartPivot;
  necklinePrice: number;
  heightPct: number;
  measuredMoveTarget: number;
  stopLossPrice: number;
  stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED';
  confidence: number;
}

/**
 * Detects Double Bottom (W) and Double Top (M) geometric formations from candlestick series.
 */
export function detectDoublePatterns(
  klines: KlineCandle[],
  currentPrice: number
): DoublePatternMatch | null {
  if (!Array.isArray(klines) || klines.length < 15) {
    return null;
  }

  const pivots = extractZigZagPivots(klines, 2, 2);
  if (pivots.length < 3) {
    return null;
  }

  // Iterate over alternating triplets: (P1, Neckline, P2)
  for (let i = pivots.length - 1; i >= 2; i--) {
    const p2 = pivots[i];
    const neck = pivots[i - 1];
    const p1 = pivots[i - 2];

    // 1. Check DOUBLE BOTTOM: L1 -> H1 -> L2
    if (p1.type === 'LOW' && neck.type === 'HIGH' && p2.type === 'LOW') {
      const separationBars = p2.index - p1.index;
      if (separationBars >= 4 && separationBars <= 45) {
        const lowestPoint = Math.min(p1.price, p2.price);
        const symmetryDiffPct = Math.abs(p2.price - p1.price) / lowestPoint;

        // Symmetry threshold: within 2.0%
        if (symmetryDiffPct <= 0.02) {
          const patternHeight = neck.price - lowestPoint;
          const heightPct = (patternHeight / lowestPoint) * 100;

          // Height threshold: at least 1.5% amplitude between trough and neckline
          if (heightPct >= 1.5) {
            const measuredMoveTarget = parseFloat((neck.price + patternHeight).toFixed(4));
            const stopLossPrice = parseFloat((lowestPoint * 0.99).toFixed(4));

            let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
            if (currentPrice >= neck.price * 1.002) {
              stage = 'CONFIRMED';
            } else if (currentPrice >= neck.price * 0.985) {
              stage = 'READY_BREAKOUT';
            }

            const confidence = Math.min(95, Math.round(72 + (1 - symmetryDiffPct * 20) * 10));

            return {
              type: 'DOUBLE_BOTTOM',
              point1: p1,
              neckline: neck,
              point2: p2,
              necklinePrice: neck.price,
              heightPct: parseFloat(heightPct.toFixed(2)),
              measuredMoveTarget,
              stopLossPrice,
              stage,
              confidence
            };
          }
        }
      }
    }

    // 2. Check DOUBLE TOP: H1 -> L1 -> H2
    if (p1.type === 'HIGH' && neck.type === 'LOW' && p2.type === 'HIGH') {
      const separationBars = p2.index - p1.index;
      if (separationBars >= 4 && separationBars <= 45) {
        const highestPoint = Math.max(p1.price, p2.price);
        const symmetryDiffPct = Math.abs(p2.price - p1.price) / highestPoint;

        if (symmetryDiffPct <= 0.02) {
          const patternHeight = highestPoint - neck.price;
          const heightPct = (patternHeight / highestPoint) * 100;

          if (heightPct >= 1.5) {
            const measuredMoveTarget = parseFloat((neck.price - patternHeight).toFixed(4));
            const stopLossPrice = parseFloat((highestPoint * 1.01).toFixed(4));

            let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
            if (currentPrice <= neck.price * 0.998) {
              stage = 'CONFIRMED';
            } else if (currentPrice <= neck.price * 1.015) {
              stage = 'READY_BREAKOUT';
            }

            const confidence = Math.min(95, Math.round(72 + (1 - symmetryDiffPct * 20) * 10));

            return {
              type: 'DOUBLE_TOP',
              point1: p1,
              neckline: neck,
              point2: p2,
              necklinePrice: neck.price,
              heightPct: parseFloat(heightPct.toFixed(2)),
              measuredMoveTarget,
              stopLossPrice,
              stage,
              confidence
            };
          }
        }
      }
    }
  }

  return null;
}
