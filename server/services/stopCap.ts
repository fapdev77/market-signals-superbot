/**
 * 6.7.4 — Teto do stop (G-14) — módulo PURO, sem I/O.
 *
 * `MAX_STOP_PCT` por estratégia: acima do teto, o sinal é suprimido com motivo
 * `STOP_TOO_WIDE` (CA-7.3) — nunca lança; a decisão de suprimir é do caller.
 *
 * Defaults (D7, aprovado por dados em 2026-09-30): p75 da distância de stop
 * histórica por categoria (n≈15k sinais reais no DB, ~288k velas 1m):
 *   SCALP 1.75 · DAY_TRADE 1.85 · INTRADAY 2.0 · COUNTER_TRADE 2.30 ·
 *   SWING 3.2 · POSITION 5.3 (p75: 1.73/1.83/1.91/2.27/3.19/5.26).
 * CUSTOM cai no teto de INTRADAY (fail-conservative). Sobreponível por env
 * `MAX_STOP_PCT_<CATEGORIA>` (ex.: MAX_STOP_PCT_SCALP=1.5).
 */

export type StrategyCategoryLike =
  | 'SCALP' | 'DAY_TRADE' | 'INTRADAY' | 'SWING' | 'POSITION' | 'COUNTER_TRADE' | 'CUSTOM';

export const STRATEGY_STOP_CAP_PCT: Record<StrategyCategoryLike, number> = {
  SCALP: 1.75,
  DAY_TRADE: 1.85,
  INTRADAY: 2.0,
  COUNTER_TRADE: 2.3,
  SWING: 3.2,
  POSITION: 5.3,
  CUSTOM: 2.0
};

export function getStopCapPct(category: StrategyCategoryLike | string | undefined): number {
  const key = String(category || '').toUpperCase() as StrategyCategoryLike;
  const fallback = STRATEGY_STOP_CAP_PCT[key] ?? STRATEGY_STOP_CAP_PCT.CUSTOM;
  const env = Number(process.env[`MAX_STOP_PCT_${key}`]);
  return Number.isFinite(env) && env > 0 ? env : fallback;
}

export interface StopCapResult {
  allowed: boolean;
  reason?: string;
  /** Distância |entry−stop|/entry em % (a mesma noção de `signalRiskPct`). */
  stopDistancePct: number;
  capPct: number;
}

export function enforceStopCap(params: {
  strategyCategory: StrategyCategoryLike | string | undefined;
  entryPrice: number;
  stopLoss: number;
}): StopCapResult {
  const capPct = getStopCapPct(params.strategyCategory);

  if (
    !Number.isFinite(params.entryPrice) || params.entryPrice <= 0 ||
    !Number.isFinite(params.stopLoss) || params.stopLoss <= 0
  ) {
    return {
      allowed: false,
      reason: `STOP_TOO_WIDE: preços inválidos para medir a distância de stop (entry=${params.entryPrice}, stop=${params.stopLoss}).`,
      stopDistancePct: Number.NaN,
      capPct
    };
  }

  const stopDistancePct = (Math.abs(params.entryPrice - params.stopLoss) / params.entryPrice) * 100;

  if (stopDistancePct > capPct) {
    return {
      allowed: false,
      reason: `STOP_TOO_WIDE: distância de stop ${stopDistancePct.toFixed(2)}% excede o teto de ${capPct}% para ${String(params.strategyCategory)}.`,
      stopDistancePct,
      capPct
    };
  }

  return { allowed: true, stopDistancePct, capPct };
}
