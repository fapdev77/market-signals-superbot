import type { TickerData, LongShortRatioData, TradeSignal } from '../../src/types.js';

/**
 * TickProcessor (Phase 2.5.1)
 *
 * Extracted from the `runMarketTick` loop in `server.ts` so the data-assembly and position-management
 * decisions can be unit tested without a live exchange, a database, or a running server.
 *
 * Two integrity bugs lived in that loop:
 *  1. When a symbol was missing from the live ticker response, the raw ticker was rebuilt from the
 *     in-memory cache **without `updatedAt`**. `processTickerState` then stamped `Date.now()`, so the
 *     DataGate saw a zero-millisecond-old quote and a stale price could generate signals and resolve
 *     stops. `resolveRawTicker` now carries the cached timestamp and marks the quote STALE.
 *  2. `fetchOpenInterest`/`fetchFundingRate`/`fetchLongShortRatio` each report their own health, but
 *     the loop ignored it and coerced missing values to `0`, which the scorer read as a real neutral
 *     reading. `resolveMarketInputs` now reports availability explicitly.
 */

export type QuoteSource = 'WS' | 'REST' | 'STALE';

export interface RawTickerLike {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  updatedAt?: number;
  source?: QuoteSource;
}

export interface ResolvedRawTicker {
  raw: RawTickerLike;
  /** True when the quote is a reconstruction of a previous tick rather than a live exchange quote. */
  stale: boolean;
}

/**
 * Picks the raw ticker for a symbol, falling back to the in-memory cache when the exchange omitted it.
 * The fallback preserves the original `updatedAt` and is tagged STALE so downstream gates reject it
 * instead of treating a frozen price as fresh.
 */
export function resolveRawTicker(
  symbol: string,
  rawFromApi: RawTickerLike | undefined | null,
  cached: TickerData | undefined
): ResolvedRawTicker | null {
  if (rawFromApi) {
    return { raw: rawFromApi, stale: false };
  }

  if (!cached) {
    return null;
  }

  return {
    stale: true,
    raw: {
      symbol,
      lastPrice: String(cached.price),
      priceChangePercent: String(cached.priceChangePercent24h),
      highPrice: String(cached.high24h),
      lowPrice: String(cached.low24h),
      volume: String(cached.volume24h),
      quoteVolume: String(cached.quoteVolume24h),
      updatedAt: cached.updatedAt,
      source: 'STALE'
    }
  };
}

export interface OpenInterestInput {
  openInterest: number;
  isDegraded?: boolean;
  source?: string;
  change24h?: number;
  change1h?: number;
}

export interface FundingInput {
  fundingRate: number;
  fundingIntervalHours: number;
  isDegraded?: boolean;
  source?: string;
}

export interface MarketInputs {
  openInterest: number;
  fundingRate: number;
  fundingIntervalHours: number;
  realOiChange: { change24h?: number; change1h?: number };
  longShortData: LongShortRatioData | undefined;
  availability: { openInterest: boolean; funding: boolean; longShort: boolean };
}

/**
 * Resolves the derived market inputs for a tick and records, per factor, whether its upstream feed was
 * actually available. Unavailable factors fall back to the last known cache value for display, but are
 * reported as unavailable so the scorer excludes them instead of reading `0` as a real measurement.
 */
export function resolveMarketInputs(params: {
  cached?: TickerData;
  oiData?: OpenInterestInput | null;
  fundingData?: FundingInput | null;
  longShortData?: LongShortRatioData | null;
  defaultFundingIntervalHours?: number;
}): MarketInputs {
  const { cached, oiData, fundingData, longShortData } = params;
  const defaultInterval = params.defaultFundingIntervalHours ?? 8;

  const oiAvailable = Boolean(oiData && !oiData.isDegraded && oiData.openInterest > 0);
  const fundingAvailable = Boolean(fundingData && !fundingData.isDegraded);
  const longShortAvailable = Boolean(longShortData);

  return {
    openInterest: oiAvailable ? oiData!.openInterest : cached?.openInterest ?? 0,
    fundingRate: fundingAvailable ? fundingData!.fundingRate : cached?.fundingRate ?? 0,
    fundingIntervalHours:
      fundingData?.fundingIntervalHours || cached?.fundingIntervalHours || defaultInterval,
    // Only pass through change values when the OI feed itself was trustworthy.
    realOiChange: oiAvailable
      ? { change24h: oiData!.change24h, change1h: oiData!.change1h }
      : {},
    longShortData: longShortAvailable ? longShortData! : undefined,
    availability: {
      openInterest: oiAvailable,
      funding: fundingAvailable,
      longShort: longShortAvailable
    }
  };
}

