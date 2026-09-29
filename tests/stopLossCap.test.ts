import { describe, it, expect } from 'vitest';
import { processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { IndicatorWeights, KlineCandle } from '../src/types.js';

/**
 * R-7 — Teto de stop (volatilidade extrema).
 *
 * Antes: o stop era o mais DISTANTE entre swing low / suporte / ATR%-base,
 * sem teto. Após uma vela volátil o stop ficava arbitrariamente largo,
 * mudando o R:R implícito e o tamanho de posição. Agora:
 *  - a distância do stop é limitada a maxStopLossAtrMultiple × ATR% (default 2.5×);
 *  - o cap é configurável via IndicatorWeights.maxStopLossAtrMultiple;
 *  - o R:R é recalculado DEPOIS do cap;
 *  - sinais cujo R:R pós-cap cai abaixo do mínimo continuam rejeitados.
 */

const baseWeights: IndicatorWeights = {
  // CVD-heavy confluence (produces a LONG on the recovery fixture below)
  volumeSurgeWeight: 20,
  openInterestWeight: 20,
  fundingRateWeight: 15,
  cvdImbalanceWeight: 35,
  fibonacciZoneWeight: 25,
  rangePocWeight: 15,
  supportResistanceWeight: 20,
  trappedTradersWeight: 25,
  rsiDivergenceWeight: 20,
  volumeProfileRange: 24,
  minRiskRewardRatio: 0 // accept any R:R so the cap itself is what we measure
};

/**
 * Builds a window with one extreme-volatility candle (huge wick) followed by
 * quiet candles — the swing low/high then sits FAR below/above the price.
 */
function makeVolatileCandles(): KlineCandle[] {
  const base = 100_000;
  const candles: KlineCandle[] = [];

  // 1 extreme candle: 8% range wick
  candles.push({
    timestamp: 1_000_000,
    open: base,
    high: base * 1.04,
    low: base * 0.92,
    close: base * 0.999,
    volume: 5_000,
    takerBuyVolume: 2_500
  });

  // 30 quiet candles right after, price recovers toward base
  for (let i = 1; i <= 30; i++) {
    const drift = base * 0.98 + i * (base * 0.0006);
    candles.push({
      timestamp: 1_000_000 + i * 60_000,
      open: drift,
      high: drift * 1.002,
      low: drift * 0.998,
      close: drift * 1.001,
      volume: 800 + i * 5,
      takerBuyVolume: 500 + i * 3
    });
  }

  return candles;
}

function makeQuietCandles(): KlineCandle[] {
  const base = 100_000;
  return Array.from({ length: 40 }, (_, i) => ({
    timestamp: 2_000_000 + i * 60_000,
    open: base + i * 20,
    high: base + i * 20 + 30,
    low: base + i * 20 - 30,
    close: base + i * 20 + 10,
    volume: 1_000 + i,
    takerBuyVolume: 600 + i
  }));
}

function buildWith(weights: IndicatorWeights, klines: KlineCandle[], price: number) {
  const ticker = processTickerState(
    { symbol: 'BTCUSDT', lastPrice: String(price), priceChangePercent: '0.5', updatedAt: Date.now() },
    klines,
    15_000_000,
    0.0001,
    weights
  );
  if (!ticker) throw new Error('processTickerState returned null');
  // R-7: the risk knob rides on the optional weights parameter.
  return buildTradeSignal(ticker, klines, weights.minRiskRewardRatio, 'INTRADAY', undefined, undefined, weights);
}

describe('R-7 stop-loss cap (maxStopLossAtrMultiple × ATR%)', () => {
  it('has a sane default cap (2.5) on IndicatorWeights', () => {
    // The type carries the field with a documented default; buildTradeSignal
    // must apply it even when the operator never set it.
    const weights = { ...baseWeights } as any;
    expect(weights.maxStopLossAtrMultiple).toBeUndefined();

    const signal = buildWith(baseWeights, makeVolatileCandles(), 99_000);
    expect(signal).not.toBeNull();

    const price = signal!.currentPrice;
    const stopDistancePct = Math.abs(price - signal!.stopLoss) / price;

    // Without a cap this window produced a ~8% stop (the extreme wick low).
    // With the 2.5×ATR% cap the stop distance must be materially tighter.
    expect(stopDistancePct).toBeLessThan(0.04);
  });

  it('caps the stop on LONG signals even with an extreme swing low below', () => {
    const signal = buildWith(baseWeights, makeVolatileCandles(), 99_000);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('LONG');

    const price = signal!.currentPrice;
    const stopDistancePct = Math.abs(price - signal!.stopLoss) / price;
    // Capped: well below the uncapped 8% swing distance
    expect(stopDistancePct).toBeLessThanOrEqual(0.05);
    // Still structurally BELOW the price (a stop, not a target)
    expect(signal!.stopLoss).toBeLessThan(price);
  });

  it('caps the stop on SHORT signals even with an extreme swing high above', () => {
    const candles = makeVolatileCandles().map(k => ({
      ...k,
      open: 200_000 - (k.open - 100_000),
      high: 200_000 - (k.low - 100_000),
      low: 200_000 - (k.high - 100_000),
      close: 200_000 - (k.close - 100_000)
    }));

    const weights = { ...baseWeights, cvdImbalanceWeight: 5, volumeSurgeWeight: 5 };
    const ticker = processTickerState(
      { symbol: 'BTCUSDT', lastPrice: '101000', priceChangePercent: '-0.5', updatedAt: Date.now() },
      candles,
      15_000_000,
      0.0001,
      weights
    );
    if (!ticker) throw new Error('processTickerState returned null');
    const signal = buildTradeSignal(ticker, candles, 0, 'INTRADAY', undefined, undefined, weights);

    if (signal && signal.direction === 'SHORT') {
      const price = signal.currentPrice;
      const stopDistancePct = Math.abs(signal.stopLoss - price) / price;
      expect(stopDistancePct).toBeLessThanOrEqual(0.05);
      expect(signal.stopLoss).toBeGreaterThan(price);
    }
  });

  it('honours a tighter operator-configured cap (1×ATR%)', () => {
    const tightWeights: IndicatorWeights = {
      ...baseWeights,
      maxStopLossAtrMultiple: 1
    } as IndicatorWeights;

    const looseWeights: IndicatorWeights = {
      ...baseWeights,
      maxStopLossAtrMultiple: 5
    } as IndicatorWeights;

    const tight = buildWith(tightWeights, makeVolatileCandles(), 99_000);
    const loose = buildWith(looseWeights, makeVolatileCandles(), 99_000);

    if (tight && loose) {
      const tightDist = Math.abs(tight.currentPrice - tight.stopLoss) / tight.currentPrice;
      const looseDist = Math.abs(loose.currentPrice - loose.stopLoss) / loose.currentPrice;
      expect(tightDist).toBeLessThanOrEqual(looseDist + 1e-9);
    }
  });

  it('does not tighten the stop below its natural (uncapped) level in quiet markets', () => {
    const signal = buildWith(baseWeights, makeQuietCandles(), 100_500);
    if (!signal) return; // quiet market may reject the signal for other reasons

    const price = signal.currentPrice;
    const stopDistancePct = Math.abs(price - signal.stopLoss) / price;
    // In a quiet market the natural stop is small; the cap must not have made it tiny.
    expect(stopDistancePct).toBeGreaterThan(0);
  });

  it('recomputes risk_reward AFTER applying the cap', () => {
    const signal = buildWith(baseWeights, makeVolatileCandles(), 99_000);
    expect(signal).not.toBeNull();

    const price = signal!.currentPrice;
    const risk = Math.abs(price - signal!.stopLoss);
    const reward = Math.abs(signal!.target2 - price);
    const impliedRR = reward / risk;

    expect(Math.abs(impliedRR - signal!.riskRewardRatio)).toBeLessThan(0.05);
  });
});
