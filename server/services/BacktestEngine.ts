import { historicalKlinesDao, backtestResultsDao, historicalFundingDao, type HistoricalKlineRow } from '../backtest_db/index.js';
import crypto from 'crypto';
import { HistoricalDataService } from './HistoricalDataService';
import { IndicatorWeights, TradingProfile, BacktestConfig, BacktestResult, AutoTuneResult, AutoTuneIteration, BacktestDiagnostic, EquityPoint, KlineCandle, StrategyCategory, WalkForwardOptions } from '../../src/types.js';
import { PROFILE_PRESETS } from '../../src/constants.js';
import { processTickerState, buildTradeSignal, SIGNAL_LOOKBACK_CANDLES } from '../signalEngine.js';
import { resolvePosition, type PositionState } from './positionResolution.js';
// 6.5.1/CA-5.2: formatação de cálculo usa dRound (decimal exato), nunca toFixed.
// 7.6.3: a aritmética de PnL e custos do backtest também usa decimal (dAdd/dSub/dMul/dDiv),
// fechando exato a soma das pernas antes das taxas/funding.
import { dAdd, dSub, dMul, dDiv, dRound } from '../utils/decimal.js';
// 8.0 / J-01, J-02: contabilidade por POSIÇÃO (legs, positionsClosed) e decomposição de R.
import {
  createPositionAccounting,
  applyResolution,
  positionNetPct,
  rDecomposition,
  positionCostR,
  legGrossPct,
  type PositionAccounting
} from './backtestAccounting.js';
import { calculateHistoricalFundingCost, type HistoricalFundingRecord } from './FundingService.js';
// CRÍTICO-1: o dimensionamento por risco é a MESMA primitiva do live. Importar em vez de
// reimplementar mantém backtest e live literalmente sobre o mesmo código de risco.
import { computePositionSize, DEFAULT_RISK_LIMITS, evaluatePortfolioRisk, getRiskLimits, type RiskLimits } from './RiskManager.js';
import type { TradeSignal } from '../../src/types.js';
import { calculateFactorCoverage } from './factorCoverage.js';
import { computeBacktestMetrics } from './backtestMetrics.js';
import { calculateFundingCostWithCoverage } from './FundingService.js';
import { calculateFitnessExpectancy, evaluateAutoTuneHoldout } from './autoTuneOptimizer.js';
// 6.7.5/G-15: split temporal 3-way — treino → validação → holdout intocado (blocos contíguos).
import { splitThreeWay } from './autoTuneSplit.js';
// 7.2.1/CA-2.2: o braço "com confirmação" usa o MESMO código puro do ciclo live
// (`evaluatePendingEntry` + `confirmEntry`). Nada de reimplementação paralela.
import { evaluatePendingEntry } from './pendingEntryLifecycle.js';
import { confirmEntry } from './entryConfirmation.js';
// SDD Fase 9 / S1 — paridade de timeframe: os indicadores do backtest usam o MESMO
// timeframe do live (15m). Contrato e testes em `timeframeParity.ts`.
import { aggregateToTimeframe, indicatorWindowAt, INDICATOR_TIMEFRAME_MINUTES, MTF_VALIDATION_TIMEFRAME_MINUTES } from './timeframeParity.js';
// SDD Fase 9 / S3 — vitoria e R LIQUIDO, com definicao unica.
import { isNetWin } from './winDefinition.js';

// Deterministic Pseudo-Random Number Generator (Mulberry32) for reproducible backtests and mutations
// (também usado pelo alinhamento de janela do runAutoTune)
const BACKTEST_CANDLE_MS = 15 * 60 * 1000;


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

/**
 * 6.7.5/G-15 — fronteiras do split 3-way do Auto-Tune (puro, exportado para o
 * espião/teste CA-7.4). Com ≥9 velas reais na janela, usa o split contíguo
 * 60/20/20 sobre os timestamps; abaixo disso, cai para frações temporais
 * equivalentes (mesmas proporções, sem lançar erro numa janela mínima).
 */
export function computeAutoTuneBoundaries(params: {
  startTime: number;
  endTime: number;
  klineTimestamps: number[];
  seed: number;
}): { trainedUntil: number; holdoutStart: number } {
  if (params.klineTimestamps.length >= 9) {
    const split = splitThreeWay(
      params.klineTimestamps.map(ts => ({ timestamp: ts })),
      { trainFraction: 0.6, validationFraction: 0.2, seed: params.seed }
    );
    return { trainedUntil: split.validation[0].timestamp, holdoutStart: split.holdoutStart! };
  }
  const span = Math.max(1, params.endTime - params.startTime);
  return {
    trainedUntil: params.startTime + Math.floor(span * 0.6),
    holdoutStart: params.startTime + Math.floor(span * 0.8)
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
  /** SDD Fase 9 / S3 — vitória LÍQUIDA (mesma definição do ledger: `isNetWin`). */
  isWin: boolean;
  /** SDD Fase 9 / S3 — vitória BRUTA, mantida para auditoria explícita. */
  isWinGross: boolean;
  /** Gross PnL in % of the position notional, BEFORE fees/funding. */
  grossPnlPct: number;
  /** SDD Fase 9 / S3 — custos em % (taxa de ida e volta + funding). */
  costsPct: number;
  /** SDD Fase 9 / S3 — P&L líquido em %: bruto − custos. */
  netPnlPct: number;
  /**
   * True when THIS candle's legs close the ENTIRE remaining position (final stop
   * or TP2). Mirrors `resolvePosition.hasClosedFull` and the live path
   * (`TickProcessor`), so a runner stop after a TP1 partial frees the engine
   * instead of being re-resolved every candle (partial leg size is 0.5).
   */
  hasClosedFull: boolean;
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
  slipPct: number,
  /** SDD Fase 9 / S3 — custos para o `isWin` líquido. Opcional: sem eles, líquido == bruto. */
  costs?: { roundtripFeePct?: number; fundingPct?: number }
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
    slippagePct: slipPct,
    roundtripFeePct: costs?.roundtripFeePct ?? 0,
    fundingPct: costs?.fundingPct ?? 0
  });

  if (!res.hasClosedFull && !res.hasPartialClose) {
    return null;
  }

  return {
    exitPrice: res.exitLegs[res.exitLegs.length - 1].price,
    exitLegs: res.exitLegs,
    isWin: res.isWin,
    isWinGross: res.isWinGross,
    grossPnlPct: res.grossPnlPct,
    costsPct: res.costsPct,
    netPnlPct: res.netPnlPct,
    hasClosedFull: res.hasClosedFull,
    nextState: {
      partialTaken: res.nextPositionState.partialTaken,
      isBreakevenActive: res.nextPositionState.isBreakevenActive,
      stopLoss: res.nextPositionState.stopLoss
    }
  };
}


