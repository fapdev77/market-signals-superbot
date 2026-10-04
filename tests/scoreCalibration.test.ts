/**
 * SDD Fase 9 — S2 / CRÍTICO-3: `confluenceScore` calibrado contra base rate.
 *
 * RED tests. Devem falhar antes de `server/services/scoreCalibration.ts` existir.
 *
 * DEFEITO DE ORIGEM:
 *   const confluenceScore = Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25));
 * `netScore = 0` — nenhum fator a favor, nenhum contra — produz 25%. A saturação em 100
 * chega com ~4 fatores moderados. E a UI o exibe como "NN% CONFLUÊNCIA", que o leitor
 * entende como probabilidade de acerto. Não é: `confluenceScore` mede FORÇA de
 * confluência, e força não é probabilidade.
 *
 * O que este arquivo trava:
 *  1. a calibração usa `rExpectancy` (R) e NUNCA `winRate` — 90% de acerto com R:R 0,2
 *     é prejuízo, e um operador que olhasse winRate tomaria a decisão errada;
 *  2. sem amostra suficiente, a função DEGRADA para o prior e diz que degradou
 *     (`confidence`), em vez de devolver um número com ar de precisão;
 *  3. o encolhimento nunca extrapola além do empírico nem do prior.
 */
import { describe, it, expect } from 'vitest';
import {
  calibrateScore,
  tierKeyForScore,
  SHRINKAGE_K,
  MIN_SAMPLE_FOR_CALIBRATION,
  type CalibrationInput
} from '../server/services/scoreCalibration.js';
import type { EvidenceGroupMetrics } from '../server/services/EvidenceService.js';

const metrics = (over: Partial<EvidenceGroupMetrics> = {}): EvidenceGroupMetrics => ({
  n: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  wilsonInterval: [0, 0],
  rExpectancy: 0,
  avgMfe: 0,
  avgMae: 0,
  cumulativeR: 0,
  maxDrawdownR: 0,
  ...over
});

/** Resumo com prior global e um tier por chave. */
const summary = (
  overall: EvidenceGroupMetrics,
  byScoreTier: Record<string, EvidenceGroupMetrics>
): CalibrationInput => ({ overall, byScoreTier });

describe('S2.1 — a chave de tier é uma definição única', () => {
  it('agrupa por dezenas, igual ao que o ledger já gravava', () => {
    expect(tierKeyForScore(0)).toBe('0-9');
    expect(tierKeyForScore(9)).toBe('0-9');
    expect(tierKeyForScore(10)).toBe('10-19');
    expect(tierKeyForScore(67)).toBe('60-69');
    expect(tierKeyForScore(100)).toBe('100-109');
  });

  it('normaliza score fora da faixa em vez de gerar chave órfã', () => {
    expect(tierKeyForScore(-5)).toBe('0-9');
    expect(tierKeyForScore(140)).toBe('100-109');
    expect(tierKeyForScore(Number.NaN)).toBe('0-9');
  });
});

describe('S2.2 — calibração por encolhimento em direção ao prior', () => {
  const overall = metrics({ n: 400, rExpectancy: 0.1 });

  it('sem bucket correspondente devolve o prior e se declara NÃO CALIBRADO', () => {
    const out = calibrateScore(70, summary(overall, {}));
    expect(out.confidence).toBe('UNCALIBRATED');
    expect(out.sampleSize).toBe(0);
    expect(out.basis).toBe('GLOBAL_PRIOR');
    expect(out.expectancyR).toBe(0.1);
  });

  it('bucket presente mas vazio também é NÃO CALIBRADO (n = 0 não é evidência)', () => {
    const out = calibrateScore(70, summary(overall, { '70-79': metrics({ n: 0 }) }));
    expect(out.confidence).toBe('UNCALIBRATED');
    expect(out.expectancyR).toBe(0.1);
  });

  it('n = 1 fica colado no prior (peso 1/31)', () => {
    const out = calibrateScore(70, summary(overall, { '70-79': metrics({ n: 1, rExpectancy: 1.5 }) }));
    const expected = 0.1 + (1.5 - 0.1) * (1 / (1 + SHRINKAGE_K));
    expect(out.expectancyR).toBeCloseTo(expected, 4);
    expect(out.confidence).toBe('THIN_SAMPLE');
    expect(out.sampleSize).toBe(1);
  });

  it('n grande aproxima o empírico', () => {
    const out = calibrateScore(70, summary(overall, { '70-79': metrics({ n: 300, rExpectancy: 0.4 }) }));
    const expected = 0.1 + (0.4 - 0.1) * (300 / (300 + SHRINKAGE_K));
    expect(out.expectancyR).toBeCloseTo(expected, 4);
    expect(out.expectancyR).toBeCloseTo(0.4, 1);
    expect(out.confidence).toBe('CALIBRATED');
  });

  it('n no limiar exato ainda é THIN_SAMPLE; um a mais já é CALIBRATED', () => {
    const atLimit = calibrateScore(70, summary(overall, { '70-79': metrics({ n: MIN_SAMPLE_FOR_CALIBRATION - 1 }) }));
    const overLimit = calibrateScore(70, summary(overall, { '70-79': metrics({ n: MIN_SAMPLE_FOR_CALIBRATION }) }));
    expect(atLimit.confidence).toBe('THIN_SAMPLE');
    expect(overLimit.confidence).toBe('CALIBRATED');
  });

  it('nunca extrapola: o resultado fica entre o prior e o empírico', () => {
    for (const n of [1, 5, 30, 120, 999]) {
      const up = calibrateScore(70, summary(overall, { '70-79': metrics({ n, rExpectancy: 0.9 }) }));
      expect(up.expectancyR).toBeGreaterThanOrEqual(0.1);
      expect(up.expectancyR).toBeLessThanOrEqual(0.9);
      const down = calibrateScore(70, summary(overall, { '70-79': metrics({ n, rExpectancy: -0.8 }) }));
      expect(down.expectancyR).toBeLessThanOrEqual(0.1);
      expect(down.expectancyR).toBeGreaterThanOrEqual(-0.8);
    }
  });

  it('o peso da evidência cresce com n (monotonia na evidencia, nao no score)', () => {
    const dist = [1, 10, 50, 200, 1000].map(
      n => calibrateScore(70, summary(overall, { '70-79': metrics({ n, rExpectancy: 1 }) })).expectancyR
    );
    for (let i = 1; i < dist.length; i++) {
      expect(dist[i]).toBeGreaterThan(dist[i - 1]);
    }
    expect(dist[dist.length - 1]).toBeCloseTo(1, 1);
  });

  it('scores do mesmo tier produzem exatamente a mesma expectativa', () => {
    const s = summary(overall, { '60-69': metrics({ n: 80, rExpectancy: 0.25 }) });
    const a = calibrateScore(60, s);
    const b = calibrateScore(69, s);
    expect(a.expectancyR).toBe(b.expectancyR);
    expect(a.tierKey).toBe('60-69');
  });
});

