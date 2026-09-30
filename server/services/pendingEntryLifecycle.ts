/**
 * 6.7.3 — Ciclo de vida PENDING_ENTRY (G-14) — módulo PURO, sem I/O.
 *
 * Regras APROVADAS (specs/phase-6-7-entry-confirmation.md §8, D1–D8, 2026-09-30):
 *  - PENDING_ENTRY → ACTIVE somente com toque da zona (R6: high/low ∩ [entryMin, entryMax])
 *    **E** `confirmEntry` confirmando; o evento ENTRY do ledger nasce no preenchimento,
 *    a `entryPrice = clamp(close_1m, entryMin, entryMax)` (D3).
 *  - Sem toque em N candles 1m → terminal ENTRY_NOT_FILLED (não-evento para o R — D4).
 *  - Movimento adverso além do stop antes do toque → terminal ENTRY_INVALIDATED.
 *  - N = ENTRY_MAX_WAIT_CANDLES (3, base 1m) escalado por categoria (D5): SCALP/DAY_TRADE
 *    usam a base; INTRADAY/COUNTER_TRADE ×4 (≈15m); SWING ×8; POSITION ×16.
 *  - Apenas a janela dos últimos N candles é considerada (candles anteriores ao createdAt
 *    não contam para expiração).
 *
 * O caller persiste transições, grava o ledger e atualiza o sinal — aqui é só a decisão.
 */

import type { KlineCandle } from '../../src/types.js';

export type PendingLifecycleTransition =
  | 'NONE'
  | 'ACTIVATED'
  | 'ENTRY_NOT_FILLED'
  | 'ENTRY_INVALIDATED';

export interface PendingEntrySignal {
  id: string;
  direction: 'LONG' | 'SHORT';
  entryZone: [number, number];
  stopLoss: number;
  target1: number;
  target2: number;
  strategyCategory?: string;
  createdAt?: number;
}

export interface ConfirmEntryFnResult {
  confirmed: boolean;
  reasons: string[];
}

export type ConfirmEntryFn = (params: {
  direction: 'LONG' | 'SHORT';
  klines1m: KlineCandle[];
  klines5m: KlineCandle[];
  confluenceScore?: number;
}) => ConfirmEntryFnResult;

/** Base aprovada (D5): 3 velas de 1m para as categorias de curto prazo. */
export const ENTRY_MAX_WAIT_CANDLES = 3;

/**
 * D8 — feature flag do ciclo PENDING_ENTRY. Default OFF: o ciclo só ativa com
 * `ENTRY_CONFIRMATION_ENABLED='true'`, após o backtest comparativo (risco: muda
 * o perfil dos sinais; evidência 6.9 só começa depois do congelamento).
 */
export function isPendingEntryEnabled(): boolean {
  return process.env.ENTRY_CONFIRMATION_ENABLED === 'true';
}

const CATEGORY_WAIT_MULTIPLIER: Record<string, number> = {
  SCALP: 1,
  DAY_TRADE: 1,
  INTRADAY: 4,
  COUNTER_TRADE: 4,
  SWING: 8,
  POSITION: 16,
  CUSTOM: 4
};

export function entryWaitCandlesFor(category: string | undefined): number {
  const key = String(category || 'INTRADAY').toUpperCase();
  const mult = CATEGORY_WAIT_MULTIPLIER[key] ?? CATEGORY_WAIT_MULTIPLIER.CUSTOM;
  return ENTRY_MAX_WAIT_CANDLES * mult;
}

/** clamp(v, lo, hi) — preço de preenchimento D3. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface PendingEntryEvaluation {
  transition: PendingLifecycleTransition;
  /** Preço de preenchimento (só em ACTIVATED). */
  entryPrice?: number;
  /** openTime do candle 1m que tocou a zona (só em ACTIVATED). */
  fillCandleOpenTime?: number;
  /** Motivo humano da transição (para expiration_reason/log). */
  reason?: string;
}

export function evaluatePendingEntry(params: {
  signal: PendingEntrySignal;
  /** Velas de 1m REAIS desde a emissão (a atual em formação pode vir incluída). */
  candles1m: KlineCandle[];
  /** Injeção do contrato 6.7.2 (puro — o caller decide como buscar klines5m). */
  confirm: ConfirmEntryFn;
  /** Score de confluência para o confirmEntry. */
  confluenceScore?: number;
  /** Velas de 5m reais para o confirmEntry (pode ser vazio — o contrato é fail-closed). */
  klines5m?: KlineCandle[];
  now?: number;
}): PendingEntryEvaluation {
  const { signal, confirm } = params;
  const [entryMin, entryMax] = signal.entryZone;
  const isLong = signal.direction === 'LONG';
  const waitCandles = entryWaitCandlesFor(signal.strategyCategory);

  const all = params.candles1m || [];
  // Só candles emitidos a partir da criação do sinal contam para o ciclo.
  // (KlineCandle usa `timestamp` como open time.)
  const candles = all.filter(c =>
    signal.createdAt === undefined || c.timestamp >= signal.createdAt
  );

  if (candles.length === 0) {
    return { transition: 'NONE', reason: 'sem candles 1m desde a emissão' };
  }

  // 1) Varre os candles procurando toque + confirmação (o primeiro que preenche vence).
  for (const candle of candles) {
    const touchesZone = candle.high >= entryMin && candle.low <= entryMax;
    if (!touchesZone) continue;

    const confirmation = confirm({
      direction: signal.direction,
      klines1m: [candle],
      klines5m: params.klines5m || [],
      confluenceScore: params.confluenceScore
    });
    if (!confirmation.confirmed) {
      // Toque sem confirmação: segue pendente (pode preencher num candle futuro).
      continue;
    }

    // D3: preço de preenchimento = clamp(close do candle 1m, entryMin, entryMax).
    const entryPrice = clamp(candle.close, entryMin, entryMax);
    return {
      transition: 'ACTIVATED',
      entryPrice,
      fillCandleOpenTime: candle.timestamp,
      reason: `Zona de entrada tocada e confirmação aprovada (fill ${entryPrice}).`
    };
  }

  // 2) Invalidação: movimento adverso além do stop antes de tocar a zona.
  for (const candle of candles) {
    const invalidated = isLong ? candle.high < signal.stopLoss : candle.low > signal.stopLoss;
    if (invalidated) {
      return {
        transition: 'ENTRY_INVALIDATED',
        reason: isLong
          ? `Preço ficou integralmente abaixo do stop (${signal.stopLoss}) antes de tocar a zona.`
          : `Preço ficou integralmente acima do stop (${signal.stopLoss}) antes de tocar a zona.`
      };
    }
  }

  // 3) Expiração: mais de N candles 1m sem toque (D5).
  if (candles.length > waitCandles) {
    return {
      transition: 'ENTRY_NOT_FILLED',
      reason: `Sem preenchimento em ${waitCandles} candles 1m (categoria ${String(signal.strategyCategory)}) — não-evento para o R (D4).`
    };
  }

  return { transition: 'NONE', reason: 'aguardando toque/validade' };
}
