import { TickerData, KlineCandle, OrderBookDepthData, OrderBookLevel, LongShortRatioData, TrappedTradersData, LiquidationSummary } from '../src/types.js';
import { addBinanceLog, getLiveWSTickers, getLiquidationsSummary } from './binanceWebsocket.js';
import { requestJson } from './utils/httpClient.js';
import { getBenchmarkPrice } from '../src/utils/benchmarkPrices.js';

function formatPriceString(value: number | null | undefined): string {
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

// Order of preference for Binance REST endpoints (vision public archive data first to bypass Cloud Run 451 geo-restrictions)
const REST_ENDPOINTS = [
  { base: 'https://data-api.binance.vision', type: 'spot_public', tickerPath: '/api/v3/ticker/24hr', klinePath: '/api/v3/klines' },
  { base: 'https://fapi.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' },
  { base: 'https://fapi1.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' },
  { base: 'https://api.binance.us', type: 'us_spot', tickerPath: '/api/v3/ticker/24hr', klinePath: '/api/v3/klines' },
  { base: 'https://api.binance.com', type: 'spot', tickerPath: '/api/v3/ticker/24hr', klinePath: '/api/v3/klines' }
];

let currentWorkingBaseIndex = 0;

// Monitored Crypto Futures Assets
export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'SUIUSDT',
  'PEPEUSDT',
  'LINKUSDT',
  'AAVEUSDT',
  'AVAXUSDT',
  'NEARUSDT'
];

// Monitored TradFi / Macro Overview
export const TRADFI_ASSETS = [
  { symbol: 'SPY', name: 'S&P 500 Index ETF', baseAsset: 'SPY', quoteAsset: 'USD' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', baseAsset: 'QQQ', quoteAsset: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', baseAsset: 'NVDA', quoteAsset: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc', baseAsset: 'AAPL', quoteAsset: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc', baseAsset: 'TSLA', quoteAsset: 'USD' },
  { symbol: 'GOLD', name: 'Gold Spot USD', baseAsset: 'XAU', quoteAsset: 'USD' }
];

// Helper to fetch JSON safely with timeout, User-Agent, and detailed logging
async function fetchWithFallback(getPath: (ep: typeof REST_ENDPOINTS[0]) => string): Promise<{ data: any; endpoint: string }> {
  // Start trying from current working endpoint index, then wrap around
  for (let offset = 0; offset < REST_ENDPOINTS.length; offset++) {
    const idx = (currentWorkingBaseIndex + offset) % REST_ENDPOINTS.length;
    const ep = REST_ENDPOINTS[idx];
    const fullUrl = `${ep.base}${getPath(ep)}`;
    const startTime = Date.now();

    try {
      const response = await requestJson(fullUrl, { timeoutMs: 4000 });
      const latency = Date.now() - startTime;
      currentWorkingBaseIndex = idx; // Remember working endpoint

      addBinanceLog(
        'SUCCESS',
        'REST_API',
        `Conexão bem-sucedida com Binance API (${ep.base}) em ${latency}ms [Status ${response.status}]`,
        { url: fullUrl, latencyMs: latency }
      );

      return { data: response.data, endpoint: ep.base };

    } catch (err: any) {
      const latency = Date.now() - startTime;
      const errMsg = err?.message || 'Falha de conexão com a API';

      addBinanceLog(
        'WARN',
        'REST_API',
        `Falha na requisição para ${ep.base}: ${errMsg} (${latency}ms). Tentando servidor secundário...`,
        { url: fullUrl, error: errMsg }
      );
    }
  }

  throw new Error('Todos os servidores da Binance REST API estão inacessíveis no momento.');
}

// Memory cache for CVD & Historical Orderbook tracking
const cvdStateMap: Record<string, { buyVol: number; sellVol: number; netCvd: number }> = {};

let lastFallbackNoticeLogged = 0;

/**
 * Fetches 24h ticker data for Binance (combines WebSocket live cache + REST API fallback)
 */
export async function fetchBinanceFuturesTickers(symbolsToFilter?: string[]): Promise<any[]> {
  // 1. First check if real-time WebSocket ticker cache has data
  const wsTickers = getLiveWSTickers();
  const wsKeys = Object.keys(wsTickers);

  const targetSymbols = symbolsToFilter && symbolsToFilter.length > 0
    ? Array.from(new Set([...DEFAULT_SYMBOLS, ...symbolsToFilter]))
    : DEFAULT_SYMBOLS;

  if (wsKeys.length > 0) {
    const targetSet = new Set(targetSymbols);
    const matchedFromWS = Object.values(wsTickers).filter((t: any) => targetSet.has(t.symbol));
    if (matchedFromWS.length >= Math.min(3, targetSymbols.length * 0.3)) {
      // Return all matched tickers plus all live tickers so callers find any active monitored pair
      return Object.values(wsTickers);
    }
  }

  // 2. Fallback to REST API fetch across unrestricted endpoints
  try {
    const { data } = await fetchWithFallback((ep) => ep.tickerPath);
    if (Array.isArray(data)) {
      const targetSet = new Set(targetSymbols);
      const filtered = data.filter(item => item.symbol && (targetSet.has(item.symbol) || item.symbol.endsWith('USDT')));
      if (filtered.length > 0) return filtered;
      return data;
    }
    return [];
  } catch (err: any) {
    const now = Date.now();
    if (now - lastFallbackNoticeLogged > 30000) {
      addBinanceLog(
        'ERROR',
        'REST_API',
        `Aviso: REST APIs da Binance inacessíveis. Utilizando gerador de contingência sintética de mercado.`
      );
      lastFallbackNoticeLogged = now;
    }
    return [];
  }
}

