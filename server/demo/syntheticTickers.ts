/**
 * R-2 — universo de triagem sintético (ver a regra do diretório em `./prng.ts`).
 *
 * Antes vivia como método privado de `MarketScreenerService`. Ele monta uma lista fixa de
 * símbolos com preços de referência e se passa por resposta de `/ticker/24hr`; por isso é usado
 * apenas quando o screener não consegue falar com a exchange **e** `ALLOW_SYNTHETIC_DATA='true'`.
 */
import { DEFAULT_SYMBOLS } from '../binanceService.js';
import { getBenchmarkPrice } from '../../src/utils/benchmarkPrices.js';

/**
 * R-2 — payload de ticker plausível para cenários de contingência.
 *
 * Antes vivia em `src/utils/benchmarkPrices.ts`, fora de `server/demo/` e portanto fora da
 * regra do diretório (ver `./prng.ts`) que exige `ALLOW_SYNTHETIC_DATA === 'true'` para
 * qualquer dado fabricado. Não tinha chamador — mas um gerador de ticker solto em
 * `src/utils/`, sem gate, é exatamente o tipo de coisa que alguém religa num momento de
 * aperto e passa a servir preço inventado como se fosse de mercado.
 *
 * Nenhum chamador no momento. Se for necessário, use-o APENAS atrás do gate de
 * `ALLOW_SYNTHETIC_DATA` e marque a origem como `DEMO` na persistência.
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
