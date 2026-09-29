import { describe, it, expect } from 'vitest';
import { canGenerateSignals, canEvaluateActiveTrades, MAX_DATA_AGE_MS } from '../server/services/DataGate.js';
import { TickerData } from '../src/types.js';

describe('DataGate & Data Integrity Suite (D2, D3, D5)', () => {
  const baseTicker: TickerData = {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    name: 'Bitcoin',
    marketType: 'crypto_futures',
    price: 94000,
    priceChangePercent24h: 2.5,
    high24h: 95000,
    low24h: 92000,
    volume24h: 15000,
    quoteVolume24h: 1400000000,
    openInterest: 50000,
    openInterestChange24h: 3.2,
    openInterestChange1h: 0.8,
    fundingRate: 0.0001,
    fundingRateDaily: 0.0003,
    fundingRateAnnualized: 0.1095,
    fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
    cvd: 500000,
    cvdDelta: 60000,
    cvdDeltaPercent: 1.2,
    cvdDirection: 'BUY',
    takerBuyRatio: 0.53,
    fibonacci: { fib50: 93500, fib618: 93200, fib68: 93000, swingHigh: 95000, swingLow: 92000, inGoldenPocket: false },
    rangeProfile: { vah: 94500, val: 93200, poc: 93800, inValueArea: true },
    keyLevels: { support1: 93000, support2: 92000, resistance1: 95000, resistance2: 96000, structureBreak: 'NONE', hasSinglePrintFVG: false },
    confluenceScore: 75,
    signalType: 'LONG',
    signalReason: 'Confluência test',
    confluenceFactors: ['CVD Positivo'],
    updatedAt: Date.now()
  };

  it('should allow signal generation for fresh, valid market data', () => {
    const decision = canGenerateSignals(baseTicker, Date.now());
    expect(decision.allow).toBe(true);
    expect(decision.isDegraded).toBe(false);
  });

  it('should block signal generation if market data is older than MAX_DATA_AGE_MS (60s)', () => {
    const staleTicker = { ...baseTicker, updatedAt: Date.now() - (MAX_DATA_AGE_MS + 5000) };
    const decision = canGenerateSignals(staleTicker, Date.now());
    expect(decision.allow).toBe(false);
    expect(decision.isDegraded).toBe(true);
    expect(decision.reason).toContain('desatualizado');
  });

  it('should block signal generation if price is zero, negative or NaN', () => {
    const invalidTicker = { ...baseTicker, price: 0 };
    expect(canGenerateSignals(invalidTicker).allow).toBe(false);

    const nanTicker = { ...baseTicker, price: NaN };
    expect(canGenerateSignals(nanTicker).allow).toBe(false);
  });

  it('should evaluate active trade status safely when data is fresh', () => {
    const decision = canEvaluateActiveTrades(baseTicker, Date.now());
    expect(decision.allow).toBe(true);
  });

  it('should suspend stop-loss / target evaluation if market data is frozen for too long', () => {
    const frozenTicker = { ...baseTicker, updatedAt: Date.now() - (MAX_DATA_AGE_MS * 3) };
    const decision = canEvaluateActiveTrades(frozenTicker, Date.now());
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain('congelado');
  });
});
