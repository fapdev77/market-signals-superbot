import { fitTrendline, ChartPivot, Trendline } from '../chartGeometryCore.js';
import type { KlineCandle } from '../../types.js';

export interface WedgeTriangleMatch {
  type: 'ASCENDING_TRIANGLE' | 'DESCENDING_TRIANGLE' | 'FALLING_WEDGE' | 'RISING_WEDGE';
  upperTrendline: Trendline;
  lowerTrendline: Trendline;
  breakoutTriggerPrice: number;
  measuredMoveTarget: number;
  stopLossPrice: number;
  stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED';
  confidence: number;
}

/**
 * Detects Triangle and Wedge chart formations.
 */
export function detectWedgeAndTrianglePatterns(
  klines: KlineCandle[],
  currentPrice: number
): WedgeTriangleMatch | null {
  if (!Array.isArray(klines) || klines.length < 6) {
    return null;
  }

  // Extract swing highs and lows
  const highPivots: ChartPivot[] = [];
  const lowPivots: ChartPivot[] = [];

  for (let i = 0; i < klines.length; i++) {
    const c = klines[i];
    const prev = klines[i - 1];
    const next = klines[i + 1];

    if ((!prev || c.high >= prev.high) && (!next || c.high >= next.high)) {
      highPivots.push({ index: i, price: c.high, type: 'HIGH' });
    }
    if ((!prev || c.low <= prev.low) && (!next || c.low <= next.low)) {
      lowPivots.push({ index: i, price: c.low, type: 'LOW' });
    }
  }

  if (highPivots.length < 2 || lowPivots.length < 2) {
    return null;
  }

  const upperLine = fitTrendline(highPivots);
  const lowerLine = fitTrendline(lowPivots);

  if (!upperLine || !lowerLine) {
    return null;
  }

  const upperSlope = upperLine.slope;
  const lowerSlope = lowerLine.slope;
  const len = klines.length;

  const baseHeight = Math.abs(highPivots[0].price - lowPivots[0].price);

  // 1. ASCENDING TRIANGLE: Flat horizontal resistance & ascending higher lows
  const isUpperFlat = Math.abs(upperSlope) <= 0.25;
  const isLowerAscending = lowerSlope >= 0.20;

  if (isUpperFlat && isLowerAscending) {
    const resistancePrice = parseFloat((upperLine.intercept + upperSlope * len).toFixed(4));
    const target = parseFloat((resistancePrice + baseHeight * 0.85).toFixed(4));
    const lastLow = lowPivots.length > 0 ? lowPivots[lowPivots.length - 1].price : resistancePrice * 0.97;
    const lineStop = (lowerLine.intercept + lowerSlope * (len - 1)) * 0.99;
    const stop = parseFloat(Math.min(lastLow * 0.995, lineStop, currentPrice * 0.985).toFixed(4));

    let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
    if (currentPrice >= resistancePrice) stage = 'CONFIRMED';
    else if (currentPrice >= resistancePrice * 0.99) stage = 'READY_BREAKOUT';

    return {
      type: 'ASCENDING_TRIANGLE',
      upperTrendline: upperLine,
      lowerTrendline: lowerLine,
      breakoutTriggerPrice: resistancePrice,
      measuredMoveTarget: target,
      stopLossPrice: stop,
      stage,
      confidence: 76
    };
  }

  // 2. DESCENDING TRIANGLE: Flat horizontal support & descending lower highs
  const isLowerFlat = Math.abs(lowerSlope) <= 0.25;
  const isUpperDescending = upperSlope <= -0.20;

  if (isLowerFlat && isUpperDescending) {
    const supportPrice = parseFloat((lowerLine.intercept + lowerSlope * len).toFixed(4));
    const target = parseFloat((supportPrice - baseHeight * 0.85).toFixed(4));
    const lastHigh = highPivots.length > 0 ? highPivots[highPivots.length - 1].price : supportPrice * 1.03;
    const lineStop = (upperLine.intercept + upperSlope * (len - 1)) * 1.01;
    const stop = parseFloat(Math.max(lastHigh * 1.005, lineStop, currentPrice * 1.015).toFixed(4));

    let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
    if (currentPrice <= supportPrice) stage = 'CONFIRMED';
    else if (currentPrice <= supportPrice * 1.01) stage = 'READY_BREAKOUT';

    return {
      type: 'DESCENDING_TRIANGLE',
      upperTrendline: upperLine,
      lowerTrendline: lowerLine,
      breakoutTriggerPrice: supportPrice,
      measuredMoveTarget: target,
      stopLossPrice: stop,
      stage,
      confidence: 76
    };
  }

  // 3. FALLING WEDGE: Both lines falling, but upper line falls faster than lower line (converging downward)
  if (upperSlope < -0.30 && lowerSlope < 0 && upperSlope < lowerSlope) {
    const trigger = parseFloat((upperLine.intercept + upperSlope * len).toFixed(4));
    const target = parseFloat((highPivots[0].price).toFixed(4));
    const lastLow = lowPivots.length > 0 ? Math.min(...lowPivots.map(p => p.price)) : currentPrice * 0.97;
    const lineStop = (lowerLine.intercept + lowerSlope * (len - 1)) * 0.99;
    const stop = parseFloat(Math.min(lastLow * 0.992, lineStop, currentPrice * 0.98).toFixed(4));

    let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
    if (currentPrice >= trigger) stage = 'CONFIRMED';
    else if (currentPrice >= trigger * 0.99) stage = 'READY_BREAKOUT';

    return {
      type: 'FALLING_WEDGE',
      upperTrendline: upperLine,
      lowerTrendline: lowerLine,
      breakoutTriggerPrice: trigger,
      measuredMoveTarget: target,
      stopLossPrice: stop,
      stage,
      confidence: 78
    };
  }

  // 4. RISING WEDGE: Both lines rising, but lower line rises faster than upper line (converging upward)
  if (lowerSlope > 0.30 && upperSlope > 0 && lowerSlope > upperSlope) {
    const trigger = parseFloat((lowerLine.intercept + lowerSlope * len).toFixed(4));
    const target = parseFloat((lowPivots[0].price).toFixed(4));
    const lastHigh = highPivots.length > 0 ? Math.max(...highPivots.map(p => p.price)) : currentPrice * 1.03;
    const lineStop = (upperLine.intercept + upperSlope * (len - 1)) * 1.01;
    const stop = parseFloat(Math.max(lastHigh * 1.008, lineStop, currentPrice * 1.02).toFixed(4));

    let stage: 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' = 'FORMING';
    if (currentPrice <= trigger) stage = 'CONFIRMED';
    else if (currentPrice <= trigger * 1.01) stage = 'READY_BREAKOUT';

    return {
      type: 'RISING_WEDGE',
      upperTrendline: upperLine,
      lowerTrendline: lowerLine,
      breakoutTriggerPrice: trigger,
      measuredMoveTarget: target,
      stopLossPrice: stop,
      stage,
      confidence: 78
    };
  }

  return null;
}
