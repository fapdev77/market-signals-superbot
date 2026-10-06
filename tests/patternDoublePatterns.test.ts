import { describe, it, expect } from 'vitest';
import { detectDoublePatterns } from '../src/utils/chartPatterns/doublePatterns.js';
import type { KlineCandle } from '../src/types.js';

describe('Épico P2: Reconhecimento Geométrico de Reversão (Double Bottom & Double Top)', () => {
  function makeCandle(close: number, high?: number, low?: number, index = 0): KlineCandle {
    const h = high ?? close * 1.005;
    const l = low ?? close * 0.995;
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

  it('T2.1: Detecta Double Bottom (W) clássico com L1, H1 (neckline) e L2', () => {
    // 30 candles formando W:
    // Fundo 1 em idx=6 (preço 100)
    // Neckline em idx=15 (preço 110)
    // Fundo 2 em idx=24 (preço 101, simetria de 1%)
    // Preço atual em idx=29 subindo em 108
    const closes = [
      115, 112, 108, 105, 102, 101, 100, 102, 104, 106, 108, 109, 110, 109, 108, 110,
      107, 105, 103, 102, 101.5, 101, 101.2, 102, 104, 105, 106, 107, 108, 108.5
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const pattern = detectDoublePatterns(klines, 108.5);

    expect(pattern).not.toBeNull();
    if (!pattern) return;

    expect(pattern.type).toBe('DOUBLE_BOTTOM');
    expect(pattern.necklinePrice).toBeCloseTo(110.5, 0);
    expect(pattern.point1.price).toBeCloseTo(99.5, 0); // L1
    expect(pattern.point2.price).toBeCloseTo(100.5, 0); // L2
    expect(pattern.measuredMoveTarget).toBeGreaterThan(118);
    expect(pattern.stopLossPrice).toBeLessThan(100);
    expect(pattern.confidence).toBeGreaterThanOrEqual(70);
  });

  it('T2.2: Rejeita formação onde fundos são consecutivos sem repique intermediário', () => {
    // Preço afundando direto sem neckline
    const closes = Array.from({ length: 25 }, (_, i) => 120 - i * 2);
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const pattern = detectDoublePatterns(klines, 72);
    expect(pattern).toBeNull();
  });

  it('T2.3: Rejeita formação com assimetria severa (> 2% entre fundos)', () => {
    // Fundo 1 em 100, repique em 110, mas fundo 2 afunda em 92 (-8%)
    const closes = [
      115, 112, 108, 105, 102, 100, 102, 106, 108, 110, 108, 104, 100, 96, 92, 94, 96
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const pattern = detectDoublePatterns(klines, 96);
    expect(pattern).toBeNull();
  });

  it('T2.4: Detecta Double Top (M) clássico com H1, L1 (neckline) e H2', () => {
    // Topo 1 em 120, recuo em 110, Topo 2 em 119.5, preço atual caindo em 112
    const closes = [
      95, 100, 105, 110, 115, 118, 120, 118, 116, 114, 112, 110, 111, 113, 115, 118, 119.5,
      118, 116, 114, 112
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const pattern = detectDoublePatterns(klines, 112);

    expect(pattern).not.toBeNull();
    if (!pattern) return;

    expect(pattern.type).toBe('DOUBLE_TOP');
    expect(pattern.necklinePrice).toBeCloseTo(109.5, 0);
    expect(pattern.point1.price).toBeCloseTo(120.5, 0); // H1
    expect(pattern.point2.price).toBeCloseTo(120.0, 0); // H2
    expect(pattern.measuredMoveTarget).toBeLessThan(102);
    expect(pattern.stopLossPrice).toBeGreaterThan(120);
  });
});
