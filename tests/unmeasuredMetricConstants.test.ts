import { describe, it, expect } from 'vitest';
import { calculateAdvancedRiskMetrics } from '../src/utils/backtestMetrics.js';
import { calculateTradingInsights, type ExecutedTrade } from '../src/utils/tradeMetrics.js';
import { recomputeAccountSummary, resetPaperSandbox } from '../src/utils/paperTradingEngine.js';
import type { PaperAccountState } from '../src/types.js';

/**
 * M8 (recorrência) — a mesma mentira, contada cinco vezes com cinco números.
 *
 * A auditoria achou `9.9` no profit factor do BacktestEngine. Ao corrigir, apareceram
 * mais três cópias do mesmo defeito, cada uma com a sua constante inventada:
 *
 *   server/services/BacktestEngine.ts   profit factor 9.9, Sortino 4.5
 *   src/utils/backtestMetrics.ts        profit factor 9.9, Sortino 5.0
 *   src/utils/paperTradingEngine.ts     profit factor 99.9
 *   src/utils/tradeMetrics.ts           profit factor 99.9
 *
 * Todas respondem à mesma pergunta errada. Com zero perdas medidas não existe
 * quociente: o denominador é 0. O contrato é um só — ausência é `null`.
 */

function trade(pnlPct: number, id: string): ExecutedTrade {
  return {
    id,
    symbol: 'BTCUSDT',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    timeframe: '15m',
    entryPrice: 100,
    exitPrice: 100 * (1 + pnlPct / 100),
    stopLoss: 95,
    target1: 110,
    target2: 120,
    riskRewardRatio: 2,
    confluenceScore: 80,
    confluenceFactors: [],
    status: 'TARGET_REACHED',
    isWin: pnlPct > 0,
    isBreakeven: false,
    pnlPct,
    pnlPctGross: pnlPct,
    costsPct: 0,
    pnlUsd: pnlPct * 10,
    pnlR: pnlPct / 2,
    entryTime: 1,
    exitTime: 2,
    durationMs: 60_000,
    durationFormatted: '1m',
    rawSignal: {} as never
  } as ExecutedTrade;
}

describe('M8 — nenhum caminho de métricas inventa profit factor', () => {
  it('calculateAdvancedRiskMetrics: sem perdas, null (não 9.9)', () => {
    const m = calculateAdvancedRiskMetrics([3, 2, 4, 1, 5]);
    expect(m.profitFactor).toBeNull();
  });

  it('calculateAdvancedRiskMetrics: Sortino sem retorno negativo é null (não 5.0)', () => {
    const m = calculateAdvancedRiskMetrics([3, 2, 4, 1, 5]);
    expect(m.sortinoRatio).toBeNull();
  });

  it('calculateAdvancedRiskMetrics: com perdas, mede', () => {
    const m = calculateAdvancedRiskMetrics([3, -2, 4, -1, 5]);
    expect(m.profitFactor).not.toBeNull();
    expect(m.sortinoRatio).not.toBeNull();
  });

  it('calculateTradingInsights: sem perdas, null (não 99.9 nem 1.0)', () => {
    const insights = calculateTradingInsights([trade(1.2, 'a'), trade(0.8, 'b'), trade(0.4, 'c')]);
    expect(insights.profitFactor).toBeNull();
  });

  it('calculateTradingInsights: com perdas, mede', () => {
    const insights = calculateTradingInsights([trade(1.2, 'a'), trade(-0.4, 'b'), trade(0.4, 'c')]);
    expect(insights.profitFactor).not.toBeNull();
  });

  it('recomputeAccountSummary: sem perdas, null (não 99.9)', () => {
    const state: PaperAccountState = resetPaperSandbox();
    state.tradeHistory = [
      { id: 'a', netPnl: 100, feesPaid: 0, entryFeePaidUsd: 0, pnlPercent: 1 } as never,
      { id: 'b', netPnl: 50, feesPaid: 0, entryFeePaidUsd: 0, pnlPercent: 0.5 } as never
    ];
    const summary = recomputeAccountSummary(state);
    expect(summary.profitFactor).toBeNull();
  });

  it('recomputeAccountSummary: com perdas, mede', () => {
    const state: PaperAccountState = resetPaperSandbox();
    state.tradeHistory = [
      { id: 'a', netPnl: 100, feesPaid: 0, entryFeePaidUsd: 0, pnlPercent: 1 } as never,
      { id: 'b', netPnl: -50, feesPaid: 0, entryFeePaidUsd: 0, pnlPercent: -0.5 } as never
    ];
    const summary = recomputeAccountSummary(state);
    expect(summary.profitFactor).not.toBeNull();
  });
});
