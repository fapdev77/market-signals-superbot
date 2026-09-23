import { TickerData, TradeSignal, IndicatorWeights, KlineCandle, StrategyCategory } from '../src/types.js';
import { calculateVolumeProfile, calculateFibonacci, detectFVG } from './binanceService.js';

export function normalizePricePrecision(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  if (abs >= 1000) return parseFloat(value.toFixed(2));
  if (abs >= 50) return parseFloat(value.toFixed(3));
  if (abs >= 1) return parseFloat(value.toFixed(4));
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return parseFloat(value.toFixed(decimals));
}

export function formatPriceString(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  const abs = Math.abs(value);
  if (abs === 0) return '0.00';
  if (abs >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 50) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return value.toFixed(decimals);
}

export function processTickerState(
  rawTicker: any,
  klines: KlineCandle[],
  openInterest: number,
  fundingRate: number,
  weights: IndicatorWeights
): TickerData {
  const symbol = rawTicker.symbol || 'BTCUSDT';
  const price = parseFloat(rawTicker.lastPrice || rawTicker.price || '90000');
  const priceChangePercent24h = parseFloat(rawTicker.priceChangePercent || '0');
  const high24h = parseFloat(rawTicker.highPrice || normalizePricePrecision(price * 1.02));
  const low24h = parseFloat(rawTicker.lowPrice || normalizePricePrecision(price * 0.98));
  const volume24h = parseFloat(rawTicker.volume || '10000');
  const quoteVolume24h = parseFloat(rawTicker.quoteVolume || (volume24h * price).toFixed(0));

  // Compute 24h Moving Average (from available klines or estimate from 24h high, low, open, close)
  let ma24h = price;
  if (klines && klines.length > 0) {
    const sumCloses = klines.reduce((acc, k) => acc + (k.close || price), 0);
    ma24h = sumCloses / klines.length;
  } else {
    // If no klines yet, synthesize from 24h open and price range
    const open24h = price / (1 + (priceChangePercent24h / 100));
    ma24h = (open24h + high24h + low24h + price) / 4;
  }
  const ma24hDeviationPct = ma24h > 0 ? Number((((price - ma24h) / ma24h) * 100).toFixed(2)) : 0;

  // Compute Volume Profile (Passo 6: default 50 bins/linhas de preço)
  const rawProfile = calculateVolumeProfile(klines, weights.volumeProfileRange || 50);
  const inValueArea = price >= rawProfile.val && price <= rawProfile.vah;
  const rangeProfile = {
    vah: rawProfile.vah,
    val: rawProfile.val,
    poc: rawProfile.poc,
    inValueArea
  };

  // Compute Fibonacci (0.5, 0.618, 0.68)
  const fibonacci = calculateFibonacci(klines, price);

  // Compute CVD (Cumulative Volume Delta) & Short-term Delta
  let totalBuyVol = 0;
  let totalSellVol = 0;
  let recentBuyVol = 0;
  let recentSellVol = 0;
  const recentCount = Math.min(5, klines.length);
  klines.forEach((c, idx) => {
    totalBuyVol += c.takerBuyVolume;
    totalSellVol += Math.max(0, c.volume - c.takerBuyVolume);
    if (idx >= klines.length - recentCount) {
      recentBuyVol += c.takerBuyVolume;
      recentSellVol += Math.max(0, c.volume - c.takerBuyVolume);
    }
  });
  const cvd = (totalBuyVol - totalSellVol) * price;
  const cvdDelta = (recentBuyVol - recentSellVol) * price;
  const totalRecentVol = (recentBuyVol + recentSellVol) || 1;
  const cvdDeltaPercent = Number((((recentBuyVol - recentSellVol) / totalRecentVol) * 100).toFixed(2));
  const takerBuyRatio = totalBuyVol / (totalBuyVol + totalSellVol || 1);
  const cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL' =
    takerBuyRatio > 0.53 ? 'BUY' : takerBuyRatio < 0.47 ? 'SELL' : 'NEUTRAL';

  // Open Interest % estimation / change
  const openInterestChange24h = priceChangePercent24h * 0.8 + (takerBuyRatio - 0.5) * 10;
  const openInterestChange1h = (takerBuyRatio - 0.5) * 6;

  // Single Prints & FVG
  const fvg = detectFVG(klines);

  // Support & Resistance
  const support1 = Math.min(rangeProfile.val, fibonacci.fib618);
  const support2 = fibonacci.swingLow;
  const resistance1 = Math.max(rangeProfile.vah, fibonacci.fib50);
  const resistance2 = fibonacci.swingHigh;

  // Structure Break Check
  let structureBreak: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
  if (klines.length >= 2) {
    const lastCandle = klines[klines.length - 1];
    const prevCandle = klines[klines.length - 2];
    if (lastCandle.close > prevCandle.high && takerBuyRatio > 0.54) {
      structureBreak = 'BULLISH';
    } else if (lastCandle.close < prevCandle.low && takerBuyRatio < 0.46) {
      structureBreak = 'BEARISH';
    }
  }

  // --- CONFLUENCE SCORE EVALUATION ---
  let bullishPoints = 0;
  let bearishPoints = 0;
  const confluenceFactors: string[] = [];

  // 1. Golden Pocket Fib (0.618 - 0.68)
  if (fibonacci.inGoldenPocket) {
    if (price < (fibonacci.swingHigh + fibonacci.swingLow) / 2) {
      bullishPoints += weights.fibonacciZoneWeight;
      confluenceFactors.push('Golden Pocket (0.618 - 0.68 Fib) Support Re-test');
    } else {
      bearishPoints += weights.fibonacciZoneWeight;
      confluenceFactors.push('Golden Pocket (0.618 - 0.68 Fib) Resistance Re-test');
    }
  }

  // 2. Open Interest + Price Relationship
  if (openInterestChange1h > 1.5) {
    if (priceChangePercent24h > 0) {
      bullishPoints += weights.openInterestWeight;
      confluenceFactors.push('Open Interest Accumulation (+OI & Price Up)');
    } else {
      bearishPoints += weights.openInterestWeight;
      confluenceFactors.push('Short Building (+OI & Price Down)');
    }
  }

  // 3. CVD Imbalance & Short-term Delta
  if (cvdDirection === 'BUY') {
    const boost = cvdDeltaPercent > 10 ? 1.2 : 1.0;
    bullishPoints += weights.cvdImbalanceWeight * boost;
    confluenceFactors.push(`Strong CVD Net Buyer Flow (${(takerBuyRatio * 100).toFixed(1)}% Taker Buy · Delta Recente ${cvdDeltaPercent > 0 ? '+' : ''}${cvdDeltaPercent}%)`);
  } else if (cvdDirection === 'SELL') {
    const boost = cvdDeltaPercent < -10 ? 1.2 : 1.0;
    bearishPoints += weights.cvdImbalanceWeight * boost;
    confluenceFactors.push(`Aggressive CVD Market Selling (${((1 - takerBuyRatio) * 100).toFixed(1)}% Taker Sell · Delta Recente ${cvdDeltaPercent}%)`);
  }

  // 4. Volume Profile Range (VAL / VAH / POC)
  const distPoc = Math.abs(price - rangeProfile.poc) / price;
  if (distPoc < 0.005) {
    confluenceFactors.push('Price at POC (Point of Control) High Volume Node');
    if (cvdDirection === 'BUY') bullishPoints += weights.rangePocWeight;
    else bearishPoints += weights.rangePocWeight;
  }
  if (price <= rangeProfile.val * 1.003 && price >= rangeProfile.val * 0.995) {
    bullishPoints += weights.rangePocWeight * 1.2;
    confluenceFactors.push('Reclaiming Range Low (VAL) - Liquidity Sweep');
  }
  if (price >= rangeProfile.vah * 0.997 && price <= rangeProfile.vah * 1.005) {
    bearishPoints += weights.rangePocWeight * 1.2;
    confluenceFactors.push('Rejection at Range High (VAH) Resistance');
  }

  // 5. Funding Rate Crowd Positioning (Análise do Comportamento do Funding Rate)
  const fundingRateDaily = fundingRate * 3;
  const annualFunding = fundingRate * 3 * 365 * 100;
  let fundingStatus: 'EXTREME_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'EXTREME_NEGATIVE' = 'NEUTRAL';
  let fundingPressure: any = 'NEUTRO / EQUILIBRADO';
  let fundingBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let fundingDesc = 'Funding rate em equilíbrio normal (' + (fundingRateDaily * 100).toFixed(3) + '%/dia). Sem pressões alavancadas em extremos.';

  if (fundingRate > 0.0004) {
    fundingStatus = 'EXTREME_POSITIVE';
    fundingPressure = 'PRESSÃO COMPRADORA EXTREMA (RISCO LONG FLUSH)';
    fundingBias = 'SELL';
    fundingDesc = `Alavancagem compradora superaquecida (+${(fundingRateDaily * 100).toFixed(2)}%/dia · ${annualFunding.toFixed(1)}% APR). Risco elevado de liquidações em cascata de longs (pressão vendedora exaustiva).`;
    bearishPoints += weights.fundingRateWeight * 1.5;
    confluenceFactors.push(`Funding Fee Muito Positivo (+${(fundingRateDaily * 100).toFixed(3)}%/dia · ${annualFunding.toFixed(1)}% APR) - Pressão Compradora Excessiva / Risco Long Flush`);
  } else if (fundingRate > 0.00015) {
    fundingStatus = 'POSITIVE';
    fundingPressure = 'PRESSÃO COMPRADORA MODERADA';
    fundingBias = 'SELL';
    fundingDesc = `Taxa de funding positiva (+${(fundingRateDaily * 100).toFixed(2)}%/dia). Longs pagando shorts, sugerindo otimismo e possível resistência compradora.`;
    bearishPoints += weights.fundingRateWeight * 0.8;
    confluenceFactors.push(`Funding Fee Positivo (+${(fundingRateDaily * 100).toFixed(3)}%/dia) - Longs Pagando Shorts / Atenção à Exaustão`);
  } else if (fundingRate < -0.0003) {
    fundingStatus = 'EXTREME_NEGATIVE';
    fundingPressure = 'PRESSÃO VENDEDORA EXTREMA (POTENCIAL SHORT SQUEEZE)';
    fundingBias = 'BUY';
    fundingDesc = `Agressão vendedora exaustiva e shorts alavancados (${(fundingRateDaily * 100).toFixed(2)}%/dia · ${annualFunding.toFixed(1)}% APR). Forte potencial para short squeeze e reversão altista rápida.`;
    bullishPoints += weights.fundingRateWeight * 1.5;
    confluenceFactors.push(`Funding Fee Muito Negativo (${(fundingRateDaily * 100).toFixed(3)}%/dia · ${annualFunding.toFixed(1)}% APR) - Pressão Vendedora Exaustiva / Potencial Short Squeeze`);
  } else if (fundingRate < -0.0001) {
    fundingStatus = 'NEGATIVE';
    fundingPressure = 'PRESSÃO VENDEDORA MODERADA';
    fundingBias = 'BUY';
    fundingDesc = `Taxa de funding negativa (${(fundingRateDaily * 100).toFixed(2)}%/dia). Shorts pagando longs, indicando pessimismo do varejo e suporte de compra reversa.`;
    bullishPoints += weights.fundingRateWeight * 0.8;
    confluenceFactors.push(`Funding Fee Negativo (${(fundingRateDaily * 100).toFixed(3)}%/dia) - Shorts Pagando Longs / Viés de Suporte`);
  }

  const fundingRateAnalysis = {
    status: fundingStatus,
    pressure: fundingPressure,
    bias: fundingBias,
    description: fundingDesc
  };

  // 6. Structure Break & FVG
  if (structureBreak === 'BULLISH') {
    bullishPoints += weights.supportResistanceWeight;
    confluenceFactors.push('Market Structure Break (BOS) Bullish Candle');
  } else if (structureBreak === 'BEARISH') {
    bearishPoints += weights.supportResistanceWeight;
    confluenceFactors.push('Market Structure Break (BOS) Bearish Candle');
  }

  if (fvg.hasSinglePrintFVG && fvg.fvgZone) {
    if (fvg.fvgZone.type === 'BULLISH') {
      bullishPoints += 10;
      confluenceFactors.push(`Bullish Fair Value Gap (FVG) at ${formatPriceString(fvg.fvgZone.bottom)} - ${formatPriceString(fvg.fvgZone.top)}`);
    } else {
      bearishPoints += 10;
      confluenceFactors.push(`Bearish Fair Value Gap (FVG) at ${formatPriceString(fvg.fvgZone.bottom)} - ${formatPriceString(fvg.fvgZone.top)}`);
    }
  }

  // Determine Signal Type & Confluence Score
  const netScore = bullishPoints - bearishPoints;
  const confluenceScore = Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25));

  let signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT' = 'NEUTRAL';
  let signalReason = 'Consolidating in range. Awaiting directional volume breakout.';

  if (netScore >= 35) {
    signalType = netScore >= 55 ? 'STRONG_LONG' : 'LONG';
    signalReason = `High Bullish Confluence (${confluenceScore}%): Golden Pocket / CVD Buyer Surge / OI Accumulation.`;
  } else if (netScore <= -35) {
    signalType = netScore <= -55 ? 'STRONG_SHORT' : 'SHORT';
    signalReason = `High Bearish Confluence (${confluenceScore}%): Resistance Rejection / CVD Selling / Overheated Longs.`;
  }

  const baseAsset = symbol.replace(/USDT|USD|BUSD/, '');
  const quoteAsset = symbol.includes('USDT') ? 'USDT' : 'USD';

  return {
    symbol,
    baseAsset,
    quoteAsset,
    name: `${baseAsset} Perpetual`,
    marketType: 'crypto_futures',
    price,
    priceChangePercent24h,
    high24h,
    low24h,
    volume24h,
    quoteVolume24h,
    ma24h,
    ma24hDeviationPct,
    openInterest,
    openInterestChange24h,
    openInterestChange1h,
    fundingRate,
    fundingRateDaily,
    fundingRateAnnualized: annualFunding,
    fundingRateAnalysis,
    cvd,
    cvdDelta,
    cvdDeltaPercent,
    cvdDirection,
    takerBuyRatio,
    fibonacci,
    rangeProfile,
    keyLevels: {
      support1,
      support2,
      resistance1,
      resistance2,
      structureBreak,
      hasSinglePrintFVG: fvg.hasSinglePrintFVG,
      fvgZone: fvg.fvgZone
    },
    confluenceScore,
    signalType,
    signalReason,
    confluenceFactors,
    updatedAt: Date.now()
  };
}

