import { TickerData, TradeSignal, IndicatorWeights, KlineCandle, StrategyCategory, LongShortRatioData, TrappedTradersData, SignalTtlSettings } from '../src/types.js';
import { calculateVolumeProfile, calculateFibonacci, detectFVG, calculateTrappedTradersAnalysis, getTradfiAsset, isTradfiMarketOpen, canGenerateSignalsForAsset } from './binanceService.js';
import { scanRSIDivergence } from '../src/utils/rsiDivergenceUtils.js';
import { calculateEffectiveTtlMinutes, DEFAULT_SIGNAL_TTL_SETTINGS } from '../src/utils/signalTtlUtils.js';
// 6.5.1/CA-5.2: cálculo de preço/risco usa decimal exato; toFixed fica só na apresentação.
import { dRound } from './utils/decimal.js';
import { roundPriceToTick, checkExecutability, type SymbolFilters } from './services/exchangeFilters.js';
import { computePositionSize } from './services/RiskManager.js';
// R-15: métrica canônica da supressão por stop cap (CA-7.3 pede métrica + motivo).
import { incrementMetric, METRIC_NAMES } from './utils/metrics.js';
// 6.7: confirmação de entrada (R1–R5) e teto do stop (D1–D8 aprovados em 2026-09-30).
import { confirmEntry } from './services/entryConfirmation.js';
import { enforceStopCap, getStopCapPct } from './services/stopCap.js';
import { isPendingEntryEnabled } from './services/pendingEntryLifecycle.js';

/**
 * Shared Lookback Window Constant (M2.3 - Phase 5)
 * Defines standard 60-candle history lookback for indicator calculation across live and backtest.
 */
export const SIGNAL_LOOKBACK_CANDLES = 60;

export function normalizePricePrecision(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  if (abs >= 1000) return dRound(value, 2);
  if (abs >= 50) return dRound(value, 3);
  if (abs >= 1) return dRound(value, 4);
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return dRound(value, decimals);
}

export function formatPriceString(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  const abs = Math.abs(value);
  if (abs === 0) return '0.00';
  if (abs >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 50) return String(dRound(value, 2));
  if (abs >= 1) return String(dRound(value, 3));
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return String(dRound(value, decimals));
}

