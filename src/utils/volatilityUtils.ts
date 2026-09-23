import { TickerData } from '../types';

export type VolatilityRegime = 'SUPERNOVA' | 'HIGH' | 'MODERATE' | 'COMPRESSION';

export interface TickerVolatilityMetric {
  ticker: TickerData;
  symbol: string;
  baseAsset: string;
  price: number;
  high24h: number;
  low24h: number;
  change24h: number;
  volume24h: number;
  quoteVolume24h: number;
  
  // ATR & Range Metrics
  estimatedAtr: number;             // Estimated ATR in price units
  atrPercent: number;                // ATR as % of current price
  intradayRangePercent: number;      // ((High - Low) / Low) * 100
  highLowSpreadUsd: number;          // High - Low
  
  // Projections
  expectedMove1D: {
    upper: number;
    lower: number;
    percent: number;
  };
  expectedMove2D: {
    upper: number;
    lower: number;
    percent: number;
  };

  // Volatility Intelligence
  volatilityRegime: VolatilityRegime;
  actionScore: number;               // 0 to 100 Action & Liquidity Intensity score
  isSqueezeCandidate: boolean;       // Low volatility with elevated OI or consolidation
  isSupernova: boolean;              // Extreme volatility (>8% ATR or top tier)
  momentumBias: 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'CHOPPY' | 'COMPRESSION';
  
  // Weights / Percentiles
  volatilityRank: number;
  actionRank: number;
}

export interface VolatilitySummary {
  items: TickerVolatilityMetric[];
  averageAtrPercent: number;
  medianAtrPercent: number;
  topVolatile: TickerVolatilityMetric | null;
  topAction: TickerVolatilityMetric | null;
  squeezeCount: number;
  supernovaCount: number;
  highCount: number;
  moderateCount: number;
  compressionCount: number;
}

/**
 * Calculates institutional ATR-based volatility, action scores, and expected move envelopes for a ticker.
 */
export function calculateTickerVolatility(ticker: TickerData): TickerVolatilityMetric {
  const price = ticker.price || 1;
  const high = ticker.high24h || price * 1.02;
  const low = ticker.low24h || price * 0.98;
  const changePct = ticker.priceChangePercent24h || 0;
  
  // Calculate raw 24h true range
  const rawHighLowRange = Math.max(0.00000001, high - low);
  const intradayRangePercent = (rawHighLowRange / Math.max(0.00000001, low)) * 100;
  
  // Estimate ATR (combining 24h high-low range with price displacement and intraday momentum)
  // Wilder's ATR heuristic for 24h crypto feeds: ~70% of 24h high-low + momentum component
  const momentumAdjustment = Math.abs(changePct) * 0.15;
  const normalizedAtrPercent = Math.max(0.2, (intradayRangePercent * 0.65) + momentumAdjustment);
  const estimatedAtr = (normalizedAtrPercent / 100) * price;

  // Expected move calculation (1 ATR & 2 ATR bands)
  const expectedMove1D = {
    upper: price + estimatedAtr,
    lower: Math.max(0, price - estimatedAtr),
    percent: normalizedAtrPercent
  };

  const expectedMove2D = {
    upper: price + (estimatedAtr * 2),
    lower: Math.max(0, price - (estimatedAtr * 2)),
    percent: normalizedAtrPercent * 2
  };

  // Volatility Regime determination
  let volatilityRegime: VolatilityRegime = 'MODERATE';
  if (normalizedAtrPercent >= 7.5) {
    volatilityRegime = 'SUPERNOVA';
  } else if (normalizedAtrPercent >= 4.5) {
    volatilityRegime = 'HIGH';
  } else if (normalizedAtrPercent <= 2.2) {
    volatilityRegime = 'COMPRESSION';
  } else {
    volatilityRegime = 'MODERATE';
  }

  // Action Score (0-100): Composite of ATR%, Quote Volume ($), Open Interest expansion, and Price Change
  // Volume velocity score (log scale)
  const quoteVol = ticker.quoteVolume24h || 100000;
  const logVolScore = Math.min(30, Math.max(5, (Math.log10(quoteVol) - 4) * 6)); // 5 to 30 pts

  // ATR component (up to 40 pts)
  const atrScore = Math.min(40, (normalizedAtrPercent / 10) * 40);

  // Price Change / Momentum component (up to 20 pts)
  const changeScore = Math.min(20, (Math.abs(changePct) / 12) * 20);

  // Open Interest velocity (up to 10 pts)
  const oiChange = Math.abs(ticker.openInterestChange24h || 0);
  const oiScore = Math.min(10, (oiChange / 15) * 10);

  const rawActionScore = Math.round(logVolScore + atrScore + changeScore + oiScore);
  const actionScore = Math.min(100, Math.max(0, rawActionScore));

  // Squeeze candidate condition: Low/Moderate ATR with elevated Volume or positive OI buildup
  const isSqueezeCandidate = (normalizedAtrPercent <= 3.0 && (oiChange >= 5 || quoteVol >= 50000000));
  const isSupernova = volatilityRegime === 'SUPERNOVA' || actionScore >= 80;

  // Momentum Bias
  let momentumBias: TickerVolatilityMetric['momentumBias'] = 'CHOPPY';
  if (volatilityRegime === 'COMPRESSION') {
    momentumBias = 'COMPRESSION';
  } else if (changePct >= 2.5 && normalizedAtrPercent >= 3.5) {
    momentumBias = 'BULLISH_EXPANSION';
  } else if (changePct <= -2.5 && normalizedAtrPercent >= 3.5) {
    momentumBias = 'BEARISH_EXPANSION';
  }

  return {
    ticker,
    symbol: ticker.symbol,
    baseAsset: ticker.baseAsset || ticker.symbol.replace(/USDT|BUSD|USDC/g, ''),
    price,
    high24h: high,
    low24h: low,
    change24h: changePct,
    volume24h: ticker.volume24h || 0,
    quoteVolume24h: ticker.quoteVolume24h || 0,
    estimatedAtr,
    atrPercent: Number(normalizedAtrPercent.toFixed(2)),
    intradayRangePercent: Number(intradayRangePercent.toFixed(2)),
    highLowSpreadUsd: rawHighLowRange,
    expectedMove1D,
    expectedMove2D,
    volatilityRegime,
    actionScore,
    isSqueezeCandidate,
    isSupernova,
    momentumBias,
    volatilityRank: 0,
    actionRank: 0
  };
}

