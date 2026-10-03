import { describe, it, expect } from 'vitest';
import {
  buildEdgeDiagnosisReport,
  computeSymbolDiagnosis,
  type EdgeDiagnosisInput
} from '../server/services/EdgeDiagnosisService.js';
import type { BacktestResult, BacktestTrade } from '../src/types.js';

/**
 * CA-1.1 — mesma entrada e mesma semente produzem relatório IDÊNTICO.
 */

function trade(i: number, net: number): BacktestTrade {
  return {
    id: `t${i}`,
    symbol: 'BTCUSDT',
    direction: i % 2 === 0 ? 'LONG' : 'SHORT',
    entryPrice: 50000 + i,
    exitPrice: 50000 + i + net * 10,
    entryTime: 1_700_000_000_000 + i * 900_000,
    exitTime: 1_700_000_000_000 + i * 900_000 + 60_000,
    pnlPct: net,
    pnlValue: net * 10,
    stopLoss: 50000 + i - 200,
    takeProfit1: 50000 + i + 400,
    takeProfit2: 50000 + i + 800,
    isWin: net > 0,
    durationMinutes: 60,
    legs: 2,
    rGross: net + 0.03,
    rFees: 0.02,
    rSlippage: 0.008,
    rFunding: 0.002,
    rNet: net,
    confluenceScore: 55 + (i % 40),
    regime: (['TREND_UP', 'TREND_DOWN', 'RANGE'] as const)[i % 3]
  };
}

function result(symbol: string, trades: BacktestTrade[]): BacktestResult {
  return {
    symbol,
    trades,
    factorCoverage: { openInterest: 100, funding: 100, longShort: 100 },
    reducedFactorSet: false
  } as unknown as BacktestResult;
}

function inputs(): EdgeDiagnosisInput[] {
  return [
    { symbol: 'BTCUSDT', result: result('BTCUSDT', Array.from({ length: 40 }, (_, i) => trade(i, (i % 4) - 1.2))) },
    { symbol: 'ETHUSDT', result: result('ETHUSDT', Array.from({ length: 35 }, (_, i) => trade(i + 100, (i % 3) - 0.8))) }
  ];
}

const META = { engineVersion: 'test-engine', days: 30, seed: 42, iterations: 500, universe: ['BTCUSDT', 'ETHUSDT'], generatedAt: 1_800_000_000_000 };

describe('8.1 / CA-1.1 — determinismo do diagnóstico do edge', () => {
  it('o mesmo input + semente produz markdown idêntico', () => {
    const a = buildEdgeDiagnosisReport(inputs(), META);
    const b = buildEdgeDiagnosisReport(inputs(), META);
    expect(a.markdown).toBe(b.markdown);
    expect(a.verdict).toEqual(b.verdict);
    expect(a.markdown).toContain('Diagnóstico do edge (8.1)');
  });

  it('sementes diferentes mudam apenas o IC bootstrap, não os n por faixa', () => {
    const a = buildEdgeDiagnosisReport(inputs(), { ...META, seed: 1 });
    const b = buildEdgeDiagnosisReport(inputs(), { ...META, seed: 2 });
    expect(a.symbols[0].summary.n).toBe(b.symbols[0].summary.n);
    expect(a.symbols[0].byScoreBand.map(g => g.n)).toEqual(b.symbols[0].byScoreBand.map(g => g.n));
    // O ponto estimado (média) é o mesmo; só o intervalo difere.
    expect(a.symbols[0].summary.netR).toBeCloseTo(b.symbols[0].summary.netR, 10);
  });

  it('computeSymbolDiagnosis é determinístico e cobre os grupos esperados', () => {
    const input = inputs()[0];
    const d1 = computeSymbolDiagnosis(input, { seed: 7 });
    const d2 = computeSymbolDiagnosis(input, { seed: 7 });
    expect(d1).toEqual(d2);
    expect(d1.summary.n).toBe(40);
    expect(d1.byScoreBand.length).toBeGreaterThan(0);
    expect(d1.byRegime.length).toBeGreaterThan(0);
    expect(d1.bySession.length).toBeGreaterThan(0);
    expect(d1.byStopBand).toHaveLength(5);
    expect(d1.maxStopTradeoff.length).toBeGreaterThan(0);
  });
});
