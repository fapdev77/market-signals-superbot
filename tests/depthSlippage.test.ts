import { describe, it, expect } from 'vitest';
import { estimateDepthSlippagePct, isSlippageAboveLimit } from '../server/services/depthSlippage.js';
import type { OrderBookDepthData, OrderBookLevel } from '../src/types.js';

/**
 * 6.5.3 / CA-5.4 — slippage estimado pela profundidade do book.
 *
 * Um notional sugerido varre níveis do book no lado da execução (asks para LONG,
 * bids para SHORT). Quanto mais raso o book para o notional, maior o slippage.
 * Acima de MAX_ESTIMATED_SLIPPAGE_PCT (padrão 0,15%) o sinal sai `executable: false`
 * com o motivo.
 */

function level(price: number, qty: number): OrderBookLevel {
  return { price, qty, totalQty: qty, totalUsd: price * qty, deviationPct: 0 };
}

function depth(params: { asks?: [number, number][]; bids?: [number, number][]; midPrice: number }): OrderBookDepthData {
  const asks = (params.asks ?? []).map(([p, q]) => level(p, q));
  const bids = (params.bids ?? []).map(([p, q]) => level(p, q));
  const bestBid = bids[0]?.price ?? params.midPrice;
  const bestAsk = asks[0]?.price ?? params.midPrice;
  const spread = Math.max(0, bestAsk - bestBid);
  return {
    symbol: 'TESTUSDT',
    timestamp: Date.now(),
    bids,
    asks,
    spread,
    spreadPct: (spread / params.midPrice) * 100,
    midPrice: params.midPrice,
    bidDepthUsd: bids.reduce((a, l) => a + l.totalUsd, 0),
    askDepthUsd: asks.reduce((a, l) => a + l.totalUsd, 0),
    totalDepthUsd: 0,
    imbalancePct: 0,
    imbalanceRatio: 1,
    pressureLabel: '',
    pressureBias: 'NEUTRAL',
    whaleWalls: {}
  };
}

describe('6.5.3 — estimativa de slippage por profundidade (CA-5.4)', () => {
  it('book profundo: notional pequeno paga ~o spread (slippage baixo)', () => {
    const book = depth({
      midPrice: 100,
      asks: [[100.01, 1000], [100.02, 1000], [100.03, 1000]],
      bids: [[99.99, 1000], [99.98, 1000]]
    });
    const s = estimateDepthSlippagePct({ notional: 500, midPrice: 100, book, side: 'LONG' });
    expect(s).toBeLessThan(0.05);
  });

  it('book raso: notional varre vários níveis ⇒ slippage alto', () => {
    const book = depth({
      midPrice: 100,
      asks: [[100.0, 1], [100.5, 1], [101.0, 1]], // 3 níveis × ~100 USD = 300 USD de profundidade
      bids: [[99.5, 10]]
    });
    const s = estimateDepthSlippagePct({ notional: 5000, midPrice: 100, book, side: 'LONG' });
    // Varre tudo: última execução a ~101.0 → slippage ~1%
    expect(s).toBeGreaterThan(0.15);
  });

  it('book raso ultrapassa o limite padrão e marca o sinal (isSlippageAboveLimit)', () => {
    const book = depth({
      midPrice: 100,
      asks: [[100.0, 1], [100.5, 1]],
      bids: [[99.5, 10]]
    });
    const s = estimateDepthSlippagePct({ notional: 5000, midPrice: 100, book, side: 'LONG' });
    expect(isSlippageAboveLimit(s)).toBe(true);
  });

  it('SHORT varre o lado dos bids (melhor bid primeiro)', () => {
    const book = depth({
      midPrice: 100,
      asks: [[100.5, 10]],
      bids: [[100.0, 1], [99.0, 1], [97.0, 3]]
    });
    const s = estimateDepthSlippagePct({ notional: 5000, midPrice: 100, book, side: 'SHORT' });
    // 100+99+291=490 < 5000 → esgota o book e paga além do último nível (97) → slippage > 3%
    expect(s).toBeGreaterThan(3);
  });

  it('slippage estimado nunca é negativo', () => {
    const book = depth({
      midPrice: 100,
      asks: [[99.0, 100]], // dado patológico: ask abaixo do mid
      bids: [[99.5, 100]]
    });
    expect(estimateDepthSlippagePct({ notional: 10, midPrice: 100, book, side: 'LONG' })).toBeGreaterThanOrEqual(0);
  });

  it('book vazio ⇒ slippage infinito (não executável, fail-closed)', () => {
    const book = depth({ midPrice: 100, asks: [], bids: [] });
    const s = estimateDepthSlippagePct({ notional: 100, midPrice: 100, book, side: 'LONG' });
    expect(isSlippageAboveLimit(s)).toBe(true);
  });

  it('limite configurável: MAX_ESTIMATED_SLIPPAGE_PCT é respeitado', () => {
    expect(isSlippageAboveLimit(0.14, 0.15)).toBe(false);
    expect(isSlippageAboveLimit(0.16, 0.15)).toBe(true);
    expect(isSlippageAboveLimit(0.16, 0.2)).toBe(false);
  });
});