/**
 * Computes volatility metrics across the whole ticker universe with relative rankings.
 */
export function calculateUniverseVolatility(tickers: TickerData[]): VolatilitySummary {
  if (!tickers || tickers.length === 0) {
    return {
      items: [],
      averageAtrPercent: 0,
      medianAtrPercent: 0,
      topVolatile: null,
      topAction: null,
      squeezeCount: 0,
      supernovaCount: 0,
      highCount: 0,
      moderateCount: 0,
      compressionCount: 0
    };
  }

  // Calculate base metrics
  const items = tickers.map(calculateTickerVolatility);

  // Sort by ATR% descending for volatility ranking
  const sortedByAtr = [...items].sort((a, b) => b.atrPercent - a.atrPercent);
  sortedByAtr.forEach((item, index) => {
    item.volatilityRank = index + 1;
  });

  // Sort by Action Score descending for action ranking
  const sortedByAction = [...items].sort((a, b) => b.actionScore - a.actionScore);
  sortedByAction.forEach((item, index) => {
    item.actionRank = index + 1;
  });

  // Aggregates
  const totalAtr = items.reduce((acc, curr) => acc + curr.atrPercent, 0);
  const averageAtrPercent = Number((totalAtr / items.length).toFixed(2));

  const sortedAtrValues = [...items].map(i => i.atrPercent).sort((a, b) => a - b);
  const midIndex = Math.floor(sortedAtrValues.length / 2);
  const medianAtrPercent = sortedAtrValues.length % 2 !== 0
    ? sortedAtrValues[midIndex]
    : Number(((sortedAtrValues[midIndex - 1] + sortedAtrValues[midIndex]) / 2).toFixed(2));

  const topVolatile = sortedByAtr[0] || null;
  const topAction = sortedByAction[0] || null;

  const squeezeCount = items.filter(i => i.isSqueezeCandidate).length;
  const supernovaCount = items.filter(i => i.volatilityRegime === 'SUPERNOVA').length;
  const highCount = items.filter(i => i.volatilityRegime === 'HIGH').length;
  const moderateCount = items.filter(i => i.volatilityRegime === 'MODERATE').length;
  const compressionCount = items.filter(i => i.volatilityRegime === 'COMPRESSION').length;

  return {
    items,
    averageAtrPercent,
    medianAtrPercent,
    topVolatile,
    topAction,
    squeezeCount,
    supernovaCount,
    highCount,
    moderateCount,
    compressionCount
  };
}