/**
 * Builds an actionable TradeSignal object with Risk/Reward parameters
 * and performs 1m & 5m Multi-Timeframe Validation to prevent false spike entries.
 */
export function buildTradeSignal(
  ticker: TickerData,
  klines: KlineCandle[] = [],
  minRiskRewardRatio: number = 2.5,
  strategyCategory: StrategyCategory = 'INTRADAY',
  customTimeframe?: string
): TradeSignal | null {
  if (ticker.signalType === 'NEUTRAL' || ticker.confluenceScore < 50) {
    return null;
  }

  const isLong = ticker.signalType.includes('LONG');
  const price = ticker.price;

  // Entry zone calculation
  const entrySpread = price * 0.003;
  const entryMin = isLong ? price - entrySpread : price;
  const entryMax = isLong ? price : price + entrySpread;

  // Stop loss distance scaled by strategy category
  let slPct = 0.015;
  let tf = customTimeframe || '30m';
  let categoryPrefix = 'INTRA';

  switch (strategyCategory) {
    case 'SCALP':
      slPct = 0.008; // 0.8% stop mais curto para micro scalp
      tf = customTimeframe || '5m';
      categoryPrefix = 'SCALP';
      break;
    case 'DAY_TRADE':
      slPct = 0.012; // 1.2% para Day Trade
      tf = customTimeframe || '15m';
      categoryPrefix = 'DAY';
      break;
    case 'INTRADAY':
      slPct = 0.015; // 1.5% para Intraday
      tf = customTimeframe || '30m';
      categoryPrefix = 'INTRA';
      break;
    case 'SWING':
      slPct = 0.025; // 2.5% para Swing Trade
      tf = customTimeframe || '1h / 4h';
      categoryPrefix = 'SWING';
      break;
    case 'POSITION':
      slPct = 0.040; // 4.0% para Position Trade
      tf = customTimeframe || '4h / 1d';
      categoryPrefix = 'POS';
      break;
    case 'CUSTOM':
      slPct = 0.015;
      tf = customTimeframe || '15m';
      categoryPrefix = 'CUST';
      break;
  }

  const slDist = price * slPct;
  const stopLoss = isLong ? Math.min(ticker.keyLevels.support1, price - slDist) : Math.max(ticker.keyLevels.resistance1, price + slDist);

  // Targets based on natural R:R constraints
  const riskAmount = Math.abs(price - stopLoss) || (price * slPct);
  
  // Natural targets based on market structure
  let target1 = isLong ? ticker.keyLevels.resistance1 : ticker.keyLevels.support1;
  let target2 = isLong ? ticker.keyLevels.resistance2 : ticker.keyLevels.support2;

  // Sanity check to ensure targets are in the correct direction
  if (isLong) {
    if (target1 <= price + riskAmount) target1 = price + riskAmount * 1.5;
    if (target2 <= target1) target2 = target1 + riskAmount * 1.5;
  } else {
    if (target1 >= price - riskAmount) target1 = price - riskAmount * 1.5;
    if (target2 >= target1) target2 = target1 - riskAmount * 1.5;
  }

  const riskRewardRatio = parseFloat((Math.abs(target2 - price) / riskAmount).toFixed(2));

  // If the natural ratio doesn't meet the minimum configured requirement, reject it entirely.
  if (riskRewardRatio < minRiskRewardRatio) {
    return null;
  }

  // --- 1m & 5m MULTI-TIMEFRAME VALIDATION ENGINE ---
  let candle1mConfirmed = false;
  let candle5mConfirmed = false;
  let spikeDetected = false;
  let validationStatus: 'PENDING_VALIDATION' | 'CONFIRMED' | 'REJECTED_SPIKE' = 'PENDING_VALIDATION';
  let validationStage = 'Aguardando validação de 1m...';
  let rejectionReason: string | undefined = undefined;

  if (klines.length >= 5) {
    const lastCandle = klines[klines.length - 1];
    const prev5Candles = klines.slice(-5);
    const open5m = prev5Candles[0].open;
    const close5m = lastCandle.close;

    // 1m Candle Wick Analysis for Spikes
    const candle1mRange = Math.abs(lastCandle.high - lastCandle.low) || 1;
    const body1m = Math.abs(lastCandle.close - lastCandle.open);
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

    // Spike Rejection Check: Upper wick > 55% of candle range on LONG = fake spike rejection
    if (isLong && upperWick / candle1mRange > 0.55 && body1m < upperWick) {
      spikeDetected = true;
      rejectionReason = 'Rejeição de topo no 1m (pavio superior > 55% da vela - Spike falso)';
    } else if (!isLong && lowerWick / candle1mRange > 0.55 && body1m < lowerWick) {
      spikeDetected = true;
      rejectionReason = 'Rejeição de fundo no 1m (pavio inferior > 55% da vela - Dump falso)';
    }

    // 1m Directional Confirmation
    if (isLong && lastCandle.close >= lastCandle.open && ticker.takerBuyRatio >= 0.49) {
      candle1mConfirmed = true;
    } else if (!isLong && lastCandle.close <= lastCandle.open && ticker.takerBuyRatio <= 0.51) {
      candle1mConfirmed = true;
    }

    // 5m Multi-Candle Trend Continuity Confirmation
    const is5mLongTrend = close5m > open5m;
    const is5mShortTrend = close5m < open5m;

    if (isLong && is5mLongTrend) {
      candle5mConfirmed = true;
    } else if (!isLong && is5mShortTrend) {
      candle5mConfirmed = true;
    }

    // Determine Final Validation State
    if (spikeDetected) {
      validationStatus = 'REJECTED_SPIKE';
      validationStage = `REJEITADO: ${rejectionReason}`;
    } else if (candle1mConfirmed && candle5mConfirmed && ticker.confluenceScore >= 60) {
      validationStatus = 'CONFIRMED';
      validationStage = 'VALIDADO: Sustentado em 1m + Tendência de 5m Confirmada';
    } else if (candle1mConfirmed || candle5mConfirmed) {
      validationStatus = 'PENDING_VALIDATION';
      validationStage = 'EM VALIDAÇÃO: Confirmando alinhamento de 1m e 5m';
    } else {
      validationStatus = 'PENDING_VALIDATION';
      validationStage = 'EM OBSERVAÇÃO: Aguardando fechamento do candle de 1m';
    }
  } else {
    // Fallback when initial klines are loading
    candle1mConfirmed = true;
    candle5mConfirmed = true;
    validationStatus = 'CONFIRMED';
    validationStage = 'VALIDADO: Confluência Direct-Market';
  }

  return {
    id: `${ticker.symbol}-${categoryPrefix}-${ticker.signalType}-${Date.now().toString(36)}`,
    symbol: ticker.symbol,
    marketType: ticker.marketType,
    signalType: ticker.signalType,
    direction: isLong ? 'LONG' : 'SHORT',
    strategyCategory,
    entryZone: [normalizePricePrecision(entryMin), normalizePricePrecision(entryMax)],
    currentPrice: normalizePricePrecision(price),
    stopLoss: normalizePricePrecision(stopLoss),
    target1: normalizePricePrecision(target1),
    target2: normalizePricePrecision(target2),
    riskRewardRatio,
    confluenceScore: ticker.confluenceScore,
    confluenceFactors: ticker.confluenceFactors,
    timeframe: tf,
    
    validationStatus,
    validationStage,
    candle1mConfirmed,
    candle5mConfirmed,
    validationDetails: {
      sustainSeconds: 60,
      candle5mDirection: candle5mConfirmed ? (isLong ? 'LONG' : 'SHORT') : 'NEUTRAL',
      spikeDetected,
      rejectionReason
    },

    createdAt: Date.now(),
    validatedAt: validationStatus === 'CONFIRMED' ? Date.now() : undefined,
    rejectedAt: validationStatus === 'REJECTED_SPIKE' ? Date.now() : undefined,
    status: 'ACTIVE'
  };
}
