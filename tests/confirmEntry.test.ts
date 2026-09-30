import { describe, it, expect } from 'vitest';
import { confirmEntry, ENTRY_THRESHOLDS, type KlineLike } from '../server/services/entryConfirmation.js';

/**
 * 6.7.2 / CA-7.1 — teste de TABELA para cada regra aprovada (D1: R1–R5 obrigatórias;
 * R6 é o toque da zona, avaliado no ciclo de vida, não aqui).
 *
 * Aprovação: specs/phase-6-7-entry-confirmation.md seção 8 (2026-09-30).
 * Thresholds (D6): wick ≤ 0.55, taker long ≥ 0.49 / short ≤ 0.51, confluência ≥ 60.
 *
 * Velas de 5m REAIS (D2): `klines5m` é a série de 5m da exchange — não 5×1m.
 */

function k1m(overrides: Partial<KlineLike> = {}): KlineLike {
  return {
    open: 100,
    high: 100.5,
    low: 99.8,
    close: 100.3,
    takerBuyBaseVolume: 0.6,
    volume: 1.0,
    ...overrides
  };
}

const LONG_HAPPY = {
  klines1m: [
    k1m(),
    k1m(),
    k1m({ open: 100.3, high: 100.7, low: 100.2, close: 100.5 }) // última fechada: corpo de alta, pavio ok
  ],
  klines5m: [{ open: 100, high: 101, low: 99.5, close: 100.4 }], // 5m real em alta
  confluenceScore: 65
};

const SHORT_HAPPY = {
  klines1m: [
    k1m(),
    k1m(),
    k1m({ open: 100.5, high: 100.7, low: 100.2, close: 100.3, takerBuyBaseVolume: 0.45 }) // corpo de baixa + taker vendedor
  ],
  klines5m: [{ open: 100.4, high: 100.8, low: 99.8, close: 100.0 }], // 5m real em baixa
  confluenceScore: 65
};