export type PositionAction =
  | { type: 'HIT_TARGET2'; signalId: string; reason: string }
  | { type: 'STOPPED_OUT'; signalId: string; reason: string }
  | { type: 'UPDATE_SIGNAL'; signal: TradeSignal };

/**
 * The price range observed since the last tick (Phase 3.1).
 * Ticks arrive every few seconds and only see the last price, so a stop or target touched *between* two
 * ticks was invisible. Passing the forming candle's high/low makes the live evaluation match how the
 * backtest resolves a position (which already uses candle extremes).
 */
export interface CandleRange {
  high: number;
  low: number;
  /** Open time of the forming candle; used to ignore range that predates the position. */
  openTime?: number;
}

/**
 * Decides what to do with open signals for a symbol given the latest price and, optionally, the range of
 * the candle currently forming.
 *
 * Pure (apart from mutating the passed signal objects, matching the original behaviour) so it can be
 * asserted directly in tests. Callers remain responsible for persisting the returned actions.
 *
 * Stop is evaluated BEFORE targets, matching the backtest's stop-first rule. Without this, a candle that
 * touches both the stop and the target would be reported as a win, overstating live performance.
 */
export function evaluatePositionManagement(
  signals: TradeSignal[],
  price: number,
  range?: CandleRange
): PositionAction[] {
  const actions: PositionAction[] = [];

  for (const signal of signals) {
    let signalModified = false;

    // Ignore the candle range when the position was opened inside that same candle: the high/low would
    // include price action from before the entry.
    const rangeApplies =
      range !== undefined &&
      (range.openTime === undefined || (signal.createdAt ?? 0) <= range.openTime);

    const high = rangeApplies ? range!.high : price;
    const low = rangeApplies ? range!.low : price;

    if (signal.direction === 'LONG') {
      if (low <= signal.stopLoss) {
        // Stop first: if the candle touched both, assume the adverse move happened.
        actions.push({
          type: 'STOPPED_OUT',
          signalId: signal.id,
          reason: signal.isBreakevenActive ? 'Saída no Breakeven (Risco Zero)' : 'Stop Loss Atingido'
        });
        continue;
      }

      // Target 1 reached -> activate breakeven (stop moves to entry)
      if (!signal.isBreakevenActive && high >= signal.target1) {
        signal.isBreakevenActive = true;
        signal.stopLoss = signal.entryZone[0];
        signalModified = true;
      }

      if (high >= signal.target2) {
        actions.push({ type: 'HIT_TARGET2', signalId: signal.id, reason: 'Alvo 2 atingido (+100% expansão de lucro)' });
      } else if (signalModified) {
        actions.push({ type: 'UPDATE_SIGNAL', signal });
      }
    } else if (signal.direction === 'SHORT') {
      if (high >= signal.stopLoss) {
        actions.push({
          type: 'STOPPED_OUT',
          signalId: signal.id,
          reason: signal.isBreakevenActive ? 'Saída no Breakeven (Risco Zero)' : 'Stop Loss Atingido'
        });
        continue;
      }

      // Target 1 reached -> activate breakeven (stop moves to entry)
      if (!signal.isBreakevenActive && low <= signal.target1) {
        signal.isBreakevenActive = true;
        signal.stopLoss = signal.entryZone[1];
        signalModified = true;
      }

      if (low <= signal.target2) {
        actions.push({ type: 'HIT_TARGET2', signalId: signal.id, reason: 'Alvo 2 atingido (+100% expansão de lucro)' });
      } else if (signalModified) {
        actions.push({ type: 'UPDATE_SIGNAL', signal });
      }
    }
  }

  return actions;
}
