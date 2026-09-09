export interface RiskMetricsInput {
  pnlPercentages: number[];
  initialBalance?: number;
  makerTakerFeePct?: number; // per order (e.g. 0.04%)
  slippagePct?: number;      // estimated roundtrip slippage (e.g. 0.02%)
}

export interface AdvancedRiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  winRate: number;
  grossProfit: number;
  netProfit: number;
  totalFeesPaid: number;
}

/**
 * Calculates advanced financial and institutional risk metrics:
 * Sharpe Ratio, Sortino Ratio, Maximum Drawdown, Profit Factor, Fees, and Net PnL.
 */
export function calculateAdvancedRiskMetrics(
  returnsPct: number[],
  initialBalance: number = 10000,
  makerTakerFeePct: number = 0.04,
  slippagePct: number = 0.02
): AdvancedRiskMetrics {
  if (!returnsPct || returnsPct.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      winRate: 0,
      grossProfit: 0,
      netProfit: 0,
      totalFeesPaid: 0
    };
  }

  const roundtripFeePct = (makerTakerFeePct * 2) + slippagePct;
  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;

  let grossProfitSum = 0;
  let grossLossSum = 0;
  let wins = 0;
  let totalFeesPaid = 0;

  const netReturns: number[] = [];

  for (const rawPct of returnsPct) {
    const netTradePct = rawPct - roundtripFeePct;
    netReturns.push(netTradePct);

    const tradeGrossPnl = (rawPct / 100) * balance;
    const feeCost = (roundtripFeePct / 100) * balance;
    totalFeesPaid += feeCost;

    if (rawPct > 0) {
      wins++;
      grossProfitSum += tradeGrossPnl;
    } else {
      grossLossSum += Math.abs(tradeGrossPnl);
    }

    const netTradePnl = tradeGrossPnl - feeCost;
    balance += netTradePnl;

    if (balance > peakBalance) {
      peakBalance = balance;
    } else {
      const dd = ((peakBalance - balance) / peakBalance) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  const totalTrades = returnsPct.length;
  const winRate = (wins / totalTrades) * 100;
  const profitFactor = grossLossSum > 0 ? grossProfitSum / grossLossSum : grossProfitSum > 0 ? 9.9 : 0;
  const netProfit = ((balance - initialBalance) / initialBalance) * 100;

  // Mean of net trade returns
  const meanReturn = netReturns.reduce((acc, val) => acc + val, 0) / totalTrades;

  // Standard deviation
  const variance = netReturns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / totalTrades;
  const stdDev = Math.sqrt(variance);

  // Downside deviation (only returns below 0)
  const downsideVariance = netReturns.reduce((acc, val) => acc + (val < 0 ? Math.pow(val, 2) : 0), 0) / totalTrades;
  const downsideDev = Math.sqrt(downsideVariance);

  // Sharpe & Sortino (normalized for trade distribution)
  const sharpeRatio = stdDev > 0.0001 ? Number(((meanReturn / stdDev) * Math.sqrt(Math.min(totalTrades, 252))).toFixed(2)) : 0;
  const sortinoRatio = downsideDev > 0.0001 ? Number(((meanReturn / downsideDev) * Math.sqrt(Math.min(totalTrades, 252))).toFixed(2)) : (meanReturn > 0 ? 5.0 : 0);

  return {
    sharpeRatio,
    sortinoRatio,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    grossProfit: Number(grossProfitSum.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2))
  };
}

/**
 * Generates CSV content from a list of backtest trades.
 */
export function exportTradesToCSV(trades: Array<{
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnlPct: number;
  pnlValue: number;
  isWin: boolean;
  durationMinutes: number;
}>): string {
  const headers = [
    'ID',
    'Par',
    'Direção',
    'Preço Entrada',
    'Preço Saída',
    'Data Entrada',
    'Data Saída',
    'PnL (%)',
    'PnL (USD)',
    'Resultado',
    'Duração (min)'
  ];

  const rows = trades.map(t => [
    t.id,
    t.symbol,
    t.direction,
    t.entryPrice.toFixed(4),
    t.exitPrice.toFixed(4),
    new Date(t.entryTime).toISOString(),
    new Date(t.exitTime).toISOString(),
    t.pnlPct.toFixed(2) + '%',
    t.pnlValue.toFixed(2),
    t.isWin ? 'VITÓRIA' : 'DERROTA',
    t.durationMinutes
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
