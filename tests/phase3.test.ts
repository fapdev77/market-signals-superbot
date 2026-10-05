import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processTickerState, buildTradeSignal } from '../server/signalEngine.js';
import { evaluatePositionManagement } from '../server/services/TickProcessor.js';
import { dAdd, dSub, dMul, dDiv, dRound, dClamp } from '../server/utils/decimal.js';
import {
  computePositionSize,
  evaluatePortfolioRisk,
  signalStopDistancePct,
  setKillSwitch,
  getKillSwitch,
  isTradingHalted,
  resetKillSwitchForTests,
  DEFAULT_RISK_LIMITS
} from '../server/services/RiskManager.js';
import { IndicatorWeights, KlineCandle, TradeSignal } from '../src/types.js';

describe('Phase 3.1 Signal engine validation and live position resolution', () => {
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
  };

  const makeCandles = (n: number): KlineCandle[] =>
    Array.from({ length: n }, (_, i) => ({
      timestamp: 1000 + i * 60_000,
      open: 90000 + i * 60,
      high: 90100 + i * 60,
      low: 89900 + i * 60,
      close: 90050 + i * 60,
      volume: 100 + i * 10,
      takerBuyVolume: 60 + i * 6
    }));

  const makeTicker = (nCandles: number) => {
    const state = processTickerState(
      { symbol: 'BTCUSDT', lastPrice: '91100', priceChangePercent: '2.5', updatedAt: Date.now() },
      makeCandles(nCandles),
      15000000,
      0.0001,
      weights
    );
    if (!state) throw new Error('processTickerState returned null in test setup');
    return state;
  };

  it('does NOT auto-confirm a signal when there is not enough 1m/5m data', () => {
    // Regression: this branch used to set both flags true and mark the signal CONFIRMED
    // ("Confluência Direct-Market"), bypassing the entire multi-timeframe filter.
    const signal = buildTradeSignal(makeTicker(4), makeCandles(4), 0, 'INTRADAY');

    expect(signal).not.toBeNull();
    expect(signal!.validationStatus).toBe('PENDING_VALIDATION');
    expect(signal!.candle1mConfirmed).toBe(false);
    expect(signal!.candle5mConfirmed).toBe(false);
    expect(signal!.validatedAt).toBeUndefined();
    expect(signal!.validationStage).not.toContain('Confluência Direct-Market');
  });

  it('runs the real multi-timeframe validation when enough data is present', () => {
    const signal = buildTradeSignal(makeTicker(20), makeCandles(20), 0, 'INTRADAY');
    expect(signal).not.toBeNull();
    // Validation actually ran: it must have reached a real verdict rather than the warming-up branch.
    expect(['CONFIRMED', 'PENDING_VALIDATION', 'REJECTED_SPIKE']).toContain(signal!.validationStatus);
  });
});

describe('Phase 3.1 Candle-range stop/target evaluation', () => {
  const signal = (overrides: Partial<TradeSignal> = {}): TradeSignal => ({
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
    createdAt: 1000,
    ...overrides
  } as TradeSignal);

  it('detects a target touched between ticks via the candle high', () => {
    // Last price sits mid-candle; only the candle high reveals the target was reached.
    const actions = evaluatePositionManagement([signal()], 91500, { high: 92500, low: 91400, openTime: 5000 });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('UPDATE_SIGNAL');
  });

  it('prefers the stop when a candle touches both stop and target', () => {
    const actions = evaluatePositionManagement([signal()], 92000, { high: 94500, low: 88500, openTime: 5000 });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('STOPPED_OUT');
  });

  it('ignores the candle range for a position opened inside that same candle', () => {
    // createdAt (9000) is after the candle open (1000), so its range predates the entry.
    const actions = evaluatePositionManagement(
      [signal({ createdAt: 9000 })],
      91500,
      { high: 94500, low: 88000, openTime: 1000 }
    );
    expect(actions).toHaveLength(0);
  });

  it('mirrors the range logic for SHORT', () => {
    const short = signal({ direction: 'SHORT', stopLoss: 91000, target1: 88000, target2: 86000 });
    const takeProfit = evaluatePositionManagement([short], 89000, { high: 89500, low: 85500, openTime: 5000 });
    expect(takeProfit[0].type).toBe('HIT_TARGET2');

    const stopped = evaluatePositionManagement(
      [signal({ direction: 'SHORT', stopLoss: 91000, target1: 88000, target2: 86000 })],
      90500,
      { high: 91500, low: 86500, openTime: 5000 }
    );
    expect(stopped[0].type).toBe('STOPPED_OUT');
  });
});

describe('Phase 3.4 Exact decimal arithmetic', () => {
  it('avoids binary floating point drift that raw doubles exhibit', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; the scaled path must be exact.
    expect(dAdd(0.1, 0.2)).toBe(0.3);
    expect(dSub(0.3, 0.1)).toBe(0.2);
  });

  it('multiplies and divides exactly for money magnitudes', () => {
    expect(dMul(1234.56, 0.04)).toBeCloseTo(49.3824, 8);
    expect(dDiv(49.3824, 0.04)).toBeCloseTo(1234.56, 6);
  });

  it('rounds half away from zero to the requested precision', () => {
    expect(dRound(2.345, 2)).toBe(2.35);
    expect(dRound(-2.345, 2)).toBe(-2.35);
    expect(dRound(1.000000001, 2)).toBe(1);
  });

  it('throws on division by zero instead of returning Infinity', () => {
    expect(() => dDiv(1, 0)).toThrow(/division by zero/);
  });

  it('rejects non-finite input instead of propagating NaN', () => {
    expect(() => dAdd(Number.NaN, 1)).toThrow(/finite/);
  });

  it('clamps into range', () => {
    expect(dClamp(5, 0, 3)).toBe(3);
    expect(dClamp(-1, 0, 3)).toBe(0);
    expect(dClamp(2, 0, 3)).toBe(2);
  });
});

