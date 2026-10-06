import { describe, it, expect } from 'vitest';
import { detectWedgeAndTrianglePatterns } from '../src/utils/chartPatterns/trianglePatterns.js';
import type { KlineCandle } from '../src/types.js';

describe('Épico P4: Reconhecimento de Triângulos e Cunhas (Wedges & Triangles)', () => {
  function makeCandle(close: number, high?: number, low?: number, index = 0): KlineCandle {
    const h = high ?? close * 1.004;
    const l = low ?? close * 0.996;
    return {
      timestamp: 1600000000000 + index * 60000 * 15,
      open: close,
      high: h,
      low: l,
      close,
      volume: 1000,
      takerBuyVolume: 500
    };
  }

  it('T4.1: Detecta Triângulo Ascendente (Resistência horizontal flat e Lows ascendentes)', () => {
    // 25 candles com teto horizontal constante em 110, e fundos subindo (95 -> 100 -> 105 -> 108)
    const candles: KlineCandle[] = [
      makeCandle(95, 100, 95, 0),
      makeCandle(105, 110, 103, 1),  // Topo 1 em 110
      makeCandle(102, 106, 100, 2),  // Fundo 1 em 100
      makeCandle(108, 110.1, 104, 3),// Topo 2 em 110.1
      makeCandle(106, 108, 104.5, 4),// Fundo 2 em 104.5 (Higher Low)
      makeCandle(109, 110.2, 107, 5),// Topo 3 em 110.2
      makeCandle(108, 109, 107.5, 6),// Fundo 3 em 107.5 (Higher Low)
      makeCandle(109.8, 110.1, 108, 7) // Pressionando a resistência
    ];

    const match = detectWedgeAndTrianglePatterns(candles, 109.8);

    expect(match).not.toBeNull();
    if (!match) return;

    expect(match.type).toBe('ASCENDING_TRIANGLE');
    expect(match.breakoutTriggerPrice).toBeCloseTo(110.1, 0);
    expect(match.measuredMoveTarget).toBeGreaterThan(115);
    expect(match.stopLossPrice).toBeLessThan(108);
  });

  it('T4.2: Detecta Triângulo Descendente (Suporte horizontal flat e Highs descendentes)', () => {
    // 8 candles com piso horizontal em 90, e topos caindo (105 -> 100 -> 95 -> 92)
    const candles: KlineCandle[] = [
      makeCandle(105, 105, 98, 0),
      makeCandle(92, 96, 90, 1),    // Fundo 1 em 90
      makeCandle(98, 100, 93, 2),   // Topo 1 em 100
      makeCandle(91, 93, 89.9, 3),  // Fundo 2 em 89.9
      makeCandle(94, 95, 91, 4),    // Topo 2 em 95 (Lower High)
      makeCandle(90.5, 92, 90.1, 5),// Fundo 3 em 90.1
      makeCandle(91.5, 92.5, 90.4, 6) // Pressionando suporte
    ];

    const match = detectWedgeAndTrianglePatterns(candles, 91.5);

    expect(match).not.toBeNull();
    if (!match) return;

    expect(match.type).toBe('DESCENDING_TRIANGLE');
    expect(match.breakoutTriggerPrice).toBeCloseTo(90, 0);
    expect(match.measuredMoveTarget).toBeLessThan(85);
  });

  it('T4.3: Detecta Falling Wedge (Cunha Descendente Convergente)', () => {
    // Topos caindo rapidamente (120 -> 112 -> 105), Fundos caindo mais lentamente (100 -> 96 -> 93) -> Convergência para baixo
    const candles: KlineCandle[] = [
      makeCandle(118, 120, 114, 0),  // Topo 1 em 120
      makeCandle(102, 106, 100, 1),  // Fundo 1 em 100
      makeCandle(110, 112, 107, 2),  // Topo 2 em 112 (queda de 8)
      makeCandle(98, 100, 96, 3),    // Fundo 2 em 96 (queda de 4)
      makeCandle(104, 105, 101, 4),  // Topo 3 em 105 (queda de 7)
      makeCandle(94, 96, 93, 5),     // Fundo 3 em 93 (queda de 3)
      makeCandle(101, 103, 98, 6)
    ];

    const match = detectWedgeAndTrianglePatterns(candles, 101);

    expect(match).not.toBeNull();
    if (!match) return;

    expect(match.type).toBe('FALLING_WEDGE');
    expect(match.measuredMoveTarget).toBeGreaterThan(110);
  });
});
