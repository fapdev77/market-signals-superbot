import { describe, it, expect } from 'vitest';
import { calculateVolumeProfile as backendCalc } from '../server/binanceService.js';
import { calculateVolumeProfile as frontendCalc } from '../src/utils/volumeProfileUtils.js';
import { computeUnifiedVolumeProfile } from '../server/utils/volumeProfileCore.js';
import type { KlineCandle } from '../src/types.js';

describe('Épico I3: Unificação Matemática do Volume Profile (Distribuição Proporcional por Span)', () => {
  const candles: KlineCandle[] = [
    { timestamp: 1, open: 100, high: 105, low: 98,  close: 104, volume: 5000, takerBuyVolume: 2800 },
    { timestamp: 2, open: 104, high: 108, low: 102, close: 107, volume: 8000, takerBuyVolume: 4200 },
    { timestamp: 3, open: 107, high: 112, low: 105, close: 106, volume: 12000, takerBuyVolume: 5800 },
    { timestamp: 4, open: 106, high: 107, low: 95,  close: 96,  volume: 15000, takerBuyVolume: 6000 },
    { timestamp: 5, open: 96,  high: 102, low: 94,  close: 101, volume: 9000, takerBuyVolume: 5100 }
  ];

  it('T3.1: Conservação exata da massa de volume na distribuição por faixas', () => {
    const profile = computeUnifiedVolumeProfile(candles, 24, 0.70);

    const totalInputVolume = candles.reduce((acc, c) => acc + c.volume, 0);
    const totalBinVolume = profile.bins.reduce((acc, b) => acc + b.volume, 0);

    expect(profile.totalVolume).toBe(totalInputVolume);
    expect(totalBinVolume).toBeCloseTo(totalInputVolume, 4);

    const totalInputBuyVolume = candles.reduce((acc, c) => acc + c.takerBuyVolume, 0);
    const totalBinBuyVolume = profile.bins.reduce((acc, b) => acc + b.buyVolume, 0);
    expect(totalBinBuyVolume).toBeCloseTo(totalInputBuyVolume, 4);
  });

  it('T3.2: Invariante fundamental da Value Area: VAL <= POC <= VAH', () => {
    const profile = computeUnifiedVolumeProfile(candles, 24, 0.70);

    expect(profile.val).toBeLessThanOrEqual(profile.poc);
    expect(profile.poc).toBeLessThanOrEqual(profile.vah);
    expect(profile.val).toBeGreaterThanOrEqual(94);
    expect(profile.vah).toBeLessThanOrEqual(112);
  });

  it('T3.3: Paridade Backend ⟷ Frontend: ambos produzem o mesmo POC, VAH e VAL', () => {
    const backendResult = backendCalc(candles, 24);
    const frontendResult = frontendCalc(candles as any, 24, 0.70);

    expect(frontendResult).not.toBeNull();
    if (!frontendResult) return;

    // Ambos devem ser estritamente consistentes
    expect(backendResult.poc).toBeCloseTo(frontendResult.poc, 2);
    expect(backendResult.vah).toBeCloseTo(frontendResult.vah, 2);
    expect(backendResult.val).toBeCloseTo(frontendResult.val, 2);
  });

  it('T3.4: Lida com lista vazia de candles de forma segura (fail-closed)', () => {
    const empty = computeUnifiedVolumeProfile([], 24);
    expect(empty.poc).toBe(0);
    expect(empty.vah).toBe(0);
    expect(empty.val).toBe(0);
    expect(empty.bins.length).toBe(0);
  });
});
