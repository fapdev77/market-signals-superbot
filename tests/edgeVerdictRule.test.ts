import { describe, it, expect } from 'vitest';
import { evaluateEdgeVerdict, type SymbolDiagnosis } from '../server/services/EdgeDiagnosisService.js';

/**
 * CA-1.2 — a regra pré-registrada (8.1.4) é exercitada nos LIMITES: 59% contra 60%
 * dos símbolos elegíveis (n ≥ 30). Também cobre o mínimo de posições e a amostra vazia.
 */

function symbol(n: number, ciLow: number, ciHigh = ciLow + 0.5): SymbolDiagnosis {
  return {
    symbol: `S${Math.round(ciLow * 1000)}-${n}`,
    summary: {
      n,
      grossR: 0.1,
      feesR: 0.02,
      slippageR: 0.01,
      fundingR: 0.005,
      netR: ciLow / 2 + 0.01,
      costAvgR: 0.035,
      winRate: 45,
      ciLow,
      ciHigh
    },
    byScoreBand: [],
    byRegime: [],
    bySession: [],
    byStopBand: [],
    stopDistancePct: { mean: 0.5, p50: 0.5, p90: 1 },
    maxStopTradeoff: [],
    factorCoverage: { openInterest: 100, funding: 100, longShort: 100 },
    reducedFactorSet: false
  };
}

/** `qualified` símbolos com IC > 0 e `notQualified` com IC ≤ 0, todos com n = 30. */
function makeSet(qualified: number, notQualified: number): SymbolDiagnosis[] {
  return [
    ...Array.from({ length: qualified }, (_, i) => symbol(30, 0.01, 0.5 + i * 1e-6)),
    ...Array.from({ length: notQualified }, (_, i) => symbol(30, -0.01 - i * 1e-6, 0.2))
  ];
}

describe('8.1.4 — regra de veredito do edge (função pura)', () => {
  it('100 símbolos elegíveis com 60% qualificados ⇒ APTO', () => {
    const verdict = evaluateEdgeVerdict(makeSet(60, 40));
    expect(verdict.total).toBe(100);
    expect(verdict.qualified).toBe(60);
    expect(verdict.share).toBeCloseTo(0.6, 10);
    expect(verdict.apt).toBe(true);
  });

  it('59% qualificados ⇒ NÃO apto (limite) e aponta aceite do dono', () => {
    const verdict = evaluateEdgeVerdict(makeSet(59, 41));
    expect(verdict.qualified).toBe(59);
    expect(verdict.apt).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/aceite explícito/i);
  });

  it('ignora símbolos com n < 30 no denominador', () => {
    // 30 elegíveis dos quais 18 qualificados (60%) + 50 com n baixo e IC > 0.
    const noisy = Array.from({ length: 50 }, () => symbol(5, 0.5, 1));
    const verdict = evaluateEdgeVerdict([...makeSet(18, 12), ...noisy]);
    expect(verdict.total).toBe(30);
    expect(verdict.qualified).toBe(18);
    expect(verdict.apt).toBe(true);
  });

  it('amostra vazia (nenhum símbolo elegível) ⇒ NÃO apto, sem divisão por zero', () => {
    const verdict = evaluateEdgeVerdict([symbol(10, 0.5), symbol(29, 0.5)]);
    expect(verdict.total).toBe(0);
    expect(verdict.share).toBe(0);
    expect(verdict.apt).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/amostra insuficiente/i);
  });

  it('aceita limiares alternativos de elegibilidade', () => {
    const verdict = evaluateEdgeVerdict(makeSet(6, 4), { threshold: 0.5, minN: 10 });
    // n = 30 ≥ 10, share = 0.6 ≥ 0.5 ⇒ apto
    expect(verdict.minN).toBe(10);
    expect(verdict.apt).toBe(true);
  });
});
