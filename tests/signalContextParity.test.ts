import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSignalContext, DEFAULT_MAX_STOP_LOSS_ATR_MULTIPLE } from '../server/signalEngine';
import type { IndicatorWeights } from '../src/types';

/**
 * A-05 (FASE 1) — paridade live ↔ backtest pelo CONTEXTO, não pelo resultado.
 *
 * Antes: `weights` era `undefined` nos dois caminhos (knobs tipados e validados
 * inertes) e `filters` existia só no live. Agora os dois lados montam o contexto
 * pela mesma função, e qualquer diferença que sobreviva fica DECLARADA em
 * `parityWarnings` em vez de silenciosa.
 */

function weights(overrides: Partial<IndicatorWeights> = {}): IndicatorWeights {
  return {
    volumeSurgeWeight: 15,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 15,
    rangePocWeight: 10,
    supportResistanceWeight: 10,
    minRiskRewardRatio: 2.5,
    volumeProfileRange: 50,
    ...overrides
  };
}

describe('A-05 — contexto único de sinal', () => {
  it('resolve o cap de stop a partir do knob tipado (não de um literal duplicado)', () => {
    const ctx = buildSignalContext({ weights: weights({ maxStopLossAtrMultiple: 1.8 }) });
    expect(ctx.stopCapMultiple).toBe(1.8);
  });

  it('usa o default compartilhado quando o knob não existe', () => {
    const ctx = buildSignalContext({ weights: weights() });
    expect(ctx.stopCapMultiple).toBe(DEFAULT_MAX_STOP_LOSS_ATR_MULTIPLE);
  });

  it('o mesmo weights produz o mesmo contexto nos dois caminhos', () => {
    const shared = weights({ maxStopLossAtrMultiple: 2.2, minRiskRewardRatio: 3 });
    const live = buildSignalContext({ weights: shared, strategyCategory: 'INTRADAY', filters: { tickSize: 0.1 } as never });
    const backtest = buildSignalContext({ weights: shared, strategyCategory: 'INTRADAY' });

    expect(live.minRiskRewardRatio).toBe(backtest.minRiskRewardRatio);
    expect(live.stopCapMultiple).toBe(backtest.stopCapMultiple);
    expect(live.ttlSettings).toEqual(backtest.ttlSettings);
  });

  it('declara as diferenças de paridade em vez de escondê-las', () => {
    const noFilters = buildSignalContext({ weights: weights() });
    expect(noFilters.parityWarnings.some(w => w.includes('filters'))).toBe(true);
    expect(noFilters.parityWarnings.some(w => w.includes('weights'))).toBe(false);

    const noWeights = buildSignalContext({});
    expect(noWeights.parityWarnings.some(w => w.includes('weights'))).toBe(true);
  });

  it('não emite avisos quando weights e filters estão presentes', () => {
    const ctx = buildSignalContext({ weights: weights(), filters: { tickSize: 0.1 } as never });
    expect(ctx.parityWarnings).toEqual([]);
  });

  it('os DOIS call sites passam weights ao motor (fim do knobs inertes)', () => {
    const live = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const backtest = fs.readFileSync(path.join(process.cwd(), 'server/services/BacktestEngine.ts'), 'utf8');

    // POSITIVO: o argumento real na posição de weights É o objeto `weights`
    // (comentários entre os args são aceitos — o nome precisa aparecer lá)
    expect(live).toMatch(/weights\.signalTtlSettings,\s*(?:\/\/[^\n]*\r?\n\s*)*weights,/);
    expect(backtest).toMatch(/\/\/ ttlSettings\s*\r?\n\s*(?:\/\/[^\n]*\r?\n\s*)*weights,/);
    // o processTickerState do backtest também recebe weights (não undefined)
    expect(backtest).toMatch(/processTickerState\(\s*rawTicker,[\s\S]{0,200}?\r?\n\s*weights,/);

    // NEGATIVO: nenhum `undefined` na posição de weights nos dois call sites
    expect(live).not.toMatch(/weights\.signalTtlSettings,\s*\r?\n\s*undefined,/);
    expect(backtest).not.toMatch(/\/\/ ttlSettings\s*\r?\n\s*undefined,/);
  });
});
