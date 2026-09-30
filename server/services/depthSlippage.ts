/**
 * 6.5.3 — Slippage por profundidade (G-12) — módulo PURO, sem I/O.
 *
 * Estima o slippage de executar um notional contra o book atual: varre os níveis
 * do lado da execução (asks para LONG, bids para SHORT), do melhor preço para o
 * pior, acumulando o notional consumido. O slippage é a distância do preço médio
 * (VWAP) de execução até o mid, em %.
 *
 * Sem liquidez suficiente no book, o restante é precificado além do último nível
 * (passo médio entre níveis, no lado que piora o preço) — book raso/vazio produz
 * slippage alto e honesto, nunca um número falso baixo.
 *
 * Acima de MAX_ESTIMATED_SLIPPAGE_PCT (default 0,15%, configurável via env) o
 * sinal é marcado `executable: false` com o motivo.
 */

import type { OrderBookDepthData } from '../../src/types.js';

/** Limite padrão do spec (0,15%). Configurável por operador via env. */
export const DEFAULT_MAX_ESTIMATED_SLIPPAGE_PCT = 0.15;

export function getMaxEstimatedSlippagePct(): number {
  const raw = Number(process.env.MAX_ESTIMATED_SLIPPAGE_PCT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_ESTIMATED_SLIPPAGE_PCT;
}

export function isSlippageAboveLimit(slippagePct: number, maxPct: number = getMaxEstimatedSlippagePct()): boolean {
  return slippagePct > maxPct;
}

/**
 * Slippage (%) estimado para executar `notional` contra o book, no lado `side`.
 * Retorna 0 quando não há como estimar (parâmetros inválidos) e Infinity quando
 * o book está vazio (nada executável com preço conhecido — fail-closed).
 */
export function estimateDepthSlippagePct(params: {
  notional: number;
  midPrice: number;
  book: OrderBookDepthData;
  side: 'LONG' | 'SHORT';
}): number {
  const { notional, midPrice, book, side } = params;

  if (!Number.isFinite(notional) || notional <= 0 || !Number.isFinite(midPrice) || midPrice <= 0) {
    return 0;
  }

  const levels = side === 'LONG'
    ? (book.asks || []).slice().sort((a, b) => a.price - b.price) // melhor (menor) ask primeiro
    : (book.bids || []).slice().sort((a, b) => b.price - a.price); // melhor (maior) bid primeiro

  const fillable = levels.filter(l => l.price > 0 && l.qty > 0);
  if (fillable.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let remaining = notional;
  let notionalFilled = 0;
  let qtyFilled = 0;

  for (const lvl of fillable) {
    if (remaining <= 0) break;
    const lvlNotional = lvl.price * lvl.qty;
    const takeNotional = Math.min(remaining, lvlNotional);
    notionalFilled += takeNotional;
    qtyFilled += takeNotional / lvl.price;
    remaining -= takeNotional;
  }

  if (qtyFilled <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  // Preço médio de execução. Com sobra sem book, o restante é executado além do
  // último nível (preço que piora), diluído no VWAP final.
  let avgFillPrice: number;
  if (remaining > 0) {
    const last = fillable[fillable.length - 1];
    const first = fillable[0];
    const avgStep = fillable.length > 1
      ? Math.abs(last.price - first.price) / (fillable.length - 1)
      : midPrice * 0.001; // 0.1% por nível quando só há um nível
    const step = avgStep > 0 ? avgStep : midPrice * 0.001;
    const extrapolatedPrice = side === 'LONG'
      ? last.price + step
      : Math.max(last.price - step, step); // nunca colapsa a ≤ 0
    const remainingQty = remaining / extrapolatedPrice;
    avgFillPrice = (notionalFilled + remaining) / (qtyFilled + remainingQty);
  } else {
    avgFillPrice = notionalFilled / qtyFilled;
  }

  // LONG paga asks (≥ mid ⇒ positivo); SHORT recebe bids (≤ mid ⇒ negativo, espelha).
  const signedPct = ((avgFillPrice - midPrice) / midPrice) * 100 * (side === 'SHORT' ? -1 : 1);
  return Math.max(0, signedPct);
}
