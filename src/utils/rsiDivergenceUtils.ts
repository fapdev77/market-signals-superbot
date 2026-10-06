import { TickerData, RSIDivergenceItem, RSIDivergenceType, KlineCandle } from '../types.js';
import { calculateWilderRSI } from './wilderRsi.js';

/**
 * Calculates theoretical risk-to-reward ratio.
 */
function calculateRiskReward(currentPrice: number, target: number, stopLoss: number): number {
  const potentialGain = Math.abs(target - currentPrice);
  const potentialLoss = Math.abs(currentPrice - stopLoss);
  if (potentialLoss <= 0.000001) return 2.0;
  const rr = potentialGain / potentialLoss;
  return parseFloat(Math.min(9.9, Math.max(0.5, rr)).toFixed(2));
}

export interface PricePivot {
  index: number;
  price: number;
  rsi: number;
  type: 'HIGH' | 'LOW';
  timestamp?: number;
}

export interface RSIDivergenceAnalysis {
  divergenceType: RSIDivergenceType;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  rsiCurrent: number;
  rsiPrevSwing: number;
  priceCurrent: number;
  pricePrevSwing: number;
  verdict: string;
  confluences: string[];
}

/**
 * Identifies local price and RSI pivots (swing highs and lows) across historical candles.
 */
export function findMarketPivots(
  highs: number[],
  lows: number[],
  rsiSeries: number[],
  leftBars: number = 2,
  rightBars: number = 2,
  rsiOffset: number = 0
): PricePivot[] {
  const pivots: PricePivot[] = [];
  const len = Math.min(highs.length, lows.length);

  for (let i = leftBars; i < len - rightBars; i++) {
    const rsiIdx = i - rsiOffset;
    if (rsiIdx < 0 || rsiIdx >= rsiSeries.length) continue;

    const currentHigh = highs[i];
    const currentLow = lows[i];

    // Check High Pivot (swing high)
    let isHigh = true;
    for (let j = 1; j <= leftBars; j++) {
      if (highs[i - j] >= currentHigh) { isHigh = false; break; }
    }
    if (isHigh) {
      for (let j = 1; j <= rightBars; j++) {
        if (highs[i + j] > currentHigh) { isHigh = false; break; }
      }
    }

    if (isHigh) {
      pivots.push({
        index: i,
        price: currentHigh,
        rsi: rsiSeries[rsiIdx],
        type: 'HIGH'
      });
    }

    // Check Low Pivot (swing low)
    let isLow = true;
    for (let j = 1; j <= leftBars; j++) {
      if (lows[i - j] <= currentLow) { isLow = false; break; }
    }
    if (isLow) {
      for (let j = 1; j <= rightBars; j++) {
        if (lows[i + j] < currentLow) { isLow = false; break; }
      }
    }

    if (isLow) {
      pivots.push({
        index: i,
        price: currentLow,
        rsi: rsiSeries[rsiIdx],
        type: 'LOW'
      });
    }
  }

  return pivots;
}

/**
 * Detects real RSI Divergences directly from candle series using Wilder's RSI (14)
 * and fractal swing pivot recognition.
 */
