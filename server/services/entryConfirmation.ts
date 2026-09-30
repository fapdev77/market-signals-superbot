/**
 * 6.7.2 — Contrato de confirmação de entrada (G-14) — módulo PURO, sem I/O.
 *
 * `confirmEntry(direction, klines1m, klines5m, confluenceScore)` implementa as regras
 * R1–R5 APROVADAS pelo dono (specs/phase-6-7-entry-confirmation.md §8, 2026-09-30):
 *   R1 anti-spike (pavio ≤ 0.55 do range, último 1m fechado) — obrigatória
 *   R2 direção do corpo (close vs open, último 1m fechado) — obrigatória
 *   R3 fluxo taker (takerBuyRatio ≥ 0.49 LONG / ≤ 0.51 SHORT) — obrigatória
 *   R4 continuidade de tendência (vela de 5m REAL, D2 — não 5×1m) — obrigatória
 *   R5 confluência mínima (score ≥ 60) — obrigatória
 * (R6 — toque da zona — é avaliada no ciclo de vida, fora deste contrato.)
 *
 * Todas as regras que falham aparecem em `reasons` (diagnóstico completo, não só a
 * primeira). Sem dados suficientes ⇒ não confirmado (fail-closed).
 *
 * Thresholds via env (D6) com os valores aprovados como default.
 */

export interface KlineLike {
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume comprado por takers da vela (campo `t` dos klines da Binance). */
  takerBuyBaseVolume?: number;
  volume?: number;
}

export type EntryDirection = 'LONG' | 'SHORT';

export interface EntryThresholds {
  maxWickRatio: number;
  takerBuyLong: number;
  takerBuyShort: number;
  minConfluence: number;
}

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Thresholds aprovados (D6); sobreponíveis por env. */
export const ENTRY_THRESHOLDS: EntryThresholds = {
  get maxWickRatio() { return numEnv('ENTRY_MAX_WICK_RATIO', 0.55); },
  get takerBuyLong() { return numEnv('ENTRY_TAKER_BUY_LONG', 0.49); },
  get takerBuyShort() { return numEnv('ENTRY_TAKER_BUY_SHORT', 0.51); },
  get minConfluence() { return numEnv('ENTRY_MIN_CONFLUENCE', 60); }
};

export interface ConfirmEntryResult {
  confirmed: boolean;
  /** Motivos das regras que falharam (identificáveis: wick/body/taker/trend/confluence). */
  reasons: string[];
  details?: {
    wickRatio?: number;
    takerBuyRatio?: number;
    bodyDirection?: 'UP' | 'DOWN' | 'FLAT';
    trend5mDirection?: 'UP' | 'DOWN' | 'FLAT';
  };
}

const MIN_1M_CANDLES = 2; // última fechada + contexto

export function confirmEntry(params: {
  direction: EntryDirection;
  /** Velas de 1m reais (a última é a vela FECHADA usada pelas regras R1–R3). */
  klines1m: KlineLike[];
  /** Vela(s) de 5m REAIS da exchange (D2) — a última fechada define a tendência. */
  klines5m: KlineLike[];
  confluenceScore: number;
}): ConfirmEntryResult {
  const { direction, confluenceScore } = params;
  const reasons: string[] = [];
  const details: NonNullable<ConfirmEntryResult['details']> = {};

  const candles = params.klines1m || [];
  const c1 = candles[candles.length - 1]; // último 1m fechado

  // Fail-closed: sem vela 1m fechada ou sem vela 5m real, não confirma.
  if (!c1 || typeof c1.open !== 'number' || typeof c1.close !== 'number') {
    return { confirmed: false, reasons: ['sem vela 1m fechada para confirmar (fail-closed)'], details };
  }
  const c5 = (params.klines5m || [])[params.klines5m.length - 1];
  if (!c5 || typeof c5.open !== 'number' || typeof c5.close !== 'number') {
    reasons.push('R4 trend: vela de 5m real ausente (fail-closed)');
  }

  const isLong = direction === 'LONG';

  // R1 — anti-spike: pavio contrário ≤ maxWickRatio do range
  if (c1) {
    const range = Math.abs(c1.high - c1.low);
    const upperWick = c1.high - Math.max(c1.open, c1.close);
    const lowerWick = Math.min(c1.open, c1.close) - c1.low;
    const wickRatio = range > 0 ? (isLong ? upperWick : lowerWick) / range : 1; // range 0 = pathological
    details.wickRatio = wickRatio;
    if (range <= 0 || wickRatio > ENTRY_THRESHOLDS.maxWickRatio) {
      reasons.push(`R1 wick: pavio ${isLong ? 'superior' : 'inferior'} ${(wickRatio * 100).toFixed(1)}% do range excede o limite (${ENTRY_THRESHOLDS.maxWickRatio * 100}%).`);
    }

    // R2 — direção do corpo
    const bodyDirection: 'UP' | 'DOWN' | 'FLAT' = c1.close > c1.open ? 'UP' : c1.close < c1.open ? 'DOWN' : 'FLAT';
    details.bodyDirection = bodyDirection;
    const bodyOk = isLong ? c1.close >= c1.open : c1.close <= c1.open;
    if (!bodyOk) {
      reasons.push(`R2 body: corpo do 1m é ${bodyDirection}, esperado ${isLong ? 'UP (close >= open)' : 'DOWN (close <= open)'}.`);
    }

    // R3 — fluxo taker
    const vol = c1.volume ?? 0;
    const takerBuyRatio = vol > 0 ? (c1.takerBuyBaseVolume ?? 0) / vol : 0.5;
    details.takerBuyRatio = takerBuyRatio;
    const takerOk = isLong
      ? takerBuyRatio >= ENTRY_THRESHOLDS.takerBuyLong
      : takerBuyRatio <= ENTRY_THRESHOLDS.takerBuyShort;
    if (!takerOk) {
      reasons.push(`R3 taker: takerBuyRatio ${takerBuyRatio.toFixed(3)} fora da faixa ${isLong ? `>= ${ENTRY_THRESHOLDS.takerBuyLong}` : `<= ${ENTRY_THRESHOLDS.takerBuyShort}`}.`);
    }
  }

  // R4 — tendência na vela de 5m REAL (motivo já adicionado acima quando ausente)
  if (c5) {
    const trend5mDirection: 'UP' | 'DOWN' | 'FLAT' = c5.close > c5.open ? 'UP' : c5.close < c5.open ? 'DOWN' : 'FLAT';
    details.trend5mDirection = trend5mDirection;
    const trendOk = isLong ? c5.close > c5.open : c5.close < c5.open;
    if (!trendOk) {
      reasons.push(`R4 trend: vela de 5m real é ${trend5mDirection}, esperado ${isLong ? 'UP' : 'DOWN'}.`);
    }
  }

  // R5 — confluência mínima
  if (!(typeof confluenceScore === 'number' && confluenceScore >= ENTRY_THRESHOLDS.minConfluence)) {
    reasons.push(`R5 confluence: score ${confluenceScore} abaixo do mínimo (${ENTRY_THRESHOLDS.minConfluence}).`);
  }

  return { confirmed: reasons.length === 0, reasons, details };
}
