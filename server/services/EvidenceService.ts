/**
 * EvidenceService (M3 - Phase 5)
 *
 * Implements server-authoritative evidence ledger, R calculation,
 * statistical summaries with Wilson score intervals, and pre-registered
 * Go/No-Go criteria evaluation.
 */

import { dAdd, dSub, dMul, dDiv, dRound } from '../utils/decimal.js';

export interface LedgerSignalParams {
  id: string;
  symbol: string;
  category: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  score: number;
  factors?: Record<string, any>;
  unavailableFactors?: string[];
  origin: 'LIVE' | 'DEMO';
  dataSource?: string;
  /** Tipo de sessão TradFi calculado no sinal (REGULAR/PRE_MARKET/AFTER_MARKET/...). */
  tradfiSession?: string;
  /** 6.2.2 — categoria TradFi do ativo (coluna própria, distinta da sessão). */
  tradfiCategory?: string;
  /** 6.2.6 — contexto de reprodutibilidade gravado por emissão. */
  engineVersion?: string;
  weightsHash?: string;
  strategyProfile?: string;
  createdAt?: number;
}

export interface LedgerEventRecord {
  id?: number;
  signalId?: string;
  eventType: 'ENTRY' | 'PARTIAL' | 'BREAKEVEN' | 'TARGET2' | 'STOP' | 'EXPIRED';
  price: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SignalOutcomeResult {
  isClosed: boolean;
  outcomeType: 'TP1' | 'TP2' | 'BREAKEVEN' | 'STOP' | 'EXPIRED' | 'ACTIVE';
  grossR: number;
  netR: number;
  costsR: number;
  realizedPnlPct?: number;
}

export interface CandleRangeRecord {
  high: number;
  low: number;
}

export interface MfeMaeResult {
  mfeR: number;
  maeR: number;
}

export interface ClosedSignalEvidence {
  id: string;
  symbol: string;
  category: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  scoreTier: string;
  tradfiSession?: string;
  origin: 'LIVE' | 'DEMO';
  netR: number;
  mfeR: number;
  maeR: number;
  isWin: boolean;
  closedAt: number;
  /** 6.2.5 — desfecho terminal do sinal (para denominador completo). */
  outcomeType?: SignalOutcomeResult['outcomeType'];
  /** 6.2.5 — motivo da expiração (quando outcomeType === 'EXPIRED'). */
  expiredReason?: string;
}

export interface EvidenceGroupMetrics {
  n: number;
  wins: number;
  losses: number;
  winRate: number;
  wilsonInterval: [number, number];
  rExpectancy: number;
  avgMfe: number;
  avgMae: number;
  cumulativeR: number;
  maxDrawdownR: number;
}

export interface EvidenceSummary {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  wilsonInterval: [number, number];
  rExpectancy: number;
  avgMfe: number;
  avgMae: number;
  maxDrawdownR: number;
  byScoreTier: Record<string, EvidenceGroupMetrics>;
  byCategory: Record<string, EvidenceGroupMetrics>;
  byTradFiSession: Record<string, EvidenceGroupMetrics>;
  /** 6.2.5 — quantidade de sinais fechados por expiração. */
  expiredCount: number;
  /** 6.2.5 — fração do denominador fechado por expiração (0..1). */
  expiredShare: number;
  /** 6.2.5 — expirados quebrados por motivo (TTL/STRATEGY_RESET/MANUAL_RESET). */
  expiredByReason: Record<string, number>;
}

export interface ScoreTierSetting {
  tier: string;
  n: number;
  netExpectancyR: number;
  enabled: boolean;
}

export interface GoNoGoInput {
  closedSignalsCount: number;
  calendarDays: number;
  netExpectancyR: number;
  bootstrapLower95R: number;
  maxDrawdownR: number;
  scoreTiers?: ScoreTierSetting[];
}

export interface GoNoGoResult {
  status: 'GO' | 'NO_GO';
  canClaimPerformance: boolean;
  reasons: string[];
  metrics: {
    closedSignalsCount: number;
    calendarDays: number;
    netExpectancyR: number;
    bootstrapLower95R: number;
    maxDrawdownR: number;
  };
}

/**
 * Calculates Gross and Net R multiple for a signal and its event sequence using exact decimal arithmetic.
 */
export function calculateSignalOutcomeR(
  signal: LedgerSignalParams,
  events: LedgerEventRecord[],
  options?: {
    feePct?: number;       // default 0.04% per order
    slippagePct?: number;  // default 0.02% roundtrip
  }
): SignalOutcomeResult {
  const isLong = signal.direction === 'LONG';
  const riskDistance = isLong
    ? dSub(signal.entryPrice, signal.stopLoss)
    : dSub(signal.stopLoss, signal.entryPrice);

  if (riskDistance <= 0) {
    throw new Error(`Invalid risk distance for signal ${signal.id}: entry=${signal.entryPrice}, stop=${signal.stopLoss}`);
  }

  // Fees and slippage assumptions aligned with backtest engine
  const feePctPerOrder = options?.feePct ?? 0.04;
  const slippagePct = options?.slippagePct ?? 0.02;
  const roundtripFeePct = dAdd(dMul(feePctPerOrder, 2), slippagePct); // e.g. 0.10%

  // 1 R in percentage of notional = riskDistance / entryPrice * 100
  const riskPctNotional = dDiv(dMul(riskDistance, 100), signal.entryPrice);
  // Cost in R = roundtripFeePct / riskPctNotional
  const costPerUnitR = dDiv(roundtripFeePct, riskPctNotional);

  let grossR = 0;
  let partialTaken = false;
  let isClosed = false;
  let outcomeType: 'TP1' | 'TP2' | 'BREAKEVEN' | 'STOP' | 'EXPIRED' | 'ACTIVE' = 'ACTIVE';

  for (const ev of events) {
    if (ev.eventType === 'PARTIAL') {
      partialTaken = true;
      const gain = isLong
        ? dSub(ev.price, signal.entryPrice)
        : dSub(signal.entryPrice, ev.price);
      const rPortion = dMul(dDiv(gain, riskDistance), 0.5);
      grossR = dAdd(grossR, rPortion);
      outcomeType = 'TP1';
    } else if (ev.eventType === 'TARGET2') {
      isClosed = true;
      outcomeType = 'TP2';
      const sizeClosed = partialTaken ? 0.5 : 1.0;
      const gain = isLong
        ? dSub(ev.price, signal.entryPrice)
        : dSub(signal.entryPrice, ev.price);
      const rPortion = dMul(dDiv(gain, riskDistance), sizeClosed);
      grossR = dAdd(grossR, rPortion);
    } else if (ev.eventType === 'BREAKEVEN') {
      outcomeType = 'BREAKEVEN';
    } else if (ev.eventType === 'STOP') {
      isClosed = true;
      const sizeClosed = partialTaken ? 0.5 : 1.0;
      const gain = isLong
        ? dSub(ev.price, signal.entryPrice)
        : dSub(signal.entryPrice, ev.price);
      const rPortion = dMul(dDiv(gain, riskDistance), sizeClosed);
      grossR = dAdd(grossR, rPortion);
      if (outcomeType !== 'BREAKEVEN') {
        outcomeType = 'STOP';
      }
    } else if (ev.eventType === 'EXPIRED') {
      isClosed = true;
      outcomeType = 'EXPIRED';
      const sizeClosed = partialTaken ? 0.5 : 1.0;
      const gain = isLong
        ? dSub(ev.price, signal.entryPrice)
        : dSub(signal.entryPrice, ev.price);
      const rPortion = dMul(dDiv(gain, riskDistance), sizeClosed);
      grossR = dAdd(grossR, rPortion);
    }
  }

  // Net R deducts trading cost in R
  const costsR = dRound(costPerUnitR, 4);
  const netR = dRound(dSub(grossR, costsR), 4);

  return {
    isClosed,
    outcomeType,
    grossR: dRound(grossR, 4),
    netR,
    costsR
  };
}

/**
 * Calculates MFE and MAE in R multiple from candle ranges while signal was open.
 */
export function calculateMfeMaeFromCandles(
  signal: LedgerSignalParams,
  candles: CandleRangeRecord[]
): MfeMaeResult {
  if (!candles || candles.length === 0) {
    return { mfeR: 0, maeR: 0 };
  }

  const isLong = signal.direction === 'LONG';
  const risk = isLong
    ? dSub(signal.entryPrice, signal.stopLoss)
    : dSub(signal.stopLoss, signal.entryPrice);

  if (risk <= 0) {
    return { mfeR: 0, maeR: 0 };
  }

  const maxHigh = Math.max(...candles.map(c => c.high));
  const minLow = Math.min(...candles.map(c => c.low));

  let mfePrice = 0;
  let maePrice = 0;

  if (isLong) {
    mfePrice = Math.max(0, dSub(maxHigh, signal.entryPrice));
    maePrice = Math.min(0, dSub(minLow, signal.entryPrice));
  } else {
    mfePrice = Math.max(0, dSub(signal.entryPrice, minLow));
    maePrice = Math.min(0, dSub(signal.entryPrice, maxHigh));
  }

  return {
    mfeR: dRound(dDiv(mfePrice, risk), 4),
    maeR: dRound(dDiv(maePrice, risk), 4)
  };
}

/**
 * Computes the Wilson score interval for a binomial proportion at the requested confidence level.
 */
export function calculateWilsonScoreInterval(
  wins: number,
  total: number,
  confidence: number = 0.95
): [number, number] {
  if (total <= 0) return [0, 0];

  // z-value for confidence (default 95% = 1.95996)
  const z = confidence === 0.99 ? 2.57583 : confidence === 0.90 ? 1.64485 : 1.95996398454;
  const p = wins / total;
  const zSq = z * z;

  const denominator = 1 + zSq / total;
  const center = (p + zSq / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + zSq / (4 * total * total));

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return [parseFloat(lower.toFixed(4)), parseFloat(upper.toFixed(4))];
}

/**
 * Aggregates closed signals into metrics group.
 */
function aggregateMetrics(signals: ClosedSignalEvidence[]): EvidenceGroupMetrics {
  const n = signals.length;
  if (n === 0) {
    return {
      n: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      wilsonInterval: [0, 0],
      rExpectancy: 0,
      avgMfe: 0,
      avgMae: 0,
      cumulativeR: 0,
      maxDrawdownR: 0
    };
  }

  let wins = 0;
  let totalNetR = 0;
  let totalMfe = 0;
  let totalMae = 0;

  let cumR = 0;
  let peakR = 0;
  let maxDd = 0;

  for (const s of signals) {
    if (s.isWin) wins++;
    totalNetR += s.netR;
    totalMfe += s.mfeR;
    totalMae += s.maeR;

    cumR += s.netR;
    if (cumR > peakR) peakR = cumR;
    const dd = peakR - cumR;
    if (dd > maxDd) maxDd = dd;
  }

  const losses = n - wins;
  const winRate = parseFloat(((wins / n) * 100).toFixed(2));
  const wilsonInterval = calculateWilsonScoreInterval(wins, n, 0.95);
  const rExpectancy = parseFloat((totalNetR / n).toFixed(4));
  const avgMfe = parseFloat((totalMfe / n).toFixed(4));
  const avgMae = parseFloat((totalMae / n).toFixed(4));

  return {
    n,
    wins,
    losses,
    winRate,
    wilsonInterval,
    rExpectancy,
    avgMfe,
    avgMae,
    cumulativeR: parseFloat(cumR.toFixed(4)),
    maxDrawdownR: parseFloat(maxDd.toFixed(4))
  };
}

/**
 * Generates structured evidence summary across score tiers, categories, and TradFi sessions.
 */
export function generateEvidenceSummary(
  signals: ClosedSignalEvidence[],
  options?: { origin?: 'LIVE' | 'DEMO' | 'ALL' }
): EvidenceSummary {
  const targetOrigin = options?.origin ?? 'LIVE';
  const filtered = targetOrigin === 'ALL'
    ? signals
    : signals.filter(s => s.origin === targetOrigin);

  const byScoreTier: Record<string, ClosedSignalEvidence[]> = {};
  const byCategory: Record<string, ClosedSignalEvidence[]> = {};
  const byTradFiSession: Record<string, ClosedSignalEvidence[]> = {};

  for (const s of filtered) {
    const tier = s.scoreTier || `${Math.floor(s.score / 10) * 10}-${Math.floor(s.score / 10) * 10 + 9}`;
    byScoreTier[tier] = byScoreTier[tier] || [];
    byScoreTier[tier].push(s);

    const cat = s.category || 'INTRADAY';
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(s);

    const sess = s.tradfiSession || 'OUT_OF_SESSION';
    byTradFiSession[sess] = byTradFiSession[sess] || [];
    byTradFiSession[sess].push(s);
  }

  const aggregatedByScoreTier: Record<string, EvidenceGroupMetrics> = {};
  for (const [key, list] of Object.entries(byScoreTier)) {
    aggregatedByScoreTier[key] = aggregateMetrics(list);
  }

  const aggregatedByCategory: Record<string, EvidenceGroupMetrics> = {};
  for (const [key, list] of Object.entries(byCategory)) {
    aggregatedByCategory[key] = aggregateMetrics(list);
  }

  const aggregatedByTradFiSession: Record<string, EvidenceGroupMetrics> = {};
  for (const [key, list] of Object.entries(byTradFiSession)) {
    aggregatedByTradFiSession[key] = aggregateMetrics(list);
  }

  const overall = aggregateMetrics(filtered);

  // 6.2.5 — denominador completo: expirados são contados, compartilhados e
  // quebrados por motivo (metadata do evento EXPIRED propagada na evidência).
  const expired = filtered.filter(s => s.outcomeType === 'EXPIRED');
  const expiredByReason: Record<string, number> = {};
  for (const s of expired) {
    const reason = s.expiredReason || 'UNKNOWN';
    expiredByReason[reason] = (expiredByReason[reason] || 0) + 1;
  }

  return {
    totalSignals: overall.n,
    wins: overall.wins,
    losses: overall.losses,
    winRate: overall.winRate,
    wilsonInterval: overall.wilsonInterval,
    rExpectancy: overall.rExpectancy,
    avgMfe: overall.avgMfe,
    avgMae: overall.avgMae,
    maxDrawdownR: overall.maxDrawdownR,
    byScoreTier: aggregatedByScoreTier,
    byCategory: aggregatedByCategory,
    byTradFiSession: aggregatedByTradFiSession,
    expiredCount: expired.length,
    expiredShare: overall.n > 0 ? expired.length / overall.n : 0,
    expiredByReason
  };
}

/**
 * Pure Go/No-Go decision function based on pre-registered institutional criteria (M3.4).
 */
export function evaluateGoNoGo(input: GoNoGoInput): GoNoGoResult {
  const reasons: string[] = [];

  // 1. Minimum 100 closed signals
  if (input.closedSignalsCount < 100) {
    reasons.push(
      `Amostra insuficiente: ${input.closedSignalsCount} sinais fechados (mínimo exigido: 100).`
    );
  }

  // 2. Minimum 60 calendar days
  if (input.calendarDays < 60) {
    reasons.push(
      `Período insuficiente: ${input.calendarDays} dias corridos (mínimo exigido: 60 dias).`
    );
  }

  // 3. Net expectancy >= +0.10 R
  if (input.netExpectancyR < 0.10) {
    reasons.push(
      `Expectativa líquida insuficiente: ${input.netExpectancyR.toFixed(3)} R (mínimo exigido: +0.10 R).`
    );
  }

  // 4. Lower bound of 95% bootstrap CI > 0
  if (input.bootstrapLower95R <= 0) {
    reasons.push(
      `Limite inferior do intervalo de confiança bootstrap de 95% (${input.bootstrapLower95R.toFixed(3)} R) não é estritamente positivo (> 0).`
    );
  }

  // 5. Maximum drawdown <= 15.0 R
  if (input.maxDrawdownR > 15.0) {
    reasons.push(
      `Drawdown máximo excedeu o limite estipulado: ${input.maxDrawdownR.toFixed(2)} R (limite máximo: 15.0 R).`
    );
  }

  // 6. No score tier with negative expectancy and n >= 30 remains enabled
  if (input.scoreTiers && input.scoreTiers.length > 0) {
    for (const tier of input.scoreTiers) {
      if (tier.n >= 30 && tier.netExpectancyR < 0 && tier.enabled) {
        reasons.push(
          `Faixa de score '${tier.tier}' possui expectativa negativa (${tier.netExpectancyR.toFixed(2)} R em ${tier.n} sinais) e permanece habilitada.`
        );
      }
    }
  }

  const passed = reasons.length === 0;

  return {
    status: passed ? 'GO' : 'NO_GO',
    canClaimPerformance: passed,
    reasons,
    metrics: {
      closedSignalsCount: input.closedSignalsCount,
      calendarDays: input.calendarDays,
      netExpectancyR: input.netExpectancyR,
      bootstrapLower95R: input.bootstrapLower95R,
      maxDrawdownR: input.maxDrawdownR
    }
  };
}
