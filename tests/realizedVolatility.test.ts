import { describe, it, expect } from 'vitest';
import { computeDailyRealizedVol } from '../src/utils/realizedVolatility';

/**
 * C-08 (FASE 0) — comportamento de `computeDailyRealizedVol`.
 *
 * O contrato: a volatilidade diária é MEDIDA sobre retornos reais das velas e
 * `null` quando a amostra não sustenta a medida — aí o chamador mantém a
 * premissa paramétrica e rotula a procedência. Nada de alegar "medido" com
 * amostra insuficiente, vazio de feed ou série sem variação.
 */

const MIN_RETURNS = 20; // espelha o mínimo da implementação (20 retornos)
const MS_15M = 15 * 60_000;
const START = Date.UTC(2026, 0, 1, 0, 0, 0);

/** Série determinística com variação real de preço (nunca constante). */
function candles(
  n: number,
  opts: { intervalMs?: number; startTs?: number; shiftFrom?: number; shiftMs?: number } = {}
): Array<{ timestamp: number; close: number }> {
  const intervalMs = opts.intervalMs ?? MS_15M;
  const startTs = opts.startTs ?? START;
  return Array.from({ length: n }, (_, i) => {
    const ts = startTs + i * intervalMs + (opts.shiftFrom !== undefined && i >= opts.shiftFrom ? (opts.shiftMs ?? 0) : 0);
    return { timestamp: ts, close: 100 * (1 + 0.02 * Math.sin(i / 3) + 0.01 * Math.cos(i / 7)) };
  });
}

describe('C-08 — volatilidade diária realizada é medida, nunca alegada', () => {
  it('série regular de 96 velas 15m ⇒ medida com intervalo e janela coerentes', () => {
    const result = computeDailyRealizedVol(candles(96));
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.dailyVol).toBeGreaterThan(0);
    expect(Number.isFinite(result.dailyVol)).toBe(true);
    expect(result.returnsUsed).toBe(95);
    expect(result.intervalMinutes).toBe(15);
    // 95 intervalos de 15 min ≈ 23,75 h de janela real
    expect(result.windowHours).toBeCloseTo(23.75, 2);
  });

  it('menos de 20 retornos ⇒ null (sem medida alegada)', () => {
    expect(computeDailyRealizedVol(candles(10))).toBeNull();
    expect(computeDailyRealizedVol(candles(MIN_RETURNS))).toBeNull(); // 20 velas = 19 retornos
  });

  it('a fronteira exata (20 retornos) sustenta a medida', () => {
    const result = computeDailyRealizedVol(candles(MIN_RETURNS + 1));
    expect(result).not.toBeNull();
    if (result) expect(result.returnsUsed).toBe(MIN_RETURNS);
  });

  it('vazio de feed: o par atravessando o salto é descartado, só pares válidos contam', () => {
    // um candle "perdido" faz o delta da posição 50 virar 2 intervalos (30 min)
    const result = computeDailyRealizedVol(candles(96, { shiftFrom: 50, shiftMs: MS_15M }));
    expect(result).not.toBeNull();
    if (!result) return;
    // 95 deltas − 1 salto descartado = 94 retornos medidos
    expect(result.returnsUsed).toBe(94);
    // o intervalo mediano segue 15m (o salto não contamina a mediana)
    expect(result.intervalMinutes).toBe(15);
    expect(result.dailyVol).toBeGreaterThan(0);
  });

  it('velas com close inválido são filtradas; o par que atravessa o vazio também', () => {
    const series = candles(60);
    series[10].close = Number.NaN;
    series[20].close = 0;
    series[30].close = -1;
    const result = computeDailyRealizedVol(series);
    expect(result).not.toBeNull();
    if (!result) return;
    // 60 velas − 3 inválidas = 57 usadas ⇒ 56 pares; os 3 pares que atravessam
    // o vazio têm delta de 2 intervalos e são descartados (não são retornos do
    // mercado) ⇒ 53 retornos medidos
    expect(result.returnsUsed).toBe(53);
    expect(result.intervalMinutes).toBe(15);
  });

  it('série sem variação de preço não vira "vol medida zero"', () => {
    const flat = Array.from({ length: 60 }, (_, i) => ({ timestamp: START + i * MS_15M, close: 100 }));
    expect(computeDailyRealizedVol(flat)).toBeNull();
  });

  it('dispersão maior de retornos ⇒ vol diária maior (monotonia básica)', () => {
    const calm = candles(96).map(c => ({ ...c, close: 100 + (c.close - 100) * 0.2 }));
    const wild = candles(96).map(c => ({ ...c, close: 100 + (c.close - 100) * 5 }));
    const calmResult = computeDailyRealizedVol(calm);
    const wildResult = computeDailyRealizedVol(wild);
    expect(calmResult).not.toBeNull();
    expect(wildResult).not.toBeNull();
    if (!calmResult || !wildResult) return;
    expect(wildResult.dailyVol).toBeGreaterThan(calmResult.dailyVol);
  });

  it('entrada vazia ou nula ⇒ null', () => {
    expect(computeDailyRealizedVol([])).toBeNull();
    expect(computeDailyRealizedVol(null as never)).toBeNull();
  });
});
