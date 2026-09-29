/**
 * R-2 — geradores de candles sintéticos (ver a regra do diretório em `./prng.ts`).
 *
 * - `generateSynthetic1mKlineRows`: histórico 1m determinístico por (symbol, startTime), usado
 *   quando a Binance não responde (gravado com `origin = 'DEMO'`) e pelos seeds de teste;
 * - `generateFallbackKlines`: candles 15m "plausíveis" a partir do preço de referência, usados
 *   quando `fetchKlines` falha com `ALLOW_SYNTHETIC_DATA='true'`.
 */
import { getBenchmarkPrice } from '../../src/utils/benchmarkPrices.js';
import type { KlineCandle } from '../../src/types.js';
import type { HistoricalKlineRow } from '../backtest_db/index.js';
import { createSeededRandom, symbolSeed } from './prng.js';

const KLINE_1M_MS = 60 * 1000;
const KLINE_15M_MS = 15 * 60 * 1000;

/**
 * Gera candles 1m sintéticos no intervalo [startTime, endTime].
 *
 * Determinístico: o stream pseudoaleatório é derivado de (símbolo, startTime), então dois
 * backtests sobre a mesma janela produzem exatamente os mesmos candles. Antes da Fase 2.5.4
 * este código usava `Math.random()` e a garantia de determinismo não existia.
 */
export function generateSynthetic1mKlineRows(
  symbol: string,
  startTime: number,
  endTime: number
): HistoricalKlineRow[] {
  let basePrice = getBenchmarkPrice(symbol);
  const rows: HistoricalKlineRow[] = [];
  let curTime = startTime;

  const random = createSeededRandom(symbolSeed(symbol) ^ (startTime % 2147483647));

  while (curTime <= endTime) {
    const variation = (Math.sin(curTime / 300000) + (random() - 0.495)) * (basePrice * 0.002);
    const open = basePrice;
    const close = basePrice + variation;
    const high = Math.max(open, close) + random() * (basePrice * 0.001);
    const low = Math.min(open, close) - random() * (basePrice * 0.001);

    // Generate volume with realistic periodic spikes (representing breakout sessions)
    let volume = random() * 20 + 5;
    if (random() < 0.08) {
      volume = volume * (2.0 + random() * 3.0);
    }

    // Generate realistic wide distribution for taker buy volume (CVD)
    const takerBuyBaseVolume = volume * (0.33 + random() * 0.34);

    rows.push({
      symbol,
      interval: '1m',
      openTime: curTime,
      closeTime: curTime + KLINE_1M_MS - 1,
      open,
      high,
      low,
      close,
      volume,
      quoteAssetVolume: volume * close,
      trades: Math.floor(random() * 150) + 20,
      takerBuyBaseVolume,
      takerBuyQuoteVolume: takerBuyBaseVolume * close
    });

    basePrice = close;
    curTime += KLINE_1M_MS;
  }

  return rows;
}

/**
 * Gera candles 15m sintéticos a partir do preço de referência do símbolo.
 * Não é determinístico (usa `Math.random()`), como no código original.
 */
export function generateFallbackKlines(symbol: string, limit: number = 50): KlineCandle[] {
  const candles: KlineCandle[] = [];
  let basePrice = getBenchmarkPrice(symbol);
  const now = Date.now();

  for (let i = limit - 1; i >= 0; i--) {
    const ts = now - i * KLINE_15M_MS;
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