export function detectRSIDivergencesFromKlines(
  klines: Array<{ high: number; low: number; close: number; timestamp?: number }>,
  period: number = 14
): RSIDivergenceAnalysis {
  if (!Array.isArray(klines) || klines.length < period + 1) {
    return {
      divergenceType: 'NO_DIVERGENCE',
      bias: 'NEUTRAL',
      confidence: 50,
      rsiCurrent: 50,
      rsiPrevSwing: 50,
      priceCurrent: klines?.[klines.length - 1]?.close ?? 0,
      pricePrevSwing: klines?.[klines.length - 1]?.close ?? 0,
      verdict: 'Dados insuficientes para cálculo de RSI de Wilder.',
      confluences: []
    };
  }

  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);

  const rsiResult = calculateWilderRSI(closes, period);
  if (!rsiResult.isValid || rsiResult.rsiSeries.length < 2) {
    return {
      divergenceType: 'NO_DIVERGENCE',
      bias: 'NEUTRAL',
      confidence: 50,
      rsiCurrent: rsiResult.currentRsi,
      rsiPrevSwing: rsiResult.currentRsi,
      priceCurrent: closes[closes.length - 1],
      pricePrevSwing: closes[closes.length - 1],
      verdict: 'Série de RSI em formação.',
      confluences: []
    };
  }

  const currentRsi = rsiResult.currentRsi;
  const currentPrice = closes[closes.length - 1];

  // Search pivots where Wilder RSI is genuinely calculated (offset by `period`)
  const pivots = findMarketPivots(highs, lows, rsiResult.rsiSeries, 2, 2, period);

  let divergenceType: RSIDivergenceType = 'NO_DIVERGENCE';
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;
  const confluences: string[] = [];
  let verdict = 'Sem divergência de momentum significativa no momento.';
  let prevSwingPrice = currentPrice;
  let prevSwingRsi = currentRsi;

  const lowPivots = pivots.filter(p => p.type === 'LOW');
  const highPivots = pivots.filter(p => p.type === 'HIGH');

  // Case 1: Regular Bullish Divergence (Price Lower Low or equal, RSI Higher Low)
  if (lowPivots.length > 0) {
    const lastLowPivot = lowPivots[lowPivots.length - 1];
    prevSwingPrice = lastLowPivot.price;
    prevSwingRsi = lastLowPivot.rsi;

    // Price testing/making lower low while RSI is printing a higher low
    const priceMadeLowerLow = currentPrice <= lastLowPivot.price * 1.005;
    const rsiMadeHigherLow = currentRsi > lastLowPivot.rsi && lastLowPivot.rsi <= 45;

    if (priceMadeLowerLow && rsiMadeHigherLow) {
      divergenceType = 'REGULAR_BULLISH';
      bias = 'BULLISH';
      confidence = 72;
      verdict = `Divergência Altista Regular: Preço testando fundo ($${currentPrice.toFixed(2)} <= $${lastLowPivot.price.toFixed(2)}) com RSI ascendente (${currentRsi.toFixed(1)} > ${lastLowPivot.rsi.toFixed(1)}) indicando exaustão vendedora.`;
      confluences.push(`Fundo ascendente no RSI (14) de Wilder [${lastLowPivot.rsi.toFixed(1)} -> ${currentRsi.toFixed(1)}].`);
    }
  }

  // Case 2: Regular Bearish Divergence (Price Higher High or equal, RSI Lower High)
  if (divergenceType === 'NO_DIVERGENCE' && highPivots.length > 0) {
    const lastHighPivot = highPivots[highPivots.length - 1];
    prevSwingPrice = lastHighPivot.price;
    prevSwingRsi = lastHighPivot.rsi;

    const priceMadeHigherHigh = currentPrice >= lastHighPivot.price * 0.995;
    const rsiMadeLowerHigh = currentRsi < lastHighPivot.rsi && lastHighPivot.rsi >= 55;

    if (priceMadeHigherHigh && rsiMadeLowerHigh) {
      divergenceType = 'REGULAR_BEARISH';
      bias = 'BEARISH';
      confidence = 74;
      verdict = `Divergência Baixista Regular: Preço renovando topo ($${currentPrice.toFixed(2)} >= $${lastHighPivot.price.toFixed(2)}) com RSI descendente (${currentRsi.toFixed(1)} < ${lastHighPivot.rsi.toFixed(1)}) indicando exaustão compradora.`;
      confluences.push(`Topo descendente no RSI (14) de Wilder [${lastHighPivot.rsi.toFixed(1)} -> ${currentRsi.toFixed(1)}].`);
    }
  }

  // Case 3: Hidden Bullish (Price Higher Low, RSI Lower Low in uptrend)
  if (divergenceType === 'NO_DIVERGENCE' && lowPivots.length > 0) {
    const lastLowPivot = lowPivots[lowPivots.length - 1];
    if (currentPrice > lastLowPivot.price * 1.005 && currentRsi < lastLowPivot.rsi && currentRsi <= 45) {
      divergenceType = 'HIDDEN_BULLISH';
      bias = 'BULLISH';
      confidence = 68;
      prevSwingPrice = lastLowPivot.price;
      prevSwingRsi = lastLowPivot.rsi;
      verdict = 'Divergência Altista Oculta: Preço sustentando fundo ascendente com recuo profundo de momentum (Continuação de Tendência).';
      confluences.push('RSI de Wilder aliviado sem perda da estrutura de suporte de preço.');
    }
  }

  // Case 4: Hidden Bearish (Price Lower High, RSI Higher High in downtrend)
  if (divergenceType === 'NO_DIVERGENCE' && highPivots.length > 0) {
    const lastHighPivot = highPivots[highPivots.length - 1];
    if (currentPrice < lastHighPivot.price * 0.995 && currentRsi > lastHighPivot.rsi && currentRsi >= 55) {
      divergenceType = 'HIDDEN_BEARISH';
      bias = 'BEARISH';
      confidence = 68;
      prevSwingPrice = lastHighPivot.price;
      prevSwingRsi = lastHighPivot.rsi;
      verdict = 'Divergência Baixista Oculta: Preço formando topo descendente com repique excessivo de RSI (Continuação de Queda).';
      confluences.push('RSI de Wilder aquecido em repique corretivo.');
    }
  }

  return {
    divergenceType,
    bias,
    confidence,
    rsiCurrent: currentRsi,
    rsiPrevSwing: prevSwingRsi,
    priceCurrent: currentPrice,
    pricePrevSwing: prevSwingPrice,
    verdict,
    confluences
  };
}

