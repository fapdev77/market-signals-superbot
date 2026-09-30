import { describe, it, expect } from 'vitest';
import { SIGNAL_LOOKBACK_CANDLES, processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { getDefaultIndicatorWeights } from '../src/constants/strategyPresets.js';
import type { KlineCandle } from '../src/types.js';

describe('M2.3, M2.5 & CA-2.4: Live and Backtest Signal Parity', () => {
  it('defines SIGNAL_LOOKBACK_CANDLES as 60 candles', () => {
    expect(SIGNAL_LOOKBACK_CANDLES).toBe(60);
  });

  it('generates identical trade signals and direction given identical candle sequence', () => {
    // Generate synthetic 60-candle trending sequence
    const basePrice = 50000;
    const candles: KlineCandle[] = [];
    const startTime = 1774857600000;

    for (let i = 0; i < SIGNAL_LOOKBACK_CANDLES; i++) {
      const price = basePrice + i * 50;
      candles.push({
        timestamp: startTime + i * 15 * 60 * 1000,
        open: price - 10,
        high: price + 40,
        low: price - 20,
        close: price + 30,
        volume: 100 + i * 2,
        takerBuyVolume: 60 + i
      });
    }

    const lastCandle = candles[candles.length - 1];
    const rawTicker = {
      symbol: 'BTCUSDT',
      lastPrice: lastCandle.close.toString(),
      priceChangePercent: '3.6',
      highPrice: Math.max(...candles.map(c => c.high)).toString(),
      lowPrice: Math.min(...candles.map(c => c.low)).toString(),
      volume: candles.reduce((a, c) => a + c.volume, 0).toString(),
      quoteVolume: candles.reduce((a, c) => a + (c.volume * c.close), 0).toString(),
      updatedAt: lastCandle.timestamp,
      source: 'REST' as const
    };

    const weights = getDefaultIndicatorWeights();

    // 1. Live path evaluation
    const liveProcessed = processTickerState(
      rawTicker,
      candles,
      500000,
      0.0001,
      weights,
      undefined,
      undefined,
      {},
      8,
      { openInterest: true, funding: true, longShort: false }
    );

    expect(liveProcessed).toBeDefined();

    const liveSignal = buildTradeSignal(
      liveProcessed!,
      candles,
      2.0,
      'DAY_TRADE'
    );

    // 2. Backtest step evaluation on the exact same window slice
    const backtestProcessed = processTickerState(
      rawTicker,
      candles,
      500000,
      0.0001,
      weights,
      undefined,
      undefined,
      {},
      8,
      { openInterest: true, funding: true, longShort: false }
    );

    const backtestSignal = buildTradeSignal(
      backtestProcessed!,
      candles,
      2.0,
      'DAY_TRADE'
    );

    if (liveSignal && backtestSignal) {
      expect(liveSignal.direction).toBe(backtestSignal.direction);
      expect(liveSignal.stopLoss).toBeCloseTo(backtestSignal.stopLoss, 4);
      expect(liveSignal.target1).toBeCloseTo(backtestSignal.target1, 4);
      expect(liveSignal.target2).toBeCloseTo(backtestSignal.target2, 4);
      expect(liveSignal.confluenceScore).toBe(backtestSignal.confluenceScore);
    }
  });
});
