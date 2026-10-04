/**
 * SDD Fase 9 — S4 / ALTO-2: modelo de custo do P&L no cliente.
 *
 * O painel de Trading Insights vivia de um motor diferente do motor que o operador
 * audita. Aqui, `pnlPct`, `pnlUsd` e `pnlR` saíam dos campos do próprio sinal
 * (`target1`, `target2`, `stopLoss`) com ZERO taxas, ZERO slippage e ZERO funding, e sem
 * caminho de preço — enquanto o `BacktestEngine`, no mesmo repositório, desconta
 * 0,04% por lado + 0,02% de slippage por lado + funding real.
 *
 * Os defaults abaixo são os MESMOS do backtest (`BacktestEngine.runBacktest`):
 *   feePct    = config.makerTakerFeePct ?? 0.04   (por lado)
 *   slipPct   = config.slippagePct     ?? 0.02   (por lado)
 *
 * Um trade com alvo de +0,05% e custo de ida e volta de 0,12% é PREJUÍZO. Pelo painel
 * antigo ele era vitória, e era somado a `wins` — o que inflava o win rate e a
 * expectativa exatamente nos trades que a estratégia deveria estar descartando.
 *
 * Este módulo é puro e sem DOM: a conta é testável sem React e sem DOM.
 */

/** Taxa por lado (taker), em % do notional. Mesmo default do `BacktestEngine`. */
export const DEFAULT_FEE_PCT_PER_SIDE = 0.04;

/** Slippage por lado, em % do notional. Mesmo default do `BacktestEngine`. */
export const DEFAULT_SLIPPAGE_PCT_PER_SIDE = 0.02;

export interface TradeCosts {
  /** Taxa por lado, em % do notional. */
  feePctPerSide: number;
  /** Slippage por lado, em % do notional. */
  slippagePctPerSide: number;
  /** Funding acumulado enquanto a posição esteve aberta, em % do notional. */
  fundingPct: number;
}

/** Modelo padrão: ida e volta sem funding (o funding depende do tempo segurado). */
export const DEFAULT_TRADE_COSTS: TradeCosts = {
  feePctPerSide: DEFAULT_FEE_PCT_PER_SIDE,
  slippagePctPerSide: DEFAULT_SLIPPAGE_PCT_PER_SIDE,
  fundingPct: 0
};

/**
 * Texto de divulgação. Enquanto o painel não tiver caminho de preço resolvido pelo
 * ledger, todo número dele é ESTIMATIVA — e uma estimativa sem esse aviso é lida como
 * medição, que é o defeito que estamos corrigindo.
 */
export const TRADE_COST_DISCLOSURE =
  'Estimativa: usa alvos e stop do sinal com taxas e slippage do motor, sem caminho de preço. ' +
  'O número autoritativo de resultado é o do evidence ledger.';

/** Custo total de ida e volta, em % do notional (taxa e slippage contam 2x). */
export function roundtripCostPct(costs: Partial<TradeCosts> = {}): number {
  const fee = Number.isFinite(costs.feePctPerSide) ? (costs.feePctPerSide as number) : 0;
  const slip = Number.isFinite(costs.slippagePctPerSide) ? (costs.slippagePctPerSide as number) : 0;
  const funding = Number.isFinite(costs.fundingPct) ? (costs.fundingPct as number) : 0;
  return fee * 2 + slip * 2 + funding;
}

export interface NettedPnl {
  grossPct: number;
  costsPct: number;
  netPct: number;
}

/**
 * Aplica os custos ao P&L bruto.
 *
 * O slippage entra como redução percentual do notional em vez de como ajuste no preço:
 *fills adversos em entrada e saída custam exatamente `2 × slipPct` do notional, que é a
 * mesma coisa que o `BacktestEngine` contabiliza via `positionSlippagePct`.
 */
export function applyTradeCosts(grossPct: number, costs: Partial<TradeCosts> = {}): NettedPnl {
  const gross = Number.isFinite(grossPct) ? grossPct : 0;
  const costsPct = roundtripCostPct(costs);
  return { grossPct: gross, costsPct, netPct: gross - costsPct };
}

/**
 * R REALIZADO, em múltiplos do risco.
 *
 * `riskPct` é a distância entry→stop em % do preço de entrada. Risco zero (ou ausente)
 * devolve 0 em vez de dividir por zero: um R infinito é sempre bug de dimensionamento, e
 * um painel que mostra `+InfinityR` teacha o operador a ignorar a coluna.
 */
export function realizedR(netPct: number, riskPct: number): number {
  if (!Number.isFinite(netPct) || !Number.isFinite(riskPct) || riskPct <= 0) return 0;
  return netPct / riskPct;
}