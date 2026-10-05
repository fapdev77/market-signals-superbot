import { describe, it, expect } from 'vitest';
import { analyzeRealtimeMomentum } from '../src/components/TrendStrengthIndicator';
import { TickerData } from '../src/types';

describe('TrendStrengthIndicator / analyzeRealtimeMomentum', () => {
  it('returns graceful fallback when ticker is null', () => {
    const result = analyzeRealtimeMomentum(null);
    expect(result.score).toBe(0);
    expect(result.directionalBias).toBe('NEUTRAL');
    expect(result.bars).toBe(1);
    expect(result.factors).toEqual([]);
    expect(result.rangePositionPct).toBe(50);
  });

  it('correctly calculates bullish momentum and high ADX for strong upward trend', () => {
    const mockTicker: TickerData = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      marketType: 'crypto_futures',
      price: 68500,
      priceChangePercent24h: 4.8,
      high24h: 69000,
      low24h: 64000,
      volume24h: 45000,
      quoteVolume24h: 3000000000,
      ma24h: 65500,
      ma24hDeviationPct: 4.58,
      openInterest: 120000,
      openInterestChange24h: 5.2,
      openInterestChange1h: 1.8,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 45000000,
      cvdDelta: 1200000,
      cvdDeltaPercent: 15.4,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.62,
      confluenceScore: 82,
      signalType: 'STRONG_LONG',
      signalReason: 'Bullish CVD expansion + Golden Pocket bounce',
      confluenceFactors: ['CVD_BUY', 'OI_EXPANDING', 'ABOVE_POC'],
      fibonacci: {
        swingHigh: 69000,
        swingLow: 64000,
        fib50: 66500,
        fib618: 67090,
        fib68: 67400,
        inGoldenPocket: false,
        trend: 'UP'
      },
      rangeProfile: {
        vah: 68200,
        val: 65100,
        poc: 66800,
        inValueArea: false
      },
      keyLevels: {
        support1: 67000,
        support2: 66000,
        resistance1: 69500,
        resistance2: 70000,
        structureBreak: 'BULLISH',
        hasSinglePrintFVG: false
      },
      updatedAt: Date.now()
    };

    const result = analyzeRealtimeMomentum(mockTicker);
    expect(result.directionalBias).toBe('BULLISH');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.adxEstimated).toBeGreaterThanOrEqual(35);
    expect(result.bars).toBeGreaterThanOrEqual(4);
    expect(result.signedScore).toBeGreaterThan(0);
    expect(result.rangePositionPct).toBeGreaterThan(80); // 68500 is close to 69000
    expect(result.factors.length).toBe(6);
    expect(result.institutionalVerdict).toContain('Momentum comprador');
  });

  it('correctly calculates bearish momentum for strong downward trend', () => {
    const mockTicker: TickerData = {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      name: 'Ethereum',
      marketType: 'crypto_futures',
      price: 2420,
      priceChangePercent24h: -5.2,
      high24h: 2600,
      low24h: 2400,
      volume24h: 180000,
      quoteVolume24h: 450000000,
      ma24h: 2540,
      ma24hDeviationPct: -4.72,
      openInterest: 85000,
      openInterestChange24h: 3.1,
      openInterestChange1h: 1.2,
      fundingRate: -0.0002,
      fundingRateDaily: -0.0006,
      fundingRateAnnualized: -21.9,
      cvd: -35000000,
      cvdDelta: -850000,
      cvdDeltaPercent: -18.2,
      cvdDirection: 'SELL',
      takerBuyRatio: 0.38,
      confluenceScore: 78,
      signalType: 'STRONG_SHORT',
      signalReason: 'Aggressive short sellers breaking VAL',
      confluenceFactors: ['CVD_SELL', 'OI_EXPANDING_BEARISH'],
      fibonacci: {
        swingHigh: 2600,
        swingLow: 2400,
        fib50: 2500,
        fib618: 2476,
        fib68: 2464,
        inGoldenPocket: false,
        trend: 'DOWN'
      },
      rangeProfile: {
        vah: 2580,
        val: 2480,
        poc: 2530,
        inValueArea: false
      },
      keyLevels: {
        support1: 2380,
        support2: 2320,
        resistance1: 2480,
        resistance2: 2540,
        structureBreak: 'BEARISH',
        hasSinglePrintFVG: false
      },
      updatedAt: Date.now()
    };

    const result = analyzeRealtimeMomentum(mockTicker);
    expect(result.directionalBias).toBe('BEARISH');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.signedScore).toBeLessThan(0);
    expect(result.rangePositionPct).toBeLessThan(20); // 2420 is close to 2400
    expect(result.institutionalVerdict).toContain('vendedora');
  });

  it('identifies consolidating / range-bound market when price movement is minimal', () => {
    const mockTicker: TickerData = {
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      name: 'Solana',
      marketType: 'crypto_futures',
      price: 150.2,
      priceChangePercent24h: 0.1,
      high24h: 153.0,
      low24h: 147.0,
      volume24h: 50000,
      quoteVolume24h: 7500000,
      ma24h: 150.0,
      ma24hDeviationPct: 0.13,
      openInterest: 30000,
      openInterestChange24h: 0.1,
      openInterestChange1h: 0.05,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 100000,
      cvdDelta: 5000,
      cvdDeltaPercent: 0.5,
      cvdDirection: 'NEUTRAL',
      takerBuyRatio: 0.505,
      confluenceScore: 40,
      signalType: 'NEUTRAL',
      signalReason: 'Range bound consolidation',
      confluenceFactors: [],
      fibonacci: {
        swingHigh: 153,
        swingLow: 147,
        fib50: 150,
        fib618: 150.7,
        fib68: 151.0,
        inGoldenPocket: false
      },
      rangeProfile: {
        vah: 152,
        val: 148,
        poc: 150.1,
        inValueArea: true
      },
      keyLevels: {
        support1: 147,
        support2: 144,
        resistance1: 153,
        resistance2: 156,
        structureBreak: 'NONE',
        hasSinglePrintFVG: false
      },
      updatedAt: Date.now()
    };

    const result = analyzeRealtimeMomentum(mockTicker);
    expect(result.directionalBias).toBe('NEUTRAL');
    expect(result.bars).toBeLessThanOrEqual(2);
    expect(result.adxEstimated).toBeLessThan(30);
    expect(result.regimeLabel).toContain('Lateral');
  });
});
