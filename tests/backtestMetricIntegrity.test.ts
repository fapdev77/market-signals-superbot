import { describe, it, expect } from 'vitest';
import { computeBacktestMetrics } from '../server/services/backtestMetrics.js';
import type { BacktestMetricInputs } from '../server/services/backtestMetrics.js';
import { calculateFactorCoverage } from '../server/services/factorCoverage.js';

/**
 * M3 / M4 / M8 (auditoria 2026-10-04) — métrica preenchida com constante.
 *
 * Uma estratégia que só ganhou não mede profit factor, nem Sortino, nem R
 * realizado. O motor devolvia 9.9, 4.5 e `preset.targetRiskRatio` nesses casos —
 * números que pareciam resultados e que nenhuma medição sustenta. Um relatório
 * com esses valores passa num limiar de qualidade sem que a qualidade tenha
 * sido observada.
 *
 * O contrato: medição que não existe é `null`, e o motivo vai para
 * `assumptions[]`. Nenhuma constante substitui ausência.
 */

function inputs(overrides: Partial<BacktestMetricInputs> = {}): BacktestMetricInputs {
  return {
    wins: 10,
    losses: 5,
    totalProfit: 300,
    totalLoss: 150,
    totalWinPctSum: 40,
    totalLossPctSum: 25,
    totalDurationSum: 15 * 45,
    balance: 10150,
    initialBalance: 10000,
    netReturns: [4, -3, 5, -2, 6, -4, 3, -5, 2, -2, 7, -3, 1, -1, 5],
    days: 30,
    targetRiskRatio: 2.5,
    ...overrides
  };
}

const allWins = inputs({
  wins: 12,
  losses: 0,
  totalProfit: 240,
  totalLoss: 0,
  totalWinPctSum: 36,
  totalLossPctSum: 0,
  balance: 10240,
  netReturns: [2, 3, 4, 1, 5, 2, 3, 4, 2, 1, 3, 2]
});

describe('M8 — sem perdas não há profit factor medido', () => {
  it('devolve null em vez da constante 9.9', () => {
    const m = computeBacktestMetrics(allWins);
    expect(m.profitFactor).toBeNull();
  });

  it('declara o motivo em assumptions', () => {
    const m = computeBacktestMetrics(allWins);
    const line = m.assumptions.find(a => /profit factor/i.test(a));
    expect(line).toBeDefined();
    expect(line).toMatch(/n\/d/i);
    expect(line).toMatch(/0 perdas/i);
  });

  it('com perdas, o profit factor é a razão medida', () => {
    const m = computeBacktestMetrics(inputs());
    expect(m.profitFactor).toBeCloseTo(2.0, 6);
  });

  it('um backtest sem nenhum trade fechado não inventa profit factor', () => {
    const m = computeBacktestMetrics(inputs({ wins: 0, losses: 0, totalProfit: 0, totalLoss: 0, balance: 10000, netReturns: [] }));
    expect(m.profitFactor).toBeNull();
  });
});

describe('M8 — sem retornos negativos não há Sortino medido', () => {
  it('devolve null em vez da constante 4.5', () => {
    const m = computeBacktestMetrics(allWins);
    expect(m.sortinoRatio).toBeNull();
  });

  it('declara o motivo em assumptions', () => {
    const m = computeBacktestMetrics(allWins);
    const line = m.assumptions.find(a => /sortino/i.test(a));
    expect(line).toBeDefined();
    expect(line).toMatch(/n\/d/i);
  });

  it('com um trade negativo, o Sortino é o quociente medido', () => {
    const m = computeBacktestMetrics(inputs());
    expect(m.sortinoRatio).not.toBeNull();
    expect(m.sortinoRatio).toBeGreaterThan(0);
  });
});

describe('M4 — sem perdas não há R realizado', () => {
  it('não devolve o R-alvo do preset como se fosse realizado', () => {
    const m = computeBacktestMetrics(allWins);
    expect(m.avgRiskReward).toBeNull();
    expect(m.avgRiskReward).not.toBe(allWins.targetRiskRatio);
  });

  it('declara que o R do preset é o pedido, não o obtido', () => {
    const m = computeBacktestMetrics(allWins);
    const line = m.assumptions.find(a => /r m[eé]dio realizado/i.test(a));
    expect(line).toBeDefined();
    expect(line).toMatch(/n\/d/i);
    expect(line).toMatch(/pedido/i);
  });

  it('com perdas, o R realizado é a média medida', () => {
    const m = computeBacktestMetrics(inputs());
    // (40/10) / (25/5) = 4.0 / 5.0
    expect(m.avgRiskReward).toBeCloseTo(0.8, 6);
  });

  it('sem nenhum trade, média de ganho e de prejuízo ficam nulas', () => {
    const m = computeBacktestMetrics(inputs({ wins: 0, losses: 0, totalWinPctSum: 0, totalLossPctSum: 0, netReturns: [], balance: 10000 }));
    expect(m.avgWinPct).toBeNull();
    expect(m.avgLossPct).toBeNull();
    expect(m.avgDurationMinutes).toBeNull();
  });
});