export function processTickerState(
  rawTicker: any,
  klines: KlineCandle[],
  openInterest: number,
  fundingRate: number,
  weights: IndicatorWeights,
  longShortData?: LongShortRatioData,
  trappedTradersData?: TrappedTradersData,
  realOiChange?: { change24h?: number; change1h?: number },
  fundingIntervalHours: number = 8,
  availability?: { openInterest?: boolean; funding?: boolean; longShort?: boolean }
): TickerData | null {
  if (!rawTicker) return null;

  // Phase 2.5.2: provenance. A factor whose upstream feed was unavailable must never be scored as if
  // it were a real neutral reading, and must be surfaced to the operator instead.
  const oiAvailable = availability?.openInterest ?? true;
  const fundingAvailable = availability?.funding ?? true;
  const longShortAvailable = availability?.longShort ?? true;
  const unavailableFactors: string[] = [];
  if (!oiAvailable) unavailableFactors.push('Open Interest');
  if (!fundingAvailable) unavailableFactors.push('Funding Rate');
  if (!longShortAvailable) unavailableFactors.push('Long/Short Ratio');

  // Quote-level freshness/provenance (drives the DataGate). Factor availability is tracked separately:
  // a funding outage must degrade *scoring*, not block stop-loss protection on an open position.
  const tickNow = Date.now();
  const hasOwnUpdatedAt = typeof rawTicker.updatedAt === 'number';
  const quoteAgeMs = hasOwnUpdatedAt ? Math.max(0, tickNow - rawTicker.updatedAt) : 0;
  const isStaleQuote = rawTicker.source === 'STALE';
  const symbol = rawTicker.symbol || 'BTCUSDT';
  const parsedPrice = parseFloat(rawTicker.lastPrice || rawTicker.price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return null;
  }
  const price = parsedPrice;
  const priceChangePercent24h = parseFloat(rawTicker.priceChangePercent || '0');
  const high24h = parseFloat(rawTicker.highPrice || (price * 1.02).toString());
  const low24h = parseFloat(rawTicker.lowPrice || (price * 0.98).toString());
  const volume24h = parseFloat(rawTicker.volume || '0');
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

  // Real Open Interest % change from exchange endpoint (no synthetic estimation)
  const openInterestChange24h = typeof realOiChange?.change24h === 'number'
    ? realOiChange.change24h
    : 0;
  const openInterestChange1h = typeof realOiChange?.change1h === 'number'
    ? realOiChange.change1h
    : 0;

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

  // 2. Open Interest + Price Relationship (skipped entirely when the OI feed is unavailable)
  if (oiAvailable && openInterestChange1h > 1.5) {
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

  // 5. Funding Rate Crowd Positioning with Contract-Specific Interval (Phase 2.2)
  const cyclesPerDay = 24 / (fundingIntervalHours || 8);
  const fundingRateDaily = fundingRate * cyclesPerDay;
  const annualFunding = fundingRateDaily * 365 * 100;
  let fundingStatus: 'EXTREME_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'EXTREME_NEGATIVE' | 'UNAVAILABLE' = 'NEUTRAL';
  let fundingPressure: any = 'NEUTRO / EQUILIBRADO';
  let fundingBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let fundingDesc = `Funding rate em equilíbrio normal (${(fundingRateDaily * 100).toFixed(3)}%/dia · ciclo de ${fundingIntervalHours}h). Sem pressões alavancadas em extremos.`;

  if (!fundingAvailable) {
    fundingStatus = 'UNAVAILABLE';
    fundingPressure = 'INDISPONÍVEL (feed de funding falhou)';
    fundingBias = 'NEUTRAL';
    fundingDesc = 'Taxa de funding indisponível neste ciclo. O fator foi ignorado na pontuação de confluência (não tratado como neutro).';
  } else if (fundingRate > 0.0004) {
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

  // 7. Trapped Traders & Institutional Counter-Trade Analysis (Fade & Squeeze)
  const fallbackLsData: LongShortRatioData = longShortData || {
    symbol,
    globalRatio: 1.0,
    longAccountPct: 50.0,
    shortAccountPct: 50.0,
    topTraderAccountRatio: 1.0,
    topTraderPositionRatio: 1.0,
    topTraderLongPositionPct: 50.0,
    topTraderShortPositionPct: 50.0,
    takerRatio: takerBuyRatio / (1 - takerBuyRatio || 1),
    takerBuyVolUsd: quoteVolume24h * 0.5,
    takerSellVolUsd: quoteVolume24h * 0.5,
    timestamp: Date.now()
  };

  const trappedTraders = trappedTradersData || calculateTrappedTradersAnalysis(
    symbol,
    price,
    klines,
    openInterest,
    fundingRate,
    fallbackLsData,
    rangeProfile,
    { support1, resistance1 },
    takerBuyRatio
  );

  const trappedWeight = weights.trappedTradersWeight || 25;
  // Phase 2.5.2: when the long/short feed is unavailable the TTI is built on a neutral placeholder,
  // so it must not award confluence points.
  if (!longShortAvailable) {
    unavailableFactors.push('Trapped Traders (fundamentado em Long/Short indisponível)');
  } else if (trappedTraders.status === 'TRAPPED_LONGS') {
    const intensity = (trappedTraders.trappedIndex / 100);
    bearishPoints += trappedWeight * intensity * 1.5;
    confluenceFactors.push(
      `⚡ Contra-Trade (Fade Trapped Longs): Net Longs (${fallbackLsData.longAccountPct}%) com TTI ${trappedTraders.trappedIndex}/100 e ${trappedTraders.absorptionRatio}% absorção na faixa $${formatPriceString(trappedTraders.trappedPriceZone[0])} - $${formatPriceString(trappedTraders.trappedPriceZone[1])}`
    );
  } else if (trappedTraders.status === 'TRAPPED_SHORTS') {
    const intensity = (trappedTraders.trappedIndex / 100);
    bullishPoints += trappedWeight * intensity * 1.5;
    confluenceFactors.push(
      `⚡ Contra-Trade (Short Squeeze): Net Shorts (${fallbackLsData.shortAccountPct}%) com TTI ${trappedTraders.trappedIndex}/100 e ${trappedTraders.absorptionRatio}% absorção na faixa $${formatPriceString(trappedTraders.trappedPriceZone[0])} - $${formatPriceString(trappedTraders.trappedPriceZone[1])}`
    );
  }

  // 8. RSI Divergence Monitor Integration
  const partialTickerForDivergence: any = {
    symbol,
    price,
    priceChangePercent24h,
    fibonacci,
    keyLevels: {
      support1,
      support2,
      resistance1,
      resistance2,
      structureBreak,
      hasSinglePrintFVG: fvg.hasSinglePrintFVG,
      fvgZone: fvg.fvgZone
    },
    cvdDirection,
    trappedTraders,
    ma24hDeviationPct
  };

  let divTimeframe = '1h';
  if (weights.volumeProfileTimeframe === '15m') divTimeframe = '15m';
  else if (weights.volumeProfileTimeframe === '4h') divTimeframe = '4h';
  else if (weights.volumeProfileTimeframe === '1d' || weights.volumeProfileTimeframe === '1D') divTimeframe = '1D';

  const rsiDivItem = scanRSIDivergence(partialTickerForDivergence, divTimeframe, klines);
  const rsiDivWeight = weights.rsiDivergenceWeight ?? 20;

  if (rsiDivItem && rsiDivItem.divergenceType !== 'NO_DIVERGENCE') {
    if (rsiDivItem.bias === 'BULLISH') {
      bullishPoints += rsiDivWeight;
      confluenceFactors.push(
        `🎯 RSI Divergência Altista (${rsiDivItem.divergenceType.replace('_', ' ')} · ${divTimeframe}): RSI Atual ${rsiDivItem.rsiCurrent} vs Swing ${rsiDivItem.rsiPrevSwing} (Exaustão Vendedora)`
      );
    } else if (rsiDivItem.bias === 'BEARISH') {
      bearishPoints += rsiDivWeight;
      confluenceFactors.push(
        `🎯 RSI Divergência Baixista (${rsiDivItem.divergenceType.replace('_', ' ')} · ${divTimeframe}): RSI Atual ${rsiDivItem.rsiCurrent} vs Swing ${rsiDivItem.rsiPrevSwing} (Exaustão Compradora)`
      );
    }
  }

  // Determine Signal Type & Confluence Score
  const netScore = bullishPoints - bearishPoints;
  const confluenceScore = Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25));

  let signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT' = 'NEUTRAL';
  let signalReason = 'Consolidating in range. Awaiting directional volume breakout.';

  if (netScore >= 35) {
    signalType = netScore >= 55 ? 'STRONG_LONG' : 'LONG';
    if (weights.activeStrategy === 'counter' || trappedTraders.status === 'TRAPPED_SHORTS') {
      signalReason = `Contra-Trade Institucional (${confluenceScore}%): Short Squeeze de ${fallbackLsData.shortAccountPct}% Net Shorts com ${trappedTraders.absorptionRatio}% de absorção em suporte.`;
    } else {
      signalReason = `High Bullish Confluence (${confluenceScore}%): Golden Pocket / CVD Buyer Surge / OI Accumulation.`;
    }
  } else if (netScore <= -35) {
    signalType = netScore <= -55 ? 'STRONG_SHORT' : 'SHORT';
    if (weights.activeStrategy === 'counter' || trappedTraders.status === 'TRAPPED_LONGS') {
      signalReason = `Contra-Trade Institucional (${confluenceScore}%): Fade de ${fallbackLsData.longAccountPct}% Net Longs no topo com ${trappedTraders.absorptionRatio}% de absorção em resistência.`;
    } else {
      signalReason = `High Bearish Confluence (${confluenceScore}%): Resistance Rejection / CVD Selling / Overheated Longs.`;
    }
  }

  // Phase 2.4 & Phase 5 (M1): Check TradFi market schedule & session policy
  const tradfiAsset = getTradfiAsset(symbol);
  let tradfiSession: 'REGULAR' | 'PRE_MARKET' | 'AFTER_MARKET' | 'OVERNIGHT' | 'NO_TRADING' | undefined = undefined;

  if (tradfiAsset) {
    const assetDecision = canGenerateSignalsForAsset(tradfiAsset);
    tradfiSession = assetDecision.session;

    if (!assetDecision.allow) {
      signalType = 'NEUTRAL';
      signalReason = assetDecision.reason || `Mercado tradicional subjacente (${tradfiAsset.tradfiCategory}) fechado no momento. Sinais pausados até a reabertura da sessão.`;
    } else if (assetDecision.scoreBonus && assetDecision.scoreBonus > 0) {
      // CA-1.4: Extended session score requirement (+5 bonus)
      const minExtendedScore = 35 + assetDecision.scoreBonus;
      if (Math.abs(netScore) < minExtendedScore) {
        signalType = 'NEUTRAL';
        signalReason = `Sinal em sessão estendida (${tradfiSession}) suprimido por score insuficiente (< ${minExtendedScore}%).`;
      }
    }
  }

  const baseAsset = symbol.replace(/USDT|USD|BUSD/, '');
  const quoteAsset = symbol.includes('USDT') ? 'USDT' : 'USD';

  const isTradfi = Boolean(tradfiAsset);
  const tradfiCategoryTag = tradfiAsset?.tradfiCategory === 'EQUITY'
    ? 'US Stock'
    : tradfiAsset?.tradfiCategory === 'INDEX'
    ? 'Index'
    : tradfiAsset?.tradfiCategory || 'TradFi';

  return {
    symbol,
    baseAsset,
    quoteAsset,
    name: isTradfi ? `${baseAsset} (${tradfiCategoryTag})` : `${baseAsset} Perpetual`,
    marketType: isTradfi ? 'tradfi' : 'crypto_futures',
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
    fundingIntervalHours,
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
    longShortData: fallbackLsData,
    trappedTraders,
    confluenceScore,
    signalType,
    signalReason,
    confluenceFactors,
    tradfiSession,
    dataQuality: {
      isLive: !isStaleQuote && quoteAgeMs < 60000 && klines.length >= 5,
      isDegraded: isStaleQuote || quoteAgeMs > 60000 || !klines || klines.length < 5,
      lastPriceAgeMs: quoteAgeMs,
      source: isStaleQuote ? 'STALE' : (rawTicker.source || (quoteAgeMs < 15000 ? 'WS' : 'REST')),
      unavailableFactors: unavailableFactors.length > 0 ? unavailableFactors : undefined
    },
    updatedAt: hasOwnUpdatedAt ? rawTicker.updatedAt : tickNow
  };
}

