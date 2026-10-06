import { describe, it, expect } from 'vitest';
import {
  computeCvdDeltaMetrics,
  classifyOrderFlowDivergence,
  generateCvdDeltaSeries,
  computeOrderBookImbalance,
  computeMultiTierOBI,
  computeCvdVolumeOscillator,
  classifyCvdMomentum,
  type CvdDeltaMetrics,
  type OrderBookImbalanceResult,
  type VolumeOscillatorResult
} from '../src/utils/cvdDeltaUtils.js';
import type { TickerData, OrderBookLevel } from '../src/types.js';

describe('CVD Delta Overlay & Real-Time Taker Aggression (TDD)', () => {
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
      quoteVolume24h: 3250000000, // $3.25B
      openInterest: 1500000000,
      openInterestChange24h: 4.5,
      openInterestChange1h: 0.8,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 125000000, // +$125M
      cvdDelta: 15000000, // +$15M
      cvdDeltaPercent: 12.5,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.56, // 56% taker buy
      fibonacci: {
        fib50: 65000,
        fib618: 64500,
        fib68: 64300,
        swingHigh: 66000,
        swingLow: 64000,
        inGoldenPocket: false
      },
      rangeProfile: {
        vah: 65800,
        val: 64200,
        poc: 65000,
        inValueArea: true
      },
      keyLevels: {
        support1: 64000,
        support2: 63000,
        resistance1: 66000,
        resistance2: 67000,
        structureBreak: 'NONE',
        hasSinglePrintFVG: false
      },
      confluenceScore: 75,
      signalType: 'LONG',
      signalReason: 'Bullish orderflow convergence',
      confluenceFactors: ['CVD_BUY', 'OI_EXPANSION'],
      updatedAt: Date.now(),
      ...overrides
    };
  }

  describe('computeCvdDeltaMetrics', () => {
    it('calculates taker buy vs sell volume and net delta correctly for bullish taker dominance', () => {
      const ticker = makeMockTicker({
        quoteVolume24h: 100000000, // $100M total volume
        takerBuyRatio: 0.60,       // 60% taker buy
        cvd: 20000000,
        cvdDelta: 5000000,
        cvdDirection: 'BUY'
      });

      const metrics = computeCvdDeltaMetrics(ticker);

      expect(metrics.totalTakerVolumeUsd).toBeGreaterThan(0);
      expect(metrics.takerBuyRatioPct).toBeCloseTo(60, 1);
      expect(metrics.takerSellRatioPct).toBeCloseTo(40, 1);
      expect(metrics.takerBuyVolumeUsd).toBeGreaterThan(metrics.takerSellVolumeUsd);
      expect(metrics.netCvdDeltaUsd).toBeGreaterThan(0);
      expect(metrics.cvdDirection).toBe('BUY');
      expect(metrics.aggressionDominance).toBe('STRONG_BUY');
    });

    it('calculates taker buy vs sell volume correctly for bearish taker dominance', () => {
      const ticker = makeMockTicker({
        quoteVolume24h: 100000000,
        takerBuyRatio: 0.38,       // 38% taker buy -> 62% taker sell
        cvd: -24000000,
        cvdDelta: -6000000,
        cvdDirection: 'SELL'
      });

      const metrics = computeCvdDeltaMetrics(ticker);

      expect(metrics.takerBuyRatioPct).toBeCloseTo(38, 1);
      expect(metrics.takerSellRatioPct).toBeCloseTo(62, 1);
      expect(metrics.takerSellVolumeUsd).toBeGreaterThan(metrics.takerBuyVolumeUsd);
      expect(metrics.netCvdDeltaUsd).toBeLessThan(0);
      expect(metrics.cvdDirection).toBe('SELL');
      expect(metrics.aggressionDominance).toBe('STRONG_SELL');
    });

    it('handles neutral/balanced taker flow gracefully', () => {
      const ticker = makeMockTicker({
        quoteVolume24h: 50000000,
        takerBuyRatio: 0.50,
        cvd: 0,
        cvdDelta: 0,
        cvdDirection: 'NEUTRAL'
      });

      const metrics = computeCvdDeltaMetrics(ticker);

      expect(metrics.takerBuyRatioPct).toBeCloseTo(50, 1);
      expect(metrics.takerSellRatioPct).toBeCloseTo(50, 1);
      expect(metrics.aggressionDominance).toBe('BALANCED');
    });
  });

  describe('classifyOrderFlowDivergence', () => {
    it('detects CONVERGENT_BULLISH when both order book bids and CVD delta are positive', () => {
      const ticker = makeMockTicker({
        cvdDirection: 'BUY',
        takerBuyRatio: 0.58
      });
      const bookImbalancePct = 18; // +18% Bids > Asks

      const div = classifyOrderFlowDivergence(ticker, bookImbalancePct);

      expect(div.divergenceType).toBe('CONVERGENT_BULLISH');
      expect(div.divergenceLabel).toContain('Convergência Compradora');
      expect(div.bias).toBe('BUY');
      expect(div.divergenceScore).toBeGreaterThan(0);
    });

    it('detects PASSIVE_ABSORPTION_BUY when book is heavy Ask but taker CVD is strongly buying', () => {
      const ticker = makeMockTicker({
        cvdDirection: 'BUY',
        takerBuyRatio: 0.62,
        cvdDelta: 25000000
      });
      const bookImbalancePct = -20; // Asks heavier in book

      const div = classifyOrderFlowDivergence(ticker, bookImbalancePct);

      expect(div.divergenceType).toBe('PASSIVE_ABSORPTION_BUY');
      expect(div.divergenceLabel).toContain('Absorção');
      expect(div.bias).toBe('BUY');
    });

    it('detects PASSIVE_ABSORPTION_SELL when book is heavy Bid but taker CVD is dumping', () => {
      const ticker = makeMockTicker({
        cvdDirection: 'SELL',
        takerBuyRatio: 0.40,
        cvdDelta: -30000000
      });
      const bookImbalancePct = 25; // Bids heavy in book

      const div = classifyOrderFlowDivergence(ticker, bookImbalancePct);

      expect(div.divergenceType).toBe('PASSIVE_ABSORPTION_SELL');
      expect(div.divergenceLabel).toContain('Absorção Vendedora');
      expect(div.bias).toBe('SELL');
    });
  });

  describe('generateCvdDeltaSeries', () => {
    it('generates consistent multi-step cumulative delta progression for visual overlay', () => {
      const ticker = makeMockTicker({
        price: 65000,
        cvd: 50000000,
        takerBuyRatio: 0.55
      });

      const series = generateCvdDeltaSeries(ticker, 20);

      expect(series).toHaveLength(20);
      expect(series[0]).toHaveProperty('timestamp');
      expect(series[0]).toHaveProperty('takerBuyUsd');
      expect(series[0]).toHaveProperty('takerSellUsd');
      expect(series[0]).toHaveProperty('deltaUsd');
      expect(series[0]).toHaveProperty('cumulativeCvdUsd');

      // The last element cumulative CVD should reflect the general direction
      const last = series[series.length - 1];
      expect(last.cumulativeCvdUsd).toBeGreaterThan(series[0].cumulativeCvdUsd);
    });
  });

  describe('computeOrderBookImbalance (OBI)', () => {
    it('calculates exact OBI percentage as (Bids - Asks) / (Bids + Asks) * 100', () => {
      // 60M bids vs 40M asks -> (60 - 40) / (60 + 40) = 20 / 100 = +20%
      const result = computeOrderBookImbalance(60000000, 40000000);

      expect(result.imbalanceRatioRaw).toBeCloseTo(0.20, 4);
      expect(result.imbalancePct).toBeCloseTo(20.0, 2);
      expect(result.bidPercentage).toBeCloseTo(60.0, 2);
      expect(result.askPercentage).toBeCloseTo(40.0, 2);
      expect(result.bias).toBe('BUY');
      expect(result.category).toBe('MODERATE_BID_IMBALANCE');
    });

    it('calculates negative OBI for ask dominance correctly', () => {
      // 25M bids vs 75M asks -> (25 - 75) / (25 + 75) = -50 / 100 = -50%
      const result = computeOrderBookImbalance(25000000, 75000000);

      expect(result.imbalanceRatioRaw).toBeCloseTo(-0.50, 4);
      expect(result.imbalancePct).toBeCloseTo(-50.0, 2);
      expect(result.bidPercentage).toBeCloseTo(25.0, 2);
      expect(result.askPercentage).toBeCloseTo(75.0, 2);
      expect(result.bias).toBe('SELL');
      expect(result.category).toBe('STRONG_ASK_IMBALANCE');
    });

    it('handles zero or balanced depth safely', () => {
      const zeroResult = computeOrderBookImbalance(0, 0);
      expect(zeroResult.imbalancePct).toBe(0);
      expect(zeroResult.bias).toBe('NEUTRAL');
      expect(zeroResult.category).toBe('BALANCED');

      const equalResult = computeOrderBookImbalance(5000000, 5000000);
      expect(equalResult.imbalancePct).toBe(0);
      expect(equalResult.bidPercentage).toBe(50);
      expect(equalResult.askPercentage).toBe(50);
    });

    it('computes multi-tier OBI across varying depth levels', () => {
      const mockBids: OrderBookLevel[] = [
        { price: 99.5, qty: 10, totalQty: 10, totalUsd: 995, deviationPct: -0.5 },
        { price: 99.0, qty: 20, totalQty: 30, totalUsd: 2975, deviationPct: -1.0 },
        { price: 98.0, qty: 50, totalQty: 80, totalUsd: 7875, deviationPct: -2.0 },
      ];
      const mockAsks: OrderBookLevel[] = [
        { price: 100.5, qty: 5, totalQty: 5, totalUsd: 502.5, deviationPct: 0.5 },
        { price: 101.0, qty: 10, totalQty: 15, totalUsd: 1512.5, deviationPct: 1.0 },
        { price: 102.0, qty: 20, totalQty: 35, totalUsd: 3552.5, deviationPct: 2.0 },
      ];

      const tiers = computeMultiTierOBI(mockBids, mockAsks);

      expect(tiers['0.5%']).toBeDefined();
      expect(tiers['1%']).toBeDefined();
      expect(tiers['2%']).toBeDefined();
      expect(tiers['0.5%'].imbalancePct).toBeGreaterThan(0); // 995 vs 502.5 -> positive
    });
  });

  describe('computeCvdVolumeOscillator (Momentum Trend Indicator)', () => {
    it('computes fast vs slow delta EMA oscillator, signal line and histogram correctly', () => {
      const ticker = makeMockTicker({
        price: 65000,
        cvd: 45000000,
        takerBuyRatio: 0.58
      });

      const series = generateCvdDeltaSeries(ticker, 24);
      const oscResult: VolumeOscillatorResult = computeCvdVolumeOscillator(series, 5, 12, 5);

      expect(oscResult).toBeDefined();
      expect(oscResult.series).toHaveLength(24);
      expect(typeof oscResult.currentOscillator).toBe('number');
      expect(typeof oscResult.currentSignal).toBe('number');
      expect(typeof oscResult.currentHistogram).toBe('number');
      expect(oscResult.fastPeriod).toBe(5);
      expect(oscResult.slowPeriod).toBe(12);
      expect(oscResult.signalPeriod).toBe(5);

      // Check datapoint structure
      const sample = oscResult.series[10];
      expect(sample).toHaveProperty('oscillator');
      expect(sample).toHaveProperty('signal');
      expect(sample).toHaveProperty('histogram');
      expect(sample).toHaveProperty('color');
      expect(sample).toHaveProperty('state');
      expect(sample.histogram).toBeCloseTo(sample.oscillator - sample.signal, 1);
    });

    it('classifies BULLISH_ACCELERATION when momentum is positive and histogram is expanding', () => {
      const classification = classifyCvdMomentum(5.2, 3.1, 2.1, 1.4);
      expect(classification.state).toBe('BULLISH_ACCELERATION');
      expect(classification.direction).toBe('BULLISH');
      expect(classification.label).toContain('Aceleração Compradora');
      expect(classification.color).toBe('#10b981');
    });

    it('classifies BULLISH_DECELERATION when momentum is positive but histogram is weakening', () => {
      const classification = classifyCvdMomentum(4.0, 3.8, 0.2, 1.1);
      expect(classification.state).toBe('BULLISH_DECELERATION');
      expect(classification.direction).toBe('BULLISH');
      expect(classification.label).toContain('Exaustão Compradora');
      expect(classification.color).toBe('#0d9488');
    });

    it('classifies BEARISH_ACCELERATION when momentum is negative and histogram is expanding', () => {
      const classification = classifyCvdMomentum(-6.5, -4.0, -2.5, -1.2);
      expect(classification.state).toBe('BEARISH_ACCELERATION');
      expect(classification.direction).toBe('BEARISH');
      expect(classification.label).toContain('Aceleração Vendedora');
      expect(classification.color).toBe('#f43f5e');
    });

    it('classifies BEARISH_DECELERATION when momentum is negative but selling impulse is fading', () => {
      const classification = classifyCvdMomentum(-5.0, -4.8, -0.2, -1.5);
      expect(classification.state).toBe('BEARISH_DECELERATION');
      expect(classification.direction).toBe('BEARISH');
      expect(classification.label).toContain('Exaustão Vendedora');
      expect(classification.color).toBe('#f97316');
    });

    it('handles empty series gracefully with neutral convergence', () => {
      const emptyResult = computeCvdVolumeOscillator([]);
      expect(emptyResult.currentOscillator).toBe(0);
      expect(emptyResult.momentumState).toBe('NEUTRAL_CONVERGENCE');
      expect(emptyResult.series).toHaveLength(0);
    });
  });
});

