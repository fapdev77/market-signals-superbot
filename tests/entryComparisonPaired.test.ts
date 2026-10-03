import { describe, it, expect } from 'vitest';
import {
  signalKeyMap,
  buildPairedSeries,
  bootstrapPairedDiffCI,
  computePairedArmMetrics,
  buildPairedEntryComparisonReport,
  buildUniversePairedEntryComparisonReport,
  renderEntryDecisionDoc
} from '../server/services/entryComparisonPaired.js';
import type { BacktestResult, EntryConfirmationStats } from '../src/types.js';

/** 8.2.1 — o comparativo pareia os braços pelo MESMO sinal (chave determinística). */

function ec(overrides: Partial<EntryConfirmationStats> = {}): EntryConfirmationStats {
  return {
    enabled: true,
    signalsEmitted: 0,
    entriesFilled: 0,
    entriesNotFilled: 0,
    entriesInvalidated: 0,
    rPerSignal: [],
    signalKeys: [],
    fillMinutesSum: 0,
    fillCount: 0,
    ...overrides
  };
}

function result(
  overrides: Partial<BacktestResult> & { ec?: Partial<EntryConfirmationStats> } = {}
): BacktestResult {
  const { ec: ecOver, ...rest } = overrides;
  const entryConfirmation = ec(ecOver);
  return {
    id: 'r',
    symbol: 'BTCUSDT',
    profile: 'daytrade',
    strategyId: 's',
    startTime: 0,
    endTime: 0,
    totalCandlesTested: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 50,
    profitFactor: 1,
    maxDrawdown: 8,
    netProfit: 0,
    avgWinPct: 0,
    avgLossPct: 0,
    avgRiskReward: 0,
    avgDurationMinutes: 0,
    equityCurve: [],
    diagnostic: { strengths: [], weaknesses: [], weightAnalysis: [], suggestions: [] },
    config: { symbol: 'BTCUSDT', weights: {} as BacktestResult['config']['weights'] },
    createdAt: 0,
    entryConfirmation,
    ...rest
  };
}

describe('8.2.1 / CA-2.1 — pareamento por sinal', () => {
  it('conjuntos idênticos produzem signalsEmitted iguais nos dois braços', () => {
    const keys = ['k1', 'k2', 'k3', 'k4'];
    const control = result({ ec: { signalsEmitted: 4, entriesFilled: 4, signalKeys: keys, rPerSignal: [1, -1, 0.5, -0.5] } });
    const withC = result({ ec: { signalsEmitted: 4, entriesFilled: 3, signalKeys: keys, rPerSignal: [1.1, -0.9, 0.6, 0] } });

    const series = buildPairedSeries(control, withC);
    expect(series.keys).toEqual(keys);

    const c = computePairedArmMetrics(control, series, 'control');
    const w = computePairedArmMetrics(withC, series, 'with');
    expect(c.signalsEmitted).toBe(w.signalsEmitted);
    expect(c.signalsEmitted).toBe(4);
  });

  it('chaves ausentes em um braço entram com R = 0 no outro (união)', () => {
    const control = result({ ec: { signalsEmitted: 2, signalKeys: ['a', 'b'], rPerSignal: [1, 1] } });
    const withC = result({ ec: { signalsEmitted: 2, signalKeys: ['b', 'c'], rPerSignal: [1, 1] } });
    const map = signalKeyMap(control.entryConfirmation);
    expect(map.get('a')).toBe(1);
    expect(map.get('c')).toBeUndefined();

    const series = buildPairedSeries(control, withC);
    expect(series.keys).toEqual(['a', 'b', 'c']);
    expect(series.controlR).toEqual([1, 1, 0]);
    expect(series.withR).toEqual([0, 1, 1]);
    // Médias iguais: a diferença pareada é 0.
    expect(bootstrapPairedDiffCI(series.controlR, series.withR, { seed: 1, iterations: 200 }).mean).toBe(0);
  });
});

describe('8.2.1 / CA-2.2 — diferença pareada bate com o cálculo manual', () => {
  it('braços diferindo em 10% dos sinais: média pareada manual', () => {
    // 10 sinais; só k1 tem R diferente (10% dos pares). Ausente = 0.
    const controlKeys = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10'];
    const controlR = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const withR = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const control = result({ ec: { signalsEmitted: 10, entriesFilled: 5, signalKeys: controlKeys, rPerSignal: controlR } });
    const withC = result({ ec: { signalsEmitted: 10, entriesFilled: 5, signalKeys: controlKeys, rPerSignal: withR } });

    const series = buildPairedSeries(control, withC);
    const diff = bootstrapPairedDiffCI(series.controlR, series.withR, { seed: 7, iterations: 1000 });

    // Média pareada = Σ(with − control)/n = (2 − 1)/10 = 0.1.
    expect(diff.mean).toBeCloseTo(0.1, 10);
    expect(diff.pairs).toBe(10);
    // Bootstrap pareado é determinístico para a mesma semente.
    const again = bootstrapPairedDiffCI(series.controlR, series.withR, { seed: 7, iterations: 1000 });
    expect(again).toEqual(diff);
  });
});