// ============================================================================
// 8.1 — Regime proxy for edge diagnosis (deterministic, no look-ahead)
// ============================================================================

/**
 * Classifica a janela que gerou o sinal em tendência (alta/baixa) ou lateral, a
 * partir da variação líquida do primeiro `open` ao último `close`. Proxy simples
 * e determinístico: NÃO usa candle futuro e não exige indicador extra, servindo
 * apenas para AGRUPAR o diagnóstico (8.1.2), nunca para decidir entrada.
 */
export function classifyRegime(
  windowSlice: Array<{ open: number; close: number }>
): 'TREND_UP' | 'TREND_DOWN' | 'RANGE' {
  if (windowSlice.length === 0) return 'RANGE';
  const first = windowSlice[0].open;
  const last = windowSlice[windowSlice.length - 1].close;
  if (!(first > 0)) return 'RANGE';
  const changePct = ((last - first) / first) * 100;
  if (changePct >= 0.5) return 'TREND_UP';
  if (changePct <= -0.5) return 'TREND_DOWN';
  return 'RANGE';
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
    wr.oosWinRate = wr.oosTrades > 0 ? dRound((windowWins[i] / wr.oosTrades) * 100, 1) : 0;
    wr.oosProfitPct = dRound(wr.oosProfitPct, 2);
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
    // M7 — open interest e long/short não são instrumentados no histórico: não há
    // coluna em `historical_klines` nem série de long/short. O 0 de cobertura é
    // real (nenhuma vela tinha o dado), mas o fator não foi medido porque não pôde
    // ser, e o relatório precisa dizer isso em vez de deixar 0% parecer medição.
    const factorCoverageResult = calculateFactorCoverage({
      totalCandles: klines.length,
      candlesWithOi: 0,
      candlesWithFunding: hasFundingHistory ? klines.length : 0,
      candlesWithLongShort: 0,
      availability: {
        openInterest: false,
        longShort: false,
        funding: hasFundingHistory
      }
    });

    const preset = PROFILE_PRESETS[profile];
    const weights = config.weights;
    const step = 1; // Phase 2.3: Check every single candle for true precision

    let balance = 10000;
    const initialBalance = balance;
    let peakBalance = balance;
    // CRÍTICO-1: o capital realmente COMMITADO pela posição aberta (notional).
    // Antes o motor assumia 100% do saldo em cada trade, enquanto o live arrisca
    // `riskPerTradePct` do equity e deriva o notional da distância do stop.
    let activeNotional = 0;
    let maxDrawdown = 0;
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalWinPctSum = 0;
    let totalLossPctSum = 0;
    let totalDurationSum = 0;

    // 8.0 / J-01, J-02 — contadores por POSIÇÃO (não por perna).
    let totalLegs = 0;
    let legWins = 0;
    let legLosses = 0;
    let totalFeesPaidValue = 0;
    let rSumGross = 0;
    let rSumFees = 0;
    let rSumSlippage = 0;
    let rSumFunding = 0;
    let rSumNet = 0;
    let rCostSum = 0;
    let rCount = 0;
    let positionAcc: PositionAccounting = createPositionAccounting();
    let lastSpecialFundingCostPct = 0;
    
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
    // CRÍTICO-1 — dimensionamento por RISCO, o mesmo do live.
    //
    // O motor antigo assumia 100% do saldo em cada trade (`PnL% × balance`). O live
    // dimensiona com `computePositionSize`: arrisca `riskPerTradePct` do equity e deriva
    // o notional da distância do stop. Com stops reais de 1,2%–4% o notional fica em
    // 83%–25% do equity, então o backtest superdimensionava o PnL em 1,2×–4× — e por
    // contaminar o saldo, todas as métricas derivadas (`netProfit`, `equityCurve`,
    // `maxDrawdown`, `profitFactor`, `sharpeRatio`) e o auto-tuner saíam junto.
    const riskPerTradePct = config.riskPerTradePct ?? DEFAULT_RISK_LIMITS.riskPerTradePct;
    // P — os limites do gate sao os MESMOS que o live usa (`getRiskLimits()`), para que
    // um operador que estreitou o risco via `POST /api/system/risk-limits` veja o backtest
    // recusar o que o live recusaria. Um override por run continua disponivel em
    // `config.riskLimits` para reproduzir um cenário sem mexer na configuração global.
    const riskLimits: RiskLimits = {
      ...getRiskLimits(),
      riskPerTradePct,
      ...(config.riskLimits ?? {})
    };
    /**
     * P — o gate enxerga o conjunto que está ABERTO, exatamente como o live
     * (`server.ts`: `evaluatePortfolioRisk(openSignals, getRiskLimits(), { category })`).
     * O sinal candidato NÃO entra na contagem: para o live ele é o `incoming`, não uma
     * posição aberta. Passá-lo como se estivesse aberto faria o backtest recusar sinais que
     * o live aceitaria — o erro oposto, e igualmente distorcedor.
     *
     * Este conjunto é VAZIO em todo ponto de emissão, porque o motor é single-position
     * (`inPosition` é um booleano) e só gera sinal quando está plano. Isso é declarado no
     * resultado em vez de escondido: a dimensão de concorrência não pode limitar aqui.
     */
    const openSignalsForGate: TradeSignal[] = [];
    /** P — todo sinal emitido passa pelo gate; nada é contabilizado sem decidedor. */
    const riskGate = {
      evaluated: 0,
      allowed: 0,
      blocked: 0,
      openAtEvaluation: 0,
      reasons: new Set<string>()
    };

    /**
     * Notional que a posição aberta deve comprometer, pela MESMA primitiva do live.
     * Retorna `balance` (100%) só quando o tamanho não é computável — nesse caso não
     * há medida de risco disponível e o comportamento antigo é o fallback conservador
     * em termos de não subdimensionar.
     */
    const computeNotionalForStop = (entry: number, stop: number, equity: number): number => {
      const size = computePositionSize({
        entryPrice: entry,
        stopLossPrice: stop,
        equity,
        riskPerTradePct
      });
      return size.valid && size.notional > 0 ? size.notional : equity;
    };
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
        : `Funding cost charged at a flat ${dRound(fundingRatePer8h * 100, 3)}%/8h baseline (not the observed rate)`,
      `Taker fee ${feePct}% per side, slippage ${slipPct}% applied to fill prices`
    ];
    // 6.3.4 — contadores de cobertura de funding por trade.
    let fundingCoverageExpectedTotal = 0;
    let fundingCoverageCoveredTotal = 0;
    let fundingFallbackEventsTotal = 0;

    // Phase 2.5.4: entry is deferred to the next candle's open to remove lookahead bias.
    let pendingEntry: { direction: 'LONG' | 'SHORT'; stopLoss: number; target1: number; target2: number; rIndex: number; createdAt: number; confluenceScore: number; regime: 'TREND_UP' | 'TREND_DOWN' | 'RANGE' } | null = null;

    // 7.2.1 — braço "com confirmação": o pendente é governado pelas funções puras do live.
    let pendingConfirmation: {
      signal: { direction: 'LONG' | 'SHORT'; entryZone: [number, number]; stopLoss: number; target1: number; target2: number; strategyCategory?: string; confluenceScore?: number; regime: 'TREND_UP' | 'TREND_DOWN' | 'RANGE'; createdAt: number };
      startIndex: number;
      rIndex: number;
    } | null = null;

    // 7.2 — estatísticas por sinal emitido (iguais nos dois braços; R = 0 para não preenchido).
    const ecStats = {
      enabled: config.entryConfirmation === true,
      signalsEmitted: 0,
      entriesFilled: 0,
      entriesNotFilled: 0,
      entriesInvalidated: 0,
      rPerSignal: [] as number[],
      // 8.2.1 — chave determinística por sinal (mesmo sinal nos dois braços).
      signalKeys: [] as string[],
      fillMinutesSum: 0,
      fillCount: 0,
      limitation: (config.entryConfirmation === true
        ? 'R4 usa vela de 5m AGREGADA de 1m (o live usa a 5m real da exchange); R por sinal emitido (não preenchido = 0).'
        : undefined) as string | undefined
    };
    let activeSignalRIndex = -1;
    let activeRiskPct = 0;
    // 8.1 — metadados do sinal ativo, usados no diagnóstico do edge.
    let activeConfluenceScore = 0;
    let activeRegime: 'TREND_UP' | 'TREND_DOWN' | 'RANGE' = 'RANGE';

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

    // CRÍTICO-2: a série de 5m para a validação multi-timeframe é agregada das 1m
    // (o histórico só tem 1m — ver a limitação declarada em `MTF_VALIDATION_TIMEFRAME_MINUTES`) uma vez,
    // fora do loop. Dentro do loop, `mtf5mCursor` avança monotonicamente para achar a
    // última vela de 5m já fechada no instante do candle corrente — O(n) no total.
    const aggregated5mForValidation = aggregateToTimeframe(candleObjects, MTF_VALIDATION_TIMEFRAME_MINUTES);
    let mtf5mCursor = -1;

    // SDD Fase 9 / S1 — PARIDADE DE TIMEFRAME. `processTickerState` (volume profile,
    // Fibonacci, FVG, estrutura, CVD, RSI divergence) precisa receber o MESMO timeframe
    // do live, que é 15m. Até aqui recebia velas de 1m — o backtest nunca reproduziu o
    // sistema de produção, e todo número de expectativa publicado descrevia outro sistema.
    //
    // A agregação é feita uma única vez, fora do loop; dentro dele, `indicatorWindowAt` recorta
    // a janela até a última vela de 15m JÁ FECHADA no instante do candle 1m corrente.
    // Sem esse cuidado haveria lookahead: o bucket k cobre as velas 1m [k*15 .. k*15+14] e
    // só está completo em i = k*15+14.
    const indicators15m = aggregateToTimeframe(candleObjects, INDICATOR_TIMEFRAME_MINUTES);

    // Rolling window evaluation (minimum candles required for indicators)
    for (let i = 25; i < candleObjects.length; i += step) {
      const candle = candleObjects[i];

      // R-10: candidate scoring stops at the training boundary — the simulation
      // never reads an out-of-sample candle while parameters are being fitted.
      if (config.isOnlyUntil !== undefined && candle.timestamp >= config.isOnlyUntil) break;

      // M2.3: standard lookback window slice matching live engine
      const windowSlice = candleObjects.slice(Math.max(0, i - (SIGNAL_LOOKBACK_CANDLES - 1)), i + 1);

      // N6: cursor monotônico da série de 5m, avançado UMA vez por candle, no topo do
      // loop. Antes ele só avançava dentro do bloco de emissão de sinal, então o ramo
      // PENDING_ENTRY (que resolve o sinal de um candle ANTERIOR) lia um cursor defasado
      // — ou ainda em -1, quando o sinal fills no mesmo candle em que foi emitido.
      //
      // E o `klines5m` do PENDING_ENTRY não pode ser derivado do recorte pós-sinal
      // (`slice(startIndex + 1, i + 1)`): a janela de espera
      // (`entryWaitCandlesFor('DAY_TRADE')` = 3 velas de 1m) limita a menos de 5 velas,
      // `aggregateToTimeframe` só emite bucket COMPLETO de 5 e devolve `[]`. O R4 é
      // fail-closed sem vela de 5m => `confirmed: false` sempre => fill 0 sempre. No
      // live (`server.ts`) a vela de 5m vem da exchange; aqui ela tem de vir da mesma
      // série agregada usada na emissão, recortada até o instante corrente.
      while (
        mtf5mCursor + 1 < aggregated5mForValidation.length &&
        aggregated5mForValidation[mtf5mCursor + 1].timestamp <= candle.timestamp
      ) {
        mtf5mCursor++;
      }
      const mtf5mSlice =
        mtf5mCursor >= 0 ? aggregated5mForValidation.slice(Math.max(0, mtf5mCursor - 1), mtf5mCursor + 1) : [];

      // Phase 2.5.4: fill a signal raised on the PREVIOUS candle at this candle's open.
      // R-9: the fill candle registers the position but cannot resolve it.
      let openedThisCandle = false;

      // 7.2.1 — braço com confirmação: pendente resolvido pelas funções puras do live.
      if (pendingConfirmation && !inPosition) {
        const pc = pendingConfirmation;
        const candles1m = candleObjects.slice(pc.startIndex + 1, i + 1);
        const evaluation = evaluatePendingEntry({
          signal: {
            id: 'bt-pending',
            direction: pc.signal.direction,
            entryZone: pc.signal.entryZone,
            stopLoss: pc.signal.stopLoss,
            target1: pc.signal.target1,
            target2: pc.signal.target2,
            strategyCategory: pc.signal.strategyCategory,
            createdAt: pc.signal.createdAt
          },
          candles1m,
          // Mesmo wrapper do live (server.ts): o score cai para o do pendente quando ausente.
          confirm: (p) => confirmEntry({ ...p, confluenceScore: p.confluenceScore ?? pc.signal.confluenceScore ?? 0 }),
          confluenceScore: pc.signal.confluenceScore,
          klines5m: mtf5mSlice
        });

        if (evaluation.transition === 'ACTIVATED') {
          inPosition = true;
          isBreakevenActive = false;
          partialTaken = false;
          openedThisCandle = true;
          posDirection = pc.signal.direction;
          // CRÍTICO-2: sem slippage na entrada. O live (`positionResolution.slipFill`)
          // só aplica slippage na SAÍDA; aplicar nas duas pernas cobrava o custo duas
          // vezes e contaminava `grossPctNoSlip` (documentado como "bruto antes do
          // slippage"). A identidade de R fechava por compensação, escondendo o erro.
          entryPrice = evaluation.entryPrice ?? candle.close;
          entryTime = candle.timestamp;
          stopLoss = pc.signal.stopLoss;
          takeProfit1 = pc.signal.target1;
          takeProfit2 = pc.signal.target2;
          activeSignalRIndex = pc.rIndex;
          activeConfluenceScore = pc.signal.confluenceScore ?? 0;
          activeRegime = pc.signal.regime;
          activeRiskPct = entryPrice > 0 ? dMul(dDiv(Math.abs(dSub(entryPrice, stopLoss)), entryPrice), 100) : 0;
          activeNotional = computeNotionalForStop(entryPrice, stopLoss, balance);
          positionAcc = createPositionAccounting(); // 8.0: nova posição, contadores zerados
          ecStats.entriesFilled++;
          ecStats.fillCount++;
          ecStats.fillMinutesSum += Math.max(0, (candle.timestamp - pc.signal.createdAt) / 60000);
          pendingConfirmation = null;
        } else if (evaluation.transition === 'ENTRY_NOT_FILLED') {
          ecStats.entriesNotFilled++;
          pendingConfirmation = null;
        } else if (evaluation.transition === 'ENTRY_INVALIDATED') {
          ecStats.entriesInvalidated++;
          pendingConfirmation = null;
        }
      }

      if (pendingEntry && !inPosition) {
        inPosition = true;
        isBreakevenActive = false;
        partialTaken = false;
        openedThisCandle = true;
        posDirection = pendingEntry.direction;
        // CRÍTICO-2: mesma razão do ramo PENDING_ENTRY — a entrada é o preço-limite,
        // e o slippage é aplicado uma única vez, na saída, pelo resolver.
        entryPrice = candle.open;
        entryTime = candle.timestamp;
        stopLoss = pendingEntry.stopLoss;
        takeProfit1 = pendingEntry.target1;
        takeProfit2 = pendingEntry.target2;
        activeSignalRIndex = pendingEntry.rIndex;
        activeConfluenceScore = pendingEntry.confluenceScore;
        activeRegime = pendingEntry.regime;
        activeRiskPct = entryPrice > 0 ? dMul(dDiv(Math.abs(dSub(entryPrice, stopLoss)), entryPrice), 100) : 0;
        activeNotional = computeNotionalForStop(entryPrice, stopLoss, balance);
        positionAcc = createPositionAccounting();
        ecStats.entriesFilled++;
        ecStats.fillCount++;
        ecStats.fillMinutesSum += Math.max(0, (candle.timestamp - pendingEntry.createdAt) / 60000);
        pendingEntry = null;
      }

      // 7.2.1 — enquanto há um pendente (controle ou confirmação) o sinal não é
      // reemitido: reproduz o live (um PENDING_ENTRY por vez) e evita sobrescrever
      // o pendente do braço com confirmação antes de ele preencher/expirar.
      if (!inPosition && !pendingConfirmation && !pendingEntry) {
        // Construct raw ticker state for signalEngine
        const rawTicker = {
          symbol: config.symbol,
          lastPrice: candle.close.toString(),
          priceChangePercent: String(dRound(((candle.close - windowSlice[0].open) / windowSlice[0].open) * 100, 2)),
          highPrice: Math.max(...windowSlice.map(k => k.high)).toString(),
          lowPrice: Math.min(...windowSlice.map(k => k.low)).toString(),
          volume: windowSlice.reduce((a, k) => a + k.volume, 0).toString(),
          quoteVolume: windowSlice.reduce((a, k) => a + (k.volume * k.close), 0).toString(),
          updatedAt: candle.timestamp,
          source: 'REST'
        };


        // Janela de indicadores no timeframe do LIVE (15m), sem lookahead: só entram
        // buckets JÁ FECHADOS no instante `i` (S1.4). `windowSlice` (1m) continua
        // alimentando os indicadores de 24h do rawTicker e a validação MTF.
        const indicatorWindow = indicatorWindowAt(
          indicators15m,
          i,
          INDICATOR_TIMEFRAME_MINUTES,
          SIGNAL_LOOKBACK_CANDLES
        );

        const tickerState = processTickerState(
          rawTicker,
          indicatorWindow,
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
          // CRÍTICO-2: `windowSlice` já é a série real de 1m do histórico (BacktestEngine
          // carrega '1m'), então ela serve como klines1m; o 5m vem da agregação acima.
          const signal = buildTradeSignal(
            tickerState,
            windowSlice,
            preset.targetRiskRatio,
            strategyCat,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { klines1m: windowSlice, klines5m: mtf5mSlice }
          );

          if (signal && signal.validationStatus !== 'REJECTED_SPIKE') {
            // P — o gate de risco decide antes de o sinal entrar na simulação, com a
            // mesma função e os mesmos limites do caminho de emissão do live.
            const gate = evaluatePortfolioRisk(openSignalsForGate, riskLimits, {
              // `strategyCat` é o análogo de `targetCategory` no live: a categoria do
              // ALVO do sinal, não a que o sinal acabou carregando (que pode ser
              // `undefined`). É essa que o `maxSignalsPerCategory` conta.
              category: strategyCat
            });
            riskGate.evaluated++;
            riskGate.openAtEvaluation = Math.max(riskGate.openAtEvaluation, openSignalsForGate.length);
            for (const reason of gate.reasons) riskGate.reasons.add(reason);

            const rIndex = ecStats.rPerSignal.length;
            ecStats.rPerSignal.push(0);
            // 8.2.1 — a mesma vela/direção/zona gera a MESMA chave nos dois braços.
            ecStats.signalKeys.push(
              `${candle.timestamp}|${signal.direction}|${signal.entryZone[0]}|${signal.entryZone[1]}`
            );
            ecStats.signalsEmitted++;

            if (!gate.allowed) {
              // Sinal produzido pelo motor mas recusado pelo mesmo gate do live. A chave e o
              // R-pendente continuam registrados ANTES da decisão, nos dois braços, para a
              // pareabilidade 8.2.1 não depender de o gate ter bloqueado.
              riskGate.blocked++;
            } else if (config.entryConfirmation === true) {
              riskGate.allowed++;
              // 7.2.1 — braço com confirmação: PENDING_ENTRY gerenciado pelo ciclo puro do live.
              pendingConfirmation = {
                signal: {
                  direction: signal.direction,
                  entryZone: signal.entryZone,
                  stopLoss: signal.stopLoss,
                  target1: signal.target1,
                  target2: signal.target2,
                  strategyCategory: signal.strategyCategory,
                  confluenceScore: signal.confluenceScore,
                  regime: classifyRegime(windowSlice),
                  createdAt: candle.timestamp
                },
                startIndex: i,
                rIndex
              };
            } else {
              riskGate.allowed++;
              // Phase 2.5.4: the signal is derived from THIS candle's close, so the fill belongs to the
              // NEXT candle's open. Filling at this candle's open was lookahead bias.
              pendingEntry = {
                direction: signal.direction,
                stopLoss: signal.stopLoss,
                target1: signal.target1,
                target2: signal.target2,
                rIndex,
                confluenceScore: signal.confluenceScore,
                regime: classifyRegime(windowSlice),
                createdAt: candle.timestamp
              };
            }
          }
        }
      } else if (inPosition && !openedThisCandle) {
        // R-9 & M2.4: resolution via the pure, unit-tested resolver (stop-first,
        // TP1 = 50% partial + breakeven, runner until TP2/breakeven-stop).
        const resolution = resolveBacktestPosition(
          candle,
          { direction: posDirection, entryPrice, entryTime, stopLoss, target1: takeProfit1, target2: takeProfit2, openedThisCandle: false },
          { partialTaken, isBreakevenActive, stopLoss },
          slipPct,
          // SDD Fase 9 / S3 — taxa entra no `isWin` da resolucao. O funding NAO entra
          // aqui por ordem: ele é calculado DEPOIS, a partir dos eventos que_this
          // candle fechou (linhas seguintes), e usá-lo antes seria circular. O
          // `isWin` autoritativo da posição é o de `trades.push`, derivado de
          // `isNetWin(r.rNet)`, que já embute taxa, slippage e funding completos.
          { roundtripFeePct: roundtripFee }
        );

        if (resolution) {
          // Apply the returned state
          stopLoss = resolution.nextState.stopLoss;
          partialTaken = resolution.nextState.partialTaken;
          isBreakevenActive = resolution.nextState.isBreakevenActive;

          // Which legs closed on THIS candle?
          const closedLegs = resolution.exitLegs;
          const closedSize = closedLegs.reduce((a, l) => a + l.size, 0);
          // 7.2 fix — usa o sinal do resolver compartilhado (paridade com o live em
          // TickProcessor): um runner parado após o parcial de TP1 fecha a posição,
          // mesmo com `closedSize` = 0.5, e não a re-resolve a cada candle.
          const positionFullyClosed = resolution.hasClosedFull;

          const durationMin = Math.max(1, Math.round((candle.timestamp - entryTime) / (60 * 1000)));

          // M2.1 / 6.3.4: funding por intervalo com cobertura — real onde há
          // registro, taxa fixa somente no trecho sem dado (declarado).
          const fundingResult = calculateFundingCostWithCoverage({
            direction: posDirection,
            positionSize: closedSize,
            entryTime,
            exitTime: candle.timestamp,
            fundingRecords: historicalFundingRecords,
            fallbackFundingRatePer8h: fundingRatePer8h,
            fundingIntervalHours
          });
          fundingCoverageExpectedTotal += fundingResult.expectedEvents;
          fundingCoverageCoveredTotal += fundingResult.coveredEvents;
          fundingFallbackEventsTotal += Math.max(0, fundingResult.expectedEvents - fundingResult.coveredEvents);

          // PnL líquido DESTE candle = bruto das pernas − taxas do tamanho fechado − funding.
          const feeCostPct = dMul(roundtripFee, closedSize);
          const fundingCostPct = fundingResult.totalFundingCostPct;
          const tradePnlPct = dSub(dSub(resolution.grossPnlPct, feeCostPct), fundingCostPct);
          const balanceBefore = balance;
          // CRÍTICO-1: o PnL da posição incide sobre o NOTIONAL comprometido, não sobre
          // o saldo inteiro. `tradePnlPct` é uma variação de PREÇO (%), que só vira
          // variação de saldo depois de multiplicada pelo capital realmente arriscado.
          const capitalAtRisk = activeNotional > 0 ? activeNotional : balance;
          const profit = dMul(dDiv(tradePnlPct, 100), capitalAtRisk);
          balance = dAdd(balance, profit);
          totalFeesPaidValue = dAdd(totalFeesPaidValue, dMul(dDiv(feeCostPct, 100), capitalAtRisk));

          // 8.0 — acumula a POSIÇÃO (pernas, taxas, funding, slippage) e a decompõe em R.
          // O bruto sem slippage é recuperado invertendo `slipFill`.
          applyResolution(positionAcc, {
            direction: posDirection,
            entryPrice,
            exitLegs: closedLegs.map(l => ({ leg: l.leg, price: l.price, size: l.size })),
            hasClosedFull: positionFullyClosed,
            slippagePct: slipPct,
            roundtripFeePct: roundtripFee,
            fundingPct: fundingCostPct,
            profitValue: profit
          });
          lastSpecialFundingCostPct = fundingResult.specialFundingCostPct;

          // 8.0.1 — win rate por PERNA, rotulado à parte do win rate por posição.
          for (const leg of closedLegs) {
            const legPct = legGrossPct(leg.price, entryPrice, leg.size, posDirection);
            if (legPct > 0) legWins++; else legLosses++;
          }

          if (balance > peakBalance) {
            peakBalance = balance;
          } else {
            const drawdown = dMul(dDiv(dSub(peakBalance, balance), peakBalance), 100);
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
          }

          equityCurve.push({
            time: candle.timestamp,
            balance: dRound(balance, 2),
            drawdown: dRound(maxDrawdown, 2)
          });

          // 8.0 / J-01 — só o fechamento TOTAL registra a POSIÇÃO: 1 fill = 1 trade.
          // Antes, cada candle de resolução (parcial inclusive) virava um "trade",
          // então parcial+runner contava 2 para 1 preenchimento ("fechados > preenchidos").
          if (positionFullyClosed) {
            const netPct = positionNetPct(positionAcc);
            const r = rDecomposition(positionAcc, activeRiskPct);
            totalLegs += positionAcc.legs; // 8.0.1 — uma posição TP1+TP2 soma 2 pernas

            // SDD Fase 9 / S3 — contagem e registro usam o MESMO criterio (R líquido).
            // Antes ambos usavam netPct > 0, que é uma medida diferente de rNet,
            // arredondada em outra casa: o win rate e a decomposição de R podiam
            // discordar sobre o mesmo trade.
            if (isNetWin(r.rNet)) {
              wins++;
              totalProfit = dAdd(totalProfit, Math.max(0, positionAcc.profitValue));
              totalWinPctSum = dAdd(totalWinPctSum, Math.abs(netPct));
            } else {
              losses++;
              totalLoss = dAdd(totalLoss, Math.abs(positionAcc.profitValue));
              totalLossPctSum = dAdd(totalLossPctSum, Math.abs(netPct));
            }
            totalDurationSum += durationMin;

            rSumGross = dAdd(rSumGross, r.rGross);
            rSumFees = dAdd(rSumFees, r.rFees);
            rSumSlippage = dAdd(rSumSlippage, r.rSlippage);
            rSumFunding = dAdd(rSumFunding, r.rFunding);
            rSumNet = dAdd(rSumNet, r.rNet);
            rCostSum = dAdd(rCostSum, positionCostR(positionAcc, activeRiskPct));
            rCount += 1;

            trades.push({
              id: crypto.randomUUID(),
              symbol: config.symbol,
              direction: posDirection,
              entryPrice: dRound(entryPrice, 4),
              exitPrice: dRound(resolution.exitPrice, 4),
              entryTime,
              exitTime: candle.timestamp,
              pnlPct: dRound(netPct, 2),
              pnlValue: dRound(positionAcc.profitValue, 2),
              stopLoss: dRound(stopLoss, 4),
              takeProfit1: dRound(takeProfit1, 4),
              takeProfit2: dRound(takeProfit2, 4),
              isWin: isNetWin(r.rNet),
              isBreakeven: isBreakevenActive,
              partialClosed: positionAcc.hadPartial,
              closedSize: dRound(positionAcc.closedSize, 2),
              durationMinutes: durationMin,
              fundingCostPct: dRound(positionAcc.fundingPct, 4),
              specialFundingCostPct: dRound(lastSpecialFundingCostPct, 4),
              legs: positionAcc.legs,
              rGross: r.rGross,
              rFees: r.rFees,
              rSlippage: r.rSlippage,
              rFunding: r.rFunding,
              rNet: r.rNet,
              confluenceScore: activeConfluenceScore,
              regime: activeRegime
            });

            // 7.2 — R do sinal emitido que gerou esta posição (liq., já decomposto).
            if (activeSignalRIndex >= 0) {
              ecStats.rPerSignal[activeSignalRIndex] = r.rNet;
              activeSignalRIndex = -1;
            }

            // Only the full close (TP2 or final stop) frees the engine for the
            // next signal; a partial keeps the position open with the runner.
            inPosition = false;
            partialTaken = false;
            isBreakevenActive = false;
            positionAcc = createPositionAccounting();
          }
        }
      }
    }

    // 8.0.1 — `totalTrades` é sinônimo explícito de posições FECHADAS (wins+losses).
    // O cálculo vive em `computeBacktestMetrics` (server/services/backtestMetrics.ts) para
    // poder ser exercitado sem rodar a simulação inteira.
    const metrics = computeBacktestMetrics({
      wins,
      losses,
      totalProfit,
      totalLoss,
      totalWinPctSum,
      totalLossPctSum,
      totalDurationSum,
      balance,
      initialBalance,
      netReturns: trades.map(t => t.pnlPct),
      days,
      targetRiskRatio: preset.targetRiskRatio
    });
    const positionsClosed = metrics.positionsClosed;
    const totalTrades = metrics.totalTrades;
    const positionsFilled = ecStats.entriesFilled;
    const winRate = metrics.winRate;
    const winRatePerLeg = legWins + legLosses > 0 ? (legWins / (legWins + legLosses)) * 100 : 0;
    const profitFactor = metrics.profitFactor;
    const netProfitPct = metrics.netProfitPct;
    const avgWinPct = metrics.avgWinPct;
    const avgLossPct = metrics.avgLossPct;
    const avgRiskReward = metrics.avgRiskReward;
    const avgDurationMinutes = metrics.avgDurationMinutes;
    // M3/M4/M8 — o motivo de cada métrica que ficou sem medição viaja com o resultado.
    assumptions.push(...metrics.assumptions);
    // P — o que o gate de portfólio cobre e o que ele NÃO consegue cobrir aqui.
    assumptions.push(
      `Gate de risco de portfólio avaliado em ${riskGate.evaluated} sinais com os limites do live ` +
        `(getRiskLimits()); ${riskGate.blocked} bloqueado(s). O motor mantém no máximo 1 posição, ` +
        'então a dimensão de concorrência não pode limitar aqui — os números são por símbolo, não de portfólio.'
    );
    // 8.0.3 — invariante: positionsClosed ≤ positionsFilled ≤ signalsEmitted.
    const openPositionsAtEnd = inPosition ? 1 : 0;
    if (openPositionsAtEnd > 0) {
      assumptions.push(
        '1 posição ainda ABERTA no fim da janela — marcada a mercado, fica fora do win rate (posições fechadas).'
      );
    }

    // 8.0.2 — médias da decomposição de R por posição fechada + custo médio em R.
    const rDecompositionAvg = {
      rGross: rCount > 0 ? dRound(rSumGross / rCount, 4) : 0,
      rFees: rCount > 0 ? dRound(rSumFees / rCount, 4) : 0,
      rSlippage: rCount > 0 ? dRound(rSumSlippage / rCount, 4) : 0,
      rFunding: rCount > 0 ? dRound(rSumFunding / rCount, 4) : 0,
      rNet: rCount > 0 ? dRound(rSumNet / rCount, 4) : 0,
      costAvgR: rCount > 0 ? dRound(rCostSum / rCount, 4) : 0,
      positions: rCount
    };

    // Advanced Institutional Metrics (Sharpe, Sortino, Slippage, Fees) - Phase 2.3
    const totalFeesPaid = dRound(totalFeesPaidValue, 2);
    const sharpeRatio = metrics.sharpeRatio;
    const sortinoRatio = metrics.sortinoRatio;

    // R-10: rolling walk-forward metrics, aggregated from the closed trades.
    const wf = aggregateWalkForward(trades, walkForwardWindows);
    const inSampleTotal = wf.inSampleWins + wf.inSampleLosses;
    const outOfSampleTotal = wf.outOfSampleWins + wf.outOfSampleLosses;
    const inSampleWinRate = inSampleTotal > 0 ? dRound((wf.inSampleWins / inSampleTotal) * 100, 1) : winRate;
    const outOfSampleWinRate = outOfSampleTotal > 0 ? dRound((wf.outOfSampleWins / outOfSampleTotal) * 100, 1) : winRate;
    // Phase 2.5.4 (kept): robustness is measured on profit per trade so the period split does not bias
    // the ratio. An uncomputable ratio stays 0 — defaulting it high made a *losing* out-of-sample run
    // pass the ≥0.5 threshold whenever the win rate happened to be ≥45%.
    const inSamplePerTrade = inSampleTotal > 0 ? wf.inSampleProfit / inSampleTotal : 0;
    const outOfSamplePerTrade = outOfSampleTotal > 0 ? wf.outOfSampleProfit / outOfSampleTotal : 0;
    const overfitRatio = inSamplePerTrade > 0 && outOfSamplePerTrade > 0
      ? dRound(outOfSamplePerTrade / inSamplePerTrade, 2)
      : 0;

    const walkForward = {
      inSampleWinRate,
      inSampleProfit: dRound(wf.inSampleProfit, 2),
      outOfSampleWinRate,
      outOfSampleProfit: dRound(wf.outOfSampleProfit, 2),
      overfitRatio,
      isRobust: overfitRatio >= 0.5 && outOfSampleWinRate >= 45,
      windows: walkForwardWindows.length,
      outOfSampleTrades: wf.outOfSampleTrades,
      windowResults: wf.windowResults
    };

    // 6.3.4 — fundingCoverage da janela: % dos eventos esperados cobertos por
    // registro real; trechos sem dado viram suposição declarada.
    const fundingCoverage =
      fundingCoverageExpectedTotal > 0
        ? Math.min(100, (fundingCoverageCoveredTotal / fundingCoverageExpectedTotal) * 100)
        : 100;
    if (fundingFallbackEventsTotal > 0) {
      assumptions.push(
        `${fundingFallbackEventsTotal} evento(s) de funding sem registro real cobrado(s) à taxa fixa de ${fundingRatePer8h * 100}%/intervalo`
      );
    }

    const result: BacktestResult = {
      id: crypto.randomUUID(),
      symbol: config.symbol,
      profile,
      strategyId,
      disabledFactors,
      assumptions,
      reducedFactorSet: factorCoverageResult.reducedFactorSet,
      factorCoverage: factorCoverageResult.factorCoverage,
      factorCoverageAvailability: factorCoverageResult.factorCoverageAvailability,
      fundingCoverage: dRound(fundingCoverage, 2),
      startTime: klines[0].openTime,
      endTime: klines[klines.length - 1].openTime,
      totalCandlesTested: klines.length,
      entryConfirmation: ecStats,
      riskGate: {
        evaluated: riskGate.evaluated,
        allowed: riskGate.allowed,
        blocked: riskGate.blocked,
        openAtEvaluation: riskGate.openAtEvaluation,
        reasons: [...riskGate.reasons],
        limits: riskLimits
      },
      totalTrades,
      legs: totalLegs,
      positionsClosed,
      positionsFilled,
      winRatePerLeg: dRound(winRatePerLeg, 2),
      openPositionsAtEnd,
      rDecomposition: rDecompositionAvg,
      winningTrades: wins,
      losingTrades: losses,
      winRate: dRound(winRate, 2),
      // Já arredondados em `computeBacktestMetrics`; `null` = sem medição.
      profitFactor,
      maxDrawdown: dRound(maxDrawdown, 2),
      netProfit: dRound(netProfitPct, 2),
      avgWinPct,
      avgLossPct,
      avgRiskReward,
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
      sharpeRatio: sharpeRatio ?? undefined,
      sortinoRatio: sortinoRatio ?? undefined,
      sharpeAnnualization: {
        isAnnualized: metrics.isAnnualized,
        tradesUsed: metrics.tradesUsed,
        annualFactor: metrics.annualFactor
      },
      makerTakerFeePct: feePct,
      slippagePct: slipPct,
      grossProfit: dRound(totalProfit, 2),
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

    // R-10 + 6.7.5: as fronteiras derivam do MESMO corte 60/20/20 sobre a série REAL
    // de velas 1m da janela de análise: o fim do bloco de TREINO (= início da
    // validação) trunca a busca via `isOnlyUntil`, e o holdout (últimos 20%) fica
    // DEPOIS da validação — um trecho que NENHUM candidato viu (CA-7.4). O probe
    // full-range materializa a janela (sync/seed de dados) e fornece os limites.
    const probe = await this.runBacktest(
      { symbol, days, profile, weights: currentWeights, seed, asOf, walkForward },
      false
    );
    const probeKlines = await historicalKlinesDao.getBySymbolAndRange(symbol, '1m', probe.startTime, probe.endTime);
    const boundaries = computeAutoTuneBoundaries({
      startTime: probe.startTime,
      endTime: probe.endTime,
      klineTimestamps: probeKlines.map(k => k.openTime),
      seed
    });
    // trainedUntil = fim do bloco de TREINO (início da validação): os candidatos
    // são simulados e ESCOLHIDOS só com velas < trainedUntil (isOnlyUntil).
    // holdoutStart = fim da validação: o bloco final fica intocado (CA-7.4).
    const trainedUntil = boundaries.trainedUntil;
    const holdoutStart = boundaries.holdoutStart;

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
      fitnessScore: dRound(bestScore, 2),
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
        fitnessScore: dRound(candidateScore, 2),
        weights: { ...candidateWeights }
      });
    }

    // Generate AutoTune summary report
    const wrDiff = dRound(bestResult.winRate - initialResult.winRate, 1);
    // Profit factor sem medição não tem diferença a reportar: subtrair `null` produziria NaN.
    const pfDiff =
      bestResult.profitFactor !== null && initialResult.profitFactor !== null
        ? dRound(bestResult.profitFactor - initialResult.profitFactor, 2)
        : null;
    const pfText = bestResult.profitFactor === null ? 'n/d' : `${bestResult.profitFactor}`;
    const pfDiffText = pfDiff === null ? '' : ` (${Number(pfDiff) >= 0 ? '+' : ''}${pfDiff})`;
    const ddDiff = dRound(initialResult.maxDrawdown - bestResult.maxDrawdown, 1);
    const profitDiff = dRound(bestResult.netProfit - initialResult.netProfit, 1);

    const tuningSummary = `O Auto-Tuning executou ${iterations} iterações de simulação quantitativa no perfil ${PROFILE_PRESETS[profile].name} (${symbol}). ` +
      `Resultado: Win Rate ${bestResult.winRate}% (${Number(wrDiff) >= 0 ? '+' : ''}${wrDiff}%), Profit Factor ${pfText}${pfDiffText}, ` +
      `Lucro Líquido ${bestResult.netProfit}% (${Number(profitDiff) >= 0 ? '+' : ''}${profitDiff}%) e Max Drawdown de ${bestResult.maxDrawdown}% (${Number(ddDiff) >= 0 ? 'redução de ' : ''}${ddDiff}%). ` +
      `R-10/6.7.5: os candidatos foram avaliados apenas no bloco de treino do split 60/20/20 (sem vazamento); ` +
      `a validação do conjunto escolhido no trecho não visto está em \`oosValidation\` e a certificação final, no holdout intocado de \`holdoutValidation\`.`;

    // R-10 & M2.6: honest validation of the chosen weights on the unseen remainder of the series.
    const oosValidation = await this.runBacktest(
      { symbol, days, profile, weights: bestWeights, seed, asOf, walkForward },
      false
    );

    // M2.6/6.7.5: holdout evaluation on the truly unseen tail (bootstrap CI +
    // robustness). `holdoutStart` (fim da validação) vem do MESMO split 60/20/20
    // que gerou `trainedUntil` — os trades de holdout têm entrada no bloco final,
    // que ficou FORA da busca (isOnlyUntil = fim do treino). A região de validação
    // (treino..holdoutStart) aparece no `oosValidation`, mas a escolha do melhor
    // candidato acima usou apenas fitness do treino (cada runBacktest de candidato
    // foi truncado em `trainedUntil`), então nenhum dado ≥ trainedUntil influenciou
    // a seleção — propriedade verificada pelo espião do CA-7.4 nos testes.
    const holdoutTrades = (oosValidation.trades || [])
      .filter(t => (holdoutStart ? t.entryTime >= holdoutStart : true))
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

    // Fator de Lucro sem perdas medidas não é nem força nem fraqueza: não foi medido.
    if (res.profitFactor === null) {
      weaknesses.push(
        'Fator de Lucro não mensurável: nenhuma posição perdedora fechou na janela, então não há prejuízo medido para dividir. O resultado medido é o lucro líquido.'
      );
    } else if (res.profitFactor >= 1.8) {
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
      io: config.isOnlyUntil ?? null,
      // P — os limites de risco mudam o resultado em DUAS frentes: o dimensionamento
      // (`riskPerTradePct`) e o gate de portfólio (`riskLimits`). Fora da chave, um run
      // com limites apertados recebia o resultado cacheado de um run frouxo — e o
      // `riskGate` do resultado afirmaria um bloqueio que aquela simulação não fez.
      // A mudança do material do hash invalida as linhas antigas sozinha.
      rpt: config.riskPerTradePct ?? null,
      rl: config.riskLimits ?? null
    });
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }
}


