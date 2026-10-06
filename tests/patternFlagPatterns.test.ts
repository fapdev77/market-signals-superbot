import { describe, it, expect } from 'vitest';
import { detectFlagPatterns } from '../src/utils/chartPatterns/flagPatterns.js';
import type { KlineCandle } from '../src/types.js';

describe('Épico P3: Reconhecimento Geométrico de Bandeiras (Bull Flag & Bear Flag)', () => {
  function makeCandle(close: number, high?: number, low?: number, index = 0, volume = 1000): KlineCandle {
    const h = high ?? close * 1.004;
    const l = low ?? close * 0.996;
    return {
      timestamp: 1600000000000 + index * 60000 * 15,
      open: close,
      high: h,
      low: l,
      close,
      volume,
      takerBuyVolume: volume * 0.55
    };
  }

  it('T3.1: Detecta Bull Flag com mastro impulsivo e canal descendente controlado', () => {
    // 25 velas:
    // Base em 100 nas velas 0-3
    // Mastro rápido de alta (100 -> 120) com alto volume nas velas 4-9
    // Canal de bandeira com retração suave inclinada para baixo (120 -> 114) com baixo volume nas velas 10-24
    const closes = [
      100, 100.5, 100.2, 100.4,
      104, 108, 112, 116, 119, 120, // Mastro (+20%)
      119, 118.5, 118, 117.5, 117, 116.5, 116, 115.5, 115, 114.5, 115, 115.5, 116, 117, 118 // Consolidação da bandeira
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.004, c * 0.996, i, i >= 4 && i <= 9 ? 5000 : 800));

    const pattern = detectFlagPatterns(klines, 118);

    expect(pattern).not.toBeNull();
    if (!pattern) return;

    expect(pattern.type).toBe('BULL_FLAG');
    expect(pattern.poleHeightPct).toBeGreaterThan(15);
    expect(pattern.measuredMoveTarget).toBeGreaterThan(130);
    expect(pattern.stopLossPrice).toBeLessThan(115);
    expect(pattern.confidence).toBeGreaterThanOrEqual(70);
  });

  it('T3.2: Rejeita bandeira se a correção devolver mais de 65% do mastro', () => {
    // Mastro de 100 para 120, mas o preço devolve tudo caindo para 104 (-80% do mastro)
    const closes = [
      100, 101, 100,
      105, 110, 115, 120, // Mastro
      116, 112, 108, 105, 104, 103, 104
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.004, c * 0.996, i));

    const pattern = detectFlagPatterns(klines, 104);
    expect(pattern).toBeNull();
  });

  it('T3.3: Detecta Bear Flag com mastro de queda e canal ascendente corretivo', () => {
    // Mastro de queda de 120 para 100, seguido por canal levemente ascendente (100 -> 106)
    const closes = [
      120, 120, 119.5,
      115, 110, 105, 102, 100.5, 100, // Mastro de baixa (-16.6%)
      100.5, 101, 101.8, 102.5, 103.2, 104, 104.5, 105, 105.5, 104.8, 104.2, 103.5 // Canal ascendente
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.004, c * 0.996, i, i >= 3 && i <= 8 ? 5000 : 800));

    const pattern = detectFlagPatterns(klines, 103.5);

    expect(pattern).not.toBeNull();
    if (!pattern) return;

    expect(pattern.type).toBe('BEAR_FLAG');
    expect(pattern.poleHeightPct).toBeGreaterThan(14);
    expect(pattern.measuredMoveTarget).toBeLessThan(90);
    expect(pattern.stopLossPrice).toBeGreaterThan(106);
  });
});
