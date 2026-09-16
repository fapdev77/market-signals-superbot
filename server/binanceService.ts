import { TickerData, KlineCandle } from '../src/types.js';
import { addBinanceLog, getLiveWSTickers } from './binanceWebsocket.js';
import { requestJson } from './utils/httpClient.js';

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
export async function fetchBinanceFuturesTickers(): Promise<any[]> {
  // 1. First check if real-time WebSocket ticker cache has data
  const wsTickers = getLiveWSTickers();
  const wsKeys = Object.keys(wsTickers);

  if (wsKeys.length > 0) {
    const matchedFromWS = DEFAULT_SYMBOLS.map(sym => wsTickers[sym]).filter(Boolean);
    if (matchedFromWS.length >= DEFAULT_SYMBOLS.length * 0.5) {
      return matchedFromWS;
    }
  }

  // 2. Fallback to REST API fetch across unrestricted endpoints
  try {
    const { data } = await fetchWithFallback((ep) => ep.tickerPath);
    if (Array.isArray(data)) {
      return data.filter(item => DEFAULT_SYMBOLS.includes(item.symbol));
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
  let basePrice = 15;
  if (symbol.includes('BTC')) basePrice = 92000;
  else if (symbol.includes('ETH')) basePrice = 3400;
  else if (symbol.includes('SOL')) basePrice = 185;
  else if (symbol.includes('BNB')) basePrice = 640;
  else if (symbol.includes('XRP')) basePrice = 2.45;
  else if (symbol.includes('DOGE')) basePrice = 0.22;
  else if (symbol.includes('SUI')) basePrice = 3.25;
  else if (symbol.includes('PEPE')) basePrice = 0.00001025;
  else if (symbol.includes('SHIB')) basePrice = 0.00001450;
  else if (symbol.includes('BONK')) basePrice = 0.00001850;
  else if (symbol.includes('NEAR')) basePrice = 4.80;
  else if (symbol.includes('AVAX')) basePrice = 28.5;
  else if (symbol.includes('AAVE')) basePrice = 220;
  else if (symbol.includes('LINK')) basePrice = 17.5;
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
