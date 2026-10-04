/**
 * SDD Fase 9 — S4 / ALTO-2: o P&L do painel do cliente desconta custos.
 *
 * RED tests.
 *
 * DEFEITO DE ORIGEM: `src/utils/tradeMetrics.ts` derivava `pnlPct`/`pnlR` dos campos do
 * próprio sinal — `target1`, `target2`, `stopLoss` — com ZERO taxas, ZERO slippage e
 * ZERO funding, e sem caminho de preço. O backtest, no mesmo repositório, desconta
 * 0,04% por lado + 0,02% de slippage por lado + funding real.
 *
 * Não é inconsistência de código: é inconsistência de MODELO. O painel "Trading
 * Insights" mostra a expectativa de um motor diferente e mais otimista que o motor que
 * o operador audita. Como o painel é a tela que ele usa para decidir se vale operar, o
 * erro não é cosmético.
 *
 * E há um caso pior, o achado N4:
 *
 *   if (signal.status === 'TARGET_REACHED') pnlR = signal.riskRewardRatio || 2.5;
 *
 * `riskRewardRatio` é o R:R **PLANEJADO** na emissão. Usá-lo como R realizado
 * pressupõe que os dois alvos foram preenchidos exatamente nos preços previstos — o que
 * o próprio `pnlPct` do bloco já desmente, ao assumir 50/50 sem caminho de preço. Todo
 * `expectancyR` do painel herda esse otimismo.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRADE_COSTS,
  roundtripCostPct,
  applyTradeCosts,
  realizedR,
  TRADE_COST_DISCLOSURE
} from '../src/utils/tradeCosts.js';
import { signalToExecutedTrade } from '../src/utils/tradeMetrics.js';
import type { TradeSignal } from '../src/types.js';

const base = Date.now() - 3 * 24 * 60 * 60 * 1000;

const long = (over: Partial<TradeSignal> = {}): TradeSignal => ({
  id: 'sig-cost',
  symbol: 'BTCUSDT',
  marketType: 'crypto_futures',
  signalType: 'STRONG_LONG',
  direction: 'LONG',
  strategyCategory: 'INTRADAY',
  entryZone: [90000, 90200],
  currentPrice: 90000,
  stopLoss: 88500,
  target1: 91500,
  target2: 93000,
  riskRewardRatio: 2.0,
  confluenceScore: 85,
  confluenceFactors: ['CVD_BULLISH'],
  timeframe: '15m',
  validationStatus: 'CONFIRMED',
  validationStage: 'VALIDADO',
  candle1mConfirmed: true,
  candle5mConfirmed: true,
  createdAt: base,
  validatedAt: base + 60000,
  expiresAt: base + 3600000,
  status: 'TARGET_REACHED',
  ...over
});

describe('S4.1 — o custo de ida e volta é o mesmo do backtest', () => {
  it('taxa e slippage contam uma vez por lado', () => {
    // BacktestEngine: feePct 0,04 por lado, slipPct 0,02 por lado.
    expect(DEFAULT_TRADE_COSTS.feePctPerSide).toBe(0.04);
    expect(DEFAULT_TRADE_COSTS.slippagePctPerSide).toBe(0.02);
    expect(roundtripCostPct(DEFAULT_TRADE_COSTS)).toBeCloseTo(0.12, 10);
  });

  it('sem custos informados, líquido == bruto (falha explícita, não otimista)', () => {
    const r = applyTradeCosts(2, { feePctPerSide: 0, slippagePctPerSide: 0, fundingPct: 0 });
    expect(r.netPct).toBe(r.grossPct);
    expect(r.costsPct).toBe(0);
  });

  it('o líquido nunca é maior que o bruto, em nenhuma combinação', () => {
    for (const fee of [0, 0.02, 0.04, 0.1]) {
      for (const slip of [0, 0.01, 0.02]) {
        for (const fund of [0, 0.01, 0.5]) {
          for (const gross of [-2, -0.05, 0, 0.05, 2]) {
            const r = applyTradeCosts(gross, { feePctPerSide: fee, slippagePctPerSide: slip, fundingPct: fund });
            expect(r.netPct).toBeLessThanOrEqual(r.grossPct + 1e-12);
          }
        }
      }
    }
  });

  it('funding é descontado além da taxa e do slippage', () => {
    const semFunding = applyTradeCosts(1.5, { ...DEFAULT_TRADE_COSTS, fundingPct: 0 });
    const comFunding = applyTradeCosts(1.5, { ...DEFAULT_TRADE_COSTS, fundingPct: 0.4 });
    expect(comFunding.netPct).toBeCloseTo(semFunding.netPct - 0.4, 10);
  });

  it('custos nunca tornam um trade perdedor em vincador', () => {
    const r = applyTradeCosts(-1, { ...DEFAULT_TRADE_COSTS, fundingPct: 0 });
    expect(r.netPct).toBeLessThan(r.grossPct);
  });

  it('a divulgação Diz o que é estimativa', () => {
    expect(TRADE_COST_DISCLOSURE).toMatch(/estimativ/i);
    expect(TRADE_COST_DISCLOSURE).toMatch(/ledger/i);
  });
});

describe('S4.2 — R realizado vem dos PREÇOS, não do R:R planejado', () => {
  it('metade em TP1 + metade em TP2 = média dos múltiplos', () => {
    // entrada 90000, risco 1500 (1,5%), TP1 = +1500 (1,0R), TP2 = +3000 (2,0R).
    // 50/50 => 1,5R — e o R:R planejado do sinal é 2,0.
    expect(realizedR(1.5, 1.5)).toBeCloseTo(1, 10);
    expect(realizedR(1.5, 1.5)).not.toBe(2);
  });

  it('risco zero não divide por zero nem vira infinito', () => {
    expect(realizedR(2, 0)).toBe(0);
    expect(Number.isFinite(realizedR(2, 0))).toBe(true);
  });

  it('o painel deixa de reportar o R:R planejado como R realizado', () => {
    const trade = signalToExecutedTrade(long());
    // 1,5R realizado (bruto) — não os 2,0R planejados do `riskRewardRatio`.
    expect(trade.pnlRGross).toBeCloseTo(1.5, 2);
    expect(trade.pnlR).toBeLessThan(trade.pnlRGross!);
  });
});

describe('S4.3 — o trade do cliente desconta custos', () => {
  it('exposição dos três números: bruto, custos e líquido', () => {
    const trade = signalToExecutedTrade(long());
    expect(trade.pnlPctGross).toBeGreaterThan(0);
    expect(trade.costsPct).toBeGreaterThan(0);
    expect(trade.pnlPct).toBeLessThan(trade.pnlPctGross!);
    expect(trade.pnlPct).toBeCloseTo(trade.pnlPctGross! - trade.costsPct, 6);
  });

  it('pnlPct é o LÍQUIDO (o painel inteiro passa a mostrar o número que o ledger mede)', () => {
    const trade = signalToExecutedTrade(long());
    expect(trade.pnlPct).toBeLessThan(trade.pnlPctGross!);
    expect(trade.pnlUsd).toBeGreaterThan(0);
  });

  it('alvo miúdo que não paga a taxa deixa de ser vitória', () => {
    // R:R 0,05: +0,05% contra 0,12% de custo de ida e volta. Lucro bruto, prejuízo real.
    const trade = signalToExecutedTrade(
      long({ stopLoss: 89995.5, target1: 90002, target2: 90005, riskRewardRatio: 0.05 })
    );
    expect(trade.pnlPctGross!).toBeGreaterThan(0);
    expect(trade.pnlPct).toBeLessThan(0);
    expect(trade.isWin).toBe(false);
  });
});

describe('S4.4 — isWin do cliente segue a mesma definição do servidor', () => {
  it('é o líquido que decide, não o bruto', () => {
    const winner = signalToExecutedTrade(long());
    expect(winner.isWin).toBe(true);
    expect(winner.pnlPct).toBeGreaterThan(0);
  });
});