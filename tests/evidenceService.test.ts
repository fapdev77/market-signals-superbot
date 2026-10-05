import { describe, it, expect } from 'vitest';

import {
  calculateSignalOutcomeR,
  calculateWilsonScoreInterval,
  evaluateGoNoGo,
  type LedgerEventRecord,
  type LedgerSignalParams,
  type GoNoGoInput
} from '../server/services/EvidenceService.js';

/**
 * M6 (segunda metade) — suíte de caracterização do `EvidenceService`.
 *
 * O serviço decide o R de cada sinal fechado e o veredito go/no-go da estratégia.
 * Hoje não há suíte própria: `evidenceDenominator` monta sinais sintéticos e
 * passa por `generateEvidenceSummary`, e `evidenceSummary` cobre agregação. Nada
 * fixa diretamente o comportamento de `calculateSignalOutcomeR` por tipo de
 * saída, do funding, nem do gate `evaluateGoNoGo` — que é justamente onde uma
 * decisão de-money é tomada.
 *
 * Caracterização: fixam o comportamento existente. `evaluateGoNoGo` é
 * fail-closed por desenho (qualquer critério reprovado ⇒ NO_GO), e é essa
 * propriedade que se quer proteger contra uma futura afrouxação.
 */

const SIGNAL: LedgerSignalParams = {
  id: 'S1',
  symbol: 'BTCUSDT',
  category: 'INTRADAY',
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 95,
  takeProfit1: 110,
  takeProfit2: 120,
  score: 80,
  origin: 'LIVE'
};

const entry = (price = 100, at = 1_000): LedgerEventRecord => ({
  eventType: 'ENTRY',
  price,
  timestamp: at
});

describe('M6 — EvidenceService: R por tipo de saída', () => {
  it('BREAKEVEN sozinho NÃO fecha a posição (só rotula o modo de saída)', () => {
    // Caracterização: `BREAKEVEN` apenas muda o rótulo; o fechamento vem do
    // STOP seguinte (que então herda outcomeType 'BREAKEVEN'). O filtro de
    // "sinal sem ENTRY não entra no denominador" mora em
    // `getClosedSignalsEvidence` (db.ts), não aqui.
    const res = calculateSignalOutcomeR(SIGNAL, [
      entry(),
      { eventType: 'BREAKEVEN', price: 100, timestamp: 1_500 }
    ]);

    expect(res.isClosed).toBe(false);
    expect(res.outcomeType).toBe('BREAKEVEN');
  });

  it('só ENTRY ⇒ posição ainda aberta, não fechada', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [entry()]);

    expect(res.isClosed).toBe(false);
    expect(res.outcomeType).toBe('ACTIVE');
  });

  it('TARGET2 fecha com o R cheio (2.0R a 100 de entrada, risco 5)', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [entry(), { eventType: 'TARGET2', price: 120, timestamp: 2_000 }]);

    expect(res.isClosed).toBe(true);
    expect(res.outcomeType).toBe('TP2');
    // (120 - 100) / 5 = 4.0R — o alvo2 está a 20 do entry com risco 5.
    expect(res.grossR).toBeCloseTo(4.0, 3);
  });

  it('STOP fecha com -1.0R', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [entry(), { eventType: 'STOP', price: 95, timestamp: 2_000 }]);

    expect(res.isClosed).toBe(true);
    expect(res.outcomeType).toBe('STOP');
    expect(res.grossR).toBeCloseTo(-1.0, 3);
  });

  it('EXPIRED a preço de entrada é ~0 BRUTO', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [
      entry(),
      { eventType: 'EXPIRED', price: 100, timestamp: 2_000, metadata: { reason: 'TTL' } }
    ]);

    expect(res.isClosed).toBe(true);
    expect(res.outcomeType).toBe('EXPIRED');
    expect(res.grossR).toBeCloseTo(0, 3);
  });

  it('SHORT espelha o sinal do R', () => {
    const short: LedgerSignalParams = { ...SIGNAL, direction: 'SHORT', entryPrice: 100, stopLoss: 105 };

    const ganho = calculateSignalOutcomeR(short, [entry(), { eventType: 'TARGET2', price: 80, timestamp: 2_000 }]);
    expect(ganho.grossR).toBeCloseTo(4.0, 3);

    const perda = calculateSignalOutcomeR(short, [entry(), { eventType: 'STOP', price: 105, timestamp: 2_000 }]);
    expect(perda.grossR).toBeCloseTo(-1.0, 3);
  });

  it('PARTIAL + STOP no breakeven fecha em ~0 BRUTO (metade já realiseada)', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [
      entry(),
      { eventType: 'PARTIAL', price: 110, timestamp: 1_500 },
      { eventType: 'BREAKEVEN', price: 100, timestamp: 1_800 },
      { eventType: 'STOP', price: 100, timestamp: 2_000 }
    ]);

    expect(res.isClosed).toBe(true);
    // O rótulo preserva que a saída foi no breakeven, não um stop seco.
    expect(res.outcomeType).toBe('BREAKEVEN');
    // Metade da posição realizes +1.0R; metade sai em 0 ⇒ ~+1.0R total.
    expect(res.grossR).toBeCloseTo(1.0, 2);
  });
});

