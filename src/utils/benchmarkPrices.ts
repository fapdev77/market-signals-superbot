/**
 * Centralized benchmark prices and market reference values for crypto and TradFi assets.
 * Eliminates arbitrary hardcoded fallbacks (e.g. $12.5 or $15) and guarantees realistic market
 * reference levels when live WebSocket/REST feeds are initializing or during network contingency.
 */

export const BENCHMARK_PRICES: Record<string, number> = {
  // Top Layer 1 & Layer 2
  BTCUSDT: 92450.0,
  ETHUSDT: 3420.0,
  SOLUSDT: 188.5,
  BNBUSDT: 640.0,
  XRPUSDT: 2.45,
  ADAUSDT: 0.785,
  SUIUSDT: 3.42,
  AVAXUSDT: 32.5,
  NEARUSDT: 4.85,
  ARBUSDT: 0.76,
  OPUSDT: 1.68,
  APTUSDT: 8.8,
  DOTUSDT: 7.2,
  ATOMUSDT: 6.1,
  TIAUSDT: 5.4,
  SEIUSDT: 0.48,
  POLUSDT: 0.46,
  FTMUSDT: 0.78,
  BCHUSDT: 440.0,
  LTCUSDT: 102.0,

  // DeFi
  LINKUSDT: 18.4,
  AAVEUSDT: 235.0,
  UNIUSDT: 10.8,
  MKRUSDT: 1750.0,
  PENDLEUSDT: 4.9,
  INJUSDT: 21.5,
  CRVUSDT: 0.62,

  // AI
  RENDERUSDT: 6.8,
  FETUSDT: 1.38,
  TAOUSDT: 485.0,

  // Memes
  DOGEUSDT: 0.265,
  SHIBUSDT: 0.0000192,
  PEPEUSDT: 0.0000185,
  BONKUSDT: 0.0000215,
  FLOKIUSDT: 0.000185,
  WIFUSDT: 2.15,
  BABYUSDT: 0.0000000024,
  BABYDOGEUSDT: 0.0000000024,

  // TradFi Macro
  SPY: 585.2,
  QQQ: 510.5,
  NVDA: 142.8,
  AAPL: 232.0,
  TSLA: 250.4,
  GOLD: 2740.0,
  XAUUSDT: 2740.0,
  PAXGUSDT: 2740.0
};

/**
 * Returns a realistic benchmark price for any symbol, matching exact or partial token symbols.
 */
export function getBenchmarkPrice(symbol: string): number {
  if (!symbol) return 1.0;
  const clean = symbol.toUpperCase().trim();

  // 1. Direct match
  if (typeof BENCHMARK_PRICES[clean] === 'number') {
    return BENCHMARK_PRICES[clean];
  }

  // 2. Match without USDT / USD / BUSD suffix
  const base = clean.replace(/USDT$|USD$|BUSD$|PERP$/, '');
  const withUsdt = `${base}USDT`;
  if (typeof BENCHMARK_PRICES[withUsdt] === 'number') {
    return BENCHMARK_PRICES[withUsdt];
  }
  if (typeof BENCHMARK_PRICES[base] === 'number') {
    return BENCHMARK_PRICES[base];
  }

  // 3. Substring checks for prominent asset classes
  if (clean.includes('BTC')) return 92450.0;
  if (clean.includes('ETH')) return 3420.0;
  if (clean.includes('SOL')) return 188.5;
  if (clean.includes('BNB')) return 640.0;
  if (clean.includes('ADA')) return 0.785;
  if (clean.includes('XRP')) return 2.45;
  if (clean.includes('DOGE')) return 0.265;
  if (clean.includes('BCH')) return 440.0;
  if (clean.includes('LTC')) return 102.0;
  if (clean.includes('AVAX')) return 32.5;
  if (clean.includes('LINK')) return 18.4;
  if (clean.includes('AAVE')) return 235.0;
  if (clean.includes('SUI')) return 3.42;
  if (clean.includes('NEAR')) return 4.85;
  if (clean.includes('ARB')) return 0.76;
  if (clean.includes('OP')) return 1.68;
  if (clean.includes('TAO')) return 485.0;
  if (clean.includes('RENDER')) return 6.8;
  if (clean.includes('PEPE') || clean.includes('SHIB') || clean.includes('BONK') || clean.includes('BABY')) {
    return 0.0000185;
  }

  // 4. Default realistic baseline for modern altcoins
  return 1.25;
}

/**
 * Generates a realistic synthetic ticker payload for fallback scenarios,
 * with consistent prices, high/low boundaries, and volumes based on the asset's scale.
 */
export function generateRealisticTicker(symbol: string, existingPrice?: number) {
  const basePrice = existingPrice && existingPrice > 0 ? existingPrice : getBenchmarkPrice(symbol);
  const variancePct = Math.sin((Date.now() / 15000) + symbol.length) * 1.2;
  const currentPrice = basePrice * (1 + variancePct / 100);

  const isLowPrice = currentPrice < 1;
  const decimals = isLowPrice ? 6 : 2;

  const highPrice = currentPrice * 1.025;
  const lowPrice = currentPrice * 0.975;
  const volume = currentPrice > 1000 ? 35000 : currentPrice > 10 ? 450000 : 15000000;
  const quoteVolume = volume * currentPrice;

  return {
    symbol,
    lastPrice: currentPrice.toFixed(decimals),
    priceChangePercent: (variancePct * 1.5).toFixed(2),
    highPrice: highPrice.toFixed(decimals),
    lowPrice: lowPrice.toFixed(decimals),
    volume: volume.toString(),
    quoteVolume: quoteVolume.toFixed(0)
  };
}