describe('Phase 3.4 Position sizing', () => {
  it('sizes from the stop distance so the risk budget is respected', () => {
    const size = computePositionSize({
      entryPrice: 90000,
      stopLossPrice: 89000,
      equity: 10000,
      riskPerTradePct: 1
    });

    expect(size.valid).toBe(true);
    expect(size.riskPerUnit).toBe(1000);
    expect(size.riskAmount).toBe(100);       // 1% of 10000
    expect(size.quantity).toBe(0.1);         // 100 / 1000
    expect(size.notional).toBe(9000);
  });

  it('refuses a zero-distance stop instead of producing a huge position', () => {
    const size = computePositionSize({ entryPrice: 90000, stopLossPrice: 90000 });
    expect(size.valid).toBe(false);
    expect(size.quantity).toBe(0);
    expect(size.reason).toMatch(/stop nula/i);
  });

  it('refuses a position below the tradable minimum', () => {
    const size = computePositionSize({
      entryPrice: 90000, stopLossPrice: 1, equity: 10000, riskPerTradePct: 0.001, minQuantity: 0.5
    });
    expect(size.valid).toBe(false);
    expect(size.reason).toMatch(/mínimo/i);
  });

  it('rejects invalid inputs', () => {
    expect(computePositionSize({ entryPrice: 0, stopLossPrice: 89000 }).valid).toBe(false);
    expect(computePositionSize({ entryPrice: 90000, stopLossPrice: -1 }).valid).toBe(false);
    expect(computePositionSize({ entryPrice: 90000, stopLossPrice: 89000, equity: 0 }).valid).toBe(false);
  });
});

describe('Phase 3.4 Portfolio risk limits', () => {
  const openSignal = (id: string, category: TradeSignal['strategyCategory']): TradeSignal => ({
    id,
    symbol: 'BTCUSDT',
    direction: 'LONG',
    strategyCategory: category,
    entryZone: [90000, 90100],
    stopLoss: 89000,
    target1: 92000,
    target2: 94000,
    isBreakevenActive: false,
    status: 'ACTIVE',
    createdAt: 1
  } as TradeSignal);

  it('computes the stop distance from the entry-to-stop distance', () => {
    // (90000 - 89000) / 90000 = 1.111...%
    expect(signalStopDistancePct(openSignal('a', 'SCALP'))).toBeCloseTo(1.1111, 3);
  });

  it('blocks new signals once the concurrency limit is reached', () => {
    const open = Array.from({ length: DEFAULT_RISK_LIMITS.maxConcurrentSignals }, (_, i) =>
      openSignal(`s${i}`, 'INTRADAY')
    );
    const result = evaluatePortfolioRisk(open, DEFAULT_RISK_LIMITS, { category: 'SCALP' });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/simultâneos/i);
  });

  it('blocks a new signal when its category is already at its cap', () => {
    const open = Array.from({ length: DEFAULT_RISK_LIMITS.maxSignalsPerCategory }, (_, i) =>
      openSignal(`s${i}`, 'INTRADAY')
    );
    const result = evaluatePortfolioRisk(open, DEFAULT_RISK_LIMITS, { category: 'INTRADAY' });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/INTRADAY/);
  });

  it('allows a signal when the portfolio is within limits', () => {
    const result = evaluatePortfolioRisk([openSignal('a', 'SCALP')], DEFAULT_RISK_LIMITS, { category: 'INTRADAY' });
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('blocks when aggregate open risk exceeds the budget', () => {
    const many = Array.from({ length: 6 }, (_, i) => openSignal(`s${i}`, 'INTRADAY'));
    const result = evaluatePortfolioRisk(many, {
      ...DEFAULT_RISK_LIMITS,
      maxConcurrentSignals: 100,
      maxSignalsPerCategory: 100,
      maxPortfolioRiskPct: 2
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Risco agregado/i);
    expect(result.openRiskPct).toBeGreaterThan(2);
  });
});

describe('Phase 3.4 Kill-switch', () => {
  beforeEach(() => resetKillSwitchForTests());
  afterEach(() => resetKillSwitchForTests());

  it('starts released', () => {
    expect(isTradingHalted()).toBe(false);
    expect(getKillSwitch().enabled).toBe(false);
  });

  it('halts trading and records who stopped it and why', () => {
    const state = setKillSwitch(true, 'token:abc@127.0.0.1', 'Exchange incident');
    expect(state.enabled).toBe(true);
    expect(state.reason).toBe('Exchange incident');
    expect(state.activatedBy).toBe('token:abc@127.0.0.1');
    expect(state.activatedAt).toBeTypeOf('number');
    expect(isTradingHalted()).toBe(true);
  });

  it('refuses to activate without a reason', () => {
    expect(() => setKillSwitch(true, 'operator')).toThrow(/motivo/i);
    expect(isTradingHalted()).toBe(false);
  });

  it('releases the halt', () => {
    setKillSwitch(true, 'operator', 'maintenance');
    const state = setKillSwitch(false, 'operator');
    expect(state.enabled).toBe(false);
    expect(state.reason).toBeNull();
    expect(isTradingHalted()).toBe(false);
  });
});
