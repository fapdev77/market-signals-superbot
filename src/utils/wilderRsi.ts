/**
 * Wilder's RSI (Relative Strength Index) Engine
 *
 * Implements J. Welles Wilder's canonical 14-period RSI algorithm (1978)
 * using true exponential smoothing on chronological candlestick close series.
 */

export interface RsiCalculationResult {
  /** Current RSI value of the most recent closed candle, bounded in [0, 100] */
  currentRsi: number;
  /** Full chronological series of calculated RSI points */
  rsiSeries: number[];
  /** Smoothed average gain */
  avgGain: number;
  /** Smoothed average loss */
  avgLoss: number;
  /** True when candle count >= period + 1 */
  isValid: boolean;
}

/**
 * Calculates Wilder's smoothed Relative Strength Index.
 *
 * @param closes Chronological array of closing prices (oldest -> newest)
 * @param period Lookback window (default: 14)
 */
export function calculateWilderRSI(
  closes: number[],
  period: number = 14
): RsiCalculationResult {
  if (!Array.isArray(closes) || closes.length < period + 1) {
    return {
      currentRsi: 50,
      rsiSeries: [],
      avgGain: 0,
      avgLoss: 0,
      isValid: false
    };
  }

  // 1. Calculate price changes (deltas)
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (typeof prev === 'number' && typeof curr === 'number' && !isNaN(prev) && !isNaN(curr)) {
      deltas.push(curr - prev);
    } else {
      deltas.push(0);
    }
  }

  if (deltas.length < period) {
    return {
      currentRsi: 50,
      rsiSeries: [],
      avgGain: 0,
      avgLoss: 0,
      isValid: false
    };
  }

  // 2. Initial averages (simple average over first `period` changes)
  let initialGainSum = 0;
  let initialLossSum = 0;

  for (let i = 0; i < period; i++) {
    const diff = deltas[i];
    if (diff > 0) {
      initialGainSum += diff;
    } else {
      initialLossSum += Math.abs(diff);
    }
  }

  let avgGain = initialGainSum / period;
  let avgLoss = initialLossSum / period;

  const rsiSeries: number[] = [];

  function computeRsiValue(gain: number, loss: number): number {
    if (loss === 0) {
      return gain === 0 ? 50 : 100;
    }
    if (gain === 0) {
      return 0;
    }
    const rs = gain / loss;
    const rsi = 100 - (100 / (1 + rs));
    return parseFloat(Math.max(0, Math.min(100, rsi)).toFixed(2));
  }

  // First RSI point at index = period (corresponding to closes[period])
  const firstRsi = computeRsiValue(avgGain, avgLoss);
  rsiSeries.push(firstRsi);

  // 3. Wilder's Smoothed Moving Average for subsequent candles
  for (let i = period; i < deltas.length; i++) {
    const diff = deltas[i];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = computeRsiValue(avgGain, avgLoss);
    rsiSeries.push(rsi);
  }

  const currentRsi = rsiSeries[rsiSeries.length - 1];

  return {
    currentRsi,
    rsiSeries,
    avgGain,
    avgLoss,
    isValid: true
  };
}
