import { describe, it, expect } from 'vitest';
import {
  buildEdgeDiagnosisReport,
  computeSymbolDiagnosis,
  type EdgeDiagnosisInput
} from '../server/services/EdgeDiagnosisService.js';
import type { BacktestResult, BacktestTrade } from '../src/types.js';

/**
 * CA-1.3 — todo resultado com fator em cobertura parcial exibe `reducedFactorSet: true`.
 */

function trade(i: number): BacktestTrade {
  return {
    id: `t${i}`,
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 50000 + i,
    exitPrice: 50050 + i,
    entryTime: 1_700_000_000_000 + i * 900_000,
    exitTime: 1_700_000_000_000 + i * 900_000 + 60_000,
    pnlPct: 0.1,
    pnlValue: 10,
    stopLoss: 49800 + i,
    takeProfit1: 50400 + i,
    takeProfit2: 50800 + i,
    isWin: true,
    durationMinutes: 60,
    rGross: 0.13,
    rFees: 0.02,
    rSlippage: 0.008,
    rFunding: 0.002,
    rNet: 0.1,
    confluenceScore: 72,
    regime: 'TREND_UP'
  };
}

function result(coverage: { openInterest: number; funding: number; longShort: number }, reduced: boolean): BacktestResult {
  return {
    symbol: 'BTCUSDT',
    trades: Array.from({ length: 40 }, (_, i) => trade(i)),
    factorCoverage: coverage,
    reducedFactorSet: reduced
  } as unknown as BacktestResult;
}

describe('8.1 / CA-1.3 — reducedFactorSet em cobertura parcial', () => {
  it('cobertura parcial ⇒ reducedFactorSet true e marcação no markdown', () => {
    const input: EdgeDiagnosisInput = {
      symbol: 'BTCUSDT',
      result: result({ openInterest: 0, funding: 62, longShort: 0 }, true)
    };
    const diag = computeSymbolDiagnosis(input, { seed: 1 });
    expect(diag.reducedFactorSet).toBe(true);

    const report = buildEdgeDiagnosisReport([input], {
      engineVersion: 'test-engine',
      days: 30,
      seed: 1,
      universe: ['BTCUSDT'],
      generatedAt: 1_800_000_000_000
    });
    expect(report.markdown).toContain('reducedFactorSet: true');
  });

  it('cobre sozinho pela cobertura < 100% mesmo sem a flag explícita', () => {
    const input: EdgeDiagnosisInput = {
      symbol: 'BTCUSDT',
      // reducedFactorSet ausente: a função decide pela cobertura.
      result: {
        symbol: 'BTCUSDT',
        trades: [trade(0)],
        factorCoverage: { openInterest: 100, funding: 40, longShort: 100 }
      } as unknown as BacktestResult
    };
    expect(computeSymbolDiagnosis(input).reducedFactorSet).toBe(true);
  });

  it('cobertura total e sem flag ⇒ reducedFactorSet false e sem marcação', () => {
    const input: EdgeDiagnosisInput = {
      symbol: 'BTCUSDT',
      result: result({ openInterest: 100, funding: 100, longShort: 100 }, false)
    };
    expect(computeSymbolDiagnosis(input).reducedFactorSet).toBe(false);
    const report = buildEdgeDiagnosisReport([input], {
      engineVersion: 'test-engine',
      days: 30,
      seed: 1,
      universe: ['BTCUSDT'],
      generatedAt: 1_800_000_000_000
    });
    expect(report.markdown).not.toContain('reducedFactorSet: true');
  });
});
