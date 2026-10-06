import { describe, it, expect } from 'vitest';
import { 
  extractZigZagPivots, 
  fitTrendline, 
  analyzeChannelGeometry,
  type ChartPivot 
} from '../src/utils/chartGeometryCore.js';

describe('Épico P1: Módulo Puro de Geometria de Mercado (chartGeometryCore)', () => {
  it('T1.1: Extrai pivôs alternados e descarta extremos consecutivos do mesmo tipo', () => {
    // 15 candles com fundo em idx=3, topo em idx=7, fundo em idx=11
    const candles = [
      { high: 100, low: 98,  close: 99 },   // 0
      { high: 98,  low: 95,  close: 96 },   // 1
      { high: 96,  low: 92,  close: 93 },   // 2
      { high: 93,  low: 88,  close: 90 },   // 3: LOW Pivot (88)
      { high: 96,  low: 91,  close: 95 },   // 4
      { high: 102, low: 95,  close: 100 },  // 5
      { high: 108, low: 101, close: 106 },  // 6
      { high: 112, low: 106, close: 110 },  // 7: HIGH Pivot (112)
      { high: 107, low: 102, close: 104 },  // 8
      { high: 102, low: 97,  close: 98 },   // 9
      { high: 96,  low: 91,  close: 93 },   // 10
      { high: 92,  low: 85,  close: 88 },   // 11: LOW Pivot (85)
      { high: 95,  low: 88,  close: 94 },   // 12
      { high: 98,  low: 92,  close: 97 },   // 13
      { high: 101, low: 96,  close: 100 }   // 14
    ];

    const pivots = extractZigZagPivots(candles, 2, 2);

    expect(pivots.length).toBeGreaterThanOrEqual(3);
    
    // Testa alternância estrita: nunca dois topos ou dois fundos seguidos
    for (let i = 1; i < pivots.length; i++) {
      expect(pivots[i].type).not.toBe(pivots[i - 1].type);
    }

    const low1 = pivots.find(p => p.type === 'LOW' && p.price === 88);
    const high1 = pivots.find(p => p.type === 'HIGH' && p.price === 112);
    const low2 = pivots.find(p => p.type === 'LOW' && p.price === 85);

    expect(low1).toBeDefined();
    expect(high1).toBeDefined();
    expect(low2).toBeDefined();
  });

  it('T1.2: Ajusta linha de tendência linear horizontal com slope ~0 e R2 ~1', () => {
    const horizontalPivots: ChartPivot[] = [
      { index: 5,  price: 100, type: 'HIGH' },
      { index: 15, price: 100, type: 'HIGH' },
      { index: 25, price: 100, type: 'HIGH' }
    ];

    const line = fitTrendline(horizontalPivots);
    expect(line).not.toBeNull();
    if (!line) return;

    expect(line.slope).toBeCloseTo(0, 4);
    expect(line.intercept).toBeCloseTo(100, 2);
    expect(line.rSquared).toBeCloseTo(1, 2);
  });

  it('T1.3: Identifica inclinação ascendente e descendente com precisão', () => {
    const ascendingPivots: ChartPivot[] = [
      { index: 0,  price: 100, type: 'LOW' },
      { index: 10, price: 110, type: 'LOW' },
      { index: 20, price: 120, type: 'LOW' }
    ];

    const line = fitTrendline(ascendingPivots);
    expect(line).not.toBeNull();
    if (!line) return;

    expect(line.slope).toBeCloseTo(1.0, 4);
    expect(line.intercept).toBeCloseTo(100, 2);
  });

  it('T1.4: Analisa convergência e paralelismo em canais de retas', () => {
    // Linha superior descendo (slope -0.5), linha inferior subindo (slope +0.5) -> Convergindo
    const upperPivots: ChartPivot[] = [
      { index: 0,  price: 120, type: 'HIGH' },
      { index: 10, price: 115, type: 'HIGH' }
    ];
    const lowerPivots: ChartPivot[] = [
      { index: 0,  price: 80,  type: 'LOW' },
      { index: 10, price: 85,  type: 'LOW' }
    ];

    const channel = analyzeChannelGeometry(upperPivots, lowerPivots);
    expect(channel).not.toBeNull();
    if (!channel) return;

    expect(channel.isConverging).toBe(true);
    expect(channel.isParallel).toBe(false);
  });
});
