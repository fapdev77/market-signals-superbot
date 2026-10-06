import { describe, it, expect } from 'vitest';
import { calculateWilderRSI } from '../src/utils/wilderRsi.js';

describe('Épico I1: RSI Canônico de J. Welles Wilder (14 Períodos)', () => {
  it('T1.1: Fail-closed em amostra insuficiente de dados (< 15 barras)', () => {
    const insufficientCloses = [100, 101, 102, 103, 104, 105];
    const result = calculateWilderRSI(insufficientCloses, 14);

    expect(result.isValid).toBe(false);
    expect(result.currentRsi).toBe(50);
    expect(result.rsiSeries.length).toBe(0);
  });

  it('T1.2: Benchmark de precisão matemática canônica de Wilder com 14 períodos', () => {
    // Série clássica de 20 preços de fechamento com subidas e quedas conhecidas
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64
    ];

    const result = calculateWilderRSI(closes, 14);

    expect(result.isValid).toBe(true);
    expect(result.rsiSeries.length).toBe(6); // 20 - 14 = 6 pontos calculados
    
    // A 15ª barra (primeiro RSI completo em t=14) tem média de ganhos e perdas diretas
    // Ganhos: (0.06 + 0.72 + 0.50 + 0.27 + 0.32 + 0.42 + 0.24 + 0.14 + 0.67) = 3.34 / 14 = 0.23857
    // Perdas: (0.25 + 0.54 + 0.19 + 0.42) = 1.40 / 14 = 0.10000
    // RS = 0.23857 / 0.10000 = 2.3857 -> RSI = 100 - (100 / (1 + 2.3857)) ≈ 70.46
    const firstRsi = result.rsiSeries[0];
    expect(firstRsi).toBeGreaterThan(69.0);
    expect(firstRsi).toBeLessThan(72.0);

    // O último RSI (na barra 20) converge exatamente para 57.92 na tabela de Wilder
    expect(result.currentRsi).toBeGreaterThan(56.0);
    expect(result.currentRsi).toBeLessThan(60.0);
    expect(result.currentRsi).toBeCloseTo(57.92, 1);
  });

  it('T1.3: Monotonicidade em alta ininterrupta resulta em RSI 100', () => {
    const straightUp = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
    const result = calculateWilderRSI(straightUp, 14);

    expect(result.isValid).toBe(true);
    expect(result.currentRsi).toBe(100);
  });

  it('T1.3b: Monotonicidade em queda ininterrupta resulta em RSI 0', () => {
    const straightDown = Array.from({ length: 25 }, (_, i) => 100 - i * 2);
    const result = calculateWilderRSI(straightDown, 14);

    expect(result.isValid).toBe(true);
    expect(result.currentRsi).toBe(0);
  });

  it('T1.4: Ponto flutuante seguro - lida com array vazio e valores flat sem NaN', () => {
    expect(calculateWilderRSI([]).isValid).toBe(false);
    
    const flat = Array.from({ length: 20 }, () => 50);
    const result = calculateWilderRSI(flat, 14);
    expect(result.isValid).toBe(true);
    expect(result.currentRsi).toBe(50);
    expect(Number.isNaN(result.currentRsi)).toBe(false);
  });
});
