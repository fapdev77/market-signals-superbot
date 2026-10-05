import { dDiv, dMul, dRound, dSub } from '../utils/decimal.js';

/**
 * Métricas de um backtest, isoladas do laço de simulação.
 *
 * O motor simulava e media no mesmo bloco de ~50 linhas: o cálculo vinha
 * misturado ao laço de candles, o que tornava impossível exercitar os casos de
 * ausência (zero perdas, poucos trades) sem rodar uma simulação inteira — e
 * simulação inteira não permite garantir "só com wins". Aqui as entradas são
 * agregados puros, então cada caso é um teste de uma linha.
 *
 * Esta extração é fiel ao cálculo original, defeitos incluídos: os casos de ausência
 * ainda são preenchidos por constantes inventadas. O contrato que os remove
 * (M3/M4/M8) é um passo seguinte, com o teste vermelho na frente.
 */

export interface BacktestMetricInputs {
  /** Posições fechadas vencedoras. */
  wins: number;
  /** Posições fechadas perdedoras. */
  losses: number;
  /** Soma dos ganhos absolutos das posições fechadas. */
  totalProfit: number;
  /** Soma das perdas absolutas das posições fechadas. */
  totalLoss: number;
  totalWinPctSum: number;
  totalLossPctSum: number;
  /** Soma da duração das posições fechadas, em minutos. */
  totalDurationSum: number;
  balance: number;
  initialBalance: number;
  /** Percentual de P&L de cada trade, na ordem em que foram fechados. */
  netReturns: number[];
  /** Dias cobertos pela janela simulada. */
  days: number;
  /** R-alvo do preset — usado como fallback de sorteio, nunca como resultado medido. */
  targetRiskRatio: number;
}

export interface BacktestMetricOutput {
  positionsClosed: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netProfitPct: number;
  avgWinPct: number;
  avgLossPct: number;
  avgRiskReward: number;
  avgDurationMinutes: number;
  sharpeRatio: number;
  sortinoRatio: number;
  /** Fator de anualização efetivamente aplicado. */
  annualFactor: number;
  /** Trades por dia na janela — a base do fator de anualização. */
  tradesPerDay: number;
}

export function computeBacktestMetrics(input: BacktestMetricInputs): BacktestMetricOutput {
  const positionsClosed = input.wins + input.losses;
  const totalTrades = positionsClosed;
  const winRate = positionsClosed > 0 ? (input.wins / positionsClosed) * 100 : 0;

  const profitFactor = input.totalLoss > 0 ? dDiv(input.totalProfit, input.totalLoss) : input.totalProfit > 0 ? 9.9 : 0;
  const netProfitPct = dMul(dDiv(dSub(input.balance, input.initialBalance), input.initialBalance), 100);
  const avgWinPct = input.wins > 0 ? input.totalWinPctSum / input.wins : 0;
  const avgLossPct = input.losses > 0 ? input.totalLossPctSum / input.losses : 0;
  const avgRiskReward = avgLossPct > 0 ? avgWinPct / avgLossPct : input.targetRiskRatio;
  const avgDurationMinutes = positionsClosed > 0 ? Math.round(input.totalDurationSum / positionsClosed) : 0;

  const netReturns = input.netReturns;
  const meanReturn = netReturns.length > 0 ? netReturns.reduce((a, b) => a + b, 0) / netReturns.length : 0;
  const variance = netReturns.length > 0
    ? netReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / netReturns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const downsideVar = netReturns.length > 0
    ? netReturns.reduce((a, b) => a + (b < 0 ? Math.pow(b, 2) : 0), 0) / netReturns.length
    : 0;
  const downsideDev = Math.sqrt(downsideVar);

  const tradesPerDay = input.days > 0 ? totalTrades / input.days : 1;
  const annualFactor = Math.sqrt(Math.max(1, tradesPerDay * 252));
  const sharpeRatio = stdDev > 0.0001 ? dRound((meanReturn / stdDev) * annualFactor, 2) : 0;
  const sortinoRatio = downsideDev > 0.0001 ? dRound((meanReturn / downsideDev) * annualFactor, 2) : meanReturn > 0 ? 4.5 : 0;

  return {
    positionsClosed,
    totalTrades,
    winRate,
    profitFactor,
    netProfitPct,
    avgWinPct,
    avgLossPct,
    avgRiskReward,
    avgDurationMinutes,
    sharpeRatio,
    sortinoRatio,
    annualFactor,
    tradesPerDay
  };
}
