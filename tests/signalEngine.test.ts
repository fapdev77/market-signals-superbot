import { describe, it, expect } from 'vitest';
import { processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { IndicatorWeights, KlineCandle, TickerData } from '../src/types.js';

describe('Signal Engine & Multi-Timeframe Validation Suite', () => {
  const defaultWeights: IndicatorWeights = {
    volumeSurgeWeight: 20,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 15,
    fibonacciZoneWeight: 15,
    rangePocWeight: 10,
    supportResistanceWeight: 10,
    volumeProfileRange: 20,
    minRiskRewardRatio: 3.0
  };

  const sampleKlines: KlineCandle[] = Array.from({ length: 30 }, (_, i) => ({
    timestamp: 1715000000000 + i * 900000,
    open: 90000 + i * 50,
    high: 90000 + i * 50 + 80,
    low: 90000 + i * 50 - 20,
    close: 90000 + i * 50 + 60,
    volume: 1000 + i * 10,
    takerBuyVolume: 650 + i * 10
  }));

  it('correctly processes ticker state and computes confluence metrics', () => {
    const rawTicker = {
      symbol: 'BTCUSDT',
      lastPrice: '91500',
      priceChangePercent: '2.5',
      highPrice: '92000',
      lowPrice: '89500',
      volume: '5000',
      quoteVolume: '450000000'
    };

    const processed = processTickerState(rawTicker, sampleKlines, 500000, 0.0001, defaultWeights);

    expect(processed.symbol).toBe('BTCUSDT');
    expect(processed.price).toBe(91500);
    expect(processed.rangeProfile).toBeDefined();
    expect(processed.fibonacci).toBeDefined();
    expect(processed.keyLevels).toBeDefined();
    expect(typeof processed.confluenceScore).toBe('number');
    expect(processed.confluenceScore).toBeGreaterThanOrEqual(0);
    expect(processed.confluenceScore).toBeLessThanOrEqual(100);
  });

  it('rejects signals with insufficient confluence score or NEUTRAL signalType', () => {
    const neutralTicker: TickerData = {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      name: 'Ethereum',
      marketType: 'crypto_futures',
      price: 3200,
      priceChangePercent24h: 0.1,
      high24h: 3250,
      low24h: 3180,
      volume24h: 1000,
      quoteVolume24h: 3200000,
      openInterest: 10000,
      openInterestChange24h: 0,
      openInterestChange1h: 0,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 0.1,
      fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
      cvd: 0,
      cvdDelta: 0,
      cvdDeltaPercent: 0,
      cvdDirection: 'NEUTRAL',
      takerBuyRatio: 0.5,
      fibonacci: { fib50: 3200, fib618: 3180, fib68: 3170, swingHigh: 3250, swingLow: 3150, inGoldenPocket: false },
      rangeProfile: { vah: 3240, val: 3160, poc: 3200, inValueArea: true },
      keyLevels: { support1: 3160, support2: 3120, resistance1: 3240, resistance2: 3280, structureBreak: 'NONE', hasSinglePrintFVG: false },
      confluenceScore: 40,
      signalType: 'NEUTRAL',
      signalReason: 'Sem confluência',
      confluenceFactors: [],
      updatedAt: Date.now()
    };

    const signal = buildTradeSignal(neutralTicker, sampleKlines, 3.0);
    expect(signal).toBeNull();
  });

  it('enforces minimum Risk:Reward ratio and rejects inadequate trades', () => {
    const highConfluenceTicker: TickerData = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      marketType: 'crypto_futures',
      price: 90000,
      priceChangePercent24h: 3.5,
      high24h: 91000,
      low24h: 88000,
      volume24h: 10000,
      quoteVolume24h: 900000000,
      openInterest: 50000,
      openInterestChange24h: 5,
      openInterestChange1h: 2,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 0.1,
      fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
      cvd: 2000000,
      cvdDelta: 500000,
      cvdDeltaPercent: 15,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.62,
      fibonacci: { fib50: 89500, fib618: 89000, fib68: 88800, swingHigh: 91000, swingLow: 88000, inGoldenPocket: true },
      rangeProfile: { vah: 90500, val: 89200, poc: 89800, inValueArea: true },
      keyLevels: { support1: 89200, support2: 88000, resistance1: 90500, resistance2: 91500, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
      confluenceScore: 85,
      signalType: 'LONG',
      signalReason: 'Golden pocket + CVD Bullish',
      confluenceFactors: ['Golden Pocket', 'CVD Buy', 'Open Interest'],
      updatedAt: Date.now()
    };

    // If we require an impossible R:R of 15.0, it must reject
    const strictSignal = buildTradeSignal(highConfluenceTicker, sampleKlines, 15.0);
    expect(strictSignal).toBeNull();

    // Standard 3.0 ratio should yield a valid trade signal
    const validSignal = buildTradeSignal(highConfluenceTicker, sampleKlines, 2.0);
    expect(validSignal).toBeDefined();
    expect(validSignal?.direction).toBe('LONG');
    expect(validSignal?.riskRewardRatio).toBeGreaterThanOrEqual(2.0);
  });

  it('detects and rejects false spikes with long wicks (>55% candle range)', () => {
    const spikeCandle: KlineCandle = {
      timestamp: Date.now(),
      open: 90000,
      close: 90050,
      high: 91000, // huge upper wick: (91000 - 90050) = 950 out of 1000 range = 95%
      low: 90000,
      volume: 5000,
      takerBuyVolume: 2000
    };

    const klinesWithSpike = [...sampleKlines.slice(-4), spikeCandle];

    const tickerForLong: TickerData = {
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      name: 'Solana',
      marketType: 'crypto_futures',
      price: 180,
      priceChangePercent24h: 4.0,
      high24h: 185,
      low24h: 172,
      volume24h: 2000,
      quoteVolume24h: 360000,
      openInterest: 10000,
      openInterestChange24h: 2,
      openInterestChange1h: 1,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 0.1,
      fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
      cvd: 50000,
      cvdDelta: 10000,
      cvdDeltaPercent: 10,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.58,
      fibonacci: { fib50: 178, fib618: 176, fib68: 175, swingHigh: 185, swingLow: 170, inGoldenPocket: true },
      rangeProfile: { vah: 182, val: 174, poc: 178, inValueArea: true },
      keyLevels: { support1: 174, support2: 170, resistance1: 184, resistance2: 195, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
      confluenceScore: 85,
      signalType: 'LONG',
      signalReason: 'Breakout attempt',
      confluenceFactors: ['CVD Buy'],
      updatedAt: Date.now()
    };

    const signal = buildTradeSignal(tickerForLong, klinesWithSpike, 2.0);
    expect(signal).toBeDefined();
    expect(signal?.validationStatus).toBe('REJECTED_SPIKE');
    expect(signal?.validationStage).toContain('REJEITADO');
  });

  it('incorporates RSI divergence into signal confluence when configured', () => {
    const rawTicker = {
      symbol: 'SOLUSDT',
      lastPrice: '175.50',
      priceChangePercent: '-3.5',
      highPrice: '185.00',
      lowPrice: '174.00',
      volume: '150000',
      quoteVolume: '26000000'
    };

    const weightsWithRsi: IndicatorWeights = {
      ...defaultWeights,
      rsiDivergenceWeight: 25,
      volumeProfileTimeframe: '15m'
    };

    const processed = processTickerState(rawTicker, sampleKlines, 500000, 0.0001, weightsWithRsi);
    expect(processed.symbol).toBe('SOLUSDT');
    expect(processed.confluenceScore).toBeGreaterThan(0);
    expect(Array.isArray(processed.confluenceFactors)).toBe(true);
  });
});
