import { TradeSignal, TickerData } from '../types';
import { formatPrice, formatPercent } from './formatters';

export interface ExecutedTrade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  marketType?: string;
  strategyCategory: string;
  timeframe: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  confluenceScore: number;
  confluenceFactors: string[];
  status: 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED' | 'ACTIVE';
  isWin: boolean;
  isBreakeven: boolean;
  pnlPct: number;
  pnlUsd: number; // based on reference position $1,000
  pnlR: number; // in R-multiples (e.g. +2.5R, -1.0R)
  entryTime: number;
  exitTime: number;
  durationMs: number;
  durationFormatted: string;
  expirationReason?: string;
  rawSignal: TradeSignal;
}

export interface CumulativePnLPoint {
  index: number;
  tradeId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  timestamp: number;
  dateFormatted: string;
  tradePnL: number;
  cumulativePnL: number;
  cumulativePnlUsd: number;
  cumulativeR: number;
  drawdownPct: number;
  isWin: boolean;
  isBreakeven: boolean;
}

export interface TradingInsightsSummary {
  totalTrades: number;
  closedTrades: number;
  activeTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // 0 to 100%
  winRateExcludingBreakeven: number;
  avgRiskRewardRatio: number;
  avgTradeDurationMs: number;
  avgTradeDurationFormatted: string;
  totalPnlPct: number;
  totalPnlUsd: number;
  avgPnlPerTradePct: number;
  avgPnlPerTradeUsd: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPct: number;
  peakCumulativePnlPct: number;
  bestTrade: { symbol: string; pnlPct: number; direction: 'LONG' | 'SHORT' } | null;
  worstTrade: { symbol: string; pnlPct: number; direction: 'LONG' | 'SHORT' } | null;
  longsCount: number;
  longsWinRate: number;
  shortsCount: number;
  shortsWinRate: number;
  byCategory: Record<string, { count: number; wins: number; winRate: number; pnlPct: number }>;
}

