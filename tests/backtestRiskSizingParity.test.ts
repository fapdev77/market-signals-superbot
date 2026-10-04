/**
 * CRITICAL-1 (auditoria 2026-10-04) — o backtest dimensionava por NOTIONAL, o live por RISCO.
 *
 * O motor fazia `profit = tradePnlPct/100 × balance`, ou seja, assumia 100% do capital
 * em CADA trade. O live dimensiona com `computePositionSize`: arrisca `riskPerTradePct`
 * (1%) do equity e deriva o notional da distância do stop. Com stops reais de 1,2%–4%
 * o notional fica em 83%–25% do equity, então o backtest superdimensionava o PnL em
 * 1,2×–4× — e por contaminar `balance`, TODA métrica derivada saía junto:
 * `netProfit`, `equityCurve`, `maxDrawdown`, `profitFactor`, `sharpeRatio` e o
 * auto-tuner (que seleciona parâmetros por essas métricas).
 *
 * Prova de não-intencionalidade: `BacktestEngine` não mencionava `riskPerTradePct`,
 * `evaluatePortfolioRisk` nem `maxConcurrentSignals` — nenhuma occurrence.
 *
 * Este guard fixa a relação entre notional e distância de stop, que é a mesma nos dois
 * lados quando o notional é proporcional ao risco e inversamente proporcional ao stop:
 *
 *     notional / equity = riskPerTradePct / stopDistancePct
 *
 * E fixa a consequência prática: um stop 4× mais largo tem de commitir 4× menos capital.
 */
import { describe, it, expect } from 'vitest';
import { computePositionSize } from '../server/services/RiskManager.js';
import { dMul, dDiv, dSub } from '../server/utils/decimal.js';

const EQUITY = 10_000;
const RISK_PER_TRADE_PCT = 1;

function notionalFor(stopDistancePct: number): number {
  const entryPrice = 100;
  const stopLossPrice = entryPrice * (1 - stopDistancePct / 100);
  const size = computePositionSize({
    entryPrice,
    stopLossPrice,
    equity: EQUITY,
    riskPerTradePct: RISK_PER_TRADE_PCT
  });
  expect(size.valid).toBe(true);
  return size.notional;
}

describe('CRITICAL-1 — dimensionamento por risco, igual ao live', () => {
  it('o notional é o risco dividido pela distância do stop', () => {
    for (const stopPct of [1, 1.2, 2, 2.5, 4]) {
      const notional = notionalFor(stopPct);
      const expected = dMul(dDiv(EQUITY, 100), dMul(RISK_PER_TRADE_PCT, dDiv(100, stopPct)));
      expect(notional, `stop ${stopPct}%`).toBeCloseTo(expected, 2);
    }
  });

  it('um stop mais largo commit MENOS capital (relação inversa, e não 100%)', () => {
    const tight = notionalFor(1);
    const mid = notionalFor(2);
    const wide = notionalFor(4);

    expect(mid).toBeLessThan(tight);
    expect(wide).toBeLessThan(mid);
    // Relação exata: dobrar o stop divide o notional por 2.
    expect(tight / mid).toBeCloseTo(2, 6);
    expect(mid / wide).toBeCloseTo(2, 6);
  });

  it('o dimensionamento de risco NÃO é 100% do capital', () => {
    // Este é o defeito: com stops de 1,2%–4%, o motor antigo assumia notional = 100%
    // do equity, sobredimensionando o PnL em 1,2× a 4×.
    for (const stopPct of [1.2, 2, 4]) {
      const fraction = notionalFor(stopPct) / EQUITY;
      expect(fraction, `stop ${stopPct}%`).toBeLessThan(1);
      expect(fraction, `stop ${stopPct}%`).toBeCloseTo(RISK_PER_TRADE_PCT / stopPct, 6);
    }
  });

  it('perder no stop custa exatamente o orçamento de risco, qualquer que seja a largura', () => {
    for (const stopPct of [1, 2, 4]) {
      const entryPrice = 100;
      const stopLossPrice = entryPrice * (1 - stopPct / 100);
      const size = computePositionSize({
        entryPrice,
        stopLossPrice,
        equity: EQUITY,
        riskPerTradePct: RISK_PER_TRADE_PCT
      });
      const lossValue = dMul(dDiv(stopPct, 100), size.notional);
      expect(lossValue, `stop ${stopPct}%`).toBeCloseTo(EQUITY * (RISK_PER_TRADE_PCT / 100), 2);
    }
  });

  it('o custo em PnL % é medido sobre o notional, não sobre o saldo inteiro', () => {
    // Um movimento de +2% no preço, com stop a 2% (notional = 50% do equity), rende
    // +1% do BALANÇO — não +2%. É essa a correção que o motor antigo não fazia.
    const entryPrice = 100;
    const stopPct = 2;
    const stopLossPrice = entryPrice * (1 - stopPct / 100);
    const size = computePositionSize({
      entryPrice,
      stopLossPrice,
      equity: EQUITY,
      riskPerTradePct: RISK_PER_TRADE_PCT
    });
    const priceMovePct = 2;
    const pnlValue = dMul(dDiv(priceMovePct, 100), size.notional);
    const pnlOnBalance = dDiv(pnlValue, EQUITY) * 100;

    expect(pnlOnBalance).toBeCloseTo(priceMovePct * (RISK_PER_TRADE_PCT / stopPct), 6);
    expect(pnlOnBalance).toBeCloseTo(1, 6); // e NÃO 2
  });

  it('BacktestEngine dimensiona pela distância do stop, não pelo saldo inteiro', () => {
    // `dMul(dDiv(tradePnlPct, 100), balance)` é a forma do defeito: PnL% × saldo
    // inteiro. O motor corrigido precisa multiplicar pelo NOTIONAL da posição.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'server', 'services', 'BacktestEngine.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/dMul\(\s*dDiv\(\s*tradePnlPct\s*,\s*100\s*\)\s*,\s*balance\s*\)/);
    // E precisa usar a mesma primitiva de dimensionamento do live.
    expect(src).toContain('computePositionSize');
  });
});