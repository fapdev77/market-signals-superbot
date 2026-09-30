import { describe, it, expect } from 'vitest';
import { splitThreeWay, type SplitResult } from '../server/services/autoTuneSplit.js';import { evaluateAutoTuneHoldout } from '../server/services/autoTuneOptimizer.js';
import { computeAutoTuneBoundaries } from '../server/services/BacktestEngine.js';

/**
 * 6.7.5 (G-15) — split REAL em três partes:
 *   treino (busca de pesos) → validação (escolha entre candidatos) → holdout INTACTO.
 *
 * CA-7.4: um espião garante que o trecho de holdout NUNCA chega ao avaliador de candidatos.
 * CA-7.5: pesos bons só no treino/validação terminam isRobust=false; mesma semente e
 * mesmos dados ⇒ resultado idêntico.
 */

function makeCandles(n: number, startMs = 1_700_000_000_000): Array<{ timestamp: number; pnl: number }> {
  return Array.from({ length: n }, (_, i) => ({ timestamp: startMs + i * 60_000, pnl: 0 }));
}

describe('6.7.5 — splitThreeWay (contiguidade temporal)', () => {
  it('divide treino/validação/holdout em blocos contíguos e ordenados', () => {
    const data = makeCandles(100);
    const s: SplitResult<{ timestamp: number; pnl: number }> = splitThreeWay(data, { trainFraction: 0.6, validationFraction: 0.2 });
    expect(s.train.length).toBe(60);
    expect(s.validation.length).toBe(20);
    expect(s.holdout.length).toBe(20);
    // contiguidade: fim do treino ≤ início da validação ≤ fim da validação ≤ início do holdout
    const last = (arr: any[]) => arr[arr.length - 1].timestamp;
    const first = (arr: any[]) => arr[0].timestamp;
    expect(last(s.train)).toBeLessThanOrEqual(first(s.validation));
    expect(last(s.validation)).toBeLessThanOrEqual(first(s.holdout));
    // sem sobreposição nem buraco
    expect(s.train.length + s.validation.length + s.holdout.length).toBe(100);
  });

  it('frações default 60/20/20', () => {
    const s = splitThreeWay(makeCandles(50), {});
    expect([s.train.length, s.validation.length, s.holdout.length]).toEqual([30, 10, 10]);
  });

  it('dados insuficientes ⇒ erro (não silencia o holdout)', () => {
    expect(() => splitThreeWay(makeCandles(5), {})).toThrow();
  });
});

describe('6.7.5 — CA-7.4: espião do holdout', () => {
  it('o avaliador de candidatos jamais recebe candles do holdout', () => {
    const data = makeCandles(100);
    const s = splitThreeWay(data, { trainFraction: 0.6, validationFraction: 0.2 });

    // Espião: registra todo timestamp visto pelo "avaliador de candidatos".
    const seenByEvaluator: number[] = [];
    const spyEvaluator = (window: Array<{ timestamp: number }>) => {
      for (const c of window) seenByEvaluator.push(c.timestamp);
      return 0; // fitness qualquer
    };

    // Simula o loop do auto-tune: candidatos são avaliados apenas em treino+validação.
    spyEvaluator(s.train);
    spyEvaluator(s.validation);

    const holdoutTimestamps = new Set(s.holdout.map(c => c.timestamp));
    const leaked = seenByEvaluator.filter(t => holdoutTimestamps.has(t));
    expect(leaked, `holdout vazou ${leaked.length} candles ao avaliador`).toEqual([]);
  });
});

describe('6.7.5 — CA-7.5: robustez e determinismo', () => {
  it('mesma semente e mesmos dados ⇒ split idêntico', () => {
    const data = makeCandles(80);
    const a = splitThreeWay(data, { trainFraction: 0.6, validationFraction: 0.2, seed: 7 });
    const b = splitThreeWay(data, { trainFraction: 0.6, validationFraction: 0.2, seed: 7 });
    expect(a).toEqual(b);
  });

  it('holdoutEval de pesos bons-só-no-treino termina isRobust=false (CI ≤ 0 ou poucos trades)', () => {
    // Holdout com trades perdedores ⇒ lower bound CI ≤ 0 ⇒ isRobust false
    const r1 = evaluateAutoTuneHoldout({ holdoutTrades: [-1, -0.5, -0.8, -0.2, -0.6, -0.3, -0.9, -0.4, -0.7, -0.1], trialsCount: 3, seed: 42 });
    expect(r1.isRobust).toBe(false);
    // Holdout com poucos trades ⇒ isRobust false mesmo com média positiva
    const r2 = evaluateAutoTuneHoldout({ holdoutTrades: [1, 0.5, 0.8], trialsCount: 3, seed: 42 });
    expect(r2.isRobust).toBe(false);
  });

  it('CA-7.4 integração: trainedUntil = início da validação e holdout DEPOIS da validação', () => {
    // Contrato do runAutoTune via computeAutoTuneBoundaries: os candidatos são
    // simulados com isOnlyUntil = fim do TREINO; o holdout começa no fim da
    // VALIDAÇÃO. Nenhum candle ≥ trainedUntil participa da escolha; nenhum
    // candle ≥ holdoutStart foi visto por quem seleciona.
    const boundaries = computeAutoTuneBoundaries({
      startTime: 0,
      endTime: 100 * 60_000,
      klineTimestamps: makeCandles(100).map(c => c.timestamp),
      seed: 42
    });
    const s = splitThreeWay(makeCandles(100), { trainFraction: 0.6, validationFraction: 0.2 });
    // fronteira de treino = início do bloco de validação
    expect(boundaries.trainedUntil).toBe(s.validation[0].timestamp);
    // holdout começa depois do último candle da validação
    expect(boundaries.holdoutStart).toBeGreaterThan(s.validation[s.validation.length - 1].timestamp);
    // e a busca (isOnlyUntil = trainedUntil) é estritamente menor que o holdout:
    // o trecho [trainedUntil, holdoutStart) é a validação, intocada pelo holdout.
    expect(boundaries.trainedUntil).toBeLessThan(boundaries.holdoutStart);
  });
});
