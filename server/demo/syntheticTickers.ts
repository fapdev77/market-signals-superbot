/**
 * R-2 — universo de triagem sintético (ver a regra do diretório em `./prng.ts`).
 *
 * Antes vivia como método privado de `MarketScreenerService`. Ele monta uma lista fixa de
 * símbolos com preços de referência e se passa por resposta de `/ticker/24hr`; por isso é usado
 * apenas quando o screener não consegue falar com a exchange **e** `ALLOW_SYNTHETIC_DATA='true'`.
 */
import { DEFAULT_SYMBOLS } from '../binanceService.js';
import { getBenchmarkPrice } from '../../src/utils/benchmarkPrices.js';

export function generateFallbackRawTickers(): any[] {
  const symbols = [
    ...DEFAULT_SYMBOLS,
    'APTUSDT', 'RENDERUSDT', 'TAOUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT', 'ARBUSDT', 'OPUSDT', 'PENDLEUSDT',
    // Stablecoin pairs in fallback dataset to demonstrate exclusion list
    'USDCUSDT', 'USDGUSDT', 'PYUSDUSDT', 'FDUSDUSDT', 'EURUSDT'
  ];
  return symbols.map(sym => {
    const p = getBenchmarkPrice(sym);
    const isLow = p < 1;
    const decimals = isLow ? 6 : 2;
    return {
      symbol: sym,
      lastPrice: p.toFixed(decimals),
      priceChangePercent: ((Math.sin(sym.length * 2.5) * 4.5)).toFixed(2),
      volume: '150000',
      quoteVolume: (50000000 + (sym.length * 15000000)).toString(),
      highPrice: (p * 1.025).toFixed(decimals),
      lowPrice: (p * 0.975).toFixed(decimals)
    };
  });
}