// In-memory cache for Open Interest (30s TTL) and Funding Rate (60s TTL) to minimize outbound requests
const oiCache: Record<string, { value: number; timestamp: number }> = {};
const fundingCache: Record<string, { value: number; timestamp: number }> = {};

/**
 * Fetches Open Interest for a Futures symbol with 30s cache and multi-endpoint fallback
 */
export async function fetchOpenInterest(symbol: string): Promise<{ openInterest: number }> {
  const cached = oiCache[symbol];
  const now = Date.now();
  if (cached && now - cached.timestamp < 30000) {
    return { openInterest: cached.value };
  }

  const futuresEndpoints = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://data-api.binance.vision'
  ];

  for (const base of futuresEndpoints) {
    try {
      const res = await requestJson<{ openInterest?: string }>(`${base}/fapi/v1/openInterest?symbol=${symbol}`, { timeoutMs: 3000 });
      if (res.data?.openInterest) {
        const val = parseFloat(res.data.openInterest);
        if (!isNaN(val) && val > 0) {
          oiCache[symbol] = { value: val, timestamp: now };
          return { openInterest: val };
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  // If remote is unreachable, return previous cached value or 0
  return { openInterest: cached?.value || 0 };
}

/**
 * Fetches Premium Index & Funding Rate for a Futures symbol with 60s cache
 */
export async function fetchFundingRate(symbol: string): Promise<{ fundingRate: number }> {
  const cached = fundingCache[symbol];
  const now = Date.now();
  if (cached && now - cached.timestamp < 60000) {
    return { fundingRate: cached.value };
  }

  const futuresEndpoints = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://data-api.binance.vision'
  ];

  for (const base of futuresEndpoints) {
    try {
      const res = await requestJson<{ lastFundingRate?: string }>(`${base}/fapi/v1/premiumIndex?symbol=${symbol}`, { timeoutMs: 3000 });
      if (res.data?.lastFundingRate) {
        const val = parseFloat(res.data.lastFundingRate);
        if (!isNaN(val)) {
          fundingCache[symbol] = { value: val, timestamp: now };
          return { fundingRate: val };
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  return { fundingRate: cached?.value ?? 0.0001 };
}

// Memory cache for Long/Short ratio data (45s TTL)
const lsCache: Record<string, { data: LongShortRatioData; timestamp: number }> = {};

/**
 * Fetches Long/Short account and position ratios from Binance Futures
 * with fallback to synthetic model estimation if endpoints are geo-blocked
 */
export async function fetchLongShortRatio(symbol: string, currentPrice?: number): Promise<LongShortRatioData> {
  const cleanSymbol = symbol.toUpperCase();
  const cached = lsCache[cleanSymbol];
  const now = Date.now();
  if (cached && now - cached.timestamp < 45000) {
    return cached.data;
  }

  const futuresBases = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://data-api.binance.vision'
  ];

  let globalRatio = 1.0;
  let longAccountPct = 50.0;
  let shortAccountPct = 50.0;
  let topTraderPositionRatio = 1.0;
  let topTraderLongPositionPct = 50.0;
  let topTraderShortPositionPct = 50.0;
  let takerRatio = 1.0;
  let takerBuyVolUsd = 500000;
  let takerSellVolUsd = 500000;
  let fetchedAny = false;

  for (const base of futuresBases) {
    try {
      // 1. Global Account Long/Short Ratio
      const globalRes = await requestJson<any[]>(
        `${base}/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(globalRes.data) && globalRes.data.length > 0) {
        const item = globalRes.data[0];
        globalRatio = parseFloat(item.longShortRatio) || 1.0;
        longAccountPct = Number((parseFloat(item.longAccount) * 100).toFixed(1)) || 50.0;
        shortAccountPct = Number((parseFloat(item.shortAccount) * 100).toFixed(1)) || 50.0;
        fetchedAny = true;
      }

      // 2. Top Trader Position Ratio
      const topPosRes = await requestJson<any[]>(
        `${base}/futures/data/topLongShortPositionRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(topPosRes.data) && topPosRes.data.length > 0) {
        const item = topPosRes.data[0];
        topTraderPositionRatio = parseFloat(item.longShortRatio) || 1.0;
        topTraderLongPositionPct = Number((parseFloat(item.longAccount) * 100).toFixed(1)) || 50.0;
        topTraderShortPositionPct = Number((parseFloat(item.shortAccount) * 100).toFixed(1)) || 50.0;
        fetchedAny = true;
      }

      // 3. Taker Buy/Sell Volume Ratio
      const takerRes = await requestJson<any[]>(
        `${base}/futures/data/takerlongshortRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(takerRes.data) && takerRes.data.length > 0) {
        const item = takerRes.data[0];
        takerRatio = parseFloat(item.buySellRatio) || 1.0;
        takerBuyVolUsd = parseFloat(item.buyVol) || 500000;
        takerSellVolUsd = parseFloat(item.sellVol) || 500000;
        fetchedAny = true;
      }

      if (fetchedAny) break;
    } catch {
      // try next base endpoint
    }
  }

  // If remote was unreachable, generate realistic synthetic positioning
  if (!fetchedAny) {
    const seed = cleanSymbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const cycle = Math.sin(seed + now / 180000);
    const retailBias = 0.52 + cycle * 0.18; // 34% to 70% long
    longAccountPct = Number((retailBias * 100).toFixed(1));
    shortAccountPct = Number(((1 - retailBias) * 100).toFixed(1));
    globalRatio = Number((retailBias / (1 - retailBias)).toFixed(2));

    // Smart Money often fades extreme retail crowding
    const smartBias = retailBias > 0.60 ? retailBias - 0.22 : retailBias < 0.40 ? retailBias + 0.22 : 0.50;
    topTraderLongPositionPct = Number((smartBias * 100).toFixed(1));
    topTraderShortPositionPct = Number(((1 - smartBias) * 100).toFixed(1));
    topTraderPositionRatio = Number((smartBias / (1 - smartBias)).toFixed(2));

    const takerBias = 0.50 + cycle * 0.12;
    takerRatio = Number((takerBias / (1 - takerBias)).toFixed(2));
    const baseUsd = currentPrice ? currentPrice * 1500 : 2500000;
    takerBuyVolUsd = Math.round(baseUsd * takerBias);
    takerSellVolUsd = Math.round(baseUsd * (1 - takerBias));
  }

  const result: LongShortRatioData = {
    symbol: cleanSymbol,
    globalRatio,
    longAccountPct,
    shortAccountPct,
    topTraderAccountRatio: Number((globalRatio * 0.95).toFixed(2)),
    topTraderPositionRatio,
    topTraderLongPositionPct,
    topTraderShortPositionPct,
    takerRatio,
    takerBuyVolUsd,
    takerSellVolUsd,
    timestamp: now
  };

  lsCache[cleanSymbol] = { data: result, timestamp: now };
  return result;
}

/**
 * Calculates Trapped Traders Index (TTI), Wyckoff Absorption Ratio and Trapped Price Zones
 * Based on Price Action at Extreme Levels, CVD Imbalance, OI Spike and Long/Short Positioning
 */
export function calculateTrappedTradersAnalysis(
  symbol: string,
  currentPrice: number,
  klines: KlineCandle[],
  openInterest: number,
  fundingRate: number,
  lsData: LongShortRatioData,
  rangeProfile: { vah: number; val: number; poc: number },
  keyLevels: { support1: number; resistance1: number },
  takerBuyRatio: number
): TrappedTradersData {
  const now = Date.now();
  const liqSummary = getLiquidationsSummary(symbol, currentPrice);

  if (!klines || klines.length < 5) {
    return {
      status: 'BALANCED',
      trappedIndex: 30,
      trappedSide: 'NONE',
      trappedPriceZone: [currentPrice * 0.995, currentPrice * 1.005],
      trappedPocPrice: currentPrice,
      trappedVolumeUSD: 1000000,
      absorptionRatio: 25,
      divergenceType: 'NONE',
      crowdSentiment: 'NEUTRAL',
      smartMoneyBias: 'NEUTRAL',
      confluenceVerdict: 'Dados insuficientes para cálculo de absorção.',
      liquidationsSummary: liqSummary,
      updatedAt: now
    };
  }

  // 1. Analyze the last 3-5 candles for volume spikes and absorption wicks
  const inspectCandles = klines.slice(-5);
  let maxVolCandle = inspectCandles[0];
  inspectCandles.forEach(c => {
    if (c.volume > maxVolCandle.volume) {
      maxVolCandle = c;
    }
  });

  const maxCandleRange = Math.abs(maxVolCandle.high - maxVolCandle.low) || (currentPrice * 0.005);
  const maxCandleBody = Math.abs(maxVolCandle.close - maxVolCandle.open);
  const upperWick = maxVolCandle.high - Math.max(maxVolCandle.open, maxVolCandle.close);
  const lowerWick = Math.min(maxVolCandle.open, maxVolCandle.close) - maxVolCandle.low;

  const upperWickPct = (upperWick / maxCandleRange) * 100;
  const lowerWickPct = (lowerWick / maxCandleRange) * 100;

  const candleTakerBuyRatio = maxVolCandle.takerBuyVolume / (maxVolCandle.volume || 1);

  // 2. Proximity to Key Range Extremes (VAH / VAL / Resistance / Support)
  const distToHigh = Math.abs(currentPrice - Math.max(rangeProfile.vah, keyLevels.resistance1)) / currentPrice;
  const distToLow = Math.abs(currentPrice - Math.min(rangeProfile.val, keyLevels.support1)) / currentPrice;
  const isNearHigh = distToHigh <= 0.015 || currentPrice >= rangeProfile.vah * 0.995;
  const isNearLow = distToLow <= 0.015 || currentPrice <= rangeProfile.val * 1.005;

  // 3. Wyckoff Effort vs Result (Absorption Calculation)
  let bearishAbsorptionScore = 0;
  if (candleTakerBuyRatio > 0.52 && (upperWickPct > 35 || maxVolCandle.close <= (maxVolCandle.high + maxVolCandle.low) / 2)) {
    bearishAbsorptionScore = Math.min(100, Math.round(candleTakerBuyRatio * 75 + upperWickPct * 0.5));
  }
  let bullishAbsorptionScore = 0;
  if (candleTakerBuyRatio < 0.48 && (lowerWickPct > 35 || maxVolCandle.close >= (maxVolCandle.high + maxVolCandle.low) / 2)) {
    bullishAbsorptionScore = Math.min(100, Math.round((1 - candleTakerBuyRatio) * 75 + lowerWickPct * 0.5));
  }

  // 4. Crowd Sentiment & Smart Money Divergence
  let crowdSentiment: 'EXTREME_GREED' | 'BULLISH_CROWD' | 'NEUTRAL' | 'BEARISH_CROWD' | 'EXTREME_FEAR' = 'NEUTRAL';
  if (lsData.longAccountPct >= 72) crowdSentiment = 'EXTREME_GREED';
  else if (lsData.longAccountPct >= 60) crowdSentiment = 'BULLISH_CROWD';
  else if (lsData.shortAccountPct >= 72) crowdSentiment = 'EXTREME_FEAR';
  else if (lsData.shortAccountPct >= 60) crowdSentiment = 'BEARISH_CROWD';

  let smartMoneyBias: 'ACCUMULATING_SHORTS' | 'ACCUMULATING_LONGS' | 'NEUTRAL' = 'NEUTRAL';
  if (lsData.topTraderShortPositionPct > 54 && lsData.longAccountPct > 56) {
    smartMoneyBias = 'ACCUMULATING_SHORTS';
  } else if (lsData.topTraderLongPositionPct > 54 && lsData.shortAccountPct > 56) {
    smartMoneyBias = 'ACCUMULATING_LONGS';
  }

  // 5. Trapped Traders Evaluation
  let status: 'TRAPPED_LONGS' | 'TRAPPED_SHORTS' | 'BALANCED' = 'BALANCED';
  let trappedSide: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
  let divergenceType: 'BEARISH_ABSORPTION' | 'BULLISH_ABSORPTION' | 'NONE' = 'NONE';
  let trappedIndex = 30;

  // Potential TRAPPED LONGS (Fade Short setup)
  if ((isNearHigh || maxVolCandle.high >= rangeProfile.vah) && (bearishAbsorptionScore >= 40 || lsData.longAccountPct >= 62)) {
    const crowdingBonus = Math.max(0, (lsData.longAccountPct - 50) * 1.5);
    const fundingBonus = fundingRate > 0.00015 ? 15 : 0;
    const smartDivergenceBonus = smartMoneyBias === 'ACCUMULATING_SHORTS' ? 15 : 0;
    const absorptionWeight = bearishAbsorptionScore * 0.45;

    trappedIndex = Math.min(100, Math.round(absorptionWeight + crowdingBonus + fundingBonus + smartDivergenceBonus));
    if (trappedIndex >= 52) {
      status = 'TRAPPED_LONGS';
      trappedSide = 'LONG';
      divergenceType = 'BEARISH_ABSORPTION';
    }
  }

  // Potential TRAPPED SHORTS (Short Squeeze setup)
  if ((isNearLow || maxVolCandle.low <= rangeProfile.val) && (bullishAbsorptionScore >= 40 || lsData.shortAccountPct >= 62)) {
    const crowdingBonus = Math.max(0, (lsData.shortAccountPct - 50) * 1.5);
    const fundingBonus = fundingRate < -0.0001 ? 15 : 0;
    const smartDivergenceBonus = smartMoneyBias === 'ACCUMULATING_LONGS' ? 15 : 0;
    const absorptionWeight = bullishAbsorptionScore * 0.45;

    trappedIndex = Math.min(100, Math.round(absorptionWeight + crowdingBonus + fundingBonus + smartDivergenceBonus));
    if (trappedIndex >= 52) {
      status = 'TRAPPED_SHORTS';
      trappedSide = 'SHORT';
      divergenceType = 'BULLISH_ABSORPTION';
    }
  }

  // 6. Define Trapped Price Zone & POC
  const trappedMin = status === 'TRAPPED_LONGS' 
    ? Math.min(maxVolCandle.low, currentPrice * 0.998)
    : Math.min(maxVolCandle.low, currentPrice * 0.995);
  const trappedMax = status === 'TRAPPED_LONGS'
    ? Math.max(maxVolCandle.high, currentPrice * 1.005)
    : Math.max(maxVolCandle.high, currentPrice * 1.002);

  const trappedPocPrice = parseFloat(((trappedMin + trappedMax + maxVolCandle.close * 2) / 4).toFixed(currentPrice > 100 ? 2 : 4));
  const trappedVolumeUSD = Math.round(maxVolCandle.volume * currentPrice * 0.65);
  const absorptionRatio = Math.max(bearishAbsorptionScore, bullishAbsorptionScore);

  // 7. Human readable institutional diagnosis
  let confluenceVerdict = 'Fluxo de liquidez e posicionamento de contratos equilibrados.';
  if (status === 'TRAPPED_LONGS') {
    confluenceVerdict = `Traders Compradores Presos no Topo (${trappedIndex}/100): ${lsData.longAccountPct}% Net Longs absorvidos na faixa de ${formatPriceString(trappedMin)} - ${formatPriceString(trappedMax)}. Absorção de compra de ${absorptionRatio}%. Alavancagem sob risco iminente de Long Flush.`;
  } else if (status === 'TRAPPED_SHORTS') {
    confluenceVerdict = `Traders Vendedores Presos no Fundo (${trappedIndex}/100): ${lsData.shortAccountPct}% Net Shorts absorvidos na faixa de ${formatPriceString(trappedMin)} - ${formatPriceString(trappedMax)}. Absorção de venda de ${absorptionRatio}%. Potencial elevado de Short Squeeze.`;
  }

  return {
    status,
    trappedIndex,
    trappedSide,
    trappedPriceZone: [trappedMin, trappedMax],
    trappedPocPrice,
    trappedVolumeUSD,
    absorptionRatio,
    divergenceType,
    crowdSentiment,
    smartMoneyBias,
    confluenceVerdict,
    liquidationsSummary: liqSummary,
    updatedAt: now
  };
}

// Memory cache for Klines with 10s TTL to optimize multi-strategy concurrent evaluations
const klineCache: Record<string, { candles: KlineCandle[]; timestamp: number }> = {};

/**
 * Fetches Kline / Candlestick data (e.g. 5m, 15m, 30m, 1h, 4h)
 */
export async function fetchKlines(symbol: string, interval: string = '15m', limit: number = 50): Promise<KlineCandle[]> {
  const cacheKey = `${symbol}_${interval}_${limit}`;
  const now = Date.now();
  if (klineCache[cacheKey] && (now - klineCache[cacheKey].timestamp < 10000)) {
    return klineCache[cacheKey].candles;
  }

  try {
    const { data } = await fetchWithFallback(
      (ep) => `${ep.klinePath}?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );

    if (Array.isArray(data) && data.length > 0) {
      const candles: KlineCandle[] = data.map((k: any) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        takerBuyVolume: parseFloat(k[9]) || parseFloat(k[5]) * 0.52
      }));
      klineCache[cacheKey] = { candles, timestamp: now };
      return candles;
    }
  } catch (err) {
    // Fallback to synthetic kline candles
  }
  const fallback = generateFallbackKlines(symbol, limit);
  klineCache[cacheKey] = { candles: fallback, timestamp: now };
  return fallback;
}

/**
 * Generates synthetic realistic candles if live API times out or rate limits
 */
export function generateFallbackKlines(symbol: string, limit: number = 50): KlineCandle[] {
  const candles: KlineCandle[] = [];
  let basePrice = getBenchmarkPrice(symbol);
  const now = Date.now();
  const intervalMs = 15 * 60 * 1000;

  for (let i = limit - 1; i >= 0; i--) {
    const ts = now - i * intervalMs;
    const variation = (Math.sin(i / 3) + (Math.random() - 0.48)) * (basePrice * 0.008);
    const open = basePrice;
    const close = basePrice + variation;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.004);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.004);
    const volume = (Math.random() * 50 + 20) * (basePrice > 1000 ? 50 : 5000);
    const takerBuyVolume = volume * (0.45 + Math.random() * 0.12);

    candles.push({ timestamp: ts, open, high, low, close, volume, takerBuyVolume });
    basePrice = close;
  }
  return candles;
}

/**
 * Calculates Volume Profile (POC, VAH, VAL) from candle arrays
 */
export function calculateVolumeProfile(klines: KlineCandle[], binsCount: number = 24) {
  if (!klines.length) {
    return { vah: 0, val: 0, poc: 0, bins: [] };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  klines.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  const step = (maxPrice - minPrice) / binsCount || 1;
  const bins = Array.from({ length: binsCount }, (_, i) => ({
    priceMin: minPrice + i * step,
    priceMax: minPrice + (i + 1) * step,
    midPrice: minPrice + (i + 0.5) * step,
    volume: 0,
    buyVolume: 0
  }));

  let totalVolume = 0;
  klines.forEach(c => {
    const mid = (c.high + c.low) / 2;
    const binIdx = Math.min(Math.floor((mid - minPrice) / step), binsCount - 1);
    if (binIdx >= 0 && binIdx < binsCount) {
      bins[binIdx].volume += c.volume;
      bins[binIdx].buyVolume += c.takerBuyVolume;
      totalVolume += c.volume;
    }
  });

  // POC = bin with max volume
  let pocBin = bins[0];
  bins.forEach(b => {
    if (b.volume > pocBin.volume) pocBin = b;
  });

  // Value Area = 70% of total volume around POC
  const sortedBins = [...bins].sort((a, b) => b.volume - a.volume);
  let accumulatedVol = 0;
  const targetVol = totalVolume * 0.7;
  const valueBins: typeof bins = [];

  for (const b of sortedBins) {
    valueBins.push(b);
    accumulatedVol += b.volume;
    if (accumulatedVol >= targetVol) break;
  }

  const val = Math.min(...valueBins.map(b => b.priceMin));
  const vah = Math.max(...valueBins.map(b => b.priceMax));

  return {
    vah,
    val,
    poc: pocBin.midPrice,
    bins
  };
}

/**
 * Calculates Fibonacci Retracements (0.0, 0.236, 0.382, 0.5, 0.618, 0.68, 0.786, 1.0)
 * According to TradingView market structure rules:
 * - Downtrend: Swing High / HH is point 1, Swing Low / LL is point 0. Bounce retracement moves 0 -> 1.
 * - Uptrend: Swing Low / LL is point 1, Swing High / HH is point 0. Pullback retracement moves 0 -> 1.
 */
export function calculateFibonacci(klines: KlineCandle[], currentPrice: number) {
  if (!klines.length) {
    return {
      fib0: 0,
      fib236: 0,
      fib382: 0,
      fib50: 0,
      fib618: 0,
      fib68: 0,
      fib786: 0,
      fib100: 0,
      swingHigh: 0,
      swingLow: 0,
      inGoldenPocket: false,
      trend: 'UP' as const,
      point1Price: 0,
      point0Price: 0,
      point1Label: '1 (0.00)',
      point0Label: '0 (0.00)',
      point1Type: 'LL' as const,
      point0Type: 'HH' as const
    };
  }

  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let hhIndex = 0;
  let llIndex = 0;

  klines.forEach((c, idx) => {
    if (c.high > swingHigh) {
      swingHigh = c.high;
      hhIndex = idx;
    }
    if (c.low < swingLow) {
      swingLow = c.low;
      llIndex = idx;
    }
  });

  const diff = swingHigh - swingLow;
  if (diff <= 0) {
    return {
      fib0: swingHigh,
      fib236: swingHigh,
      fib382: swingHigh,
      fib50: swingHigh,
      fib618: swingHigh,
      fib68: swingHigh,
      fib786: swingHigh,
      fib100: swingLow,
      swingHigh,
      swingLow,
      inGoldenPocket: false,
      trend: 'UP' as const,
      point1Price: swingLow,
      point0Price: swingHigh,
      point1Label: `1 (${formatPriceString(swingLow)})`,
      point0Label: `0 (${formatPriceString(swingHigh)})`,
      point1Type: 'LL' as const,
      point0Type: 'HH' as const
    };
  }

  // Determine market structure direction based on chronological sequence of HH and LL:
  // If HH occurred before LL (hhIndex < llIndex):
  // The impulse moved DOWN from HH (1) to LL (0).
  // Retracement bounces from 0 (LL) upwards towards 1 (HH).
  // If LL occurred before HH (llIndex < hhIndex):
  // The impulse moved UP from LL (1) to HH (0).
  // Retracement pulls back from 0 (HH) downwards towards 1 (LL).
  const isDownTrend = hhIndex < llIndex;

  let f0 = 0;
  let f236 = 0;
  let f382 = 0;
  let f50 = 0;
  let f618 = 0;
  let f68 = 0;
  let f786 = 0;
  let f100 = 0;

  if (isDownTrend) {
    // Downtrend: 1 is HH (swingHigh), 0 is LL (swingLow)
    f0 = swingLow;
    f236 = swingLow + diff * 0.236;
    f382 = swingLow + diff * 0.382;
    f50 = swingLow + diff * 0.50;
    f618 = swingLow + diff * 0.618;
    f68 = swingLow + diff * 0.68;
    f786 = swingLow + diff * 0.786;
    f100 = swingHigh;
  } else {
    // Uptrend: 1 is LL (swingLow), 0 is HH (swingHigh)
    f0 = swingHigh;
    f236 = swingHigh - diff * 0.236;
    f382 = swingHigh - diff * 0.382;
    f50 = swingHigh - diff * 0.50;
    f618 = swingHigh - diff * 0.618;
    f68 = swingHigh - diff * 0.68;
    f786 = swingHigh - diff * 0.786;
    f100 = swingLow;
  }

  // Golden Pocket zone: between 0.618 and 0.68 retracement
  const goldenTop = Math.max(f618, f68);
  const goldenBottom = Math.min(f618, f68);
  const inGoldenPocket = currentPrice >= goldenBottom * 0.998 && currentPrice <= goldenTop * 1.002;

  return {
    fib0: f0,
    fib236: f236,
    fib382: f382,
    fib50: f50,
    fib618: f618,
    fib68: f68,
    fib786: f786,
    fib100: f100,
    swingHigh,
    swingLow,
    inGoldenPocket,
    trend: isDownTrend ? ('DOWN' as const) : ('UP' as const),
    point1Price: isDownTrend ? swingHigh : swingLow,
    point0Price: isDownTrend ? swingLow : swingHigh,
    point1Label: isDownTrend ? `1 (${formatPriceString(swingHigh)})` : `1 (${formatPriceString(swingLow)})`,
    point0Label: isDownTrend ? `0 (${formatPriceString(swingLow)})` : `0 (${formatPriceString(swingHigh)})`,
    point1Type: isDownTrend ? ('HH' as const) : ('LL' as const),
    point0Type: isDownTrend ? ('LL' as const) : ('HH' as const)
  };
}

/**
 * Detects Fair Value Gaps (FVG) / Single Prints
 */
export function detectFVG(klines: KlineCandle[]) {
  if (klines.length < 3) return { hasSinglePrintFVG: false };

  // Look at last 5 candles for FVG
  for (let i = klines.length - 2; i >= 2; i--) {
    const c1 = klines[i - 2];
    const c3 = klines[i];

    // Bullish FVG: C3 Low > C1 High
    if (c3.low > c1.high) {
      return {
        hasSinglePrintFVG: true,
        fvgZone: { top: c3.low, bottom: c1.high, type: 'BULLISH' as const }
      };
    }
    // Bearish FVG: C3 High < C1 Low
    if (c3.high < c1.low) {
      return {
        hasSinglePrintFVG: true,
        fvgZone: { top: c1.low, bottom: c3.high, type: 'BEARISH' as const }
      };
    }
  }

  return { hasSinglePrintFVG: false };
}

/**
 * Normalizes raw order book levels into cumulative depth with USD calculation and wall detection
 */
function processDepthData(
  symbol: string,
  rawBids: string[][],
  rawAsks: string[][],
  timestamp: number
): OrderBookDepthData {
  const parsedBids = rawBids.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })).filter(b => b.price > 0 && b.qty > 0);
  const parsedAsks = rawAsks.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })).filter(a => a.price > 0 && a.qty > 0);

  // Sort bids descending (highest buy offer first), asks ascending (lowest sell offer first)
  parsedBids.sort((a, b) => b.price - a.price);
  parsedAsks.sort((a, b) => a.price - b.price);

  const bestBid = parsedBids[0]?.price || 1;
  const bestAsk = parsedAsks[0]?.price || bestBid * 1.0002;
  const spread = Math.max(0, bestAsk - bestBid);
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  // Compute average qty to detect Whale Walls
  const allQtys = [...parsedBids.map(b => b.qty), ...parsedAsks.map(a => a.qty)];
  const avgQty = allQtys.length > 0 ? allQtys.reduce((acc, q) => acc + q, 0) / allQtys.length : 1;
  const wallThreshold = avgQty * 2.3;

  let cumBidQty = 0;
  let cumBidUsd = 0;
  let maxBidWall: OrderBookLevel | undefined;

  const bids: OrderBookLevel[] = parsedBids.map(b => {
    cumBidQty += b.qty;
    const usd = b.price * b.qty;
    cumBidUsd += usd;
    const isWall = b.qty >= wallThreshold;
    const level: OrderBookLevel = {
      price: b.price,
      qty: b.qty,
      totalQty: cumBidQty,
      totalUsd: cumBidUsd,
      deviationPct: Number((((b.price - midPrice) / midPrice) * 100).toFixed(3)),
      isWall
    };
    if (isWall && (!maxBidWall || b.qty > maxBidWall.qty)) {
      maxBidWall = level;
    }
    return level;
  });

  let cumAskQty = 0;
  let cumAskUsd = 0;
  let maxAskWall: OrderBookLevel | undefined;

  const asks: OrderBookLevel[] = parsedAsks.map(a => {
    cumAskQty += a.qty;
    const usd = a.price * a.qty;
    cumAskUsd += usd;
    const isWall = a.qty >= wallThreshold;
    const level: OrderBookLevel = {
      price: a.price,
      qty: a.qty,
      totalQty: cumAskQty,
      totalUsd: cumAskUsd,
      deviationPct: Number((((a.price - midPrice) / midPrice) * 100).toFixed(3)),
      isWall
    };
    if (isWall && (!maxAskWall || a.qty > maxAskWall.qty)) {
      maxAskWall = level;
    }
    return level;
  });

  const totalDepthUsd = cumBidUsd + cumAskUsd;
  const imbalancePct = totalDepthUsd > 0
    ? Number((((cumBidUsd - cumAskUsd) / totalDepthUsd) * 100).toFixed(2))
    : 0;
  const imbalanceRatio = cumAskUsd > 0 ? Number((cumBidUsd / cumAskUsd).toFixed(2)) : 1;

  let pressureLabel = 'LIVRO EQUILIBRADO (FLUXO NEUTRO)';
  let pressureBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

  if (imbalancePct >= 20) {
    pressureLabel = 'FORTE PRESSÃO COMPRADORA (SUPORTE CARREGADO)';
    pressureBias = 'BUY';
  } else if (imbalancePct >= 7) {
    pressureLabel = 'MODERADA PRESSÃO COMPRADORA (BID DOMINANTE)';
    pressureBias = 'BUY';
  } else if (imbalancePct <= -20) {
    pressureLabel = 'FORTE PRESSÃO VENDEDORA (RESISTÊNCIA CARREGADA)';
    pressureBias = 'SELL';
  } else if (imbalancePct <= -7) {
    pressureLabel = 'MODERADA PRESSÃO VENDEDORA (ASK DOMINANTE)';
    pressureBias = 'SELL';
  }

  return {
    symbol,
    timestamp,
    bids,
    asks,
    spread,
    spreadPct,
    midPrice,
    bidDepthUsd: cumBidUsd,
    askDepthUsd: cumAskUsd,
    totalDepthUsd,
    imbalancePct,
    imbalanceRatio,
    pressureLabel,
    pressureBias,
    whaleWalls: {
      bidWall: maxBidWall,
      askWall: maxAskWall
    }
  };
}

