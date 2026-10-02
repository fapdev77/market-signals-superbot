import { describe, it, expect } from 'vitest';
import {
  buildEntryComparisonReport,
  bootstrapMeanDiffCI,
  mean,
  computeArmMetrics
} from '../server/services/entryConfirmationComparison.js';
import type { BacktestResult, EntryConfirmationStats } from '../src/types.js';

/** 7.2.2 / CA-2.3 — o comparativo precisa ser reprodutível com a mesma semente. */
describe('7.2.2 — comparativo da confirmação de entrada (determinismo e métricas)', () => {
  function ec(overrides: Partial<EntryConfirmationStats> = {}): EntryConfirmationStats {
    return {
      enabled: true,
      signalsEmitted: 0,
      entriesFilled: 0,
      entriesNotFilled: 0,
      entriesInvalidated: 0,
      rPerSignal: [],
      fillMinutesSum: 0,
      fillCount: 0,
      ...overrides
    };
  }

  function result(overrides: Partial<BacktestResult> = {}): BacktestResult {
    return {
      id: 'r',
      symbol: 'BTCUSDT',
      profile: 'daytrade',
      strategyId: 's',
      startTime: 0,
      endTime: 0,
      totalCandlesTested: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 50,
      profitFactor: 1,
      maxDrawdown: 8,
      netProfit: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      avgRiskReward: 0,
      avgDurationMinutes: 0,
      equityCurve: [],
      diagnostic: { strengths: [], weaknesses: [], weightAnalysis: [], suggestions: [] },
      config: { symbol: 'BTCUSDT', weights: {} as BacktestResult['config']['weights'] },
      createdAt: 0,
      ...overrides
    };
  }

  const control = result({
    totalTrades: 10,
    winRate: 50,
    maxDrawdown: 8,
    entryConfirmation: ec({
      enabled: false,
      signalsEmitted: 10,
      entriesFilled: 10,
      rPerSignal: [1, -1, 2, -1, 1, -1, 1, 1, -1, 1],
      fillCount: 10,
      fillMinutesSum: 30
    })
  });
  const withConfirmation = result({
    totalTrades: 8,
    winRate: 62.5,
    maxDrawdown: 9,
    entryConfirmation: ec({
      enabled: true,
      signalsEmitted: 10,
      entriesFilled: 8,
      entriesNotFilled: 2,
      rPerSignal: [1.2, -1.1, 2.1, 0, 1.3, 0, -1.2, 1.1, -1.0, 1.5],
      fillCount: 8,
      fillMinutesSum: 24,
      limitation: 'R4 agregada'
    })
  });

  function build() {
    return buildEntryComparisonReport({
      symbol: 'BTCUSDT',
      days: 30,
      seed: 42,
      engineVersion: 'abc1234',
      control,
      withConfirmation,
      generatedAt: 1_700_000_000_000,
      iterations: 500
    });
  }

  it('CA-2.3 — duas montagens com a mesma semente produzem markdown idêntico', () => {
    const a = build();
    const b = build();
    expect(a.markdown).toBe(b.markdown);
    expect(a.diff).toEqual(b.diff);
    expect(a.decision).toEqual(b.decision);
  });

  it('o IC bootstrap é determinístico para a mesma semente e muda com outra semente', () => {
    const a = bootstrapMeanDiffCI([1, 2, 3, 4], [2, 3, 4, 5], { seed: 7, iterations: 500 });
    const b = bootstrapMeanDiffCI([1, 2, 3, 4], [2, 3, 4, 5], { seed: 7, iterations: 500 });
    const c = bootstrapMeanDiffCI([1, 2, 3, 4], [2, 3, 4, 5], { seed: 8, iterations: 500 });
    expect(a).toEqual(b);
    expect(a.mean).toBe(1);
    expect(c.mean).toBe(1);
    // com semente diferente, os limites do IC quase certamente diferem
    expect(c.ciLow !== a.ciLow || c.ciHigh !== a.ciHigh).toBe(true);
  });

  it('o relatório contém as métricas da 7.2.2 e aplica a regra da 7.2.3', () => {
    const { markdown, decision, controlMetrics, withMetrics } = build();
    for (const label of [
      'Sinais emitidos',
      'Preenchidos',
      'Taxa de preenchimento',
      'Fechados',
      'Win rate',
      'Expectativa líquida (R/sinal emitido)',
      'Drawdown máximo',
      'Tempo médio até o preenchimento',
      'ENTRY_NOT_FILLED',
      'Regra de decisão pré-registrada',
      'IC 95% bootstrap'
    ]) {
      expect(markdown).toContain(label);
    }
    expect(controlMetrics.expectancyR).toBeCloseTo(mean(control.entryConfirmation!.rPerSignal), 10);
    expect(withMetrics.notFilledShare).toBeCloseTo(0.2, 10);
    // 8 preenchidos < 30 ⇒ a regra (a) barra a decisão mesmo com diferença positiva.
    expect(decision.enable).toBe(false);
  });

  it('computeArmMetrics marca não-preenchidos como 0 R por sinal emitido', () => {
    const m = computeArmMetrics(withConfirmation);
    // 8 preenchidos e 2 não-preenchidos (0 R): média de 10 valores
    expect(m.expectancyR).toBeCloseTo(mean(withConfirmation.entryConfirmation!.rPerSignal), 10);
    expect(m.notFilledShare).toBeCloseTo(0.2, 10);
    expect(m.avgFillMinutes).toBeCloseTo(3, 10);
  });
});
