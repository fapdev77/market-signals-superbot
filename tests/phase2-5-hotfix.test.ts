import { describe, it, expect } from 'vitest';
import {
  resolveRawTicker,
  resolveMarketInputs,
  evaluatePositionManagement
} from '../server/services/TickProcessor.js';
import { canGenerateSignals, canEvaluateActiveTrades } from '../server/services/DataGate.js';
import { processTickerState } from '../server/signalEngine.js';
import { KlineCandle, IndicatorWeights, TickerData, TradeSignal } from '../src/types.js';

/**
 * Phase 2.5 hotfix verification (items 2.5.1, 2.5.2, 2.5.3).
 *
 * These tests exist because the code they cover had no coverage at all, which is how the integrity
 * bugs survived Phase 2: a stale cached quote was stamped fresh, and missing feeds were scored as 0.
 */
describe('Phase 2.5 Hotfix Suite (cache provenance, factor provenance, funding interval)', () => {
  const weights: IndicatorWeights = {
    volumeSurgeWeight: 20,
    openInterestWeight: 20,
    fundingRateWeight: 15,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 15,
    rangePocWeight: 15,
    supportResistanceWeight: 15,
    trappedTradersWeight: 25,
    rsiDivergenceWeight: 20,
    volumeProfileRange: 24,
    minRiskRewardRatio: 2.0
  } as IndicatorWeights;

  const candles: KlineCandle[] = [
    { timestamp: 1000, open: 90000, high: 90200, low: 89800, close: 90100, volume: 100, takerBuyVolume: 65 },
    { timestamp: 2000, open: 90100, high: 90500, low: 90000, close: 90400, volume: 150, takerBuyVolume: 95 },
    { timestamp: 3000, open: 90400, high: 90800, low: 90300, close: 90700, volume: 200, takerBuyVolume: 140 },
    { timestamp: 4000, open: 90700, high: 91000, low: 90600, close: 90900, volume: 220, takerBuyVolume: 160 },
    { timestamp: 5000, open: 90900, high: 91200, low: 90800, close: 91100, volume: 250, takerBuyVolume: 180 }
  ];

  const cachedTicker = (overrides: Partial<TickerData> = {}): TickerData => ({
    symbol: 'BTCUSDT',
    price: 91000,
    priceChangePercent24h: 1.2,
    high24h: 92000,
    low24h: 89000,
    volume24h: 1000,
    quoteVolume24h: 91000000,
    openInterest: 15000000,
    fundingRate: 0.0001,
    updatedAt: Date.now() - 5 * 60 * 1000, // five minutes old
    ...overrides
  } as TickerData);

  // -----------------------------------------------------------------
  // 2.5.1 — a cached quote must never look fresh
  // -----------------------------------------------------------------
  describe('2.5.1 Stale cache is never treated as fresh data', () => {
    it('passes a live exchange quote through untouched', () => {
      const live = { symbol: 'BTCUSDT', lastPrice: '91000', priceChangePercent: '1.2' } as any;
      const resolved = resolveRawTicker('BTCUSDT', live, cachedTicker());
      expect(resolved?.stale).toBe(false);
      expect(resolved?.raw).toBe(live);
    });

    it('carries the cached timestamp and marks STALE when the exchange omits the symbol', () => {
      const cached = cachedTicker();
      const resolved = resolveRawTicker('BTCUSDT', undefined, cached);

      expect(resolved?.stale).toBe(true);
      expect(resolved?.raw.updatedAt).toBe(cached.updatedAt);
      expect(resolved?.raw.source).toBe('STALE');
      // The regression: previously updatedAt was omitted entirely, so the engine stamped Date.now()
      // and the DataGate measured an age of ~0ms.
      expect(resolved?.raw.updatedAt).not.toBeUndefined();
    });

    it('returns null when the symbol is neither in the response nor in the cache', () => {
      expect(resolveRawTicker('BTCUSDT', undefined, undefined)).toBeNull();
    });

    it('propagates STALE + degraded into the processed ticker and blocks both gates', () => {
      const resolved = resolveRawTicker('BTCUSDT', undefined, cachedTicker());
      const processed = processTickerState(
        resolved!.raw,
        candles,
        15000000,
        0.0001,
        weights
      );

      expect(processed).not.toBeNull();
      expect(processed!.dataQuality?.source).toBe('STALE');
      expect(processed!.dataQuality?.isDegraded).toBe(true);
      expect(processed!.updatedAt).toBe(resolved!.raw.updatedAt);

      // Signal generation and position management must both refuse stale quotes.
      expect(canGenerateSignals(processed!).allow).toBe(false);
      expect(canEvaluateActiveTrades(processed!).allow).toBe(false);
    });

    it('blocks position management on a degraded (but not STALE) quote', () => {
      const processed = processTickerState(
        { symbol: 'BTCUSDT', lastPrice: '91000', priceChangePercent: '1.2', updatedAt: Date.now() },
        [], // no klines -> degraded
        15000000,
        0.0001,
        weights
      );

      expect(processed!.dataQuality?.isDegraded).toBe(true);
      expect(canEvaluateActiveTrades(processed!).allow).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // 2.5.2 — factor provenance
  // -----------------------------------------------------------------
  describe('2.5.2 Unavailable feeds are excluded from scoring, not scored as zero', () => {
    it('reports Open Interest as unavailable and drops the change values', () => {
      const inputs = resolveMarketInputs({
        cached: cachedTicker(),
        oiData: { openInterest: 0, isDegraded: true, change24h: 0, change1h: 0 },
        fundingData: { fundingRate: 0.0001, fundingIntervalHours: 8, isDegraded: false }
      });

      expect(inputs.availability.openInterest).toBe(false);
      // No change values are passed through, so the scorer cannot read 0 as a real reading.
      expect(inputs.realOiChange).toEqual({});
      // Display value falls back to the last known cache value.
      expect(inputs.openInterest).toBe(15000000);
    });

    it('reports funding as unavailable when the feed degraded', () => {
      const inputs = resolveMarketInputs({
        cached: cachedTicker(),
        fundingData: { fundingRate: 0, fundingIntervalHours: 8, isDegraded: true }
      });
      expect(inputs.availability.funding).toBe(false);
    });

    it('treats a null long/short response as unavailable and passes no fabricated data', () => {
      const inputs = resolveMarketInputs({
        cached: cachedTicker(),
        longShortData: null
      });
      expect(inputs.availability.longShort).toBe(false);
      expect(inputs.longShortData).toBeUndefined();
    });

    it('marks funding UNAVAILABLE in the engine instead of claiming a neutral market', () => {
      const processed = processTickerState(
        { symbol: 'BTCUSDT', lastPrice: '91100', priceChangePercent: '2.5', updatedAt: Date.now() },
        candles,
        15000000,
        0.0001,
        weights,
        undefined,
        undefined,
        { change24h: 1.2, change1h: 0.4 },
        8,
        { openInterest: true, funding: false, longShort: true }
      );

      expect(processed!.fundingRateAnalysis?.status).toBe('UNAVAILABLE');
      expect(processed!.dataQuality?.unavailableFactors).toContain('Funding Rate');
      // No funding confluence factor may be awarded on an unavailable feed.
      expect(processed!.confluenceFactors.some((f: string) => f.startsWith('Funding Fee'))).toBe(false);
    });

    it('does not award Open Interest points when the OI feed is unavailable', () => {
      const available = processTickerState(
        { symbol: 'BTCUSDT', lastPrice: '91100', priceChangePercent: '2.5', updatedAt: Date.now() },
        candles,
        15000000,
        0.0001,
        weights,
        undefined,
        undefined,
        { change24h: 5, change1h: 5 },
        8,
        { openInterest: true, funding: true, longShort: true }
      );

      const unavailable = processTickerState(
        { symbol: 'BTCUSDT', lastPrice: '91100', priceChangePercent: '2.5', updatedAt: Date.now() },
        candles,
        15000000,
        0.0001,
        weights,
        undefined,
        undefined,
        { change24h: 5, change1h: 5 },
        8,
        { openInterest: false, funding: true, longShort: true }
      );

      expect(available!.confluenceFactors.some((f: string) => f.includes('Open Interest'))).toBe(true);
      expect(unavailable!.confluenceFactors.some((f: string) => f.includes('Open Interest'))).toBe(false);
      expect(unavailable!.dataQuality?.unavailableFactors).toContain('Open Interest');
    });
  });

  // -----------------------------------------------------------------
  // 2.5.1 — position management decisions
  // -----------------------------------------------------------------
  describe('2.5.1 Position management decisions', () => {
    const baseSignal = (overrides: Partial<TradeSignal> = {}): TradeSignal => ({
      id: 'sig-1',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      entryZone: [90000, 90100],
      currentPrice: 90050,
      stopLoss: 89000,
      target1: 92000,
      target2: 94000,
      riskRewardRatio: 2.5,
      confluenceScore: 70,
      confluenceFactors: [],
      timeframe: '15m',
      validationStatus: 'CONFIRMED',
      isBreakevenActive: false,
      status: 'ACTIVE',
      createdAt: Date.now(),
      ...overrides
    } as TradeSignal);

    it('activates breakeven when a LONG reaches target 1', () => {
      const signal = baseSignal();
      const actions = evaluatePositionManagement([signal], 92500);

      expect(signal.isBreakevenActive).toBe(true);
      expect(signal.stopLoss).toBe(90000); // entry
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('UPDATE_SIGNAL');
    });

    it('closes a LONG at target 2', () => {
      const actions = evaluatePositionManagement([baseSignal()], 94500);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('HIT_TARGET2');
    });

    it('stops out a LONG below the stop loss', () => {
      const actions = evaluatePositionManagement([baseSignal()], 88000);
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ type: 'STOPPED_OUT', signalId: 'sig-1' });
    });

    it('labels a breakeven exit when the stop is already at entry', () => {
      const signal = baseSignal({ isBreakevenActive: true, stopLoss: 90000 });
      const actions = evaluatePositionManagement([signal], 89900);
      expect(actions[0]).toMatchObject({ type: 'STOPPED_OUT' });
      expect((actions[0] as any).reason).toContain('Breakeven');
    });

    it('mirrors the logic for a SHORT (stop above entry, targets below)', () => {
      const signal = baseSignal({
        direction: 'SHORT',
        entryZone: [90000, 90100],
        stopLoss: 91000,
        target1: 88000,
        target2: 86000
      });

      const breakeven = evaluatePositionManagement([signal], 87500);
      expect(signal.isBreakevenActive).toBe(true);
      expect(signal.stopLoss).toBe(90100); // upper entry bound
      expect(breakeven[0].type).toBe('UPDATE_SIGNAL');

      const target = evaluatePositionManagement([baseSignal({
        direction: 'SHORT', entryZone: [90000, 90100], stopLoss: 91000, target1: 88000, target2: 86000
      })], 85000);
      expect(target[0].type).toBe('HIT_TARGET2');
    });

    it('does nothing while price sits between stop and target', () => {
      expect(evaluatePositionManagement([baseSignal()], 90500)).toHaveLength(0);
    });
  });
});