/**
 * Fallback estimation only when klines are completely absent
 */
export function estimateRSI(ticker: TickerData, timeframe: string = '1h'): { current: number; prevSwing: number } {
  const changePct = ticker.priceChangePercent24h || 0;
  const devPct = ticker.ma24hDeviationPct || (changePct * 0.4);
  const cvdDir = ticker.cvdDirection;
  const inGP = ticker.fibonacci?.inGoldenPocket;

  let tfMultiplier = 1.0;
  if (timeframe === '15m') tfMultiplier = 1.25;
  if (timeframe === '4h') tfMultiplier = 0.85;
  if (timeframe === '1D') tfMultiplier = 0.70;

  let rawRsi = 50 + (changePct * 2.8 * tfMultiplier) + (devPct * 1.5);
  if (cvdDir === 'BUY') rawRsi += 3.5;
  if (cvdDir === 'SELL') rawRsi -= 3.5;
  if (inGP && changePct < 0) rawRsi -= 4;
  if (inGP && changePct > 0) rawRsi += 4;

  const currentRsi = Math.max(8, Math.min(92, Math.round(rawRsi * 10) / 10));

  let prevSwingRsi = 50;
  if (currentRsi >= 65) {
    prevSwingRsi = Math.min(95, currentRsi + (changePct > 2 ? 8 : -6));
  } else if (currentRsi <= 35) {
    prevSwingRsi = Math.max(5, currentRsi + (changePct < -2 ? -8 : 7));
  } else {
    prevSwingRsi = Math.max(10, Math.min(90, 50 - (changePct * 1.2)));
  }

  return { current: currentRsi, prevSwing: Math.round(prevSwingRsi * 10) / 10 };
}

/**
 * Scans an asset for Regular or Hidden RSI Divergences using real Wilder RSI
 * when klines are supplied, or fallback estimation when klines are absent.
 */
