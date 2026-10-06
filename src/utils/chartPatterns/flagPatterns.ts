import { fitTrendline, ChartPivot, Trendline } from '../chartGeometryCore.js';
import type { KlineCandle } from '../../types.js';

export interface FlagPatternMatch {
  type: 'BULL_FLAG' | 'BEAR_FLAG';
  poleStart: ChartPivot;
  poleEnd: ChartPivot;
  poleHeightPct: number;
  flagUpperLine: Trendline;
  flagLowerLine: Trendline;
  breakoutTriggerPrice: number;
  measuredMoveTarget: number;
  stopLossPrice: number;
  stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED';
  confidence: number;
}

/**
 * Detects Bull Flag and Bear Flag geometric formations.
 */
export function detectFlagPatterns(
  klines: KlineCandle[],
  currentPrice: number
): FlagPatternMatch | null {
  if (!Array.isArray(klines) || klines.length < 15) {
    return null;
  }

  const len = klines.length;
  let bestBull: FlagPatternMatch | null = null;
  let bestBear: FlagPatternMatch | null = null;

  // 1. Check Bull Flag
  for (let poleEndIdx = Math.min(len - 6, 20); poleEndIdx >= 4; poleEndIdx--) {
    const poleEndCandle = klines[poleEndIdx];
    const poleHigh = poleEndCandle.high;

    let minLow = Infinity;
    let minLowIdx = 0;
    for (let j = Math.max(0, poleEndIdx - 10); j <= poleEndIdx - 2; j++) {
      if (klines[j].low < minLow) {
        minLow = klines[j].low;
        minLowIdx = j;
      }
    }

    const poleHeight = poleHigh - minLow;
    const poleHeightPct = (poleHeight / minLow) * 100;

    if (poleHeightPct >= 3.0 && poleEndIdx - minLowIdx >= 2) {
      const flagCandles = klines.slice(poleEndIdx);
      const flagHighs = flagCandles.map((c, i) => ({ index: poleEndIdx + i, price: c.high, type: 'HIGH' as const }));
      const flagLows = flagCandles.map((c, i) => ({ index: poleEndIdx + i, price: c.low, type: 'LOW' as const }));

      const flagMinLow = Math.min(...flagCandles.map(c => c.low));
      const retracement = poleHigh - flagMinLow;
      const retracementRatio = retracement / poleHeight;

      if (retracementRatio <= 0.65 && retracementRatio >= 0.05) {
        const upperLine = fitTrendline(flagHighs);
        const lowerLine = fitTrendline(flagLows);

        if (upperLine && lowerLine && upperLine.slope <= 0.05) {
          const breakoutTrigger = parseFloat((upperLine.slope * len + upperLine.intercept).toFixed(4));
          const measuredMoveTarget = parseFloat((currentPrice + poleHeight * 0.90).toFixed(4));
          const stopLossPrice = parseFloat((flagMinLow * 0.992).toFixed(4));

          let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
          if (currentPrice >= breakoutTrigger) {
            stage = 'CONFIRMED';
          } else if (currentPrice >= breakoutTrigger * 0.99) {
            stage = 'READY_BREAKOUT';
          }

          const confidence = Math.min(94, Math.round(70 + (1 - retracementRatio) * 20));

          const candidate: FlagPatternMatch = {
            type: 'BULL_FLAG',
            poleStart: { index: minLowIdx, price: minLow, type: 'LOW' },
            poleEnd: { index: poleEndIdx, price: poleHigh, type: 'HIGH' },
            poleHeightPct: parseFloat(poleHeightPct.toFixed(2)),
            flagUpperLine: upperLine,
            flagLowerLine: lowerLine,
            breakoutTriggerPrice: breakoutTrigger,
            measuredMoveTarget,
            stopLossPrice,
            stage,
            confidence
          };

          if (!bestBull || candidate.poleHeightPct > bestBull.poleHeightPct) {
            bestBull = candidate;
          }
        }
      }
    }
  }

  // 2. Check Bear Flag
  for (let poleEndIdx = Math.min(len - 6, 20); poleEndIdx >= 4; poleEndIdx--) {
    const poleEndCandle = klines[poleEndIdx];
    const poleLow = poleEndCandle.low;

    let maxHigh = -Infinity;
    let maxHighIdx = 0;
    for (let j = Math.max(0, poleEndIdx - 10); j <= poleEndIdx - 2; j++) {
      if (klines[j].high > maxHigh) {
        maxHigh = klines[j].high;
        maxHighIdx = j;
      }
    }

    const poleHeight = maxHigh - poleLow;
    const poleHeightPct = (poleHeight / maxHigh) * 100;

    if (poleHeightPct >= 3.0 && poleEndIdx - maxHighIdx >= 2) {
      const flagCandles = klines.slice(poleEndIdx);
      const flagHighs = flagCandles.map((c, i) => ({ index: poleEndIdx + i, price: c.high, type: 'HIGH' as const }));
      const flagLows = flagCandles.map((c, i) => ({ index: poleEndIdx + i, price: c.low, type: 'LOW' as const }));

      const flagMaxHigh = Math.max(...flagCandles.map(c => c.high));
      const retracement = flagMaxHigh - poleLow;
      const retracementRatio = retracement / poleHeight;

      if (retracementRatio <= 0.65 && retracementRatio >= 0.05) {
        const upperLine = fitTrendline(flagHighs);
        const lowerLine = fitTrendline(flagLows);

        if (upperLine && lowerLine && lowerLine.slope >= -0.05) {
          const breakoutTrigger = parseFloat((lowerLine.slope * len + lowerLine.intercept).toFixed(4));
          const measuredMoveTarget = parseFloat((currentPrice - poleHeight * 0.90).toFixed(4));
          const stopLossPrice = parseFloat((flagMaxHigh * 1.008).toFixed(4));

          let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
          if (currentPrice <= breakoutTrigger) {
            stage = 'CONFIRMED';
          } else if (currentPrice <= breakoutTrigger * 1.01) {
            stage = 'READY_BREAKOUT';
          }

          const confidence = Math.min(94, Math.round(70 + (1 - retracementRatio) * 20));

          const candidate: FlagPatternMatch = {
            type: 'BEAR_FLAG',
            poleStart: { index: maxHighIdx, price: maxHigh, type: 'HIGH' },
            poleEnd: { index: poleEndIdx, price: poleLow, type: 'LOW' },
            poleHeightPct: parseFloat(poleHeightPct.toFixed(2)),
            flagUpperLine: upperLine,
            flagLowerLine: lowerLine,
            breakoutTriggerPrice: breakoutTrigger,
            measuredMoveTarget,
            stopLossPrice,
            stage,
            confidence
          };

          if (!bestBear || candidate.poleHeightPct > bestBear.poleHeightPct) {
            bestBear = candidate;
          }
        }
      }
    }
  }

  // Select dominant flag pattern by pole magnitude
  if (bestBull && bestBear) {
    return bestBull.poleHeightPct >= bestBear.poleHeightPct ? bestBull : bestBear;
  }

  return bestBull || bestBear || null;
}
