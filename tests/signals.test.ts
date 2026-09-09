import { describe, it, expect } from 'vitest';
import { calculateVolumeProfile, calculateFibonacci, detectFVG } from '../server/binanceService.js';
import { KlineCandle } from '../src/types.js';

describe('Market Analysis & Indicator Calculation Suite', () => {
  const mockCandles: KlineCandle[] = [
    {
      timestamp: 1715000000000,
      open: 100,
      high: 105,
      low: 98,
      close: 102,
      volume: 1000,
      takerBuyVolume: 600
    },
    {
      timestamp: 1715000060000,
      open: 102,
      high: 110,
      low: 101,
      close: 108,
      volume: 2000,
      takerBuyVolume: 1400
    },
    {
      timestamp: 1715000120000,
      open: 108,
      high: 112,
      low: 106,
      close: 111,
      volume: 1500,
      takerBuyVolume: 800
    }
  ];

  it('calculates Volume Profile with VAH, VAL, and POC', () => {
    const profile = calculateVolumeProfile(mockCandles, 3);
    expect(profile).toBeDefined();
    expect(profile.vah).toBeGreaterThanOrEqual(profile.val);
    expect(profile.poc).toBeGreaterThanOrEqual(profile.val);
    expect(profile.poc).toBeLessThanOrEqual(profile.vah);
  });

  it('calculates Fibonacci levels accurately', () => {
    const fib = calculateFibonacci(mockCandles, 105);
    expect(fib).toBeDefined();
    expect(fib.fib50).toBeDefined();
    expect(fib.fib618).toBeDefined();
    expect(fib.fib68).toBeDefined();
    expect(fib.swingHigh).toBe(112);
    expect(fib.swingLow).toBe(98);
    expect(typeof fib.inGoldenPocket).toBe('boolean');
  });

  it('detects Fair Value Gaps (FVG) across consecutive candles', () => {
    const fvg = detectFVG(mockCandles);
    expect(fvg).toBeDefined();
    expect(typeof fvg.hasSinglePrintFVG).toBe('boolean');
  });
});