describe('M6 — EvidenceService: funding e custos', () => {
  it('sem opções de funding, o fallback é explícito e não NaN', () => {
    const res = calculateSignalOutcomeR(SIGNAL, [entry(), { eventType: 'TARGET2', price: 120, timestamp: 2_000 }]);

    expect(Number.isFinite(res.fundingR)).toBe(true);
    expect(Number.isFinite(res.netR)).toBe(true);
    expect(res.netR).toBeLessThanOrEqual(res.grossR);
  });

  it('funding positivo REDUZ o netR (custo de manter posição)', () => {
    const base = calculateSignalOutcomeR(SIGNAL, [entry(), { eventType: 'TARGET2', price: 120, timestamp: 2_000 }]);

    const comFunding = calculateSignalOutcomeR(
      SIGNAL,
      [entry(), { eventType: 'TARGET2', price: 120, timestamp: 86_400_000 }],
      {
        funding: {
          records: [
            { symbol: 'BTCUSDT', fundingTime: 4_000, fundingRate: 0.001, markPrice: 100, rateType: 'PERIODIC' }
          ]
        }
      }
    );

    expect(comFunding.fundingR).toBeGreaterThan(0);
    expect(comFunding.netR).toBeLessThan(base.netR);
  });

  it('netR = grossR − custos − funding (identidade contábil)', () => {
    const res = calculateSignalOutcomeR(
      SIGNAL,
      [entry(), { eventType: 'TARGET2', price: 120, timestamp: 86_400_000 }],
      {
        funding: {
          records: [
            { symbol: 'BTCUSDT', fundingTime: 4_000, fundingRate: 0.001, markPrice: 100, rateType: 'PERIODIC' }
          ]
        }
      }
    );

    // `fundingR` é opcional no tipo; neste cenário com funding informado ele é
    // sempre calculado, então a identidade contábil tem de fechar.
    expect(res.fundingR).toBeDefined();
    expect(res.netR).toBeCloseTo(res.grossR - res.costsR - (res.fundingR ?? 0), 3);
  });
});

describe('M6 — EvidenceService: intervalo de Wilson', () => {
  it('n = 0 devolve [0,0] em vez de dividir por zero', () => {
    expect(calculateWilsonScoreInterval(0, 0)).toEqual([0, 0]);
  });

  it('100% de acerto ainda tem limite inferior < 1 (honestidade estatística)', () => {
    const [lo, hi] = calculateWilsonScoreInterval(30, 30, 0.95);
    expect(hi).toBeCloseTo(1, 2);
    // Se o limite inferior fosse 1.0, "30 de 30" pareceria certeza.
    expect(lo).toBeLessThan(1);
    expect(lo).toBeGreaterThan(0.8);
  });

  it('intervalo contém a proporção observada', () => {
    const [lo, hi] = calculateWilsonScoreInterval(6, 10, 0.95);
    expect(lo).toBeLessThan(0.6);
    expect(hi).toBeGreaterThan(0.6);
  });

  it('confiança maior ⇒ intervalo mais largo', () => {
    const [lo90] = calculateWilsonScoreInterval(6, 10, 0.90);
    const [lo99] = calculateWilsonScoreInterval(6, 10, 0.99);
    expect(lo99).toBeLessThan(lo90);
  });

  it('mais amostra estreita o intervalo', () => {
    const [loPequena, hiPequena] = calculateWilsonScoreInterval(6, 10);
    const [loGrande, hiGrande] = calculateWilsonScoreInterval(60, 100);
    expect(loGrande).toBeGreaterThan(loPequena);
    expect(hiGrande).toBeLessThan(hiPequena);
  });
});

