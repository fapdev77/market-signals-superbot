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
 * Contrato único (M3/M4/M8): medição que não existe é `null`, e o motivo vai
 * para `assumptions[]`. Nenhuma constante substitui ausência — 9.9 e 4.5 não
 * eram limites, eram números inventados que passavam limiares de qualidade sem
 * que a qualidade tivesse sido observada.
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
  profitFactor: number | null;
  netProfitPct: number;
  avgWinPct: number | null;
  avgLossPct: number | null;
  avgRiskReward: number | null;
  avgDurationMinutes: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  /** Fator de anualização aplicado, ou `null` quando a métrica não foi anualizada. */
  annualFactor: number | null;
  /** True quando Sharpe/Sortino foram multiplicados por `annualFactor`. */
  isAnnualized: boolean;
  /** Quantos trades entraram no cálculo de Sharpe/Sortino. */
  tradesUsed: number;
  /** Motivos, em pt-BR, de cada métrica que ficou sem medição. */
  assumptions: string[];
}

/**
 * Trades necessários para que anualizar signifique alguma coisa.
 *
 * Com poucas observações, `sqrt(tradesPerDay × 252)` multiplica ruído por uma
 * constante grande e o resultado continua rotulado como Sharpe anual. Abaixo
 * deste piso a métrica sai crua, com `isAnnualized: false`.
 */
export const MIN_TRADES_FOR_ANNUALIZATION = 30;

export function computeBacktestMetrics(input: BacktestMetricInputs): BacktestMetricOutput {
  const assumptions: string[] = [];

  const positionsClosed = input.wins + input.losses;
  const totalTrades = positionsClosed;
  const winRate = positionsClosed > 0 ? (input.wins / positionsClosed) * 100 : 0;

  // Com zero perdas não há o que dividir: o quociente é uma divisão
  // por zero e a constante que ocupava o lugar (9.9) não foi medida.
  const profitFactor = input.totalLoss > 0 ? dDiv(input.totalProfit, input.totalLoss) : null;
  if (profitFactor === null && input.totalProfit > 0) {
    assumptions.push('Profit factor: n/d (0 perdas — nenhum prejuízo medido contra o qual dividir).');
  }

  const netProfitPct = dMul(dDiv(dSub(input.balance, input.initialBalance), input.initialBalance), 100);

  // O R-alvo do preset é o que a estratégia *pedia*, não o que *ganhou*. Sem
  // perdas não há média de prejuízo, logo não há R realizado.
  const avgWinPct = input.wins > 0 ? input.totalWinPctSum / input.wins : null;
  const avgLossPct = input.losses > 0 ? input.totalLossPctSum / input.losses : null;
  const avgRiskReward = avgWinPct !== null && avgLossPct !== null && avgLossPct > 0
    ? avgWinPct / avgLossPct
    : null;
  if (avgRiskReward === null && avgWinPct !== null) {
    assumptions.push(
      `R médio realizado: n/d (0 perdas — o R-alvo de ${input.targetRiskRatio} do preset é o que foi pedido, não o que foi obtido).`
    );
  }

  const avgDurationMinutes = positionsClosed > 0 ? Math.round(input.totalDurationSum / positionsClosed) : null;

  const netReturns = input.netReturns;
  const tradesUsed = netReturns.length;
  const meanReturn = tradesUsed > 0 ? netReturns.reduce((a, b) => a + b, 0) / tradesUsed : 0;
  const variance = tradesUsed > 0
    ? netReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / tradesUsed
    : 0;
  const stdDev = Math.sqrt(variance);
  const downsideVar = tradesUsed > 0
    ? netReturns.reduce((a, b) => a + (b < 0 ? Math.pow(b, 2) : 0), 0) / tradesUsed
    : 0;
  const downsideDev = Math.sqrt(downsideVar);

  // `Math.max(1, tradesPerDay × 252)` colava o fator em 1 e ainda assim o
  // resultado se chamava Sharpe anual. Abaixo do piso de trades o fator não é
  // aplicado e a métrica sai declarada como não anualizada.
  const tradesPerDay = input.days > 0 ? totalTrades / input.days : totalTrades;
  const isAnnualized = tradesUsed >= MIN_TRADES_FOR_ANNUALIZATION;
  const annualFactor = isAnnualized ? Math.sqrt(tradesPerDay * 252) : null;
  const annualizer = annualFactor ?? 1;

  const sharpeRatio = stdDev > 0.0001 ? dRound((meanReturn / stdDev) * annualizer, 2) : null;
  if (sharpeRatio === null) {
    assumptions.push('Sharpe: n/d (sem trades fechados — não há distribuição de retornos).');
  } else if (!isAnnualized) {
    assumptions.push(
      `Sharpe: ${sharpeRatio} NÃO anualizado (${tradesUsed} trades < ${MIN_TRADES_FOR_ANNUALIZATION} necessários).`
    );
  }

  // Sortino só existe se houver retornos negativos — é a definição da razão.
  const sortinoRatio = downsideDev > 0.0001 ? dRound((meanReturn / downsideDev) * annualizer, 2) : null;
  if (sortinoRatio === null && sharpeRatio !== null) {
    assumptions.push('Sortino: n/d (nenhum trade com retorno negativo — não há desvio a-baixo a medir).');
  }

  return {
    positionsClosed,
    totalTrades,
    winRate: dRound(winRate, 2),
    profitFactor: profitFactor === null ? null : dRound(profitFactor, 2),
    netProfitPct: dRound(netProfitPct, 2),
    avgWinPct: avgWinPct === null ? null : dRound(avgWinPct, 2),
    avgLossPct: avgLossPct === null ? null : dRound(avgLossPct, 2),
    avgRiskReward: avgRiskReward === null ? null : dRound(avgRiskReward, 2),
    avgDurationMinutes,
    sharpeRatio,
    sortinoRatio,
    annualFactor: annualFactor === null ? null : dRound(annualFactor, 4),
    isAnnualized,
    tradesUsed,
    assumptions
  };
}