describe('6.7.2 — confirmEntry: casos felizes', () => {
  it('LONG: todas as regras passam ⇒ confirmed true, reasons vazio', () => {
    const r = confirmEntry({ direction: 'LONG', ...LONG_HAPPY });
    expect(r.confirmed).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('SHORT: todas as regras passam ⇒ confirmed true', () => {
    const r = confirmEntry({ direction: 'SHORT', ...SHORT_HAPPY });
    expect(r.confirmed).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('takerBuyRatio é derivado de takerBuyBaseVolume/volume da última vela', () => {
    const r = confirmEntry({ direction: 'LONG', ...LONG_HAPPY, klines1m: [k1m({ takerBuyBaseVolume: 0.7, volume: 1 })] });
    expect(r.reasons).toEqual([]);
    expect(r.details?.takerBuyRatio).toBeCloseTo(0.7, 5);
  });
});

describe('6.7.2 — tabela de falhas por regra (LONG)', () => {
  const cases: Array<{ name: string; mutate: any; reasonContains: string }> = [
    {
      name: 'R1 anti-spike: pavio superior > 0.55 do range rejeita LONG',
      mutate: { klines1m: [k1m(), k1m(), k1m({ open: 100.3, high: 101.5, low: 100.2, close: 100.4 })] },
      reasonContains: 'wick'
    },
    {
      name: 'R2 direção do corpo: close < open rejeita LONG',
      mutate: { klines1m: [k1m(), k1m(), k1m({ open: 100.5, high: 100.7, low: 100.2, close: 100.3 })] },
      reasonContains: 'body'
    },
    {
      name: 'R3 fluxo taker: ratio < 0.49 rejeita LONG',
      mutate: { klines1m: [k1m(), k1m(), k1m({ takerBuyBaseVolume: 0.4, volume: 1 })] },
      reasonContains: 'taker'
    },
    {
      name: 'R4 tendência 5m real: close5m <= open5m rejeita LONG',
      mutate: { klines5m: [{ open: 100.2, high: 100.5, low: 99.9, close: 100.0 }] },
      reasonContains: 'trend'
    },
    {
      name: 'R5 confluência mínima: score 59 < 60 rejeita',
      mutate: { confluenceScore: 59 },
      reasonContains: 'confluence'
    }
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = confirmEntry({ direction: 'LONG', ...LONG_HAPPY, ...c.mutate });
      expect(r.confirmed).toBe(false);
      expect(r.reasons.join(' ').toLowerCase()).toContain(c.reasonContains);
    });
  }
});

describe('6.7.2 — tabela de falhas por regra (SHORT)', () => {
  const cases: Array<{ name: string; mutate: any; reasonContains: string }> = [
    {
      name: 'R1 anti-spike: pavio inferior > 0.55 do range rejeita SHORT',
      mutate: { klines1m: [k1m(), k1m(), k1m({ open: 100.4, high: 100.5, low: 99.2, close: 100.3 })] },
      reasonContains: 'wick'
    },
    {
      name: 'R2 direção do corpo: close > open rejeita SHORT',
      mutate: { klines1m: [k1m(), k1m(), k1m({ open: 100.0, high: 100.5, low: 99.8, close: 100.4 })] },
      reasonContains: 'body'
    },
    {
      name: 'R3 fluxo taker: ratio > 0.51 rejeita SHORT',
      mutate: { klines1m: [k1m(), k1m(), k1m({ takerBuyBaseVolume: 0.7, volume: 1 })] },
      reasonContains: 'taker'
    },
    {
      name: 'R4 tendência 5m real: close5m >= open5m rejeita SHORT',
      mutate: { klines5m: [{ open: 100.0, high: 100.6, low: 99.9, close: 100.4 }] },
      reasonContains: 'trend'
    }
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = confirmEntry({ direction: 'SHORT', ...SHORT_HAPPY, ...c.mutate });
      expect(r.confirmed).toBe(false);
      expect(r.reasons.join(' ').toLowerCase()).toContain(c.reasonContains);
    });
  }
});

describe('6.7.2 — contrato fail-closed e thresholds', () => {
  it('sem velas suficientes ⇒ não confirmado (fail-closed)', () => {
    const r = confirmEntry({ direction: 'LONG', klines1m: [], klines5m: [], confluenceScore: 99 });
    expect(r.confirmed).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('sem 5m real ⇒ não confirmado com motivo de tendência (D2: não deriva de 5×1m)', () => {
    const r = confirmEntry({ direction: 'LONG', ...LONG_HAPPY, klines5m: [] });
    expect(r.confirmed).toBe(false);
    expect(r.reasons.join(' ').toLowerCase()).toContain('trend');
  });

  it('thresholds expostos batem com o aprovado em D6', () => {
    expect(ENTRY_THRESHOLDS.maxWickRatio).toBe(0.55);
    expect(ENTRY_THRESHOLDS.takerBuyLong).toBe(0.49);
    expect(ENTRY_THRESHOLDS.takerBuyShort).toBe(0.51);
    expect(ENTRY_THRESHOLDS.minConfluence).toBe(60);
  });

  it('todas as regras que falham aparecem em reasons (não só a primeira)', () => {
    const r = confirmEntry({
      direction: 'LONG',
      klines1m: [k1m(), k1m(), k1m({ open: 100.5, high: 101.5, low: 100.2, close: 100.3, takerBuyBaseVolume: 0.3, volume: 1 })],
      klines5m: [{ open: 100.2, high: 100.4, low: 99.9, close: 100.0 }],
      confluenceScore: 50
    });
    expect(r.confirmed).toBe(false);
    const blob = r.reasons.join(' ').toLowerCase();
    expect(blob).toContain('wick');
    expect(blob).toContain('body');
    expect(blob).toContain('taker');
    expect(blob).toContain('trend');
    expect(blob).toContain('confluence');
  });
});