/**
 * Velas usadas APENAS pela validação multi-timeframe (1m e 5m reais).
 *
 * CRÍTICO-2 (auditoria): antes these duas checagens eram derivadas do array `klines`, que é o
 * mesmo dos indicadores — 15m no live (`server.ts`) e 1m no backtest (`BacktestEngine`).
 * Isso significava que:
 *   - no LIVE, "confirmação de 1m" media a última vela de 15m (e o limiar de pavio de 55%
 *     disparava sobre a amplitude de 15m, não de 1m);
 *   - no BACKTEST, media 1m — por acidente correto;
 *   - logo, live e backtest NÃO eram comparáveis nesse filtro. O teste de paridade existente
 *     não detectou isso porque alimenta as mesmas velas dos dois lados, o que mascara
 *     justamente a diferença de timeframe;
 *   - e "confirmação de 5m" era `open da vela de 5 barras atrás` — 75 minutos num feed de
 *     15m, quase a mesma medição da "confirmação de 1m" (dupla contagem).
 *
 * Agora cada checagem mede o timeframe que o rótulo diz. Ausência de velas de 1m/5m NÃO
 * faz o sinal ser confirmado: falha fechada em `PENDING_VALIDATION`.
 */
export interface ValidationKlines {
  /** Últimas velas REAIS de 1m (exchange no live; histórico 1m no backtest). */
  klines1m?: KlineCandle[];
  /** Últimas velas REAIS de 5m. */
  klines5m?: KlineCandle[];
}