export function scanRSIDivergence(
  ticker: TickerData,
  timeframe: string = '1h',
  klines?: KlineCandle[]
): RSIDivergenceItem {
  const price = ticker.price || 1;
  const fib = ticker.fibonacci;
  const key = ticker.keyLevels;
  const cvd = ticker.cvdDirection;
  const trapped = ticker.trappedTraders;

  // Prefer canonical Wilder RSI from real candlestick history
  if (Array.isArray(klines) && klines.length >= 15) {
    const analysis = detectRSIDivergencesFromKlines(klines, 14);

    let confidence = analysis.confidence;
    const confluences = [...analysis.confluences];

    if (analysis.divergenceType === 'REGULAR_BULLISH') {
      if (fib?.inGoldenPocket) {
        confidence += 10;
        confluences.push('Confluência direta com Golden Pocket de Fibonacci (0.618 - 0.68).');
      }
      if (cvd === 'BUY' || trapped?.status === 'TRAPPED_SHORTS') {
        confidence += 10;
        confluences.push('Absorção passiva detectada no Order Flow (Trapped Shorts).');
      }
      if (key?.support1 && price <= key.support1 * 1.01) {
        confidence += 6;
        confluences.push(`Defesa no suporte $${key.support1}.`);
      }
    } else if (analysis.divergenceType === 'REGULAR_BEARISH') {
      if (trapped?.status === 'TRAPPED_LONGS') {
        confidence += 10;
        confluences.push('Traders presos no topo (Trapped Longs) sob risco de flush.');
      }
      if (cvd === 'SELL') {
        confidence += 8;
        confluences.push('Delta CVD negativo com agressões vendedoras.');
      }
      if (key?.resistance1 && price >= key.resistance1 * 0.99) {
        confidence += 6;
        confluences.push(`Rejeição próxima à resistência $${key.resistance1}.`);
      }
    }

    confidence = Math.min(98, confidence);

    const targetPrice = analysis.bias === 'BULLISH'
      ? (key?.resistance1 || price * 1.035)
      : (key?.support1 || price * 0.965);
    const stopLossPrice = analysis.bias === 'BULLISH'
      ? (key?.support1 ? key.support1 * 0.992 : price * 0.985)
      : (key?.resistance1 ? key.resistance1 * 1.008 : price * 1.015);

    const riskReward = calculateRiskReward(price, targetPrice, stopLossPrice);

    return {
      symbol: ticker.symbol,
      timeframe,
      divergenceType: analysis.divergenceType,
      bias: analysis.bias,
      confidence,
      rsiCurrent: analysis.rsiCurrent,
      rsiPrevSwing: analysis.rsiPrevSwing,
      priceCurrent: analysis.priceCurrent,
      pricePrevSwing: analysis.pricePrevSwing,
      suggestedEntry: price,
      targetPrice,
      stopLossPrice,
      riskRewardRatio: riskReward,
      verdict: analysis.verdict,
      confluenceFactors: confluences,
      updatedAt: Date.now()
    };
  }

  // Fallback path when klines are not provided
  const { current: rsiCurrent, prevSwing: rsiPrevSwing } = estimateRSI(ticker, timeframe);
  const changePct = ticker.priceChangePercent24h || 0;
  const swingH = fib?.swingHigh || ticker.high24h || price * 1.04;
  const swingL = fib?.swingLow || ticker.low24h || price * 0.96;

  let divergenceType: RSIDivergenceType = 'NO_DIVERGENCE';
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;
  const confluences: string[] = [];
  let verdict = 'Sem divergência de momentum significativa no momento.';

  let priceCurrent = price;
  let pricePrevSwing = price;

  const isNearSupportOrGP = (price <= (fib?.fib618 || swingL * 1.02)) || (key?.support1 && price <= key.support1 * 1.015);
  if ((isNearSupportOrGP || changePct < -0.8) && rsiCurrent > rsiPrevSwing && rsiPrevSwing <= 38) {
    divergenceType = 'REGULAR_BULLISH';
    bias = 'BULLISH';
    pricePrevSwing = swingL * 1.01;
    confidence = 72;
    verdict = 'Divergência Altista Regular: Preço testando fundo enquanto o RSI forma fundo ascendente (Exaustão Vendedora).';
    confluences.push('Fundo ascendente no RSI (14) em zona de sobrevenda.');
  } else if ((price >= (fib?.fib236 || swingH * 0.985) || changePct > 0.8) && rsiCurrent < rsiPrevSwing && rsiPrevSwing >= 62) {
    divergenceType = 'REGULAR_BEARISH';
    bias = 'BEARISH';
    pricePrevSwing = swingH * 0.99;
    confidence = 74;
    verdict = 'Divergência Baixista Regular: Preço renovando topo sem confirmação de momentum no RSI (Exaustão Compradora).';
    confluences.push('Topo descendente no RSI (14) em região de sobrecompra.');
  }

  const targetPrice = bias === 'BULLISH' ? (key?.resistance1 || price * 1.03) : (key?.support1 || price * 0.97);
  const stopLossPrice = bias === 'BULLISH' ? (key?.support1 ? key.support1 * 0.99 : price * 0.985) : (key?.resistance1 ? key.resistance1 * 1.01 : price * 1.015);

  return {
    symbol: ticker.symbol,
    timeframe,
    divergenceType,
    bias,
    confidence,
    rsiCurrent,
    rsiPrevSwing,
    priceCurrent,
    pricePrevSwing,
    suggestedEntry: price,
    targetPrice,
    stopLossPrice,
    riskRewardRatio: calculateRiskReward(price, targetPrice, stopLossPrice),
    verdict,
    confluenceFactors: confluences,
    updatedAt: Date.now()
  };
}

export interface UniverseRSIDivergenceSummary {
  items: Array<RSIDivergenceItem & { id?: string }>;
  bullishCount: number;
  bearishCount: number;
  totalDivergences: number;
  topOpportunity: (RSIDivergenceItem & { id?: string }) | null;
}

/**
 * Scans a list of tickers across the market universe for RSI divergences.
 */
export function scanUniverseRSIDivergences(
  tickers: TickerData[],
  timeframe: string = '1h'
): UniverseRSIDivergenceSummary {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return {
      items: [],
      bullishCount: 0,
      bearishCount: 0,
      totalDivergences: 0,
      topOpportunity: null
    };
  }

  const items: Array<RSIDivergenceItem & { id?: string }> = tickers.map(t => {
    const div = scanRSIDivergence(t, timeframe);
    return {
      ...div,
      id: `${t.symbol}_${timeframe}`
    };
  });

  const divergences = items.filter(i => i.divergenceType !== 'NO_DIVERGENCE');
  const bullishCount = divergences.filter(i => i.bias === 'BULLISH').length;
  const bearishCount = divergences.filter(i => i.bias === 'BEARISH').length;

  const sortedByConfidence = [...divergences].sort((a, b) => b.confidence - a.confidence);
  const topOpportunity = sortedByConfidence[0] || null;

  return {
    items,
    bullishCount,
    bearishCount,
    totalDivergences: divergences.length,
    topOpportunity
  };
}

