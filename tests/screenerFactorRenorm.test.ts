/**
 * 6.4.4 / CA-4.4 — Sem dado de OI (ou funding), o fator SAI do score, que é
 * renormalizado entre os fatores disponíveis; `availableFactors` não lista o
 * fator ausente; e o resultado NÃO muda se o peso do fator ausente for
 * alterado. UI mostra "n/d" via campo nulo.
 */
import { describe, it, expect } from 'vitest';

import { computeScreenerCompositeScore } from '../server/services/screenerScoring.js';

const base = {
  priceChangePercent24h: 2.0,
  quoteVolume24h: 80_000_000,
  rvol: 1.5,
  openInterestChange24h: null as number | null,
  fundingRate: 0.0001 as number | null,
  fundingIntervalHours: 8 as number | null
};

describe('6.4.4 / CA-4.4 — renormalização do score sem OI', () => {
  it('sem OI: availableFactors não lista oiChange; score independe do peso de OI', () => {
    const withDefaultWeight = computeScreenerCompositeScore('BTCUSDT', { ...base }, {
      rvolWeight: 35, oiChangeWeight: 30, priceMomentumWeight: 20, fundingAnomalyWeight: 15
    });
    const withZeroWeight = computeScreenerCompositeScore('BTCUSDT', { ...base }, {
      rvolWeight: 35, oiChangeWeight: 0, priceMomentumWeight: 20, fundingAnomalyWeight: 15
    });
    const withMaxWeight = computeScreenerCompositeScore('BTCUSDT', { ...base }, {
      rvolWeight: 35, oiChangeWeight: 100, priceMomentumWeight: 20, fundingAnomalyWeight: 15
    });

    expect(withDefaultWeight.availableFactors).not.toContain('oiChange');
    expect(withZeroWeight.score).toBe(withDefaultWeight.score);
    expect(withMaxWeight.score).toBe(withDefaultWeight.score);
  });

  it('sem OI e sem funding: só rvol e momentum compõem, renormalizados', () => {
    const result = computeScreenerCompositeScore('BTCUSDT', { ...base, fundingRate: null }, {
      rvolWeight: 35, oiChangeWeight: 30, priceMomentumWeight: 20, fundingAnomalyWeight: 15
    });

    expect(result.availableFactors.sort()).toEqual(['momentum', 'rvol']);
    // rvol 1.5 ⇒ min(100, 50) = 50 pontos; momentum 2% ⇒ min(100, 10) = 10 pontos.
    // Renormalizado: (50*35 + 10*20) / 55 = 34.545… ⇒ 35 (arredondado).
    expect(result.score).toBe(35);
  });

  it('com todos os dados: os 4 fatores entram e o peso de cada um altera o score', () => {
    const full = { ...base, openInterestChange24h: 5, fundingRate: 0.0003 };
    const weights = { rvolWeight: 35, oiChangeWeight: 30, priceMomentumWeight: 20, fundingAnomalyWeight: 15 };
    const result = computeScreenerCompositeScore('BTCUSDT', full, weights);
    expect(result.availableFactors.sort()).toEqual(['funding', 'momentum', 'oiChange', 'rvol']);
    expect(result.score).toBeGreaterThan(0);

    const shifted = computeScreenerCompositeScore('BTCUSDT', full, {
      ...weights, rvolWeight: 5, oiChangeWeight: 60
    });
    expect(shifted.score).not.toBe(result.score);
  });
});
