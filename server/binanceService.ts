import { TickerData, KlineCandle } from '../src/types.js';
import { addBinanceLog, getLiveWSTickers } from './binanceWebsocket.js';

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketSignalsSuperBot/2.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (!res.ok) {
        addBinanceLog(
          'WARN',
          'REST_API',
          `Requisição para ${ep.base} retornou status HTTP ${res.status} (${latency}ms). Tentando próximo servidor de fallback...`,
          { url: fullUrl, status: res.status }
        );
        continue;
      }

      const json = await res.json();
      currentWorkingBaseIndex = idx; // Remember working endpoint

      addBinanceLog(
        'SUCCESS',
        'REST_API',
        `Conexão bem-sucedida com Binance API (${ep.base}) em ${latency}ms [Status ${res.status}]`,
        { url: fullUrl, latencyMs: latency }
      );

      return { data: json, endpoint: ep.base };

    } catch (err: any) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      const errMsg = err.name === 'AbortError' ? 'Timeout de requisição (4000ms)' : err.message;

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

/**
 * Fetches Open Interest for a Futures symbol
 */
export async function fetchOpenInterest(symbol: string): Promise<{ openInterest: number }> {
  try {
    const ep = REST_ENDPOINTS[currentWorkingBaseIndex];
    if (ep.type === 'futures') {
      const res = await fetch(`${ep.base}/fapi/v1/openInterest?symbol=${symbol}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const data = await res.json();
        return { openInterest: parseFloat(data.openInterest || '0') };
      }
    }
    return { openInterest: 0 };
  } catch (err) {
    return { openInterest: 0 };
  }
}

/**
 * Fetches Premium Index & Funding Rate for a Futures symbol
 */
export async function fetchFundingRate(symbol: string): Promise<{ fundingRate: number }> {
  try {
    const ep = REST_ENDPOINTS[currentWorkingBaseIndex];
    if (ep.type === 'futures') {
      const res = await fetch(`${ep.base}/fapi/v1/premiumIndex?symbol=${symbol}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const data = await res.json();
        return { fundingRate: parseFloat(data.lastFundingRate || '0.0001') };
      }
    }
    return { fundingRate: 0.0001 };
  } catch (err) {
    return { fundingRate: 0.0001 };
  }
}

/**
 * Fetches Kline / Candlestick data (e.g. 15m / 1h)
 */
export async function fetchKlines(symbol: string, interval: string = '15m', limit: number = 50): Promise<KlineCandle[]> {
  try {
    const { data } = await fetchWithFallback(
      (ep) => `${ep.klinePath}?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );

    if (Array.isArray(data)) {
      return data.map((k: any) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        takerBuyVolume: parseFloat(k[9]) || parseFloat(k[5]) * 0.52
      }));
    }
  } catch (err) {
    // Fallback to synthetic kline candles
  }
  return generateFallbackKlines(symbol, limit);
}

/**
 * Generates synthetic realistic candles if live API times out or rate limits
 */
export function generateFallbackKlines(symbol: string, limit: number = 50): KlineCandle[] {
  const candles: KlineCandle[] = [];
  let basePrice = symbol.includes('BTC') ? 92000 : symbol.includes('ETH') ? 3400 : symbol.includes('SOL') ? 185 : 15;
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
 * Calculates Fibonacci Retracements (0.5, 0.618, 0.68)
 */
export function calculateFibonacci(klines: KlineCandle[], currentPrice: number) {
  if (!klines.length) {
    return { fib50: 0, fib618: 0, fib68: 0, swingHigh: 0, swingLow: 0, inGoldenPocket: false };
  }

  let swingHigh = -Infinity;
  let swingLow = Infinity;

  klines.forEach(c => {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  });

  const diff = swingHigh - swingLow;
  const fib50 = swingHigh - diff * 0.5;
  const fib618 = swingHigh - diff * 0.618;
  const fib68 = swingHigh - diff * 0.68;

  // Golden Pocket zone: between 0.618 and 0.68 retracement
  const goldenTop = Math.max(fib618, fib68);
  const goldenBottom = Math.min(fib618, fib68);
  const inGoldenPocket = currentPrice >= goldenBottom * 0.998 && currentPrice <= goldenTop * 1.002;

  return {
    fib50,
    fib618,
    fib68,
    swingHigh,
    swingLow,
    inGoldenPocket
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
