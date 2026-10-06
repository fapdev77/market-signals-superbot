import { describe, it, expect } from 'vitest';
import {
  computeVolumeDeltaOscillator,
  generateVolumeOscillatorSeries,
  type VolumeOscillatorResult,
  type VolumeOscillatorPoint
} from '../src/utils/volumeOscillatorUtils.js';
import type { TickerData } from '../src/types.js';

describe('Volume Oscillator for CVD Delta Shifts (TDD)', () => {
  function makeMockTicker(overrides: Partial<TickerData> = {}): TickerData {
    return {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      marketType: 'crypto_futures',
      price: 65000,
      priceChangePercent24h: 3.5,
      high24h: 66000,
      low24h: 64000,
      volume24h: 50000,
      quoteVolume24h: 3250000000,
      openInterest: 1500000000,
      openInterestChange24h: 4.5,
      openInterestChange1h: 0.8,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 125000000,
      cvdDelta: 15000000,
      cvdDeltaPercent: 12.5,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.58,
      fibonacci: { swingHigh: 66000, swingLow: 64000, fib50: 65000, fib618: 64500, fib68: 64300, inGoldenPocket: false },
      rangeProfile: { vah: 65800, val: 64200, poc: 65000, inValueArea: true },
      keyLevels: { support1: 64000, support2: 63000, resistance1: 66000, resistance2: 67000, structureBreak: 'NONE', hasSinglePrintFVG: false },
      confluenceScore: 75,
      signalType: 'LONG',
      signalReason: 'Bullish orderflow convergence',
      confluenceFactors: ['CVD_BUY', 'OI_EXPANSION'],
      updatedAt: Date.now(),
      ...overrides
    };
  }

  describe('computeVolumeDeltaOscillator', () => {
    it('computes positive expanding volume oscillator for strong buyer momentum', () => {
      const ticker = makeMockTicker({
        takerBuyRatio: 0.65,
        cvdDelta: 20000000,
        cvdDirection: 'BUY'
      });

      const res = computeVolumeDeltaOscillator(ticker, { fastPeriod: 5, slowPeriod: 14 });

      expect(res.oscillatorPct).toBeGreaterThan(0);
      expect(res.fastEma).toBeGreaterThan(res.slowEma);
      expect(res.histogram).toBeGreaterThan(0);
      expect(res.momentumState).toBe('EXPANDING_BULLISH');
      expect(res.signal).toBe('STRONG_BUY_MOMENTUM');
      expect(res.trendLabel).toContain('Expansão Compradora');
    });

    it('computes negative expanding volume oscillator for aggressive seller momentum', () => {
      const ticker = makeMockTicker({
        takerBuyRatio: 0.35,
        cvd: -30000000,
        cvdDelta: -25000000,
        cvdDirection: 'SELL'
      });

      const res = computeVolumeDeltaOscillator(ticker, { fastPeriod: 5, slowPeriod: 14 });

      expect(res.oscillatorPct).toBeLessThan(-3);
      expect(res.fastEma).toBeLessThan(res.slowEma);
      expect(res.histogram).toBeLessThan(0);
      expect(res.momentumState).toBe('EXPANDING_BEARISH');
      expect(res.signal).toBe('STRONG_SELL_MOMENTUM');
      expect(res.trendLabel).toContain('Expansão Vendedora');
    });

    it('handles neutral or fading momentum appropriately', () => {
      const ticker = makeMockTicker({
        takerBuyRatio: 0.50,
        cvd: 0,
        cvdDelta: 0,
        cvdDeltaPercent: 0,
        cvdDirection: 'NEUTRAL'
      });

      const res = computeVolumeDeltaOscillator(ticker);

      expect(res.momentumState).toBe('NEUTRAL');
      expect(res.signal).toBe('NEUTRAL');
      expect(Math.abs(res.oscillatorPct)).toBeLessThan(5);
    });
  });

  describe('generateVolumeOscillatorSeries', () => {
    it('generates continuous multi-step oscillator trajectory points with histogram and signal lines', () => {
      const ticker = makeMockTicker({
        price: 65000,
        takerBuyRatio: 0.56,
        cvdDelta: 12000000
      });

      const series = generateVolumeOscillatorSeries(ticker, 24);

      expect(series).toHaveLength(24);
      expect(series[0]).toHaveProperty('timestamp');
      expect(series[0]).toHaveProperty('oscillatorValue');
      expect(series[0]).toHaveProperty('fastEma');
      expect(series[0]).toHaveProperty('slowEma');
      expect(series[0]).toHaveProperty('histogram');
      expect(series[0]).toHaveProperty('color');
    });
  });
});
