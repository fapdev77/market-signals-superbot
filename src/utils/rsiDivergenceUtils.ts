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
  /** `null` quando não há velas suficientes — nunca injetar um RSI neutro fabricado (50). */
  rsiCurrent: number | null;
  rsiPrevSwing: number | null;
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
      rsiCurrent: null,
      rsiPrevSwing: null,
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
 * FASE 0 (C-01): item "sem dados" — RSI não medido e plano com nulos.
 * Nenhum nível direcional é derivado do preço quando não há histórico de velas.
 */
function buildNoDataRsiItem(ticker: TickerData, timeframe: string, price: number): RSIDivergenceItem {
  return {
    id: `${ticker.symbol}_${timeframe}`,
    symbol: ticker.symbol,
    ticker,
    timeframe,
    divergenceType: 'NO_DIVERGENCE',
    bias: 'NEUTRAL',
    confidence: 0,
    rsiCurrent: null,
    rsiPrevSwing: null,
    priceCurrent: price,
    pricePrevSwing: price,
    divergenceSlope: 0,
    status: 'ACTIVE',
    isOverbought: false,
    isOversold: false,
    entryZone: null,
    stopLoss: null,
    target1: null,
    target2: null,
    riskRewardRatio: null,
    confluences: [],
    verdict: 'RSI indisponível: sem histórico de velas suficientes para o cálculo de Wilder. Nenhuma divergência é reportada.',
    detectedAt: Date.now()
  };
}

/**
 * Scans an asset for Regular or Hidden RSI Divergences using real Wilder RSI.
 *
 * FASE 0 (C-01): quando não há velas, o RSI NÃO é estimado. Retornamos
 * `NO_DIVERGENCE` com `rsiCurrent`/`rsiPrevSwing` nulos — a UI exibe
 * "indisponível" em vez de um número sintético rotulado como "RSI (14)".
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

    // FASE 0 (C-01): fronteira explícita — sem RSI de Wilder medido não há
    // como classificar sobrecompra/sobrevenda nem derivar um plano direcional;
    // reusamos a mesma saída de "sem velas" (nada é estimado).
    if (analysis.rsiCurrent == null || analysis.rsiPrevSwing == null) {
      return buildNoDataRsiItem(ticker, timeframe, price);
    }

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
      id: `${ticker.symbol}_${timeframe}`,
      symbol: ticker.symbol,
      ticker,
      timeframe,
      divergenceType: analysis.divergenceType,
      bias: analysis.bias,
      confidence,
      rsiCurrent: analysis.rsiCurrent,
      rsiPrevSwing: analysis.rsiPrevSwing,
      priceCurrent: analysis.priceCurrent,
      pricePrevSwing: analysis.pricePrevSwing,
      divergenceSlope: parseFloat((Math.abs(analysis.rsiCurrent - analysis.rsiPrevSwing) / 10).toFixed(2)),
      status: 'ACTIVE',
      isOverbought: analysis.rsiCurrent >= 70,
      isOversold: analysis.rsiCurrent <= 30,
      entryZone: [parseFloat((price * 0.998).toFixed(4)), parseFloat((price * 1.002).toFixed(4))],
      stopLoss: stopLossPrice,
      target1: targetPrice,
      target2: parseFloat((targetPrice * (analysis.bias === 'BULLISH' ? 1.02 : 0.98)).toFixed(4)),
      riskRewardRatio: riskReward,
      confluences,
      verdict: analysis.verdict,
      detectedAt: Date.now()
    };
  }

  // FASE 0 (C-01): sem velas suficientes não há RSI de Wilder — não estimamos
  // nenhum valor (nem RSI, nem níveis de plano derivados do preço).
  return buildNoDataRsiItem(ticker, timeframe, price);
}

export interface UniverseRSIDivergenceSummary {
  items: Array<RSIDivergenceItem>;
  bullishCount: number;
  bearishCount: number;
  regularCount: number;
  hiddenCount: number;
  totalDivergences: number;
  /** RSI médio de Wilder apenas sobre os ativos efetivamente medidos. `null` se nenhum. */
  avgRSI: number | null;
  /** Quantos ativos tiveram RSI de Wilder medido — a base real do `avgRSI`. */
  rsiMeasuredCount: number;
  marketCondition: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' | 'UNKNOWN';
  topOpportunity: RSIDivergenceItem | null;
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
      regularCount: 0,
      hiddenCount: 0,
      totalDivergences: 0,
      avgRSI: null,
      rsiMeasuredCount: 0,
      marketCondition: 'UNKNOWN',
      topOpportunity: null
    };
  }

  const items: Array<RSIDivergenceItem> = tickers.map(t => scanRSIDivergence(t, timeframe));

  const divergences = items.filter(i => i.divergenceType !== 'NO_DIVERGENCE');
  const regularCount = divergences.filter(i => i.divergenceType === 'REGULAR_BULLISH' || i.divergenceType === 'REGULAR_BEARISH').length;
  const hiddenCount = divergences.filter(i => i.divergenceType === 'HIDDEN_BULLISH' || i.divergenceType === 'HIDDEN_BEARISH').length;
  const bullishCount = divergences.filter(i => i.bias === 'BULLISH').length;
  const bearishCount = divergences.filter(i => i.bias === 'BEARISH').length;

  // FASE 0 (C-01): o RSI médio é calculado SÓ sobre ativos com RSI de Wilder
  // medido. Nenhum valor neutro é injetado para ativos sem histórico — se nada
  // foi medido, o resultado é `null` e a UI mostra "n/d" em vez de um 50 falso.
  const measured = items.filter(i => i.rsiCurrent != null);
  const rsiMeasuredCount = measured.length;
  const totalRSI = measured.reduce((acc, i) => acc + (i.rsiCurrent as number), 0);
  const avgRSI = rsiMeasuredCount > 0 ? Math.round((totalRSI / rsiMeasuredCount) * 10) / 10 : null;
  const marketCondition: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' | 'UNKNOWN' =
    avgRSI == null ? 'UNKNOWN' : avgRSI >= 65 ? 'OVERBOUGHT' : avgRSI <= 35 ? 'OVERSOLD' : 'NEUTRAL';

  const sortedByConfidence = [...divergences].sort((a, b) => b.confidence - a.confidence);
  const topOpportunity = sortedByConfidence[0] || null;

  return {
    items,
    bullishCount,
    bearishCount,
    regularCount,
    hiddenCount,
    totalDivergences: divergences.length,
    avgRSI,
    rsiMeasuredCount,
    marketCondition,
    topOpportunity
  };
}