/**
 * Builds an actionable TradeSignal object with Risk/Reward parameters
 * and performs 1m & 5m Multi-Timeframe Validation to prevent false spike entries.
 *
 * @param validationKlines velas de 1m e 5m para a validação multi-timeframe. Sem elas o sinal
 *   nasce `PENDING_VALIDATION` (nunca `CONFIRMED`).
 */
export function buildTradeSignal(
  ticker: TickerData,
  klines: KlineCandle[] = [],
  minRiskRewardRatio: number = 2.5,
  strategyCategory: StrategyCategory = 'INTRADAY',
  customTimeframe?: string,
  ttlSettings?: SignalTtlSettings,
  /** R-7: carries maxStopLossAtrMultiple (and future risk knobs) from operator settings. */
  weights?: IndicatorWeights,
  /** 6.5.2: filtros do exchange para arredondamento de preços e executabilidade. */
  filters?: SymbolFilters | null,
  /** 6.5.2: equity/risco para sugerir quantidade (defaults do RiskManager). */
  riskParams?: { equity?: number; riskPerTradePct?: number },
  /** CRÍTICO-2: velas REAIS de 1m/5m para a validação multi-timeframe. */
  validationKlines?: ValidationKlines
): TradeSignal | null {
  if (ticker.signalType === 'NEUTRAL' || ticker.confluenceScore < 50) {
    return null;
  }

  const isLong = ticker.signalType.includes('LONG');
  const price = ticker.price;

  // Entry zone calculation
  const entrySpread = price * 0.003;
  let entryMin = isLong ? price - entrySpread : price;
  let entryMax = isLong ? price : price + entrySpread;

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
    case 'COUNTER_TRADE':
      slPct = 0.010; // 1.0% stop técnico estreito logo além da zona de absorção
      tf = customTimeframe || '15m';
      categoryPrefix = 'CONTRA';
      break;
    case 'CUSTOM':
      slPct = 0.015;
      tf = customTimeframe || '15m';
      categoryPrefix = 'CUST';
      break;
  }

  // Institutional Dynamic Volatility (ATR-based) Risk Sizing
  const atrMultipliers: Record<string, number> = {
    SCALP: 1.0,
    DAY_TRADE: 1.4,
    INTRADAY: 1.6,
    SWING: 2.2,
    POSITION: 3.5,
    COUNTER_TRADE: 1.3,
    CUSTOM: 1.5
  };
  const strategyAtrMultiplier = atrMultipliers[strategyCategory] || 1.5;

  let calculatedAtr = 0;
  if (Array.isArray(klines) && klines.length >= 5) {
    const lookbackAtr = klines.slice(-15);
    const trueRanges = lookbackAtr.map((k, idx) => {
      const prevClose = idx > 0 ? lookbackAtr[idx - 1].close : k.open;
      return Math.max(
        k.high - k.low,
        Math.abs(k.high - prevClose),
        Math.abs(k.low - prevClose)
      );
    });
    calculatedAtr = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  // Cap dynamic distance to the category ceiling from stopCap
  const capPct = getStopCapPct(strategyCategory) / 100;
  const maxAllowedDist = price * (capPct * 0.95);

  // Dynamic stop distance: ATR-anchored when klines are present, percentage fallback otherwise
  const rawSlDistance = calculatedAtr > 0 ? calculatedAtr * strategyAtrMultiplier : price * slPct;
  const dynamicSlDistance = Math.min(rawSlDistance, maxAllowedDist);
  const slDist = Math.max(price * 0.003, dynamicSlDistance);

  // Phase 2.2: Stop Loss anchored to recent candle Swing High / Swing Low extremes with safety buffer
  let recentLowestLow = price * (1 - slPct);
  let recentHighestHigh = price * (1 + slPct);
  if (Array.isArray(klines) && klines.length >= 5) {
    const lookback = klines.slice(-10);
    recentLowestLow = Math.min(...lookback.map(k => k.low));
    recentHighestHigh = Math.max(...lookback.map(k => k.high));
  }

  // Long: Stop loss anchored to recent swing low and dynamic volatility, strictly capped within maxAllowedDist
  // Short: Stop loss anchored to recent swing high and dynamic volatility, strictly capped within maxAllowedDist
  let stopLoss = isLong
    ? Math.max(price - maxAllowedDist, Math.min(recentLowestLow * 0.9985, price - slDist))
    : Math.min(price + maxAllowedDist, Math.max(recentHighestHigh * 1.0015, price + slDist));

  // R-7: cap the stop distance to maxStopLossAtrMultiple × ATR% of the recent
  // window. After an extreme-volatility candle the swing/suporte anchor could
  // sit arbitrarily far away, silently inflating risk per trade. The cap keeps
  // the stop structural (it still sits beyond the price) but bounded, and the
  // R:R is recomputed AFTER the cap below.
  const capMultiple = weights?.maxStopLossAtrMultiple ?? 2.5;
  if (Array.isArray(klines) && klines.length >= 5 && capMultiple > 0) {
    const lookbackAtr = klines.slice(-15);
    const trueRanges = lookbackAtr.map((k, idx) => {
      const prevClose = idx > 0 ? lookbackAtr[idx - 1].close : k.open;
      return Math.max(
        k.high - k.low,
        Math.abs(k.high - prevClose),
        Math.abs(k.low - prevClose)
      );
    });
    const atr = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
    const maxStopDistance = atr * capMultiple;

    if (isLong && price - stopLoss > maxStopDistance) {
      stopLoss = price - maxStopDistance;
    } else if (!isLong && stopLoss - price > maxStopDistance) {
      stopLoss = price + maxStopDistance;
    }
  }

  // Natural targets based on market structure
  let target1 = isLong ? ticker.keyLevels.resistance1 : ticker.keyLevels.support1;
  let target2 = isLong ? ticker.keyLevels.resistance2 : ticker.keyLevels.support2;

  // Institutional Counter-Trade Precision Anchoring (Stop Loss & Take Profits anchored on Trapped Zone)
  if (strategyCategory === 'COUNTER_TRADE' && ticker.trappedTraders && ticker.trappedTraders.status !== 'BALANCED') {
    if (isLong) {
      // Short Squeeze: Stop loss safely below the trapped bottom cluster
      const trapBottom = ticker.trappedTraders.trappedPriceZone[0];
      stopLoss = Math.min(trapBottom * 0.998, price - price * 0.010);
      target1 = ticker.rangeProfile.poc;
      target2 = Math.max(ticker.rangeProfile.vah, ticker.keyLevels.resistance1);
    } else {
      // Fade Trapped Longs: Stop loss safely above the trapped top cluster
      const trapTop = ticker.trappedTraders.trappedPriceZone[1];
      stopLoss = Math.max(trapTop * 1.002, price + price * 0.010);
      target1 = ticker.rangeProfile.poc;
      target2 = Math.min(ticker.rangeProfile.val, ticker.keyLevels.support1);
    }
  }

  // Targets based on natural R:R constraints
  // 6.5.2: `let` porque o risco de referência é refinado após o arredondamento do stop ao tickSize.
  let riskAmount = Math.abs(price - stopLoss) || (price * slPct);

  // Sanity check to ensure targets are in the correct direction with minimum spacing
  if (isLong) {
    if (target1 <= price + riskAmount * 0.8) target1 = price + riskAmount * 1.5;
    if (target2 <= target1) target2 = target1 + riskAmount * 1.5;
  } else {
    if (target1 >= price - riskAmount * 0.8) target1 = price - riskAmount * 1.5;
    if (target2 >= target1) target2 = target1 - riskAmount * 1.5;
  }

  // 6.5.2/CA-5.3: preços alinhados ao tickSize do exchange. O stop arredonda para o lado
  // conservador (dispara antes); entrada e alvos para o múltiplo mais próximo. R:R recalculado
  // sobre os preços já arredondados.
  if (filters) {
    entryMin = roundPriceToTick(entryMin, filters.tickSize);
    entryMax = roundPriceToTick(entryMax, filters.tickSize);
    stopLoss = roundPriceToTick(stopLoss, filters.tickSize, isLong ? 'conservative-long-stop' : 'conservative-short-stop');
    target1 = roundPriceToTick(target1, filters.tickSize);
    target2 = roundPriceToTick(target2, filters.tickSize);
    // R:R sobre o risco real pós-arredondamento (o stop pode ter andado um tick).
    riskAmount = Math.abs(price - stopLoss) || riskAmount;
  }

  const riskRewardRatio = dRound(Math.abs(target2 - price) / riskAmount, 2);

  // If the natural ratio doesn't meet the minimum configured requirement, reject it entirely.
  if (riskRewardRatio < minRiskRewardRatio) {
    return null;
  }

  // 6.7.4/CA-7.3 — teto do stop por estratégia (D7: defaults calibrados por dados).
  // Acima do teto o sinal é suprimido com motivo STOP_TOO_WIDE.
  const stopCap = enforceStopCap({
    strategyCategory,
    entryPrice: price,
    stopLoss
  });
  if (!stopCap.allowed) {
    // CA-7.3: métrica + motivo (o warn carrega a razão STOP_TOO_WIDE completa).
    incrementMetric(METRIC_NAMES.signalsSuppressedStopCap);
    console.warn(`⛔ [STOP CAP] Sinal ${ticker.symbol}/${strategyCategory} suprimido: ${stopCap.reason}`);
    return null;
  }

  // 6.5.2 — quantidade sugerida (RiskManager) e executabilidade contra os filtros do exchange.
  // Ausente = filtros indisponíveis (executabilidade desconhecida); `false` só com motivo.
  let suggestedQuantity: number | undefined = undefined;
  let executable: boolean | undefined = undefined;
  let nonExecutableReason: string | undefined = undefined;
  if (filters) {
    const sizing = computePositionSize({
      entryPrice: price,
      stopLossPrice: stopLoss,
      equity: riskParams?.equity,
      riskPerTradePct: riskParams?.riskPerTradePct,
      minQuantity: filters.minQty,
      quantityDecimals: 8
    });
    if (sizing.valid) {
      const check = checkExecutability({ quantity: sizing.quantity, entryPrice: price, filters });
      suggestedQuantity = check.suggestedQuantity;
      executable = check.executable;
      nonExecutableReason = check.reason;
    } else {
      executable = false;
      nonExecutableReason = sizing.reason;
    }
  }

  // --- 1m & 5m MULTI-TIMEFRAME VALIDATION ENGINE (CRÍTICO-2) ---
  // Cada checagem usa velas do timeframe que o rótulo declara: a spike e a direção
  // confirmam na vela real de 1m; a continuidade de tendência, na vela real de 5m.
  let candle1mConfirmed = false;
  let candle5mConfirmed = false;
  let spikeDetected = false;
  let validationStatus: 'PENDING_VALIDATION' | 'CONFIRMED' | 'REJECTED_SPIKE' = 'PENDING_VALIDATION';
  let validationStage = 'Aguardando validação de 1m...';
  let rejectionReason: string | undefined = undefined;

  const v1m = validationKlines?.klines1m;
  const v5m = validationKlines?.klines5m;
  const has1m = Array.isArray(v1m) && v1m.length >= 1;
  const has5m = Array.isArray(v5m) && v5m.length >= 1;

  if (has1m && has5m) {
    const last1m = v1m![v1m!.length - 1];
    const last5m = v5m![v5m!.length - 1];

    // Rejeição de spike — análise de pavio NA VELA DE 1m.
    const candle1mRange = Math.abs(last1m.high - last1m.low) || 1;
    const body1m = Math.abs(last1m.close - last1m.open);
    const upperWick = last1m.high - Math.max(last1m.open, last1m.close);
    const lowerWick = Math.min(last1m.open, last1m.close) - last1m.low;

    if (isLong && upperWick / candle1mRange > 0.55 && body1m < upperWick) {
      spikeDetected = true;
      rejectionReason = 'Rejeição de topo no 1m (pavio superior > 55% da vela - Spike falso)';
    } else if (!isLong && lowerWick / candle1mRange > 0.55 && body1m < lowerWick) {
      spikeDetected = true;
      rejectionReason = 'Rejeição de fundo no 1m (pavio inferior > 55% da vela - Dump falso)';
    }

    // Confirmação direcional na vela real de 1m
    if (isLong && last1m.close >= last1m.open && ticker.takerBuyRatio >= 0.49) {
      candle1mConfirmed = true;
    } else if (!isLong && last1m.close <= last1m.open && ticker.takerBuyRatio <= 0.51) {
      candle1mConfirmed = true;
    }

    // Continuidade de tendência NA VELA REAL DE 5m. Antes usava o `open` de 5 velas
    // atrás do mesmo array — no live isso media 75 minutos e duplicava a checagem de 1m.
    const is5mLongTrend = last5m.close > last5m.open;
    const is5mShortTrend = last5m.close < last5m.open;

    if (isLong && is5mLongTrend) {
      candle5mConfirmed = true;
    } else if (!isLong && is5mShortTrend) {
      candle5mConfirmed = true;
    }

    // Estado final
    if (spikeDetected) {
      validationStatus = 'REJECTED_SPIKE';
      validationStage = `REJEITADO: ${rejectionReason}`;
    } else if (candle1mConfirmed && candle5mConfirmed && ticker.confluenceScore >= 60) {
      validationStatus = 'CONFIRMED';
      validationStage = 'VALIDADO: vela de 1m sustenta a direção + tendência de 5m confirmada';
    } else if (candle1mConfirmed || candle5mConfirmed) {
      validationStatus = 'PENDING_VALIDATION';
      validationStage = 'EM VALIDAÇÃO: alinhamento entre 1m e 5m parcial';
    } else {
      validationStatus = 'PENDING_VALIDATION';
      validationStage = 'EM OBSERVAÇÃO: 1m e 5m ainda sem alinhamento direcional';
    }
  } else {
    // Phase 3.1 (preservado) + CRÍTICO-2: sem velas REAIS de 1m e 5m o setup é NÃO
    // VALIDADO. Este ramo nunca marca CONFIRMED — sem o timeframe correto não há como
    // afirmar confirmação multi-timeframe.
    candle1mConfirmed = false;
    candle5mConfirmed = false;
    validationStatus = 'PENDING_VALIDATION';
    validationStage = has1m || has5m
      ? 'EM OBSERVAÇÃO: falta um dos timeframes (1m/5m) para validar (sinal NÃO confirmado)'
      : 'EM OBSERVAÇÃO: velas de 1m/5m indisponíveis para validação (sinal NÃO confirmado)';
  }

  const now = Date.now();
  const effectiveTtl = calculateEffectiveTtlMinutes(strategyCategory, ttlSettings || DEFAULT_SIGNAL_TTL_SETTINGS);
  const expiresAt = now + (effectiveTtl * 60 * 1000);

  return {
    id: `${ticker.symbol}-${categoryPrefix}-${ticker.signalType}-${now.toString(36)}`,
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

    createdAt: now,
    validatedAt: validationStatus === 'CONFIRMED' ? now : undefined,
    rejectedAt: validationStatus === 'REJECTED_SPIKE' ? now : undefined,
    ttlMinutes: effectiveTtl,
    expiresAt,
    isBreakevenActive: false,
    // 6.7.3/D8: com a flag, o sinal nasce PENDING_ENTRY (só ativa ao tocar a zona com
    // confirmação); sem a flag, comportamento atual preservado.
    status: isPendingEntryEnabled() ? 'PENDING_ENTRY' : 'ACTIVE',
    tradfiSession: ticker.tradfiSession,
    // 6.5.2/6.5.3: executabilidade (estimativa de slippage é anexada pelo caller, que tem o book).
    suggestedQuantity,
    executable,
    nonExecutableReason,
    // R-2: a proveniência do sinal é herdada do ticker. Só é DEMO quando o próprio dado é
    // sintético (o que exige ALLOW_SYNTHETIC_DATA='true' para chegar aqui — o DataGate bloqueia
    // o contrário), nunca por causa do ambiente.
    origin: ticker.dataQuality?.source === 'SYNTHETIC' ? 'DEMO' : 'LIVE'
  };
}
