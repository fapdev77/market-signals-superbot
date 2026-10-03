import { describe, it, expect } from 'vitest';
import {
  evaluateEntryConfirmationDecisionV2,
  MIN_FILLED_PER_ARM_DEFAULT,
  MAX_DRAWDOWN_WORSE_PCT_DEFAULT_V2,
  type PairedArmMetrics,
  type PairedDiff
} from '../server/services/entryDecisionRuleV2.js';

/** 8.2.2 / CA-2.3 — a regra v2 cobre todos os limites. */
describe('8.2.2 / CA-2.3 — regra de decisão v2 (pareada)', () => {
  function arm(overrides: Partial<PairedArmMetrics> = {}): PairedArmMetrics {
    return {
      signalsEmitted: 100,
      entriesFilled: 50,
      positionsClosed: 50,
      winRate: 55,
      expectancyR: 0.2,
      maxDrawdownPct: 10,
      notFilledShare: 0.5,
      ...overrides
    };
  }

  function diff(ciLow: number, mean = ciLow + 0.01): PairedDiff {
    return { mean, ciLow, ciHigh: mean + 0.05, pairs: 100 };
  }

  it('liga quando (a) ≥30/braço, (b) IC inf > 0, (c) DD ≤120% e (d) expectativa ≥ 0', () => {
    const decision = evaluateEntryConfirmationDecisionV2({
      control: arm(),
      withConfirmation: arm({ entriesFilled: 40, maxDrawdownPct: 11, expectancyR: 0.05 }),
      pairedDiff: diff(0.001)
    });
    expect(decision.enable).toBe(true);
    expect(decision.reasons.join(' ')).toContain('PODE ser ligada');
  });

  it('(a) 29 preenchidos por braço barra; 30 libera', () => {
    const at29 = evaluateEntryConfirmationDecisionV2({
      control: arm({ entriesFilled: MIN_FILLED_PER_ARM_DEFAULT - 1 }),
      withConfirmation: arm({ entriesFilled: MIN_FILLED_PER_ARM_DEFAULT - 1 }),
      pairedDiff: diff(0.001)
    });
    expect(at29.enable).toBe(false);
    expect(at29.reasons.join(' ')).toContain('amostra insuficiente');

    const at30 = evaluateEntryConfirmationDecisionV2({
      control: arm({ entriesFilled: MIN_FILLED_PER_ARM_DEFAULT }),
      withConfirmation: arm({ entriesFilled: MIN_FILLED_PER_ARM_DEFAULT }),
      pairedDiff: diff(0.001)
    });
    expect(at30.enable).toBe(true);
  });

  it('(b) IC inferior 0 barra; 0,001 libera', () => {
    const zero = evaluateEntryConfirmationDecisionV2({
      control: arm(),
      withConfirmation: arm(),
      pairedDiff: diff(0)
    });
    expect(zero.enable).toBe(false);
    expect(zero.reasons.join(' ')).toContain('≤ 0');

    const positive = evaluateEntryConfirmationDecisionV2({
      control: arm(),
      withConfirmation: arm(),
      pairedDiff: diff(0.001)
    });
    expect(positive.enable).toBe(true);
  });

  it('(c) drawdown exatamente 120% passa; 121% barra', () => {
    const atLimit = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 10 }),
      withConfirmation: arm({ maxDrawdownPct: 10 * (1 + MAX_DRAWDOWN_WORSE_PCT_DEFAULT_V2 / 100) }),
      pairedDiff: diff(0.001)
    });
    expect(atLimit.enable).toBe(true);

    const over = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 10 }),
      withConfirmation: arm({ maxDrawdownPct: 12.01 }),
      pairedDiff: diff(0.001)
    });
    expect(over.enable).toBe(false);
    expect(over.reasons.join(' ')).toContain('excede');
  });

  it('(d) expectativa negativa barra sem aceite; aceite do dono libera', () => {
    const blocked = evaluateEntryConfirmationDecisionV2({
      control: arm(),
      withConfirmation: arm({ expectancyR: -0.3 }),
      pairedDiff: diff(0.001)
    });
    expect(blocked.enable).toBe(false);
    expect(blocked.reasons.join(' ')).toContain('sem aceite');

    const accepted = evaluateEntryConfirmationDecisionV2({
      control: arm(),
      withConfirmation: arm({ expectancyR: -0.3 }),
      pairedDiff: diff(0.001),
      ownerAcceptance: { acceptedNegativeExpectancy: true, reason: 'paper experimental' }
    });
    expect(accepted.enable).toBe(true);
    expect(accepted.reasons.join(' ')).toContain('ACEITE EXPLÍCITO');
  });

  it('falha se qualquer condição faltar (ex.: IC ok mas amostra pequena)', () => {
    const decision = evaluateEntryConfirmationDecisionV2({
      control: arm({ entriesFilled: 10 }),
      withConfirmation: arm({ entriesFilled: 10 }),
      pairedDiff: diff(0.001)
    });
    expect(decision.enable).toBe(false);
  });
});
