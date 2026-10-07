import { describe, it, expect } from 'vitest';
import { calculateFibonacci } from '../server/binanceService';
import type { KlineCandle } from '../src/types';

/**
 * A-03 (FASE 1) — Fibonacci por pivôs/fractais, direção por ESTRUTURA.
 *
 * Antes: `swingHigh`/`swingLow` eram o máximo/mínimo de TODA a janela e a
 * direção vinha de `hhIndex < llIndex` (ordem cronológica de aparição). Em rango
 * essa ordem era quase arbitrária: a classificação invertia entre avaliações e
 * movia `fib618`/`fib68`, `inGoldenPocket`, suporte/resistência, stop e alvo.
 */

interface CandleSpec { high: number; low: number }

function series(specs: CandleSpec[]): KlineCandle[] {
  return specs.map((s, i) => ({
    timestamp: i * 900000,
    open: (s.high + s.low) / 2,
    high: s.high,
    low: s.low,
    close: (s.high + s.low) / 2,
    volume: 100,
    takerBuyVolume: 50
  }));
}

const FLAT: CandleSpec = { high: 100, low: 99 };
const f = (v: number): CandleSpec => ({ high: v + 1, low: v - 1 });

/** Downtrend estrutural: topo e fundo descendentes. H1=124 (i2), L1=100 (i8), H2=114 (i13), L2=95 (i18). */
const DOWNTREND = series([
  { high: 110, low: 109 }, { high: 110, low: 109 },
  { high: 124, low: 122 },
  f(104), f(104), f(104), f(104),
  { high: 112, low: 104 },
  { high: 108, low: 100 },
  { high: 112, low: 105 },
  f(104), f(104), f(104),
  { high: 114, low: 108 },
  f(104), f(104), f(104),
  { high: 112, low: 104 },
  { high: 108, low: 95 },
  { high: 112, low: 104 },
  f(104), f(104)
]);

/** Uptrend estrutural: topo e fundo ascendentes. L1=99 (i2), H1=120 (i8), L2=110 (i13), H2=130 (i18). */
const UPTREND = series([
  { high: 115, low: 114 }, { high: 115, low: 114 },
  { high: 112, low: 99 },
  { high: 116, low: 100 },
  { high: 116, low: 100 }, { high: 116, low: 100 }, { high: 116, low: 100 }, { high: 116, low: 100 },
  { high: 120, low: 114 },
  { high: 115, low: 113 }, { high: 115, low: 113 }, { high: 115, low: 113 }, { high: 115, low: 113 },
  { high: 116, low: 110 },
  { high: 118, low: 111 }, { high: 118, low: 111 },
  { high: 116, low: 115 }, { high: 116, low: 115 },
  { high: 130, low: 124 },
  { high: 117, low: 116 }, { high: 117, low: 116 }, { high: 117, low: 116 }
]);

/** Rango: topo mais BAIXO (H2<H1) porém fundo mais ALTO (L2>L1) — sem estrutura direcional. */
const RANGE_MIXED = series([
  { high: 110, low: 109 }, { high: 110, low: 109 },
  { high: 120, low: 116 },
  { high: 115, low: 114 }, { high: 115, low: 114 },
  { high: 112, low: 100 },
  { high: 108, low: 107 }, { high: 108, low: 107 },
  { high: 114, low: 113 }, { high: 114, low: 113 }, { high: 114, low: 113 },
  { high: 116, low: 112 },
  { high: 114, low: 113 }, { high: 114, low: 113 }, { high: 114, low: 113 }
]);

describe('A-03 — Fibonacci ancorado em pivôs fractais', () => {
  it('usa os últimos pivôs, não os extremos de toda a janela', () => {
    const fib = calculateFibonacci(DOWNTREND, 100);

    expect(fib.structureSource).toBe('FRACTAL_PIVOTS');
    expect(fib.swingHigh).toBe(114);  // último topo, não o máximo da janela (124)
    expect(fib.swingLow).toBe(95);    // último fundo, não o mínimo histórico
  });

  it('classifica downtrend por estrutura (topos e fundos descendentes)', () => {
    const fib = calculateFibonacci(DOWNTREND, 100);

    expect(fib.structure).toBe('DOWNTREND');
    expect(fib.trend).toBe('DOWN');
    expect(fib.fib0).toBe(95);        // 0 no fundo, retração sobe para o topo
    expect(fib.fib100).toBe(114);
    expect(fib.fib618).toBeGreaterThan(95);
    expect(fib.fib618).toBeLessThan(114);
  });

  it('classifica uptrend por estrutura (topos e fundos ascendentes)', () => {
    const fib = calculateFibonacci(UPTREND, 125);

    expect(fib.structure).toBe('UPTREND');
    expect(fib.trend).toBe('UP');
    expect(fib.swingHigh).toBe(130);
    expect(fib.swingLow).toBe(110);
    expect(fib.fib0).toBe(130);       // 0 no topo, retração desce para o fundo
    expect(fib.fib100).toBe(110);
  });

  it('não afirma direção quando a estrutura é mista (topo baixo + fundo alto)', () => {
    const fib = calculateFibonacci(RANGE_MIXED, 110);

    // o código antigo decidia por ordem cronológica (máximo i2 < mínimo i5 ⇒ DOWN)
    expect(fib.structure).toBe('RANGE');
  });

  it('é determinística: mesma série ⇒ mesmo resultado', () => {
    const a = calculateFibonacci(RANGE_MIXED, 110);
    const b = calculateFibonacci(RANGE_MIXED, 110);
    expect(a.structure).toBe(b.structure);
    expect(a.fib618).toBe(b.fib618);
    expect(a.inGoldenPocket).toBe(b.inGoldenPocket);
  });

  it('série sem pivôs não inventa estrutura (proveniência explícita)', () => {
    const flat = series(Array.from({ length: 30 }, () => FLAT));
    const fib = calculateFibonacci(flat, 99.5);

    expect(fib.structureSource).toBe('INSUFFICIENT_PIVOTS');
    expect(fib.structure).toBe('RANGE');
    expect(fib.inGoldenPocket).toBe(false);
  });
});