describe('S2.3 — a calibração usa R, nunca win rate', () => {
  const overall = metrics({ n: 500, rExpectancy: -0.05 });

  it('winRate absurdo com o mesmo rExpectancy não muda o resultado', () => {
    const a = calibrateScore(70, summary(overall, { '70-79': metrics({ n: 90, rExpectancy: 0.3, winRate: 95 }) }));
    const b = calibrateScore(70, summary(overall, { '70-79': metrics({ n: 90, rExpectancy: 0.3, winRate: 12 }) }));
    expect(a.expectancyR).toBe(b.expectancyR);
  });

  it('um tier com winRate altíssimo e expectancy negativa NÃO vira recomendação', () => {
    // 92% de acerto, mas R negativo: é exatamente o caso que só o R revela.
    const out = calibrateScore(
      80,
      summary(overall, { '80-89': metrics({ n: 200, rExpectancy: -0.2, winRate: 92 }) })
    );
    expect(out.expectancyR).toBeLessThan(0);
  });
});

describe('S2.4 — degradação explícita quando não há base', () => {
  it('sem resumo nenhum, responde UNCALIBRATED com prior zero', () => {
    for (const input of [undefined, null, {} as CalibrationInput]) {
      const out = calibrateScore(70, input);
      expect(out.confidence).toBe('UNCALIBRATED');
      expect(out.expectancyR).toBe(0);
      expect(out.sampleSize).toBe(0);
    }
  });

  it('prior global sem amostra vale zero, sem inventar expectativa', () => {
    const out = calibrateScore(70, summary(metrics({ n: 0, rExpectancy: 0 }), { '70-79': metrics({ n: 10, rExpectancy: 0.5 }) }));
    // Sem base global, o prior é 0 e o bucket de n=10 ainda encolhe para perto de 0.
    expect(out.expectancyR).toBeLessThan(0.5 * 0.5);
  });

  it('o rótulo diz o que o número significa (força não é probabilidade)', () => {
    const s = summary(metrics({ n: 300, rExpectancy: 0.1 }), { '70-79': metrics({ n: 100, rExpectancy: 0.3 }) });
    const out = calibrateScore(70, s);
    expect(out.label).toContain('R');
    expect(out.label).not.toMatch(/\d+\s*%/);
  });
});
// ---------------------------------------------------------------------------
// S2.5 — a chave de tier não pode divergir entre servidor e UI.
// ---------------------------------------------------------------------------

describe('S2.5 — guard de drift da chave de tier', () => {
  it('servidor e UI produzem a mesma chave em toda a faixa válida', async () => {
    const ui = await import('../src/utils/scoreTier.js');
    for (let score = 0; score <= 100; score++) {
      expect(tierKeyForScore(score)).toBe(ui.tierKeyForScore(score));
    }
  });

  it('o ledger grava a mesma chave que a calibração lê', async () => {
    // Se `server/db.ts` voltasse a montar a chave na mão, o tier gravado e o tier
    // calibrado divergiriam e a tela passaria a mostrar a expectativa do bucket errado.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const db = readFileSync(resolve(process.cwd(), 'server/db.ts'), 'utf8');
    expect(db).toContain('scoreTier: tierKeyForScore(score)');
    expect(db).not.toContain('Math.floor(score / 10)');
  });
});
