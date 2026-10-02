import { describe, it, expect } from 'vitest';
import {
  evaluateEntryConfirmationDecision,
  MIN_FILLED_TRADES_DEFAULT,
  MAX_DRAWDOWN_WORSE_PCT_DEFAULT,
  type EntryArmMetrics,
  type ExpectancyDiff
} from '../server/services/entryDecisionRule.js';

/** 7.2.3 — regra pré-registrada da confirmação de entrada (CA-2.4). */
describe('7.2.3 — regra de decisão pré-registrada da confirmação de entrada', () => {
  function arm(overrides: Partial<EntryArmMetrics> = {}): EntryArmMetrics {
    return {
      signalsEmitted: 100,
      entriesFilled: 50,
      closedTrades: 50,
      winRate: 55,
      expectancyR: 0.2,
      maxDrawdownPct: 10,
      notFilledShare: 0.5,
      avgFillMinutes: 2,
      ...overrides
    };
  }

  function diff(mean: number): ExpectancyDiff {
    return { mean, ciLow: mean - 0.05, ciHigh: mean + 0.05 };
  }

  it('liga a flag quando (a) ≥ 30 preenchidos, (b) diferença > 0 e (c) drawdown dentro de 20%', () => {
    const decision = evaluateEntryConfirmationDecision({
      control: arm({ maxDrawdownPct: 10 }),
      withConfirmation: arm({ entriesFilled: 30, maxDrawdownPct: 12 }),
      expectancyDiff: diff(0.03)
    });
    expect(decision.enable).toBe(true);
    expect(decision.reasons.join(' ')).toContain('PODE ser ligada');
  });

  it('CA-2.4 — 29 trades preenchidos barra; 30 (o limite) libera o critério (a)', () => {
    const at29 = evaluateEntryConfirmationDecision({
      control: arm(),
      withConfirmation: arm({ entriesFilled: MIN_FILLED_TRADES_DEFAULT - 1 }),
      expectancyDiff: diff(0.03)
    });
    expect(at29.enable).toBe(false);
    expect(at29.reasons.join(' ')).toContain('insuficiente');

    const at30 = evaluateEntryConfirmationDecision({
      control: arm(),
      withConfirmation: arm({ entriesFilled: MIN_FILLED_TRADES_DEFAULT }),
      expectancyDiff: diff(0.03)
    });
    expect(at30.enable).toBe(true);
  });

  it('diferença de expectativa ≤ 0 barra a decisão mesmo com trades suficientes', () => {
    const decision = evaluateEntryConfirmationDecision({
      control: arm(),
      withConfirmation: arm(),
      expectancyDiff: diff(0)
    });
    expect(decision.enable).toBe(false);
    expect(decision.reasons.join(' ')).toContain('≤ 0');
  });

  it('drawdown mais de 20% pior que o controle barra; exatamente no limite passa', () => {
    const worse = evaluateEntryConfirmationDecision({
      control: arm({ maxDrawdownPct: 10 }),
      withConfirmation: arm({ maxDrawdownPct: 12.01 }), // > 10 * 1.20
      expectancyDiff: diff(0.03)
    });
    expect(worse.enable).toBe(false);
    expect(worse.reasons.join(' ')).toContain('excede');

    const atLimit = evaluateEntryConfirmationDecision({
      control: arm({ maxDrawdownPct: 10 }),
      withConfirmation: arm({ maxDrawdownPct: 10 * (1 + MAX_DRAWDOWN_WORSE_PCT_DEFAULT / 100) }),
      expectancyDiff: diff(0.03)
    });
    expect(atLimit.enable).toBe(true);
  });
});
