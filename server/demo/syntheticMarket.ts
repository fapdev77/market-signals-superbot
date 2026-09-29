/**
 * R-2 — simulação de posicionamento e liquidações (ver a regra do diretório em `./prng.ts`).
 *
 * Estes dois geradores existiam inline dentro de `binanceService.fetchLongShortRatio` e de
 * `binanceWebsocket.getLiquidationsSummary`. Os dois alimentam fatores de confluência, então
 * mantê-los aqui deixa explícito que qualquer número que saia deles é invenção, e não leitura
 * de mercado. Não importam nada de `binanceService` (evita ciclo de import).
 */
import type { LiquidationSummary, LongShortRatioData } from '../../src/types.js';
import { symbolSeed } from './prng.js';

/**
 * Posicionamento "plausível" (retail vs smart money) quando os 3 endpoints de long/short falham
 * e `ALLOW_SYNTHETIC_DATA='true'`. O resultado é servido com a mesma forma do dado real, por isso
 * o chamador é quem precisa marcar a origem como DEMO.
 */
export function simulateLongShortRatio(
  symbol: string,
  currentPrice?: number,
  now: number = Date.now()
): LongShortRatioData {
  const cleanSymbol = symbol.toUpperCase();
  const seed = symbolSeed(cleanSymbol);
  const cycle = Math.sin(seed + now / 180000);
  const retailBias = 0.52 + cycle * 0.18; // 34% to 70% long
  const longAccountPct = Number((retailBias * 100).toFixed(1));
  const shortAccountPct = Number(((1 - retailBias) * 100).toFixed(1));
  const globalRatio = Number((retailBias / (1 - retailBias)).toFixed(2));

  // Smart Money often fades extreme retail crowding
  const smartBias = retailBias > 0.60 ? retailBias - 0.22 : retailBias < 0.40 ? retailBias + 0.22 : 0.50;
  const topTraderLongPositionPct = Number((smartBias * 100).toFixed(1));
  const topTraderShortPositionPct = Number(((1 - smartBias) * 100).toFixed(1));
  const topTraderPositionRatio = Number((smartBias / (1 - smartBias)).toFixed(2));

  const takerBias = 0.50 + cycle * 0.12;
  const takerRatio = Number((takerBias / (1 - takerBias)).toFixed(2));
  const baseUsd = currentPrice ? currentPrice * 1500 : 2500000;
  const takerBuyVolUsd = Math.round(baseUsd * takerBias);
  const takerSellVolUsd = Math.round(baseUsd * (1 - takerBias));

  return {
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
}

/**
 * Fluxo de liquidações sintético (sempre marcado com `isSimulated: true`, para a UI poder
 * rotular). Só é usado quando o buffer do WebSocket está vazio e a flag está ligada.
 */
export function simulateLiquidationSummary(
  symbol: string,
  currentPrice: number,
  now: number = Date.now()
): LiquidationSummary {
  const cleanSymbol = symbol.toUpperCase();
  const seed = symbolSeed(cleanSymbol);
  const cycle = Math.sin(seed + now / 120000);
  const baseLiq = currentPrice > 1000 ? 850000 : currentPrice > 100 ? 320000 : 95000;

  const simSellLiq = Math.max(15000, Math.round(baseLiq * (1 + cycle * 0.6)));
  const simBuyLiq = Math.max(15000, Math.round(baseLiq * (1 - cycle * 0.6)));

  return {
    totalBuyLiqUSD: simBuyLiq,
    totalSellLiqUSD: simSellLiq,
    netLiqUSD: simBuyLiq - simSellLiq,
    isSimulated: true,
    recentEvents: [
      {
        symbol: cleanSymbol,
        side: cycle > 0 ? 'SELL' : 'BUY',
        price: currentPrice * (cycle > 0 ? 0.996 : 1.004),
        qty: parseFloat(((baseLiq * 0.4) / currentPrice).toFixed(3)),
        usdValue: Math.round(baseLiq * 0.4),
        timestamp: now - 3 * 60 * 1000
      }
    ],
    lastSpikeAt: now - 3 * 60 * 1000
  };
}
