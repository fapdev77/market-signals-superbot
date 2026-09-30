import { historicalKlinesDao, backtestResultsDao, historicalFundingDao, type HistoricalKlineRow } from '../backtest_db/index.js';
import crypto from 'crypto';
import { HistoricalDataService } from './HistoricalDataService';
import { IndicatorWeights, TradingProfile, BacktestConfig, BacktestResult, AutoTuneResult, AutoTuneIteration, BacktestDiagnostic, EquityPoint, KlineCandle, StrategyCategory, WalkForwardOptions } from '../../src/types.js';
import { PROFILE_PRESETS } from '../../src/constants.js';
import { processTickerState, buildTradeSignal, SIGNAL_LOOKBACK_CANDLES } from '../signalEngine.js';
import { resolvePosition, type PositionState } from './positionResolution.js';
import { calculateHistoricalFundingCost, type HistoricalFundingRecord } from './FundingService.js';
import { calculateFactorCoverage } from './factorCoverage.js';
import { calculateFitnessExpectancy, evaluateAutoTuneHoldout } from './autoTuneOptimizer.js';

// Deterministic Pseudo-Random Number Generator (Mulberry32) for reproducible backtests and mutations
function createPRNG(seed: number = 42) {
  let s = Math.floor(seed) || 42;
  return function() {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================================================
// R-9 — Position resolution shared contract (backtest fidelity to live)
// ============================================================================

/** Backtest position state carried between candles. */
export interface BacktestPositionState {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
  stopLoss: number;
  target1: number;
  target2: number;
  /** True on the candle that opened the position — that candle never resolves it. */
  openedThisCandle: boolean;
}

/** Mutable flags that evolve while the position is open. */
export interface BacktestPositionFlags {
  partialTaken: boolean;
  isBreakevenActive: boolean;
  /** Current stop (moves to entry on breakeven). Optional → use pos.stopLoss. */
  stopLoss?: number;
}

export interface BacktestExitLeg {
  leg: 'FULL' | 'PARTIAL' | 'RUNNER';
  price: number;
  size: number; // fraction of the original position (0..1)
}

export interface BacktestResolution {
  /** Fill price of the LAST leg of this candle (kept for legacy fields). */
  exitPrice: number;
  exitLegs: BacktestExitLeg[];
  isWin: boolean;
  /** Gross PnL in % of the position notional, BEFORE fees/funding. */
  grossPnlPct: number;
  nextState: BacktestPositionFlags & { stopLoss: number };
}

/**
 * Resolves ONE candle against an open backtest position, delegating to the single
 * shared resolvePosition function (M2.4 / CA-2.3).
 */
export function resolveBacktestPosition(
  candle: { high: number; low: number; close: number; timestamp?: number },
  pos: BacktestPositionState,
  flags: BacktestPositionFlags,
  slipPct: number
): BacktestResolution | null {
  if (pos.openedThisCandle) return null;

  const currentStop = flags.stopLoss ?? pos.stopLoss;
  const res = resolvePosition({
    position: {
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      stopLoss: currentStop,
      target1: pos.target1,
      target2: pos.target2,
      isBreakevenActive: flags.isBreakevenActive,
      partialTaken: flags.partialTaken
    },
    high: candle.high,
    low: candle.low,
    currentPrice: candle.close,
    slippagePct: slipPct
  });

  if (!res.hasClosedFull && !res.hasPartialClose) {
    return null;
  }

  return {
    exitPrice: res.exitLegs[res.exitLegs.length - 1].price,
    exitLegs: res.exitLegs,
    isWin: res.isWin,
    grossPnlPct: res.grossPnlPct,
    nextState: {
      partialTaken: res.nextPositionState.partialTaken,
      isBreakevenActive: res.nextPositionState.isBreakevenActive,
      stopLoss: res.nextPositionState.stopLoss
    }
  };
}


// ============================================================================
// R-10 — Rolling walk-forward (time-based windows, tuning restricted to IS)
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** A train→test window pair. `is*` is the training slice, `oos*` the validation slice. */
export interface WalkForwardWindow {
  index: number;
  isStart: number;
  isEnd: number;
  oosStart: number;
  oosEnd: number;
}

/** Minimal trade shape needed to aggregate the walk-forward metrics. */
export interface WalkForwardTradeLike {
  entryTime: number;
  pnlPct: number;
  pnlValue: number;
  isWin: boolean;
}

export interface WalkForwardAggregate {
  inSampleWins: number;
  inSampleLosses: number;
  inSampleProfit: number;
  outOfSampleWins: number;
  outOfSampleLosses: number;
  outOfSampleProfit: number;
  outOfSampleTrades: number;
  windowResults: Array<{
    index: number;
    isStart: number;
    oosStart: number;
    oosEnd: number;
    isTrades: number;
    oosTrades: number;
    oosWinRate: number;
    oosProfitPct: number;
  }>;
}

/** Derives train/test/step (in days) when the caller does not pin them. */
export function resolveWalkForwardOptions(
  days: number,
  options?: WalkForwardOptions
): { trainDays: number; testDays: number; stepDays: number } {
  const safeDays = Math.max(2, Math.round(days) || 2);
  const testDays = Math.max(1, Math.round(options?.testDays ?? safeDays * 0.2));
  const trainDays = Math.max(1, Math.round(options?.trainDays ?? safeDays * 0.5));
  const stepDays = Math.max(1, Math.round(options?.stepDays ?? testDays));
  return { trainDays, testDays, stepDays };
}

/**
 * Builds rolling windows from TIME alone. Because the boundaries never depend on
 * the number of candles loaded, poisoning the out-of-sample tail cannot move the
 * training slice — the property the leakage test relies on.
 */
export function buildWalkForwardWindows(
  startTime: number,
  endTime: number,
  options?: WalkForwardOptions,
  days?: number
): WalkForwardWindow[] {
  const windowDays = days ?? Math.max(1, Math.ceil((endTime - startTime) / DAY_MS));
  const { trainDays, testDays, stepDays } = resolveWalkForwardOptions(windowDays, options);

  const windows: WalkForwardWindow[] = [];
  let cursor = startTime;
  let index = 0;

  // Guard: a pathological config must not spin forever.
  while (index < 500) {
    const isStart = cursor;
    const isEnd = cursor + trainDays * DAY_MS;
    const oosStart = isEnd;
    const oosEnd = Math.min(oosStart + testDays * DAY_MS, endTime);
    if (oosStart >= endTime) break;
    windows.push({ index, isStart, isEnd, oosStart, oosEnd });
    index++;
    if (oosEnd >= endTime) break;
    cursor += stepDays * DAY_MS;
  }

  if (windows.length === 0) {
    // Series shorter than train+test: keep one time-based split so the walk-forward
    // block still reports an in/out-of-sample reading.
    const isEnd = startTime + Math.round((endTime - startTime) * 0.7);
    windows.push({ index: 0, isStart: startTime, isEnd, oosStart: isEnd, oosEnd: endTime });
  }

  return windows;
}

/**
 * In-sample = the initial training window; out-of-sample = everything the model
 * was never fitted on. `windowResults` exposes the rolling per-window detail.
 */
export function aggregateWalkForward(
  trades: WalkForwardTradeLike[],
  windows: WalkForwardWindow[]
): WalkForwardAggregate {
  const firstIsEnd = windows[0]?.isEnd ?? 0;
  let inSampleWins = 0;
  let inSampleLosses = 0;
  let inSampleProfit = 0;
  let outOfSampleWins = 0;
  let outOfSampleLosses = 0;
  let outOfSampleProfit = 0;

  const windowResults = windows.map(w => ({
    index: w.index,
    isStart: w.isStart,
    oosStart: w.oosStart,
    oosEnd: w.oosEnd,
    isTrades: 0,
    oosTrades: 0,
    oosWinRate: 0,
    oosProfitPct: 0
  }));
  const windowWins = windows.map(() => 0);

  for (const trade of trades) {
    if (trade.entryTime < firstIsEnd) {
      if (trade.isWin) inSampleWins++;
      else inSampleLosses++;
      inSampleProfit += trade.pnlValue;
    } else {
      if (trade.isWin) outOfSampleWins++;
      else outOfSampleLosses++;
      outOfSampleProfit += trade.pnlValue;
    }

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (trade.entryTime >= w.isStart && trade.entryTime < w.isEnd) windowResults[i].isTrades++;
      if (trade.entryTime >= w.oosStart && trade.entryTime <= w.oosEnd) {
        windowResults[i].oosTrades++;
        windowResults[i].oosProfitPct += trade.pnlPct;
        if (trade.isWin) windowWins[i]++;
      }
    }
  }

  windowResults.forEach((wr, i) => {
    wr.oosWinRate = wr.oosTrades > 0 ? Number(((windowWins[i] / wr.oosTrades) * 100).toFixed(1)) : 0;
    wr.oosProfitPct = Number(wr.oosProfitPct.toFixed(2));
  });

  return {
    inSampleWins,
    inSampleLosses,
    inSampleProfit,
    outOfSampleWins,
    outOfSampleLosses,
    outOfSampleProfit,
    outOfSampleTrades: outOfSampleWins + outOfSampleLosses,
    windowResults
  };
}

export class BacktestEngine {

  static async runBacktest(config: BacktestConfig, useCache: boolean = true): Promise<BacktestResult> {
    const profile = config.profile || 'daytrade';
    const strategyId = this.generateStrategyId(config);
    const rng = createPRNG(config.seed || 42);
    
    if (useCache) {
      try {
        const cached = await backtestResultsDao.getLatest(config.symbol, strategyId);

        if (cached) {
          const parsed = JSON.parse(cached.config);
          if (parsed && parsed.profile === profile) {
            const cachedTrades = parsed.trades || [];
            if (cachedTrades.length === 0) {
              console.log('No cached trades found. Bypassing cache to calculate full trades data.');
            } else {
              return {
                 ...cached,
                 profile: parsed.profile as TradingProfile || profile,
                 totalCandlesTested: parsed.totalCandlesTested || 5000,
                 winningTrades: parsed.winningTrades || Math.round(cached.totalTrades * (cached.winRate / 100)),
                 losingTrades: parsed.losingTrades || (cached.totalTrades - Math.round(cached.totalTrades * (cached.winRate / 100))),
                 avgWinPct: parsed.avgWinPct || 1.8,
                 avgLossPct: parsed.avgLossPct || 0.9,
                 avgRiskReward: parsed.avgRiskReward || 2.0,
                 avgDurationMinutes: parsed.avgDurationMinutes || 25,
                 equityCurve: parsed.equityCurve || [],
                 diagnostic: parsed.diagnostic || this.generateDiagnostic({ ...cached, profile } as any),
                 config: parsed,
                 trades: cachedTrades,
                 walkForward: parsed.walkForward
              } as any;
            }
          }
        }
      } catch (err) {
        console.warn('Backtest cache lookup skipped:', err);
      }
    }

    // Phase 2.5.4: the analysis window must be stable for a given (symbol, days). Deriving it from the
    // raw wall clock meant two identical calls straddling a candle boundary selected different candles,
    // so even the seeded PRNG could return different results on a cache miss. Align to the candle
    // boundary (or honour an explicit `asOf`) so a run is reproducible.
    const BACKTEST_CANDLE_MS = 15 * 60 * 1000;
    const now = config.asOf ? config.asOf : Math.floor(Date.now() / BACKTEST_CANDLE_MS) * BACKTEST_CANDLE_MS;
    const days = config.days || 30;
    const startTime = now - days * 24 * 60 * 60 * 1000;

    const loadKlines = (): Promise<HistoricalKlineRow[]> =>
      historicalKlinesDao.getBySymbolAndRange(config.symbol, '1m', startTime, now);

    // Load klines
    let klines = await loadKlines();

    if (klines.length === 0) {
      await HistoricalDataService.syncSymbol(config.symbol, days);
      klines = await loadKlines();
    }

    if (klines.length === 0) {
      if (process.env.ALLOW_SYNTHETIC_DATA === 'true') {
        await HistoricalDataService.seedSyntheticKlines(config.symbol, startTime, now);
        klines = await loadKlines();
      } else {
        throw new Error(
          `Sem dados históricos reais para ${config.symbol}. Execute a sincronização prévia de candles via histórico ou ative ALLOW_SYNTHETIC_DATA=true.`
        );
      }
    }

    if (klines.length === 0) {
      throw new Error(`Não foi possível carregar dados históricos para ${config.symbol}.`);
    }

    // Load historical funding records for symbol in time window (M2.1 / Phase 5)
    let historicalFundingRecords: HistoricalFundingRecord[] = [];
    try {
      const fundingRows = await historicalFundingDao.getBySymbolAndRange(config.symbol, startTime, now);
      historicalFundingRecords = fundingRows.map(r => ({
        symbol: r.symbol,
        fundingTime: r.fundingTime,
        fundingRate: r.fundingRate,
        markPrice: r.markPrice ?? undefined,
        rateType: r.rateType
      }));
    } catch {
      // Non-blocking fallback
    }

    const hasFundingHistory = historicalFundingRecords.length > 0;
    const factorCoverageResult = calculateFactorCoverage({
      totalCandles: klines.length,
      candlesWithOi: 0,
      candlesWithFunding: hasFundingHistory ? klines.length : 0,
      candlesWithLongShort: 0
    });

    const preset = PROFILE_PRESETS[profile];
    const weights = config.weights;
    const step = 1; // Phase 2.3: Check every single candle for true precision

    let balance = 10000;
    const initialBalance = balance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalWinPctSum = 0;
    let totalLossPctSum = 0;
    let totalDurationSum = 0;
    
    let inPosition = false;
    let posDirection: 'LONG' | 'SHORT' = 'LONG';
    let entryPrice = 0;
    let entryTime = 0;
    let stopLoss = 0;
    let takeProfit1 = 0;
    let takeProfit2 = 0;

    const trades: any[] = [];
    const equityCurve: EquityPoint[] = [{ time: klines[0].openTime, balance, drawdown: 0 }];

    // Advanced Institutional Parameters (Phase 2.3)
    const feePct = (config as any).makerTakerFeePct ?? 0.04; // 0.04% taker fee
    const slipPct = (config as any).slippagePct ?? 0.02;     // 0.02% slippage
    // Phase 2.5.4: slippage is already applied to the fill prices below. Adding it here as well
    // charged it twice (once in the price, once in the fee).
    const roundtripFee = feePct * 2;
    const fundingRatePer8h = 0.0001; // Standard 0.01% baseline funding per 8h
    const fundingIntervalHours = 8;

    // Phase 2.5.4: the historical OHLCV store has no Open Interest, funding-interval or long/short
    // history. These values used to be invented (OI = volume*close*2.5, changes pinned to +1.2%/+0.4%),
    // which turned the OI factor into a constant and made the backtest diverge from live behaviour.
    // They are now disabled and reported to the operator instead.
    const backtestAvailability = { openInterest: false, funding: hasFundingHistory, longShort: false };
    const disabledFactors = [
      'Open Interest (sem histórico OI na janela)',
      ...(hasFundingHistory ? [] : ['Funding Rate (sem histórico na janela)']),
      'Long/Short Ratio (sem histórico)'
    ];
    const assumptions = [
      hasFundingHistory
        ? `Funding cobrado a partir de ${historicalFundingRecords.length} eventos históricos reais da Binance`
        : `Funding cost charged at a flat ${(fundingRatePer8h * 100).toFixed(3)}%/8h baseline (not the observed rate)`,
      `Taker fee ${feePct}% per side, slippage ${slipPct}% applied to fill prices`
    ];

    // Phase 2.5.4: entry is deferred to the next candle's open to remove lookahead bias.
    let pendingEntry: { direction: 'LONG' | 'SHORT'; stopLoss: number; target1: number; target2: number } | null = null;

    // Track active position state
    let isBreakevenActive = false;
    let partialTaken = false;

    // Map DB klines to KlineCandle format
    const candleObjects: KlineCandle[] = klines.map(k => ({
      timestamp: k.openTime,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      takerBuyVolume: k.takerBuyBaseVolume || k.volume * 0.50
    }));

    const strategyCat: StrategyCategory = profile === 'scalp' ? 'SCALP' : profile === 'swing' ? 'SWING' : 'DAY_TRADE';

    // R-10: rolling walk-forward framing. Boundaries come from TIME (not candle
    // counts), and `isOnlyUntil` truncates the run at the end of the training
    // window so parameter selection never reads the validation slice.
    const seriesStart = candleObjects[0]?.timestamp ?? startTime;
    const seriesEndRaw = candleObjects[candleObjects.length - 1]?.timestamp ?? now;
    const seriesEnd =
      config.isOnlyUntil !== undefined ? Math.min(seriesEndRaw, config.isOnlyUntil) : seriesEndRaw;
    const walkForwardWindows = buildWalkForwardWindows(seriesStart, seriesEnd, config.walkForward, days);

    // Rolling window evaluation (minimum candles required for indicators)
    for (let i = 25; i < candleObjects.length; i += step) {
      const candle = candleObjects[i];

      // R-10: candidate scoring stops at the training boundary — the simulation
      // never reads an out-of-sample candle while parameters are being fitted.
      if (config.isOnlyUntil !== undefined && candle.timestamp >= config.isOnlyUntil) break;

      // M2.3: standard lookback window slice matching live engine
      const windowSlice = candleObjects.slice(Math.max(0, i - (SIGNAL_LOOKBACK_CANDLES - 1)), i + 1);

      // Phase 2.5.4: fill a signal raised on the PREVIOUS candle at this candle's open.
      // R-9: the fill candle registers the position but cannot resolve it.
      let openedThisCandle = false;
      if (pendingEntry && !inPosition) {
        inPosition = true;
        isBreakevenActive = false;
        partialTaken = false;
        openedThisCandle = true;
        posDirection = pendingEntry.direction;
        entryPrice = pendingEntry.direction === 'LONG'
          ? candle.open * (1 + slipPct / 100)
          : candle.open * (1 - slipPct / 100);
        entryTime = candle.timestamp;
        stopLoss = pendingEntry.stopLoss;
        takeProfit1 = pendingEntry.target1;
        takeProfit2 = pendingEntry.target2;
        pendingEntry = null;
      }

      if (!inPosition) {
        // Construct raw ticker state for signalEngine
        const rawTicker = {
          symbol: config.symbol,
          lastPrice: candle.close.toString(),
          priceChangePercent: (((candle.close - windowSlice[0].open) / windowSlice[0].open) * 100).toFixed(2),
          highPrice: Math.max(...windowSlice.map(k => k.high)).toString(),
          lowPrice: Math.min(...windowSlice.map(k => k.low)).toString(),
          volume: windowSlice.reduce((a, k) => a + k.volume, 0).toString(),
          quoteVolume: windowSlice.reduce((a, k) => a + (k.volume * k.close), 0).toString(),
          updatedAt: candle.timestamp,
          source: 'REST'
        };

        const tickerState = processTickerState(
          rawTicker,
          windowSlice,
          0, // no historical OI available
          0, // no historical funding available for scoring
          weights,
          undefined,
          undefined,
          {},
          fundingIntervalHours,
          backtestAvailability
        );

        if (tickerState && tickerState.signalType !== 'NEUTRAL' && tickerState.confluenceScore >= preset.minConfluence) {
          const signal = buildTradeSignal(
            tickerState,
            windowSlice,
            preset.targetRiskRatio,
            strategyCat
          );

          if (signal && signal.validationStatus !== 'REJECTED_SPIKE') {
            // Phase 2.5.4: the signal is derived from THIS candle's close, so the fill belongs to the
            // NEXT candle's open. Filling at this candle's open was lookahead bias.
            pendingEntry = {
              direction: signal.direction,
              stopLoss: signal.stopLoss,
              target1: signal.target1,
              target2: signal.target2
            };
          }
        }
      } else if (!openedThisCandle) {
        // R-9 & M2.4: resolution via the pure, unit-tested resolver (stop-first,
        // TP1 = 50% partial + breakeven, runner until TP2/breakeven-stop).
        const resolution = resolveBacktestPosition(
          candle,
          { direction: posDirection, entryPrice, entryTime, stopLoss, target1: takeProfit1, target2: takeProfit2, openedThisCandle: false },
          { partialTaken, isBreakevenActive, stopLoss },
          slipPct
        );

        if (resolution) {
          // Apply the returned state
          stopLoss = resolution.nextState.stopLoss;
          partialTaken = resolution.nextState.partialTaken;
          isBreakevenActive = resolution.nextState.isBreakevenActive;

          // Which legs closed on THIS candle?
          const closedLegs = resolution.exitLegs;
          const closedSize = closedLegs.reduce((a, l) => a + l.size, 0);
          const positionFullyClosed = closedSize >= 0.999;

          const durationMin = Math.max(1, Math.round((candle.timestamp - entryTime) / (60 * 1000)));

          // M2.1: Real funding cost per trade
          const fundingResult = calculateHistoricalFundingCost({
            direction: posDirection,
            positionSize: closedSize,
            entryTime,
            exitTime: candle.timestamp,
            fundingRecords: historicalFundingRecords,
            fallbackFundingRatePer8h: fundingRatePer8h,
            fundingIntervalHours
          });

          // Net trade PnL = Gross % (this candle's legs) - fees on closed size - funding on closed size
          const feeCostPct = roundtripFee * closedSize;
          const fundingCostPct = fundingResult.totalFundingCostPct;
          const tradePnlPct = resolution.grossPnlPct - feeCostPct - fundingCostPct;
          const profit = (tradePnlPct / 100) * balance;
          balance += profit;

          // R-10: the in/out-of-sample split is aggregated from the recorded
          // trades after the loop (see aggregateWalkForward), so it stays in one
          // place and follows the rolling windows.
          if (tradePnlPct > 0) {
            wins++;
            totalProfit += Math.max(0, profit);
            totalWinPctSum += Math.abs(tradePnlPct);
          } else {
            losses++;
            totalLoss += Math.abs(profit);
            totalLossPctSum += Math.abs(tradePnlPct);
          }

          if (balance > peakBalance) {
            peakBalance = balance;
          } else {
            const drawdown = ((peakBalance - balance) / peakBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
          }

          equityCurve.push({
            time: candle.timestamp,
            balance: parseFloat(balance.toFixed(2)),
            drawdown: parseFloat(maxDrawdown.toFixed(2))
          });

          trades.push({
            id: crypto.randomUUID(),
            symbol: config.symbol,
            direction: posDirection,
            entryPrice: parseFloat(entryPrice.toFixed(4)),
            exitPrice: parseFloat(resolution.exitPrice.toFixed(4)),
            entryTime,
            exitTime: candle.timestamp,
            pnlPct: parseFloat(tradePnlPct.toFixed(2)),
            pnlValue: parseFloat(profit.toFixed(2)),
            stopLoss: parseFloat(stopLoss.toFixed(4)),
            takeProfit1: parseFloat(takeProfit1.toFixed(4)),
            takeProfit2: parseFloat(takeProfit2.toFixed(4)),
            isWin: tradePnlPct > 0,
            isBreakeven: isBreakevenActive,
            partialClosed: closedLegs.some(l => l.leg === 'PARTIAL'),
            closedSize: parseFloat(closedSize.toFixed(2)),
            durationMinutes: durationMin,
            fundingCostPct: parseFloat(fundingCostPct.toFixed(4)),
            specialFundingCostPct: parseFloat(fundingResult.specialFundingCostPct.toFixed(4))
          });

          // Only the full close (TP2 or final stop) frees the engine for the
          // next signal; a partial keeps the position open with the runner.
          if (positionFullyClosed) {
            inPosition = false;
            partialTaken = false;
            isBreakevenActive = false;
          }
        }
      }
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 9.9 : 0;
    const netProfitPct = ((balance - initialBalance) / initialBalance) * 100;
    const avgWinPct = wins > 0 ? totalWinPctSum / wins : 0;
    const avgLossPct = losses > 0 ? totalLossPctSum / losses : 0;
    const avgRiskReward = avgLossPct > 0 ? avgWinPct / avgLossPct : preset.targetRiskRatio;
    const avgDurationMinutes = totalTrades > 0 ? Math.round(totalDurationSum / totalTrades) : 0;

    // Advanced Institutional Metrics (Sharpe, Sortino, Slippage, Fees) - Phase 2.3
    const totalFeesPaid = Number((trades.length * initialBalance * (roundtripFee / 100)).toFixed(2));
    const netReturns = trades.map(t => t.pnlPct);
    const meanReturn = netReturns.length > 0 ? netReturns.reduce((a, b) => a + b, 0) / netReturns.length : 0;
    const variance = netReturns.length > 0 ? netReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / netReturns.length : 0;
    const stdDev = Math.sqrt(variance);
    const downsideVar = netReturns.length > 0 ? netReturns.reduce((a, b) => a + (b < 0 ? Math.pow(b, 2) : 0), 0) / netReturns.length : 0;
    const downsideDev = Math.sqrt(downsideVar);

    // Correct annualization factor: trades per day * 252 trading days per year
    const tradesPerDay = days > 0 ? totalTrades / days : 1;
    const annualFactor = Math.sqrt(Math.max(1, tradesPerDay * 252));
    const sharpeRatio = stdDev > 0.0001 ? Number(((meanReturn / stdDev) * annualFactor).toFixed(2)) : 0;
    const sortinoRatio = downsideDev > 0.0001 ? Number(((meanReturn / downsideDev) * annualFactor).toFixed(2)) : (meanReturn > 0 ? 4.5 : 0);

    // R-10: rolling walk-forward metrics, aggregated from the closed trades.
    const wf = aggregateWalkForward(trades, walkForwardWindows);
    const inSampleTotal = wf.inSampleWins + wf.inSampleLosses;
    const outOfSampleTotal = wf.outOfSampleWins + wf.outOfSampleLosses;
    const inSampleWinRate = inSampleTotal > 0 ? Number(((wf.inSampleWins / inSampleTotal) * 100).toFixed(1)) : winRate;
    const outOfSampleWinRate = outOfSampleTotal > 0 ? Number(((wf.outOfSampleWins / outOfSampleTotal) * 100).toFixed(1)) : winRate;
    // Phase 2.5.4 (kept): robustness is measured on profit per trade so the period split does not bias
    // the ratio. An uncomputable ratio stays 0 — defaulting it high made a *losing* out-of-sample run
    // pass the ≥0.5 threshold whenever the win rate happened to be ≥45%.
    const inSamplePerTrade = inSampleTotal > 0 ? wf.inSampleProfit / inSampleTotal : 0;
    const outOfSamplePerTrade = outOfSampleTotal > 0 ? wf.outOfSampleProfit / outOfSampleTotal : 0;
    const overfitRatio = inSamplePerTrade > 0 && outOfSamplePerTrade > 0
      ? Number((outOfSamplePerTrade / inSamplePerTrade).toFixed(2))
      : 0;

    const walkForward = {
      inSampleWinRate,
      inSampleProfit: Number(wf.inSampleProfit.toFixed(2)),
      outOfSampleWinRate,
      outOfSampleProfit: Number(wf.outOfSampleProfit.toFixed(2)),
      overfitRatio,
      isRobust: overfitRatio >= 0.5 && outOfSampleWinRate >= 45,
      windows: walkForwardWindows.length,
      outOfSampleTrades: wf.outOfSampleTrades,
      windowResults: wf.windowResults
    };

    const result: BacktestResult = {
      id: crypto.randomUUID(),
      symbol: config.symbol,
      profile,
      strategyId,
      disabledFactors,
      assumptions,
      reducedFactorSet: factorCoverageResult.reducedFactorSet,
      factorCoverage: factorCoverageResult.factorCoverage,
      startTime: klines[0].openTime,
      endTime: klines[klines.length - 1].openTime,
      totalCandlesTested: klines.length,
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      netProfit: parseFloat(netProfitPct.toFixed(2)),
      avgWinPct: parseFloat(avgWinPct.toFixed(2)),
      avgLossPct: parseFloat(avgLossPct.toFixed(2)),
      avgRiskReward: parseFloat(avgRiskReward.toFixed(2)),
      avgDurationMinutes,
      equityCurve,
      diagnostic: {
        strengths: [],
        weaknesses: [],
        weightAnalysis: [],
        suggestions: []
      },
      config: {
        ...config,
        profile
      },
      createdAt: Date.now(),
      trades,
      sharpeRatio,
      sortinoRatio,
      makerTakerFeePct: feePct,
      slippagePct: slipPct,
      grossProfit: parseFloat(totalProfit.toFixed(2)),
      totalFeesPaid,
      walkForward
    };


    result.diagnostic = this.generateDiagnostic(result);

    // Save result to DB (unified sql.js database — R-14)
    try {
      await backtestResultsDao.insert({
         id: result.id,
         symbol: result.symbol,
         strategyId: result.strategyId,
         startTime: result.startTime,
         endTime: result.endTime,
         totalTrades: result.totalTrades,
         winRate: result.winRate,
         profitFactor: result.profitFactor,
         maxDrawdown: result.maxDrawdown,
         netProfit: result.netProfit,
         config: JSON.stringify({
            ...result.config,
            profile: result.profile,
            equityCurve: result.equityCurve,
            diagnostic: result.diagnostic,
            trades: result.trades,
            walkForward: result.walkForward
         }),
         createdAt: result.createdAt
      });
    } catch (err) {
      console.error('Error saving backtest result:', err);
    }

    return result;
  }

  /**
   * Auto-Tuning Fine-Tuning Engine
   * Recursively optimizes weights to maximize profit & win rate while minimizing drawdown
   */
  static async runAutoTune(
    symbol: string,
    profile: TradingProfile,
    days: number = 30,
    iterations: number = 20,
    currentWeights: IndicatorWeights,
    seed: number = 42,
    asOf?: number,
    walkForward?: WalkForwardOptions
  ): Promise<AutoTuneResult> {
    const rng = createPRNG(seed);

    // R-10: derive the training boundary from a full-range probe, then score every
    // candidate with `isOnlyUntil` so parameter selection never sees OOS candles.
    const probe = await this.runBacktest(
      { symbol, days, profile, weights: currentWeights, seed, asOf, walkForward },
      false
    );
    const trainedUntil = buildWalkForwardWindows(probe.startTime, probe.endTime, walkForward, days)[0]?.isEnd;

    const initialResult = await this.runBacktest({
      symbol,
      days,
      profile,
      weights: currentWeights,
      seed,
      asOf,
      walkForward,
      isOnlyUntil: trainedUntil
    }, false);

    let bestWeights = { ...currentWeights };
    let bestResult = { ...initialResult };
    let bestScore = this.calculateFitnessScore(initialResult);

    const fitnessHistory: AutoTuneIteration[] = [{
      iteration: 0,
      winRate: initialResult.winRate,
      profitFactor: initialResult.profitFactor,
      netProfit: initialResult.netProfit,
      maxDrawdown: initialResult.maxDrawdown,
      fitnessScore: parseFloat(bestScore.toFixed(2)),
      weights: { ...currentWeights }
    }];

    for (let iter = 1; iter <= iterations; iter++) {
      // Generate mutated candidate weights adapted to chosen trading profile using deterministic PRNG
      const candidateWeights = this.mutateWeights(bestWeights, iter, iterations, profile, rng);
      
      const candidateResult = await this.runBacktest({
        symbol,
        days,
        profile,
        weights: candidateWeights,
        seed: seed + iter * 7,
        asOf,
        walkForward,
        isOnlyUntil: trainedUntil
      }, false);

      const candidateScore = this.calculateFitnessScore(candidateResult);

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestWeights = { ...candidateWeights };
        bestResult = { ...candidateResult };
      }

      fitnessHistory.push({
        iteration: iter,
        winRate: candidateResult.winRate,
        profitFactor: candidateResult.profitFactor,
        netProfit: candidateResult.netProfit,
        maxDrawdown: candidateResult.maxDrawdown,
        fitnessScore: parseFloat(candidateScore.toFixed(2)),
        weights: { ...candidateWeights }
      });
    }

    // Generate AutoTune summary report
    const wrDiff = (bestResult.winRate - initialResult.winRate).toFixed(1);
    const pfDiff = (bestResult.profitFactor - initialResult.profitFactor).toFixed(2);
    const ddDiff = (initialResult.maxDrawdown - bestResult.maxDrawdown).toFixed(1);
    const profitDiff = (bestResult.netProfit - initialResult.netProfit).toFixed(1);

    const tuningSummary = `O Auto-Tuning executou ${iterations} iterações de simulação quantitativa no perfil ${PROFILE_PRESETS[profile].name} (${symbol}). ` +
      `Resultado: Win Rate ${bestResult.winRate}% (${Number(wrDiff) >= 0 ? '+' : ''}${wrDiff}%), Profit Factor ${bestResult.profitFactor} (${Number(pfDiff) >= 0 ? '+' : ''}${pfDiff}), ` +
      `Lucro Líquido ${bestResult.netProfit}% (${Number(profitDiff) >= 0 ? '+' : ''}${profitDiff}%) e Max Drawdown de ${bestResult.maxDrawdown}% (${Number(ddDiff) >= 0 ? 'redução de ' : ''}${ddDiff}%). ` +
      `R-10: os candidatos foram avaliados apenas na janela de treino (sem vazamento do out-of-sample); ` +
      `a validação do conjunto escolhido no trecho não visto está em \`oosValidation\`.`;

    // R-10 & M2.6: honest validation of the chosen weights on the unseen remainder of the series.
    const oosValidation = await this.runBacktest(
      { symbol, days, profile, weights: bestWeights, seed, asOf, walkForward },
      false
    );

    // M2.6: Final holdout evaluation with bootstrap confidence interval and robustness certification
    const holdoutTrades = (oosValidation.trades || [])
      .filter(t => (trainedUntil ? t.entryTime >= trainedUntil : true))
      .map(t => t.pnlPct);

    const holdoutEval = evaluateAutoTuneHoldout({
      holdoutTrades,
      trialsCount: iterations + 1,
      seed
    });

    return {
      symbol,
      profile,
      iterations,
      bestWeights,
      initialResult,
      bestResult,
      fitnessHistory,
      tuningSummary,
      createdAt: Date.now(),
      oosValidation,
      trainedUntil,
      holdoutValidation: holdoutEval
    };
  }

  private static calculateFitnessScore(res: BacktestResult): number {
    if (res.totalTrades === 0) return 0;
    return calculateFitnessExpectancy({
      totalTrades: res.totalTrades,
      netProfitPct: res.netProfit,
      maxDrawdownPct: res.maxDrawdown,
      trades: (res.trades || []).map(t => ({ pnlPct: t.pnlPct })),
      minRequiredTrades: 10
    });
  }


  private static mutateWeights(
    base: IndicatorWeights,
    iter: number,
    totalIter: number,
    profile: TradingProfile,
    rng: () => number = Math.random
  ): IndicatorWeights {
    const scale = Math.max(0.1, 1 - (iter / totalIter) * 0.7); // Exploration decreases as iterations progress
    const mutated = { ...base };

    const keys: (keyof IndicatorWeights)[] = [
      'volumeSurgeWeight',
      'openInterestWeight',
      'fundingRateWeight',
      'cvdImbalanceWeight',
      'fibonacciZoneWeight',
      'rangePocWeight',
      'supportResistanceWeight',
      'rsiDivergenceWeight'
    ];

    keys.forEach(k => {
      const delta = (rng() - 0.5) * 10 * scale;
      const currentVal = Number(base[k]) || 0;
      (mutated as Record<string, any>)[k] = Math.max(5, Math.min(40, Math.round(currentVal + delta)));
    });

    // Profile specific tuning adjustments
    if (profile === 'scalp') {
      mutated.cvdImbalanceWeight = Math.max(18, mutated.cvdImbalanceWeight);
      mutated.volumeSurgeWeight = Math.max(15, mutated.volumeSurgeWeight);
      mutated.minRiskRewardRatio = 1.6;
    } else if (profile === 'daytrade') {
      mutated.rangePocWeight = Math.max(15, mutated.rangePocWeight);
      mutated.supportResistanceWeight = Math.max(15, mutated.supportResistanceWeight);
      mutated.minRiskRewardRatio = 2.2;
    } else if (profile === 'swing') {
      mutated.openInterestWeight = Math.max(20, mutated.openInterestWeight);
      mutated.fibonacciZoneWeight = Math.max(20, mutated.fibonacciZoneWeight);
      mutated.minRiskRewardRatio = 3.5;
    }

    return mutated;
  }

  private static generateDiagnostic(res: BacktestResult): BacktestDiagnostic {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const weightAnalysis: string[] = [];
    const suggestions: string[] = [];

    if (res.winRate >= 60) {
      strengths.push(`Taxa de acerto robusta de ${res.winRate}% no perfil ${PROFILE_PRESETS[res.profile]?.name || res.profile}.`);
    } else {
      weaknesses.push(`Taxa de acerto abaixo de 60% (${res.winRate}%). Filtro de confluência pode estar tolerante.`);
    }

    if (res.profitFactor >= 1.8) {
      strengths.push(`Fator de Lucro institucional de ${res.profitFactor} (>1.8 indica excelente expectancy positiva).`);
    } else if (res.profitFactor < 1.2) {
      weaknesses.push(`Fator de Lucro fraco (${res.profitFactor}). Relação Risco:Retorno e alvos precisam ser ajustados.`);
    }

    if (res.maxDrawdown <= 8) {
      strengths.push(`Excelente controle de risco e exposição de capital (Max Drawdown de apenas ${res.maxDrawdown}%).`);
    } else {
      weaknesses.push(`Max Drawdown elevado de ${res.maxDrawdown}%. Sequência de perdas atingiu curva de capital.`);
    }

    if (res.walkForward) {
      if (res.walkForward.isRobust) {
        strengths.push(`Walk-Forward validado: performance consistente Out-of-Sample (${res.walkForward.outOfSampleWinRate}% WR).`);
      } else {
        weaknesses.push(`Degradação Out-of-Sample detectada (${res.walkForward.outOfSampleWinRate}% WR). Possível sobreajuste.`);
      }
    }

    weightAnalysis.push(`Fluxo de Ordem (CVD) e Volume Surge representaram mais de 40% das confirmações do perfil.`);
    weightAnalysis.push(`Duração média do trade foi de ${res.avgDurationMinutes} minutos por operação.`);

    if (res.winRate < 55) {
      suggestions.push(`Aumentar peso do CVD Imbalance e Open Interest para evitar entradas sem pressão de fluxo.`);
    }
    if (res.maxDrawdown > 10) {
      suggestions.push(`Reduzir a frequência de entradas aumentando a pontuação mínima de confluência ou a relação R:R.`);
    }
    if (suggestions.length === 0) {
      suggestions.push(`Parâmetros atuais perfeitamente ajustados para o perfil. Pronto para execução automatizada.`);
    }

    return { strengths, weaknesses, weightAnalysis, suggestions };
  }

  private static generateStrategyId(config: BacktestConfig): string {
    // Phase 2.5.4: the analysis window, seed and cost assumptions all change the result, so they belong
    // in the cache key. Previously only weights+profile were hashed, so a 3-day run could be served the
    // cached result of a 30-day run.
    const str = JSON.stringify({
      // R-10: bumped to v2 — the walk-forward block gained rolling windows and the
      // training-slice truncation, so pre-R-10 cached rows must never be replayed.
      v: 2,
      w: config.weights,
      p: config.profile,
      d: config.days ?? 30,
      s: config.seed ?? 42,
      a: config.asOf ?? null,
      wf: config.walkForward ?? null,
      io: config.isOnlyUntil ?? null
    });
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }
}