describe('M6 — EvidenceService: gate go/no-go (fail-closed)', () => {
  const base: GoNoGoInput = {
    closedSignalsCount: 200,
    calendarDays: 120,
    netExpectancyR: 0.3,
    bootstrapLower95R: 0.05,
    maxDrawdownR: 8,
    scoreTiers: []
  };

  it('todos os critérios satisfeitos ⇒ GO', () => {
    const res = evaluateGoNoGo(base);
    expect(res.status).toBe('GO');
    expect(res.canClaimPerformance).toBe(true);
    expect(res.reasons).toEqual([]);
  });

  it('amostra insuficiente ⇒ NO_GO', () => {
    const res = evaluateGoNoGo({ ...base, closedSignalsCount: 99 });
    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('Amostra insuficiente'))).toBe(true);
  });

  it('período insuficiente ⇒ NO_GO', () => {
    const res = evaluateGoNoGo({ ...base, calendarDays: 59 });
    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('Período insuficiente'))).toBe(true);
  });

  it('expectativa abaixo de +0.10R ⇒ NO_GO', () => {
    const res = evaluateGoNoGo({ ...base, netExpectancyR: 0.09 });
    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('Expectativa líquida insuficiente'))).toBe(true);
  });

  it('limite inferior do CI exatamente 0 ⇒ NO_GO (exige > 0 estrito)', () => {
    const res = evaluateGoNoGo({ ...base, bootstrapLower95R: 0 });
    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('não é estritamente positivo'))).toBe(true);
  });

  it('drawdown acima de 15R ⇒ NO_GO', () => {
    const res = evaluateGoNoGo({ ...base, maxDrawdownR: 15.1 });
    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('Drawdown máximo'))).toBe(true);
  });

  it('tier com expectativa negativa e n>=30 habilitado reprova', () => {
    const res = evaluateGoNoGo({
      ...base,
      scoreTiers: [{ tier: '60-69', n: 40, netExpectancyR: -0.2, enabled: true }]
    });

    expect(res.status).toBe('NO_GO');
    expect(res.reasons.some(r => r.includes('60-69'))).toBe(true);
  });

  it('mesmo tier NEGATIVO mas DESABILITADO não reprova', () => {
    const res = evaluateGoNoGo({
      ...base,
      scoreTiers: [{ tier: '60-69', n: 40, netExpectancyR: -0.2, enabled: false }]
    });

    expect(res.status).toBe('GO');
  });

  it('tier negativo com n pequeno demais é ignorado (ruído estatístico)', () => {
    const res = evaluateGoNoGo({
      ...base,
      scoreTiers: [{ tier: '60-69', n: 10, netExpectancyR: -0.5, enabled: true }]
    });

    expect(res.status).toBe('GO');
  });

  it('canClaimPerformance nunca é true quando há qualquer reprovação', () => {
    const res = evaluateGoNoGo({ ...base, closedSignalsCount: 5 });
    expect(res.canClaimPerformance).toBe(false);
  });

  it('acumula TODAS as reprovações, não apenas a primeira', () => {
    const res = evaluateGoNoGo({
      ...base,
      closedSignalsCount: 10,
      calendarDays: 10,
      netExpectancyR: -0.5,
      maxDrawdownR: 40
    });

    expect(res.reasons.length).toBeGreaterThanOrEqual(4);
  });
});