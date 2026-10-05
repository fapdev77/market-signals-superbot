import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RISK_LIMITS,
  evaluatePortfolioRisk,
  signalOpenRiskAmount,
  signalStopDistancePct
} from '../server/services/RiskManager.js';
import type { TradeSignal } from '../src/types.js';

/**
 * M5 (auditoria 2026-10-04) — `signalRiskPct` prometia risco aberto e devolvia
 * distância de stop.
 *
 * A confusão não era cosmética. `evaluatePortfolioRisk` filtrava os sinais por
 * `signalRiskPct(...) > 0` e depois somava `riskPerTradePct` por sinal, de modo
 * que o nome prometia uma medição que a unidade não era: o valor nunca entrava
 * na soma, só decidia quem contava. Um sinal cujo tamanho não pode ser
 * computado (`computePositionSize` inválido) contava o orçamento inteiro mesmo
 * sem risco deployável, e nenhum consumidor conseguia distinguir as duas
 * grandezas porque havia uma função só.
 *
 * Este guard fixa a distinção: distância de stop é geometria do sinal (independe
 * do equity); risco aberto é o que o orçamento de risco realmente imobiliza.
 */

function signalWith(overrides: Partial<TradeSignal>): TradeSignal {
  return {
    id: 's',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [100, 100.5],
    stopLoss: 99.7,
    target1: 102,
    target2: 104,
    isBreakevenActive: false,
    status: 'ACTIVE',
    createdAt: 1,
    ...overrides
  } as TradeSignal;
}

describe('M5 — distância de stop e risco aberto são grandezas distintas', () => {
  it('signalStopDistancePct é a distância |entry−stop|/entry, em %', () => {
    // entry 100, stop 99.7 → 0.3%
    expect(signalStopDistancePct(signalWith({}))).toBeCloseTo(0.3, 6);
  });

  it('a distância de stop não depende do equity nem do orçamento de risco', () => {
    const narrow = signalWith({ entryZone: [100, 100], stopLoss: 99.7 });
    const wide = signalWith({ entryZone: [100, 100], stopLoss: 90 });
    expect(signalStopDistancePct(narrow)).not.toBe(signalStopDistancePct(wide));
    // Mesma geometria, riscos de trade diferentes: a distância não se move.
    const before = signalStopDistancePct(narrow);
    const smallBudget = evaluatePortfolioRisk([narrow], { ...DEFAULT_RISK_LIMITS, riskPerTradePct: 0.25 });
    const bigBudget = evaluatePortfolioRisk([narrow], { ...DEFAULT_RISK_LIMITS, riskPerTradePct: 5 });
    expect(smallBudget.openRiskPct).toBeCloseTo(0.25, 6);
    expect(bigBudget.openRiskPct).toBeCloseTo(5, 6);
    expect(before).toBeCloseTo(0.3, 6);
  });

  it('signalOpenRiskAmount devolve a moeda imobilizada, não a distância', () => {
    // Stop a 0.3% do entry, orçamento de 1% sobre 10 000 de equity.
    // Risco aberto = 100 (1% do equity). Distância = 0.3%. São números
    // diferentes em unidades diferentes: um é moeda, o outro é percentagem
    // de preço. Uma função só não pode responder as duas perguntas.
    const risk = signalOpenRiskAmount(signalWith({}), DEFAULT_RISK_LIMITS);
    expect(risk).toBeCloseTo(100, 6);
    expect(signalStopDistancePct(signalWith({}))).toBeCloseTo(0.3, 6);
  });

  it('um stop largo não altera o risco aberto: o orçamento é o que limita', () => {
    const wide = signalWith({ entryZone: [100, 100], stopLoss: 60 });
    expect(signalStopDistancePct(wide)).toBeCloseTo(40, 6);
    expect(signalOpenRiskAmount(wide, DEFAULT_RISK_LIMITS)).toBeCloseTo(100, 6);
  });

  it('preços não mensuráveis não geram risco, e isso fica visível', () => {
    const broken = signalWith({ entryZone: undefined });
    expect(signalOpenRiskAmount(broken, DEFAULT_RISK_LIMITS)).toBe(0);

    const result = evaluatePortfolioRisk([broken], DEFAULT_RISK_LIMITS);
    expect(result.openRiskAmount).toBe(0);
    expect(result.openRiskPct).toBe(0);
    // A exclusão não pode ser silenciosa: um risco não mensurado que some da
    // soma sem ser contado é exatamente o buraco que M5 abriu.
    expect(result.unmeasurableCount).toBe(1);
  });
});

describe('M5 — evaluatePortfolioRisk soma risco aberto real', () => {
  it('soma o risco aberto de cada sinal, não o orçamento presumido', () => {
    const open = Array.from({ length: 4 }, (_, i) => signalWith({ id: `s${i}` }));
    const result = evaluatePortfolioRisk(open, {
      ...DEFAULT_RISK_LIMITS,
      maxConcurrentSignals: 100,
      maxSignalsPerCategory: 100,
      maxPortfolioRiskPct: 50
    });
    // 4 sinais × 1% de 10 000 = 400 → 4% do equity.
    expect(result.openRiskAmount).toBeCloseTo(400, 6);
    expect(result.openRiskPct).toBeCloseTo(4, 6);
    expect(result.allowed).toBe(true);
  });

  it('um sinal sem tamanho computável não infla o risco da carteira', () => {
    // Equity minúsculo → tamanho abaixo do mínimo negociável → sem risco
    // deployável. A versão antiga contava o orçamento inteiro assim mesmo.
    const open = Array.from({ length: 6 }, (_, i) => signalWith({ id: `s${i}` }));
    const result = evaluatePortfolioRisk(open, {
      ...DEFAULT_RISK_LIMITS,
      accountEquity: 0.0005,
      maxConcurrentSignals: 100,
      maxSignalsPerCategory: 100,
      maxPortfolioRiskPct: 50
    });
    expect(result.openRiskAmount).toBe(0);
    expect(result.openRiskPct).toBe(0);
    expect(result.unmeasurableCount).toBe(6);
  });

  it('o teto de carteira é comparado contra o risco aberto somado', () => {
    const open = Array.from({ length: 3 }, (_, i) => signalWith({ id: `s${i}` }));
    const result = evaluatePortfolioRisk(open, {
      ...DEFAULT_RISK_LIMITS,
      maxConcurrentSignals: 100,
      maxSignalsPerCategory: 100,
      maxPortfolioRiskPct: 2
    });
    expect(result.openRiskPct).toBeCloseTo(3, 6);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Risco agregado/i);
  });
});