describe('M3 — Sharpe/Sortino só são anualizados com amostra suficiente', () => {
  it('abaixo do piso de trades, declara que não foi anualizado', () => {
    const m = computeBacktestMetrics(inputs({
      wins: 5,
      losses: 4,
      netReturns: [3, -2, 4, -1, 5, -3, 2, -1, 4],
      days: 30
    }));
    expect(m.tradesUsed).toBe(9);
    expect(m.isAnnualized).toBe(false);
    expect(m.annualFactor).toBeNull();
    expect(m.assumptions.some(a => /NÃO anualizado/.test(a))).toBe(true);
  });

  it('o resultado não anualizado não carrega o fator anual por baixo', () => {
    const few = inputs({ netReturns: [3, -2, 4, -1, 5, -3, 2, -1, 4] });
    const m = computeBacktestMetrics(few);
    const mean = few.netReturns.reduce((a, b) => a + b, 0) / few.netReturns.length;
    const std = Math.sqrt(few.netReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / few.netReturns.length);
    expect(m.sharpeRatio).toBeCloseTo(mean / std, 2);
  });

  it('com amostra suficiente, anualiza e o diz', () => {
    // 40 trades: acima do piso de 30.
    const many = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? -2 : 3));
    const m = computeBacktestMetrics(inputs({ netReturns: many, wins: 27, losses: 13 }));
    expect(m.tradesUsed).toBe(40);
    expect(m.isAnnualized).toBe(true);
    expect(m.annualFactor).toBeGreaterThan(1);
    expect(m.assumptions.some(a => /NÃO anualizado/.test(a))).toBe(false);
  });

  it('sem trades fechados, Sharpe é null e não zero', () => {
    const m = computeBacktestMetrics(inputs({ wins: 0, losses: 0, netReturns: [], balance: 10000 }));
    expect(m.sharpeRatio).toBeNull();
    expect(m.tradesUsed).toBe(0);
    expect(m.assumptions.some(a => /sharpe: n\/d/i.test(a))).toBe(true);
  });
});

/**
 * M7 — `reducedFactorSet` era uma constante disfarçada.
 *
 * O motor passava `candlesWithOi: 0` e `candlesWithLongShort: 0` hardcoded, então
 * a cobertura dava 0% e `reducedFactorSet` era `true` em toda execução. O relatório
 * dizia "rodou com conjunto reduzido de fatores" sem distinguir dois casos que não
 * se confundem: o fator foi medido e veio incompleto, ou o fator nunca foi
 * instrumentado. `historical_klines` não tem coluna de open interest e não há
 * histórico de long/short — o segundo é o caso real, e ele precisa ser declarado.
 */
describe('M7 — fator não instrumentado não vira cobertura medida', () => {
  it('declara quais fatores puderam ser medidos', () => {
    const c = calculateFactorCoverage({
      totalCandles: 500,
      candlesWithOi: 0,
      candlesWithFunding: 500,
      candlesWithLongShort: 0,
      availability: { openInterest: false, longShort: false, funding: true }
    });
    expect(c.availability.openInterest).toBe(false);
    expect(c.availability.longShort).toBe(false);
    expect(c.availability.funding).toBe(true);
  });

  it('um fator indisponível não aparece como se tivesse sido medido em 0%', () => {
    const c = calculateFactorCoverage({
      totalCandles: 500,
      candlesWithOi: 0,
      candlesWithFunding: 500,
      candlesWithLongShort: 0,
      availability: { openInterest: false, longShort: false, funding: true }
    });
    // Cobertura permanece 0 — honesto, nenhuma vela tinha o dado — mas o sinal
    // explícito diz que o número é ausência de instrumentação, não medição.
    expect(c.factorCoverage.openInterest).toBe(0);
    expect(c.factorCoverageAvailability).toEqual({
      openInterest: false,
      longShort: false,
      funding: true
    });
  });

  it('um fator medido e incompleto continua distinto do indisponível', () => {
    const partial = calculateFactorCoverage({
      totalCandles: 500,
      candlesWithOi: 250,
      candlesWithFunding: 500,
      candlesWithLongShort: 0,
      availability: { openInterest: true, longShort: false, funding: true }
    });
    expect(partial.factorCoverage.openInterest).toBe(50);
    expect(partial.factorCoverageAvailability.openInterest).toBe(true);
  });

  it('reducedFactorSet continua true — a execução foi reduzida de fato', () => {
    const c = calculateFactorCoverage({
      totalCandles: 500,
      candlesWithOi: 0,
      candlesWithFunding: 500,
      candlesWithLongShort: 0,
      availability: { openInterest: false, longShort: false, funding: true }
    });
    expect(c.reducedFactorSet).toBe(true);
  });

  it('sem disponibilidade declarada, o comportamento antigo é preservado', () => {
    const c = calculateFactorCoverage({
      totalCandles: 500,
      candlesWithOi: 0,
      candlesWithFunding: 500,
      candlesWithLongShort: 0
    });
    expect(c.reducedFactorSet).toBe(true);
    expect(c.factorCoverage.openInterest).toBe(0);
  });
});
