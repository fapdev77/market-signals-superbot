/**
 * 6.4.4 / CA-4.3 — Propriedade: dois símbolos com entradas de mercado
 * idênticas e NOMES diferentes recebem scores idênticos — prova que nenhuma
 * métrica é derivada do nome do símbolo (o antigo `baseSymbolSeed`).
 */
import { describe, it, expect } from 'vitest';

import { computeScreenerCompositeScore } from '../server/services/screenerScoring.js';

const base = {
  priceChangePercent24h: 2.5,
  quoteVolume24h: 120_000_000,
  rvol: 1.8,
  openInterestChange24h: 3.2 as number | null,
  fundingRate: 0.00012 as number | null,
  fundingIntervalHours: 8 as number | null
};

describe('6.4.4 / CA-4.3 — score independente do nome do símbolo', () => {
  it('dois símbolos com dados idênticos e nomes diferentes ⇒ scores idênticos', () => {
    const a = computeScreenerCompositeScore('AAAAUSDT', { ...base });
    const b = computeScreenerCompositeScore('ZZZZUSDT', { ...base });
    expect(a.score).toBe(b.score);
  });

  it('muitos nomes diferentes produzem no máximo um score (todos iguais)', () => {
    const names = ['BTCUSDT', 'PEPEUSDT', 'DOGEUSDT', 'XAUUSDT', 'SPXUSDT', 'SHIBUSDT', 'WIFUSDT'];
    const scores = new Set(
      names.map(n => computeScreenerCompositeScore(n, { ...base }).score)
    );
    expect(scores.size).toBe(1);
  });

  it('dados diferentes ⇒ scores diferentes (o score ainda discrimina)', () => {
    const a = computeScreenerCompositeScore('BTCUSDT', { ...base, rvol: 0.5 });
    const b = computeScreenerCompositeScore('BTCUSDT', { ...base, rvol: 3.0 });
    expect(a.score).not.toBe(b.score);
  });
});
