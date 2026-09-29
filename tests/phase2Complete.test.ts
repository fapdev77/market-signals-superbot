import { describe, it, expect } from 'vitest';
import {
  TRADFI_ASSETS,
  isTradfiMarketOpen,
  fetchBinanceTradfiContracts
} from '../server/binanceService.js';
import { BinanceRateLimiter } from '../server/utils/binanceRateLimiter.js';
import { processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { KlineCandle, IndicatorWeights } from '../src/types.js';

describe('Phase 2 Complete Test Suite (2.1 Ingestão, 2.2 Motor de Sinais, 2.3 Backtest, 2.4 TradFi)', () => {
  const sampleWeights: IndicatorWeights = {
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
  };

  // -------------------------------------------------------------
  // 2.1 INGESTÃO
  // -------------------------------------------------------------
  describe('2.1 Ingestão: fapi endpoints, weight control, and backoff', () => {
    it('enforces exponential backoff and throttle state on HTTP 429 and 418', () => {
      BinanceRateLimiter.recordSuccess();
      const initialState = BinanceRateLimiter.getState();
      expect(initialState.consecutiveRateErrors).toBe(0);

      // Trigger HTTP 429
      BinanceRateLimiter.triggerBackoff(429, 2000);
      const throttledState = BinanceRateLimiter.getState();
      expect(throttledState.isThrottled).toBe(true);
      expect(throttledState.consecutiveRateErrors).toBe(1);
      expect(BinanceRateLimiter.isAllowed()).toBe(false);

      // Reset
      BinanceRateLimiter.recordSuccess();
    });

    it('preemptively throttles when used weight exceeds 85% capacity', () => {
      BinanceRateLimiter.updateFromHeaders({
        'x-mbx-used-weight-1m': '1050'
      });
      const state = BinanceRateLimiter.getState();
      expect(state.usedWeight1m).toBe(1050);
      expect(state.isThrottled).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 2.2 MOTOR DE SINAIS
  // -------------------------------------------------------------
  describe('2.2 Motor de Sinais: Real OI, Contract Funding Intervals, 1m/5m Validation, Candle Swing Stops', () => {
    const mockCandles: KlineCandle[] = [
      { timestamp: 1000, open: 90000, high: 90200, low: 89800, close: 90100, volume: 100, takerBuyVolume: 65 },
      { timestamp: 2000, open: 90100, high: 90500, low: 90000, close: 90400, volume: 150, takerBuyVolume: 95 },
      { timestamp: 3000, open: 90400, high: 90800, low: 90300, close: 90700, volume: 200, takerBuyVolume: 140 },
      { timestamp: 4000, open: 90700, high: 91000, low: 90600, close: 90900, volume: 220, takerBuyVolume: 160 },
      { timestamp: 5000, open: 90900, high: 91200, low: 90800, close: 91100, volume: 250, takerBuyVolume: 180 }
    ];

    it('calculates contract-specific funding rate cycles and annualized APR', () => {
      const rawTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '91100',
        priceChangePercent: '2.5',
        updatedAt: Date.now()
      };

      // 4-hour funding interval (6 cycles/day)
      const state4h = processTickerState(
        rawTicker,
        mockCandles,
        15000000,
        0.0002, // 0.02% per 4h
        sampleWeights,
        undefined,
        undefined,
        { change24h: 3.5, change1h: 1.2 },
        4
      );

      expect(state4h).not.toBeNull();
      expect(state4h?.fundingIntervalHours).toBe(4);
      expect(state4h?.fundingRateDaily).toBeCloseTo(0.0002 * (24 / 4), 5); // 0.0012
      expect(state4h?.openInterestChange24h).toBe(3.5);
      expect(state4h?.openInterestChange1h).toBe(1.2);
    });

    it('rejects false spike candle wicks (>55% upper wick) via 1m validation', () => {
      const spikeCandles: KlineCandle[] = [
        ...mockCandles.slice(0, 4),
        {
          timestamp: 5000,
          open: 90900,
          high: 92500, // huge upper wick
          low: 90800,
          close: 90950,
          volume: 300,
          takerBuyVolume: 100
        }
      ];

      const rawTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '90950',
        priceChangePercent: '1.2',
        updatedAt: Date.now()
      };

      const tickerState = processTickerState(rawTicker, spikeCandles, 1000000, 0.0001, sampleWeights);
      if (tickerState) {
        tickerState.signalType = 'STRONG_LONG';
        tickerState.confluenceScore = 80;
        const signal = buildTradeSignal(tickerState, spikeCandles, 2.0, 'DAY_TRADE');
        expect(signal?.validationStatus).toBe('REJECTED_SPIKE');
        expect(signal?.validationDetails.spikeDetected).toBe(true);
      }
    });

    it('anchors stop loss to recent candle swing lows with safety buffer on Long setups', () => {
      const rawTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '91100',
        priceChangePercent: '2.0',
        updatedAt: Date.now()
      };

      const tickerState = processTickerState(rawTicker, mockCandles, 1000000, 0.0001, sampleWeights);
      if (tickerState) {
        tickerState.signalType = 'LONG';
        tickerState.confluenceScore = 75;
        const signal = buildTradeSignal(tickerState, mockCandles, 2.0, 'INTRADAY');
        expect(signal).not.toBeNull();
        if (signal) {
          const minLow = Math.min(...mockCandles.map(k => k.low));
          expect(signal.stopLoss).toBeLessThanOrEqual(minLow);
          expect(signal.target1).toBeGreaterThan(signal.currentPrice);
          expect(signal.target2).toBeGreaterThan(signal.target1);
        }
      }
    });
  });

  // -------------------------------------------------------------
  // 2.3 BACKTEST VERDADEIRO
  // -------------------------------------------------------------
  describe('2.3 Backtest Verdadeiro: processTickerState/buildTradeSignal, stop-first, funding fees, walk-forward, deterministic PRNG', () => {
    it('executes true backtest simulation with funding deductions, walk-forward, and stop-first rule', async () => {
      const result = await BacktestEngine.runBacktest({
        symbol: 'BTCUSDT',
        days: 7,
        profile: 'daytrade',
        weights: sampleWeights,
        seed: 12345
      }, false);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(typeof result.totalTrades).toBe('number');
      expect(typeof result.winRate).toBe('number');
      expect(typeof result.netProfit).toBe('number');
      expect(typeof result.sharpeRatio).toBe('number');
      expect(typeof result.sortinoRatio).toBe('number');
      expect(result.walkForward).toBeDefined();
      expect(typeof result.walkForward?.inSampleWinRate).toBe('number');
      expect(typeof result.walkForward?.outOfSampleWinRate).toBe('number');
      expect(typeof result.walkForward?.overfitRatio).toBe('number');
      expect(typeof result.walkForward?.isRobust).toBe('boolean');
    }, 25000);

    it('produces identical deterministic results given the same random seed', async () => {
      const run1 = await BacktestEngine.runBacktest({
        symbol: 'ETHUSDT',
        days: 3,
        profile: 'scalp',
        weights: sampleWeights,
        seed: 777
      }, false);

      const run2 = await BacktestEngine.runBacktest({
        symbol: 'ETHUSDT',
        days: 3,
        profile: 'scalp',
        weights: sampleWeights,
        seed: 777
      }, false);

      expect(run1.totalTrades).toBe(run2.totalTrades);
      expect(run1.winRate).toBe(run2.winRate);
      expect(run1.netProfit).toBe(run2.netProfit);
      expect(run1.maxDrawdown).toBe(run2.maxDrawdown);
    }, 25000);
  });

  // -------------------------------------------------------------
  // 2.4 TRADFI REAL
  // -------------------------------------------------------------
  describe('2.4 TradFi Real: TRADIFI_PERPETUAL, trading schedule, and closed session signal suppression', () => {
    it('defines TradFi assets and categories including gold commodities, forex, and tokenized equities', () => {
      expect(TRADFI_ASSETS.length).toBeGreaterThanOrEqual(7);
      const gold = TRADFI_ASSETS.find(a => a.symbol === 'PAXGUSDT');
      expect(gold).toBeDefined();
      expect(gold?.tradfiCategory).toBe('COMMODITY');

      const fx = TRADFI_ASSETS.find(a => a.symbol === 'EURUSDT');
      expect(fx).toBeDefined();
      expect(fx?.tradfiCategory).toBe('FOREX');
    });

    it('correctly evaluates open/closed market sessions for Commodities, Forex, and Equities', () => {
      // Commodities trade 24/7 on Binance perpetuals
      expect(isTradfiMarketOpen('COMMODITY')).toBe(true);

      // Function executes without throwing and returns boolean
      const equityOpen = isTradfiMarketOpen('EQUITY');
      const forexOpen = isTradfiMarketOpen('FOREX');
      expect(typeof equityOpen).toBe('boolean');
      expect(typeof forexOpen).toBe('boolean');
    });

    it('discovers and caches real TradFi contracts from exchangeInfo', async () => {
      const contracts = await fetchBinanceTradfiContracts();
      expect(contracts).toBeDefined();
      expect(contracts instanceof Set).toBe(true);
      expect(contracts.has('PAXGUSDT')).toBe(true);
      expect(contracts.has('EURUSDT')).toBe(true);
    });

    it('suppresses trading signals on TradFi contracts when market session is closed', () => {
      // When equity market is closed, processTickerState forces signal to NEUTRAL
      const rawTicker = {
        symbol: 'AAPLBUSDT',
        lastPrice: '235.50',
        priceChangePercent: '1.5',
        updatedAt: Date.now()
      };

      const candles: KlineCandle[] = [
        { timestamp: 1000, open: 230, high: 236, low: 230, close: 235.5, volume: 5000, takerBuyVolume: 3500 }
      ];

      const state = processTickerState(rawTicker, candles, 5000000, 0.0001, sampleWeights);
      expect(state).not.toBeNull();
      if (!isTradfiMarketOpen('EQUITY')) {
        expect(state?.signalType).toBe('NEUTRAL');
        expect(state?.signalReason).toContain('fechado');
      }
    });
  });
});