export function formatTradeDuration(ms: number): string {
  if (ms <= 0) return '< 1 min';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return '< 1 min';
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

export function signalToExecutedTrade(signal: TradeSignal, livePrice?: number): ExecutedTrade {
  const isLong = signal.direction === 'LONG';
  
  // Authoritative entry price
  const entryPrice = isLong
    ? (signal.entryZone?.[0] ?? signal.currentPrice)
    : (signal.entryZone?.[1] ?? signal.currentPrice);

  const entryTime = signal.createdAt || Date.now();
  let exitTime = signal.validatedAt || signal.createdAt || Date.now();
  
  let exitPrice = signal.currentPrice;
  let isWin = false;
  let isBreakeven = false;
  let pnlPct = 0;
  let pnlR = 0;
  const initialRisk = Math.abs(entryPrice - signal.stopLoss);

  if (signal.status === 'TARGET_REACHED') {
    // 50% at Target 1, 50% at Target 2
    exitPrice = signal.target2;
    exitTime = signal.expiresAt || (entryTime + 1000 * 60 * (signal.ttlMinutes ? Math.floor(signal.ttlMinutes * 0.75) : 90));
    isWin = true;

    if (isLong) {
      const pnl1 = (signal.target1 - entryPrice) / entryPrice;
      const pnl2 = (signal.target2 - entryPrice) / entryPrice;
      pnlPct = (0.5 * pnl1 + 0.5 * pnl2) * 100;
    } else {
      const pnl1 = (entryPrice - signal.target1) / entryPrice;
      const pnl2 = (entryPrice - signal.target2) / entryPrice;
      pnlPct = (0.5 * pnl1 + 0.5 * pnl2) * 100;
    }
    pnlR = signal.riskRewardRatio || 2.5;

  } else if (signal.status === 'STOPPED_OUT') {
    const isBe = signal.isBreakevenActive || signal.expirationReason?.toLowerCase().includes('breakeven');
    exitTime = signal.expiresAt || (entryTime + 1000 * 60 * (signal.ttlMinutes ? Math.floor(signal.ttlMinutes * 0.5) : 45));

    if (isBe) {
      isBreakeven = true;
      isWin = true; // Partial profit was taken at TP1
      exitPrice = entryPrice;
      
      if (isLong) {
        const pnl1 = (signal.target1 - entryPrice) / entryPrice;
        pnlPct = (0.5 * pnl1) * 100;
      } else {
        const pnl1 = (entryPrice - signal.target1) / entryPrice;
        pnlPct = (0.5 * pnl1) * 100;
      }
      pnlR = initialRisk > 0 ? (0.5 * Math.abs(signal.target1 - entryPrice)) / initialRisk : 0.75;
    } else {
      exitPrice = signal.stopLoss;
      isWin = false;
      
      if (isLong) {
        pnlPct = ((signal.stopLoss - entryPrice) / entryPrice) * 100;
      } else {
        pnlPct = ((entryPrice - signal.stopLoss) / entryPrice) * 100;
      }
      pnlR = -1.0;
    }

  } else if (signal.status === 'EXPIRED') {
    exitTime = signal.expiresAt || (entryTime + 1000 * 60 * (signal.ttlMinutes || 120));
    const isBe = signal.isBreakevenActive || signal.expirationReason?.toLowerCase().includes('breakeven');
    
    if (isBe) {
      isBreakeven = true;
      isWin = true;
      exitPrice = entryPrice;
      if (isLong) {
        pnlPct = (0.5 * ((signal.target1 - entryPrice) / entryPrice)) * 100;
      } else {
        pnlPct = (0.5 * ((entryPrice - signal.target1) / entryPrice)) * 100;
      }
      pnlR = 0.5;
    } else {
      exitPrice = livePrice || signal.currentPrice;
      if (isLong) {
        pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        pnlPct = ((entryPrice - exitPrice) / entryPrice) * 100;
      }
      isWin = pnlPct > 0;
      pnlR = initialRisk > 0 ? (pnlPct / 100 * entryPrice) / initialRisk : (pnlPct > 0 ? 0.5 : -0.5);
    }

  } else {
    // ACTIVE signal
    exitTime = Date.now();
    exitPrice = livePrice || signal.currentPrice;
    if (isLong) {
      pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else {
      pnlPct = ((entryPrice - exitPrice) / entryPrice) * 100;
    }
    isWin = pnlPct > 0;
    pnlR = initialRisk > 0 ? (pnlPct / 100 * entryPrice) / initialRisk : 0;
  }

  const durationMs = Math.max(0, exitTime - entryTime);
  const REFERENCE_CAPITAL = 1000;
  const pnlUsd = (pnlPct / 100) * REFERENCE_CAPITAL;

  return {
    id: signal.id,
    symbol: signal.symbol,
    direction: signal.direction,
    marketType: signal.marketType,
    strategyCategory: signal.strategyCategory || 'INTRADAY',
    timeframe: signal.timeframe || '15m',
    entryPrice,
    exitPrice,
    stopLoss: signal.stopLoss,
    target1: signal.target1,
    target2: signal.target2,
    riskRewardRatio: signal.riskRewardRatio || 2.0,
    confluenceScore: signal.confluenceScore || 0,
    confluenceFactors: signal.confluenceFactors || [],
    status: signal.status,
    isWin,
    isBreakeven,
    pnlPct: parseFloat(pnlPct.toFixed(2)),
    pnlUsd: parseFloat(pnlUsd.toFixed(2)),
    pnlR: parseFloat(pnlR.toFixed(2)),
    entryTime,
    exitTime,
    durationMs,
    durationFormatted: formatTradeDuration(durationMs),
    expirationReason: signal.expirationReason,
    rawSignal: signal
  };
}

export function filterTradesByTimeframe(
  trades: ExecutedTrade[],
  timeframe: 'today' | '7d' | '15d' | '30d' | 'all'
): ExecutedTrade[] {
  if (timeframe === 'all') return trades;

  const now = new Date();
  let cutoffTimestamp = 0;

  if (timeframe === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    cutoffTimestamp = startOfToday;
  } else if (timeframe === '7d') {
    cutoffTimestamp = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  } else if (timeframe === '15d') {
    cutoffTimestamp = now.getTime() - 15 * 24 * 60 * 60 * 1000;
  } else if (timeframe === '30d') {
    cutoffTimestamp = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }

  return trades.filter(t => t.entryTime >= cutoffTimestamp || t.exitTime >= cutoffTimestamp);
}

export function calculateCumulativePnLSeries(trades: ExecutedTrade[]): CumulativePnLPoint[] {
  // Sort trades chronologically by exitTime (or entryTime)
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);

  let cumulativePnL = 0;
  let cumulativePnlUsd = 0;
  let cumulativeR = 0;
  let peakPnL = 0;
  const points: CumulativePnLPoint[] = [];

  // Initial zero baseline
  if (sorted.length > 0) {
    const firstTradeTime = sorted[0].entryTime;
    points.push({
      index: 0,
      tradeId: 'start',
      symbol: 'BASE',
      direction: 'LONG',
      timestamp: firstTradeTime - 60000,
      dateFormatted: new Date(firstTradeTime - 60000).toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      tradePnL: 0,
      cumulativePnL: 0,
      cumulativePnlUsd: 0,
      cumulativeR: 0,
      drawdownPct: 0,
      isWin: false,
      isBreakeven: false
    });
  }

  sorted.forEach((trade, idx) => {
    cumulativePnL += trade.pnlPct;
    cumulativePnlUsd += trade.pnlUsd;
    cumulativeR += trade.pnlR;
    
    if (cumulativePnL > peakPnL) {
      peakPnL = cumulativePnL;
    }
    const drawdownPct = peakPnL > 0 ? Math.max(0, peakPnL - cumulativePnL) : 0;

    points.push({
      index: idx + 1,
      tradeId: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      timestamp: trade.exitTime,
      dateFormatted: new Date(trade.exitTime).toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      tradePnL: trade.pnlPct,
      cumulativePnL: parseFloat(cumulativePnL.toFixed(2)),
      cumulativePnlUsd: parseFloat(cumulativePnlUsd.toFixed(2)),
      cumulativeR: parseFloat(cumulativeR.toFixed(2)),
      drawdownPct: parseFloat(drawdownPct.toFixed(2)),
      isWin: trade.isWin,
      isBreakeven: trade.isBreakeven
    });
  });

  return points;
}

export function calculateTradingInsights(trades: ExecutedTrade[]): TradingInsightsSummary {
  const totalTrades = trades.length;
  const closedTradesList = trades.filter(t => t.status !== 'ACTIVE');
  const closedTrades = closedTradesList.length;
  const activeTrades = totalTrades - closedTrades;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      closedTrades: 0,
      activeTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      winRateExcludingBreakeven: 0,
      avgRiskRewardRatio: 0,
      avgTradeDurationMs: 0,
      avgTradeDurationFormatted: '0m',
      totalPnlPct: 0,
      totalPnlUsd: 0,
      avgPnlPerTradePct: 0,
      avgPnlPerTradeUsd: 0,
      expectancyR: 0,
      profitFactor: 0,
      maxDrawdownPct: 0,
      peakCumulativePnlPct: 0,
      bestTrade: null,
      worstTrade: null,
      longsCount: 0,
      longsWinRate: 0,
      shortsCount: 0,
      shortsWinRate: 0,
      byCategory: {}
    };
  }

  // Use closed trades for historical outcome metrics if available, fallback to all trades
  const targetList = closedTradesList.length > 0 ? closedTradesList : trades;

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalDurationMs = 0;
  let totalRR = 0;
  let totalPnlPct = 0;
  let totalPnlUsd = 0;
  let totalR = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  let bestTrade: { symbol: string; pnlPct: number; direction: 'LONG' | 'SHORT' } | null = null;
  let worstTrade: { symbol: string; pnlPct: number; direction: 'LONG' | 'SHORT' } | null = null;

  let longsCount = 0;
  let longsWins = 0;
  let shortsCount = 0;
  let shortsWins = 0;

  const byCategory: Record<string, { count: number; wins: number; winRate: number; pnlPct: number }> = {};

  targetList.forEach(t => {
    if (t.isBreakeven) {
      breakevens++;
      wins++;
    } else if (t.isWin) {
      wins++;
    } else {
      losses++;
    }

    if (t.direction === 'LONG') {
      longsCount++;
      if (t.isWin) longsWins++;
    } else {
      shortsCount++;
      if (t.isWin) shortsWins++;
    }

    const cat = t.strategyCategory || 'INTRADAY';
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, wins: 0, winRate: 0, pnlPct: 0 };
    }
    byCategory[cat].count++;
    if (t.isWin) byCategory[cat].wins++;
    byCategory[cat].pnlPct += t.pnlPct;

    totalDurationMs += t.durationMs;
    totalRR += t.riskRewardRatio;
    totalPnlPct += t.pnlPct;
    totalPnlUsd += t.pnlUsd;
    totalR += t.pnlR;

    if (t.pnlPct > 0) {
      grossProfit += t.pnlPct;
    } else {
      grossLoss += Math.abs(t.pnlPct);
    }

    if (!bestTrade || t.pnlPct > bestTrade.pnlPct) {
      bestTrade = { symbol: t.symbol, pnlPct: t.pnlPct, direction: t.direction };
    }
    if (!worstTrade || t.pnlPct < worstTrade.pnlPct) {
      worstTrade = { symbol: t.symbol, pnlPct: t.pnlPct, direction: t.direction };
    }
  });

  // Calculate Win Rates per category
  Object.keys(byCategory).forEach(k => {
    byCategory[k].winRate = byCategory[k].count > 0 ? (byCategory[k].wins / byCategory[k].count) * 100 : 0;
    byCategory[k].pnlPct = parseFloat(byCategory[k].pnlPct.toFixed(2));
  });

  const winRate = targetList.length > 0 ? (wins / targetList.length) * 100 : 0;
  const nonBeCount = targetList.length - breakevens;
  const winRateExcludingBreakeven = nonBeCount > 0 ? ((wins - breakevens) / nonBeCount) * 100 : winRate;

  const avgTradeDurationMs = targetList.length > 0 ? totalDurationMs / targetList.length : 0;
  const avgRiskRewardRatio = targetList.length > 0 ? totalRR / targetList.length : 0;
  const avgPnlPerTradePct = targetList.length > 0 ? totalPnlPct / targetList.length : 0;
  const avgPnlPerTradeUsd = targetList.length > 0 ? totalPnlUsd / targetList.length : 0;
  const expectancyR = targetList.length > 0 ? totalR / targetList.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 1.0;

  // Max Drawdown calculation from cumulative series
  const series = calculateCumulativePnLSeries(targetList);
  const maxDrawdownPct = series.reduce((max, pt) => Math.max(max, pt.drawdownPct), 0);
  const peakCumulativePnlPct = series.reduce((peak, pt) => Math.max(peak, pt.cumulativePnL), 0);

  return {
    totalTrades,
    closedTrades,
    activeTrades,
    wins,
    losses,
    breakevens,
    winRate: parseFloat(winRate.toFixed(1)),
    winRateExcludingBreakeven: parseFloat(winRateExcludingBreakeven.toFixed(1)),
    avgRiskRewardRatio: parseFloat(avgRiskRewardRatio.toFixed(2)),
    avgTradeDurationMs,
    avgTradeDurationFormatted: formatTradeDuration(avgTradeDurationMs),
    totalPnlPct: parseFloat(totalPnlPct.toFixed(2)),
    totalPnlUsd: parseFloat(totalPnlUsd.toFixed(2)),
    avgPnlPerTradePct: parseFloat(avgPnlPerTradePct.toFixed(2)),
    avgPnlPerTradeUsd: parseFloat(avgPnlPerTradeUsd.toFixed(2)),
    expectancyR: parseFloat(expectancyR.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    peakCumulativePnlPct: parseFloat(peakCumulativePnlPct.toFixed(2)),
    bestTrade,
    worstTrade,
    longsCount,
    longsWinRate: longsCount > 0 ? parseFloat(((longsWins / longsCount) * 100).toFixed(1)) : 0,
    shortsCount,
    shortsWinRate: shortsCount > 0 ? parseFloat(((shortsWins / shortsCount) * 100).toFixed(1)) : 0,
    byCategory
  };
}