describe('8.2.1 / CA-2.4 — relatório e documento de decisão coerentes', () => {
  const control = result({
    totalTrades: 40, positionsClosed: 40, positionsFilled: 40, winRate: 50, maxDrawdown: 18.89,
    rDecomposition: { rGross: 0.1, rFees: 0.02, rSlippage: 0.01, rFunding: 0.005, rNet: 0.065, costAvgR: 0.035, positions: 40 },
    ec: { signalsEmitted: 40, entriesFilled: 40, signalKeys: ['a', 'b', 'c', 'd'], rPerSignal: [1, 1] }
  });
  const withC = result({
    totalTrades: 38, positionsClosed: 38, positionsFilled: 38, winRate: 52, maxDrawdown: 19,
    rDecomposition: { rGross: 0.12, rFees: 0.02, rSlippage: 0.01, rFunding: 0.006, rNet: 0.084, costAvgR: 0.036, positions: 38 },
    ec: { signalsEmitted: 38, entriesFilled: 38, signalKeys: ['a', 'b', 'c', 'd'], rPerSignal: [1.2, 1.1] }
  });

  function build() {
    return buildPairedEntryComparisonReport({
      symbol: 'BTCUSDT',
      days: 30,
      seed: 42,
      engineVersion: 'deadbee',
      control,
      withConfirmation: withC,
      generatedAt: 1_700_000_000_000,
      iterations: 300
    });
  }

  it('markdown é determinístico com a mesma semente', () => {
    expect(build().markdown).toBe(build().markdown);
  });

  it('o documento de decisão contém os números do relatório', () => {
    const report = build();
    const doc = renderEntryDecisionDoc(report, {
      engineVersion: 'deadbee',
      generatedAt: '2026-10-02T00:00:00.000Z',
      symbol: 'BTCUSDT',
      days: 30,
      seed: 42
    });
    expect(doc).toContain(String(report.controlMetrics.entriesFilled));
    expect(doc).toContain(report.controlMetrics.expectancyR.toFixed(4));
    expect(doc).toContain(report.withMetrics.expectancyR.toFixed(4));
    expect(doc).toContain(report.diff.mean.toFixed(4));
    expect(doc).toContain(report.diff.ciLow.toFixed(4));
    expect(doc).toContain(report.decision.enable ? 'LIGAR' : 'MANTER DESLIGADA');
  });

  it('o relatório traz as contagens por posição (não mais "fechados > preenchidos")', () => {
    const md = build().markdown;
    expect(md).toContain('Posições preenchidas');
    expect(md).toContain('Posições fechadas');
    expect(md).toContain('Sinais no conjunto pareado');
    expect(md).toContain(`Pares: **`);
  });
});

describe('8.2.3 — comparativo agregado do universo', () => {
  function arm(keys: string[], r: number[], filled: number, dd: number) {
    return result({
      totalTrades: filled,
      positionsClosed: filled,
      positionsFilled: filled,
      winRate: 50,
      maxDrawdown: dd,
      ec: { signalsEmitted: keys.length, entriesFilled: filled, signalKeys: keys, rPerSignal: r }
    });
  }

  it('agrega os pares de todos os símbolos e decide uma vez', () => {
    const keys = ['k1', 'k2', 'k3'];
    const report = buildUniversePairedEntryComparisonReport({
      symbols: ['AAAUSDT', 'BBBUSDT'],
      days: 30,
      seed: 42,
      engineVersion: 'deadbee',
      iterations: 300,
      dataOrigin: 'LIVE',
      runs: [
        { symbol: 'AAAUSDT', control: arm(keys, [1, 0, 0], 40, 10), withConfirmation: arm(keys, [1.5, 0, 0], 40, 9) },
        { symbol: 'BBBUSDT', control: arm(keys, [1, 0, 0], 40, 11), withConfirmation: arm(keys, [1.5, 0, 0], 40, 10) }
      ]
    });

    expect(report.perSymbol.map(s => s.symbol)).toEqual(['AAAUSDT', 'BBBUSDT']);
    expect(report.diff.pairs).toBe(6);
    // (1.5 − 1)/3 = 0.1667 em cada símbolo; agregado igual.
    expect(report.diff.mean).toBeCloseTo(0.1667, 4);
    expect(report.controlMetrics.entriesFilled).toBe(80);
    expect(report.withMetrics.entriesFilled).toBe(80);
    expect(report.markdown).toContain('universo');
    expect(report.markdown).toContain('AAAUSDT');
  });

  it('determinístico para a mesma semente', () => {
    const keys = ['k1', 'k2', 'k3', 'k4'];
    const mk = () => buildUniversePairedEntryComparisonReport({
      symbols: ['AAAUSDT'],
      days: 30,
      seed: 7,
      engineVersion: 'x',
      iterations: 200,
      generatedAt: 1_700_000_000_000,
      runs: [
        { symbol: 'AAAUSDT', control: arm(keys, [1, -1, 0.5, 0], 30, 12), withConfirmation: arm(keys, [1.2, -0.9, 0.6, 0.1], 30, 11) }
      ]
    });
    expect(mk().markdown).toBe(mk().markdown);
  });
});