/**
 * Generates synthetic high-fidelity Order Book Depth centered around the asset's active price
 */
export function generateSimulatedDepth(
  symbol: string,
  currentPrice: number = 100,
  limit: number = 35,
  timestamp: number = Date.now()
): OrderBookDepthData {
  let midPrice = currentPrice || 100;
  if (!currentPrice || currentPrice <= 0) {
    if (symbol.includes('BTC')) midPrice = 92000;
    else if (symbol.includes('ETH')) midPrice = 3400;
    else if (symbol.includes('SOL')) midPrice = 185;
    else if (symbol.includes('BNB')) midPrice = 640;
    else if (symbol.includes('XRP')) midPrice = 2.45;
    else if (symbol.includes('SPY')) midPrice = 585;
    else if (symbol.includes('GOLD')) midPrice = 2650;
    else midPrice = 50;
  }

  const spread = midPrice * 0.00015; // tight institutional spread
  const bestBid = midPrice - spread / 2;
  const bestAsk = midPrice + spread / 2;

  const rawBids: string[][] = [];
  const rawAsks: string[][] = [];

  // Seed with deterministic pseudo-random variations based on symbol and time
  const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const biasFactor = Math.sin(seed + Math.floor(timestamp / 60000)) * 0.25; // slight natural cyclical shift

  const baseUnitQty = midPrice > 1000 ? 0.8 : midPrice > 100 ? 15 : midPrice > 1 ? 500 : 25000;

  for (let i = 0; i < limit; i++) {
    // Step size grows slightly as we move deeper into the order book
    const distPct = 0.0002 + (i / limit) * 0.02; // up to ~2% depth
    const bidPrice = bestBid * (1 - distPct);
    const askPrice = bestAsk * (1 + distPct);

    // Depth volume: increasing with distance + random variance + potential whale wall spike
    let bidQty = (baseUnitQty * (1 + i * 0.35)) * (0.7 + Math.random() * 0.6) * (1 + biasFactor);
    let askQty = (baseUnitQty * (1 + i * 0.35)) * (0.7 + Math.random() * 0.6) * (1 - biasFactor);

    // Inject deliberate institutional walls at ~tier 7 or 15
    if (i === 7 || i === 18) {
      if (Math.sin(seed + i) > 0) {
        bidQty *= 3.4; // Bid Wall
      } else {
        askQty *= 3.4; // Ask Wall
      }
    }

    rawBids.push([bidPrice.toFixed(midPrice > 10 ? 2 : 5), bidQty.toFixed(2)]);
    rawAsks.push([askPrice.toFixed(midPrice > 10 ? 2 : 5), askQty.toFixed(2)]);
  }

  return processDepthData(symbol, rawBids, rawAsks, timestamp);
}

/**
 * Fetches Order Book Depth (bids, asks) with depth imbalance and whale wall detection
 */
export async function fetchOrderBookDepth(
  symbol: string,
  currentPrice?: number,
  limit: number = 35
): Promise<OrderBookDepthData> {
  const cleanSymbol = symbol.toUpperCase();
  const now = Date.now();

  const isTradfi = TRADFI_ASSETS.some(a => a.symbol === cleanSymbol);

  if (!isTradfi) {
    const endpoints = [
      `https://fapi.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=${limit}`,
      `https://data-api.binance.vision/api/v3/depth?symbol=${cleanSymbol}&limit=${limit}`,
      `https://api.binance.us/api/v3/depth?symbol=${cleanSymbol}&limit=${limit}`
    ];

    for (const url of endpoints) {
      try {
        const res = await requestJson<{ bids?: string[][]; asks?: string[][] }>(url, { timeoutMs: 2500 });
        if (res.data?.bids && res.data?.asks && res.data.bids.length > 0 && res.data.asks.length > 0) {
          return processDepthData(cleanSymbol, res.data.bids, res.data.asks, now);
        }
      } catch {
        // try next endpoint
      }
    }
  }

  return generateSimulatedDepth(cleanSymbol, currentPrice, limit, now);
}
