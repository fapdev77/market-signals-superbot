import { describe, it, expect } from 'vitest';
import { calculateAdvancedRiskMetrics, exportTradesToCSV } from '../src/utils/backtestMetrics';

describe('Advanced Backtest Risk Metrics & CSV Suite', () => {
  it('calculates Sharpe and Sortino ratios with transaction fees', () => {
    // 5 trades: 4 wins (+2.5%, +3.0%, +1.8%, +2.0%) and 1 loss (-1.5%)
    const pnlPercentages = [2.5, 3.0, -1.5, 1.8, 2.0];
    const metrics = calculateAdvancedRiskMetrics(pnlPercentages, 10000, 0.04, 0.02);

    expect(metrics.winRate).toBe(80);
    expect(metrics.profitFactor).toBeGreaterThan(1);
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
    expect(metrics.sortinoRatio).toBeGreaterThan(0);
    expect(metrics.totalFeesPaid).toBeGreaterThan(0);
    expect(metrics.netProfit).toBeGreaterThan(0);
  });

  it('handles empty trades gracefully', () => {
    const metrics = calculateAdvancedRiskMetrics([], 10000);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
    expect(metrics.winRate).toBe(0);
  });

  it('exports backtest trades to CSV format with headers', () => {
    const mockTrades = [
      {
        id: 't-1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entryPrice: 90000,
        exitPrice: 91500,
        entryTime: 1700000000000,
        exitTime: 1700003600000,
        pnlPct: 1.67,
        pnlValue: 167,
        isWin: true,
        durationMinutes: 60
      }
    ];

    const csv = exportTradesToCSV(mockTrades);
    expect(csv).toContain('ID,Par,Direção,Preço Entrada,Preço Saída');
    expect(csv).toContain('BTCUSDT,LONG,90000.0000,91500.0000');
    expect(csv).toContain('VITÓRIA');
  });
});
