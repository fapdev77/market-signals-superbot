import { describe, it, expect } from 'vitest';
import {
  evaluateGoNoGo,
  type GoNoGoInput
} from '../server/services/EvidenceService.js';

describe('M3.4 & CA-3.4: Pure Go/No-Go Decision Function Tested at Exact Boundaries', () => {
  const validPassingInput: GoNoGoInput = {
    closedSignalsCount: 100,
    calendarDays: 60,
    netExpectancyR: 0.10,
    bootstrapLower95R: 0.01,
    maxDrawdownR: 15.0,
    scoreTiers: [
      { tier: '70-79', n: 35, netExpectancyR: 0.08, enabled: true },
      { tier: '80-89', n: 45, netExpectancyR: 0.14, enabled: true },
      { tier: '90-100', n: 20, netExpectancyR: 0.22, enabled: true }
    ]
  };

  it('passes (GO) when all criteria meet the exact minimum thresholds', () => {
    const res = evaluateGoNoGo(validPassingInput);
    expect(res.status).toBe('GO');
    expect(res.canClaimPerformance).toBe(true);
    expect(res.reasons).toHaveLength(0);
  });

  it('fails (NO_GO) when closedSignalsCount is 99 vs 100', () => {
    const res99 = evaluateGoNoGo({
      ...validPassingInput,
      closedSignalsCount: 99
    });
    expect(res99.status).toBe('NO_GO');
    expect(res99.canClaimPerformance).toBe(false);
    expect(res99.reasons.some(r => r.includes('99') || r.includes('100'))).toBe(true);

    const res100 = evaluateGoNoGo({
      ...validPassingInput,
      closedSignalsCount: 100
    });
    expect(res100.status).toBe('GO');
    expect(res100.canClaimPerformance).toBe(true);
  });

  it('fails (NO_GO) when calendarDays is 59 vs 60', () => {
    const res59 = evaluateGoNoGo({
      ...validPassingInput,
      calendarDays: 59
    });
    expect(res59.status).toBe('NO_GO');
    expect(res59.canClaimPerformance).toBe(false);
    expect(res59.reasons.some(r => r.includes('59') || r.includes('60'))).toBe(true);

    const res60 = evaluateGoNoGo({
      ...validPassingInput,
      calendarDays: 60
    });
    expect(res60.status).toBe('GO');
  });

  it('fails (NO_GO) when netExpectancyR is 0.099 vs 0.10', () => {
    const resUnder = evaluateGoNoGo({
      ...validPassingInput,
      netExpectancyR: 0.099
    });
    expect(resUnder.status).toBe('NO_GO');
    expect(resUnder.canClaimPerformance).toBe(false);

    const resExact = evaluateGoNoGo({
      ...validPassingInput,
      netExpectancyR: 0.10
    });
    expect(resExact.status).toBe('GO');
  });

  it('fails (NO_GO) when bootstrap lower 95% bound is 0 or negative', () => {
    const resZero = evaluateGoNoGo({
      ...validPassingInput,
      bootstrapLower95R: 0.0
    });
    expect(resZero.status).toBe('NO_GO');
    expect(resZero.canClaimPerformance).toBe(false);

    const resNegative = evaluateGoNoGo({
      ...validPassingInput,
      bootstrapLower95R: -0.02
    });
    expect(resNegative.status).toBe('NO_GO');
  });

  it('fails (NO_GO) when maxDrawdownR exceeds 15.0 R', () => {
    const resOver = evaluateGoNoGo({
      ...validPassingInput,
      maxDrawdownR: 15.01
    });
    expect(resOver.status).toBe('NO_GO');
    expect(resOver.canClaimPerformance).toBe(false);

    const resExact = evaluateGoNoGo({
      ...validPassingInput,
      maxDrawdownR: 15.0
    });
    expect(resExact.status).toBe('GO');
  });

  it('fails (NO_GO) if any score tier with n >= 30 and negative expectancy remains enabled', () => {
    // Tier with n=30, negative expectancy and enabled: true -> must fail
    const resWithNegativeEnabled = evaluateGoNoGo({
      ...validPassingInput,
      scoreTiers: [
        { tier: '70-79', n: 30, netExpectancyR: -0.05, enabled: true },
        { tier: '80-89', n: 50, netExpectancyR: 0.20, enabled: true },
        { tier: '90-100', n: 20, netExpectancyR: 0.25, enabled: true }
      ]
    });
    expect(resWithNegativeEnabled.status).toBe('NO_GO');
    expect(resWithNegativeEnabled.canClaimPerformance).toBe(false);
    expect(resWithNegativeEnabled.reasons.some(r => r.includes('70-79'))).toBe(true);

    // If disabled, it passes
    const resWithNegativeDisabled = evaluateGoNoGo({
      ...validPassingInput,
      scoreTiers: [
        { tier: '70-79', n: 30, netExpectancyR: -0.05, enabled: false },
        { tier: '80-89', n: 50, netExpectancyR: 0.20, enabled: true },
        { tier: '90-100', n: 20, netExpectancyR: 0.25, enabled: true }
      ]
    });
    expect(resWithNegativeDisabled.status).toBe('GO');
    expect(resWithNegativeDisabled.canClaimPerformance).toBe(true);

    // If n < 30 (e.g. n=29), it does not trigger the prohibition
    const resWithLowCount = evaluateGoNoGo({
      ...validPassingInput,
      scoreTiers: [
        { tier: '70-79', n: 29, netExpectancyR: -0.05, enabled: true },
        { tier: '80-89', n: 51, netExpectancyR: 0.20, enabled: true },
        { tier: '90-100', n: 20, netExpectancyR: 0.25, enabled: true }
      ]
    });
    expect(resWithLowCount.status).toBe('GO');
  });
});
