import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatPriceRange,
  formatPercent,
  formatCompactNumber,
  formatTimestamp,
  formatUsd,
  calculateTradeMetrics
} from '../src/utils/formatters';

describe('formatters utility suite', () => {
  it('formats USD currency correctly', () => {
    expect(formatUsd(1234.56)).toBe('$1,234.56');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(undefined)).toBe('$0.00');
  });

  it('formats crypto and asset prices with correct decimals and currency flags', () => {
    expect(formatPrice(92450.5, { currency: true })).toBe('$92,450.50');
    expect(formatPrice(0.00452, { currency: true })).toBe('$0.00452');
    expect(formatPrice(1.2346, { maxDecimals: 3 })).toBe('1.235');
    expect(formatPrice(undefined)).toBe('0.00');
  });

  it('formats price ranges', () => {
    expect(formatPriceRange(100, 110, false)).toBe('100.00 - 110.00');
    expect(formatPriceRange(100, 110, true)).toBe('$100.00 - $110.00');
    expect(formatPriceRange(undefined, undefined)).toBe('$0.00 - $0.00');
  });

  it('formats percentages with directional signs', () => {
    expect(formatPercent(5.2)).toBe('+5.20%');
    expect(formatPercent(-3.45)).toBe('-3.45%');
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(undefined)).toBe('0.00%');
  });

  it('formats compact numbers (K, M, B)', () => {
    expect(formatCompactNumber(500)).toBe('500.00');
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(2500000)).toBe('2.50M');
    expect(formatCompactNumber(1200000000)).toBe('1.20B');
  });

  it('formats timestamps into valid local date/time strings', () => {
    const ts = 1715000000000;
    const formatted = formatTimestamp(ts);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatTimestamp(undefined)).toBe('--:--');
  });

  it('calculates trade risk and reward ratios accurately', () => {
    const metrics = calculateTradeMetrics({
      entry: 100,
      stopLoss: 95,
      target1: 110,
      target2: 120,
      direction: 'LONG'
    });
    expect(metrics.riskPct).toBeCloseTo(5.0);
    expect(metrics.target1GainPct).toBeCloseTo(10.0);
    expect(metrics.target2GainPct).toBeCloseTo(20.0);
    expect(metrics.rrRatio1).toBeCloseTo(2.0);
    expect(metrics.rrRatio2).toBeCloseTo(4.0);
  });

  it('handles invalid inputs gracefully in calculateTradeMetrics', () => {
    const zeroEntry = calculateTradeMetrics({ entry: 0, stopLoss: 90, target1: 110 });
    expect(zeroEntry.riskPct).toBe(0);
    expect(zeroEntry.rrRatio1).toBe(0);

    const noStop = calculateTradeMetrics({ entry: 100, stopLoss: undefined, target1: 110 });
    expect(noStop.riskPct).toBe(0);
    expect(noStop.rrRatio1).toBe(0);
  });
});
