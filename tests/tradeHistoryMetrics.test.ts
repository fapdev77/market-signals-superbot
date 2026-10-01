import { describe, it, expect } from 'vitest';
import { 
  signalToExecutedTrade, 
  filterTradesByTimeframe, 
  calculateCumulativePnLSeries, 
  calculateTradingInsights, 
  formatTradeDuration,
  ExecutedTrade 
} from '../src/utils/tradeMetrics';
import { TradeSignal } from '../src/types';

describe('Trade History & Trading Insights Metrics Suite', () => {
  const baseTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago

  const mockTargetReachedLong: TradeSignal = {
    id: 'sig-target-long',
    symbol: 'BTCUSDT',
    marketType: 'crypto_futures',
    signalType: 'STRONG_LONG',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [90000, 90200],
    currentPrice: 90000,
    stopLoss: 88500, // 1500 risk
    target1: 91500,  // +1500 (1.0R)
    target2: 93000,  // +3000 (2.0R)
    riskRewardRatio: 2.0,
    confluenceScore: 85,
    confluenceFactors: ['CVD_BULLISH', 'FIB_618', 'OI_EXPANSION'],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: baseTimestamp,
    validatedAt: baseTimestamp + 60000,
    expiresAt: baseTimestamp + 3600000,
    status: 'TARGET_REACHED'
  };

  const mockStoppedOutShort: TradeSignal = {
    id: 'sig-stop-short',
    symbol: 'ETHUSDT',
    marketType: 'crypto_futures',
    signalType: 'SHORT',
    direction: 'SHORT',
    strategyCategory: 'SCALP',
    entryZone: [3000, 3010],
    currentPrice: 3010,
    stopLoss: 3060, // 50 risk
    target1: 2950,
    target2: 2900,
    riskRewardRatio: 2.2,
    confluenceScore: 78,
    confluenceFactors: ['RSI_BEARISH_DIV', 'CVD_ABSORPTION'],
    timeframe: '5m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: baseTimestamp + 3600000 * 2,
    validatedAt: baseTimestamp + 3600000 * 2 + 60000,
    expiresAt: baseTimestamp + 3600000 * 3,
    status: 'STOPPED_OUT',
    expirationReason: 'Stop Loss Atingido'
  };

  const mockBreakevenLong: TradeSignal = {
    id: 'sig-be-long',
    symbol: 'SOLUSDT',
    marketType: 'crypto_futures',
    signalType: 'LONG',
    direction: 'LONG',
    strategyCategory: 'DAY_TRADE',
    entryZone: [200, 202],
    currentPrice: 200,
    stopLoss: 194, // 6 risk
    target1: 206, // +6 target 1
    target2: 212,
    riskRewardRatio: 2.0,
    confluenceScore: 82,
    confluenceFactors: ['VOLUME_PROFILE_POC', 'BOS_BULLISH'],
    timeframe: '30m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: baseTimestamp + 3600000 * 5,
    validatedAt: baseTimestamp + 3600000 * 5 + 60000,
    expiresAt: baseTimestamp + 3600000 * 7,
    status: 'STOPPED_OUT',
    isBreakevenActive: true,
    expirationReason: 'Saída no Breakeven (Risco Zero)'
  };

  describe('signalToExecutedTrade conversion', () => {
    it('correctly calculates Target 2 reached trade metrics', () => {
      const trade = signalToExecutedTrade(mockTargetReachedLong);
      expect(trade.symbol).toBe('BTCUSDT');
      expect(trade.direction).toBe('LONG');
      expect(trade.entryPrice).toBe(90000);
      expect(trade.exitPrice).toBe(93000);
      expect(trade.isWin).toBe(true);
      expect(trade.isBreakeven).toBe(false);
      expect(trade.pnlPct).toBeGreaterThan(0);
      expect(trade.pnlR).toBe(2.0);
      expect(trade.durationMs).toBeGreaterThan(0);
    });

    it('correctly calculates Stopped Out loss metrics', () => {
      const trade = signalToExecutedTrade(mockStoppedOutShort);
      expect(trade.symbol).toBe('ETHUSDT');
      expect(trade.direction).toBe('SHORT');
      expect(trade.entryPrice).toBe(3010);
      expect(trade.exitPrice).toBe(3060);
      expect(trade.isWin).toBe(false);
      expect(trade.pnlPct).toBeLessThan(0);
      expect(trade.pnlR).toBe(-1.0);
    });

    it('correctly calculates Breakeven win with partial profit', () => {
      const trade = signalToExecutedTrade(mockBreakevenLong);
      expect(trade.symbol).toBe('SOLUSDT');
      expect(trade.isBreakeven).toBe(true);
      expect(trade.isWin).toBe(true);
      expect(trade.exitPrice).toBe(200);
      expect(trade.pnlPct).toBeGreaterThan(0); // 50% partial profit at TP1
      expect(trade.pnlR).toBeGreaterThan(0);
    });
  });

  describe('calculateTradingInsights', () => {
    it('calculates accurate win rate, average risk-reward and trade duration', () => {
      const trades = [
        signalToExecutedTrade(mockTargetReachedLong),
        signalToExecutedTrade(mockStoppedOutShort),
        signalToExecutedTrade(mockBreakevenLong)
      ];

      const insights = calculateTradingInsights(trades);

      expect(insights.totalTrades).toBe(3);
      expect(insights.closedTrades).toBe(3);
      // 2 wins (1 full target + 1 breakeven partial), 1 loss
      expect(insights.wins).toBe(2);
      expect(insights.losses).toBe(1);
      expect(insights.winRate).toBeCloseTo(66.7, 1);
      expect(insights.avgRiskRewardRatio).toBeGreaterThan(1.5);
      expect(insights.avgTradeDurationMs).toBeGreaterThan(0);
      expect(insights.avgTradeDurationFormatted).toBeDefined();
      expect(insights.profitFactor).toBeGreaterThan(1);
      expect(insights.longsCount).toBe(2);
      expect(insights.shortsCount).toBe(1);
      expect(insights.longsWinRate).toBe(100);
      expect(insights.shortsWinRate).toBe(0);
    });

    it('gracefully handles empty trades array without errors', () => {
      const insights = calculateTradingInsights([]);
      expect(insights.totalTrades).toBe(0);
      expect(insights.winRate).toBe(0);
      expect(insights.avgRiskRewardRatio).toBe(0);
      expect(insights.avgTradeDurationMs).toBe(0);
      expect(insights.avgTradeDurationFormatted).toBe('0m');
      expect(insights.profitFactor).toBe(0);
    });
  });

  describe('calculateCumulativePnLSeries', () => {
    it('generates chronological cumulative points starting at baseline zero', () => {
      const trades = [
        signalToExecutedTrade(mockTargetReachedLong),
        signalToExecutedTrade(mockStoppedOutShort),
        signalToExecutedTrade(mockBreakevenLong)
      ];

      const series = calculateCumulativePnLSeries(trades);

      expect(series.length).toBe(4); // 1 baseline + 3 trades
      expect(series[0].cumulativePnL).toBe(0);
      expect(series[0].tradeId).toBe('start');
      
      const lastPoint = series[series.length - 1];
      expect(lastPoint.cumulativePnL).toBeDefined();
      expect(lastPoint.cumulativeR).toBeDefined();
    });
  });

  describe('filterTradesByTimeframe', () => {
    it('filters trades by timeframe boundaries', () => {
      const now = Date.now();
      const tradeToday: ExecutedTrade = {
        ...signalToExecutedTrade(mockTargetReachedLong),
        id: 'trade-today',
        entryTime: now - 3600000,
        exitTime: now
      };

      const tradeOld: ExecutedTrade = {
        ...signalToExecutedTrade(mockStoppedOutShort),
        id: 'trade-old',
        entryTime: now - 20 * 24 * 60 * 60 * 1000,
        exitTime: now - 19 * 24 * 60 * 60 * 1000
      };

      const all = [tradeToday, tradeOld];

      expect(filterTradesByTimeframe(all, 'all').length).toBe(2);
      expect(filterTradesByTimeframe(all, 'today').length).toBe(1);
      expect(filterTradesByTimeframe(all, '7d').length).toBe(1);
      expect(filterTradesByTimeframe(all, '30d').length).toBe(2);
    });
  });

  describe('formatTradeDuration helper', () => {
    it('formats millisecond durations into readable strings', () => {
      expect(formatTradeDuration(0)).toBe('< 1 min');
      expect(formatTradeDuration(30 * 1000)).toBe('< 1 min');
      expect(formatTradeDuration(5 * 60 * 1000)).toBe('5m');
      expect(formatTradeDuration(90 * 60 * 1000)).toBe('1h 30m');
      expect(formatTradeDuration(26 * 3600 * 1000)).toBe('1d 2h');
    });
  });
});
