/**
 * A-08 (FASE 2) — gate de calibração na emissão de sinais.
 *
 * O motor já calcula expectativa calibrada por tier (`scoreCalibration.ts`), mas até
 * aqui era apenas um probe de UI — nada gateava a decisão. Este teste trava a regra
 * do plano de remediação (§8, item 19): emitir SÓ com `expectancyR > 0` e
 * `confidence ≠ UNCALIBRATED`.
 *
 * Exceção explícita (decisão de design): ledger TOTALMENTE sem amostras
 * (`priorSampleSize = 0`) ⇒ modo bootstrap — emite com aviso "sem base rate" para o
 * robô não nascer mudo e permanecer mudo (sem emissão não há evidência, sem evidência
 * nunca sairia do UNCALIBRATED). A partir da 1ª amostra fechada o gate vale literalmente.
 *
 * Também trava a FIAÇÃO: o gate roda na cadeia de gates do tick, antes de
 * `buildTradeSignal`/`saveSignalAndLedger`, e o caminho bloqueado vira métrica dedicada.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateCalibrationGate } from '../server/services/calibrationGate.js';
import type { CalibrationInput } from '../server/services/scoreCalibration.js';
import type { EvidenceGroupMetrics } from '../server/services/EvidenceService.js';

function metrics(n: number, rExpectancy: number): EvidenceGroupMetrics {
  return {
    n,
    wins: Math.round(n / 2),
    losses: n - Math.round(n / 2),
    winRate: n > 0 ? 0.5 : 0,
    wilsonInterval: [0.3, 0.7],
    rExpectancy,
    avgMfe: 1,
    avgMae: -1,
    cumulativeR: rExpectancy * n,
    maxDrawdownR: -2
  };
}

function input(
  overallN: number,
  overallR: number,
  tiers: Record<string, EvidenceGroupMetrics>
): CalibrationInput {
  return { overall: metrics(overallN, overallR), byScoreTier: tiers };
}

describe('A-08 — regra do gate (pura)', () => {
  it('ledger sem NENHUMA amostra ⇒ bootstrap: emite com aviso, não bloqueia', () => {
    for (const inp of [undefined, null, input(0, 0, {})] as const) {
      const gate = evaluateCalibrationGate(72, inp);
      expect(gate.allowed).toBe(true);
      expect(gate.bootstrap).toBe(true);
      expect(gate.confidence).toBe('UNCALIBRATED');
      expect(gate.reason).toMatch(/bootstrap/i);
    }
  });

  it('há amostra geral mas o tier não ⇒ UNCALIBRATED bloqueia MESMO com prior positivo', () => {
    const gate = evaluateCalibrationGate(72, input(80, 0.25, { '50-59': metrics(40, 0.1) }));
    expect(gate.allowed).toBe(false);
    expect(gate.bootstrap).toBe(false);
    expect(gate.confidence).toBe('UNCALIBRATED');
    // o prior positivo NÃO salva: a regra é confidence ≠ UNCALIBRATED, sem exceção.
    expect(gate.expectancyR).toBeGreaterThan(0);
    expect(gate.reason).toMatch(/UNCALIBRATED/);
  });

  it('tier medido com expectativa não positiva ⇒ bloqueia', () => {
    const gate = evaluateCalibrationGate(72, input(50, -0.1, { '70-79': metrics(40, -0.2) }));
    expect(gate.allowed).toBe(false);
    expect(gate.bootstrap).toBe(false);
    expect(gate.expectancyR).toBeLessThanOrEqual(0);
    expect(gate.reason).toMatch(/não positiva/);
  });

  it('expectancy exatamente 0 ⇒ bloqueia (a regra é estritamente > 0)', () => {
    const gate = evaluateCalibrationGate(72, input(50, 0, { '70-79': metrics(40, 0) }));
    expect(gate.expectancyR).toBe(0);
    expect(gate.allowed).toBe(false);
  });

  it('THIN_SAMPLE com expectativa positiva ⇒ permite (amostra fraca é rótulo, não veto)', () => {
    const gate = evaluateCalibrationGate(72, input(100, 0.1, { '70-79': metrics(10, 0.25) }));
    expect(gate.confidence).toBe('THIN_SAMPLE');
    expect(gate.expectancyR).toBeGreaterThan(0);
    expect(gate.allowed).toBe(true);
    expect(gate.bootstrap).toBe(false);
  });

  it('CALIBRATED com expectativa positiva ⇒ permite', () => {
    const gate = evaluateCalibrationGate(72, input(200, 0.1, { '70-79': metrics(40, 0.3) }));
    expect(gate.confidence).toBe('CALIBRATED');
    expect(gate.expectancyR).toBeGreaterThan(0);
    expect(gate.allowed).toBe(true);
    expect(gate.bootstrap).toBe(false);
  });
});

describe('A-08 — fiação em server.ts e metrics.ts', () => {
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const metricsSrc = fs.readFileSync(path.join(process.cwd(), 'server/utils/metrics.ts'), 'utf8');

  it('o gate roda antes de construir e salvar o sinal', () => {
    const gateIdx = serverSrc.indexOf('evaluateCalibrationGate(');
    const buildIdx = serverSrc.indexOf('buildTradeSignal(');
    const saveIdx = serverSrc.indexOf('await saveSignalAndLedger(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(buildIdx);
    expect(gateIdx).toBeLessThan(saveIdx);
    expect(serverSrc).toContain('loadCalibrationInput(');
  });

  it('caminho bloqueado vira métrica dedicada com log (padrão dos demais gates)', () => {
    const block = serverSrc.match(
      /else if \(calibrationGate && !calibrationGate\.allowed\) \{([\s\S]{0,600})/
    );
    expect(block).not.toBeNull();
    expect(block![1]).toContain('incrementMetric(METRIC_NAMES.signalsSuppressedCalibration)');
    expect(block![1]).toContain('logJson(');
  });

  it('modo bootstrap é avisado no log', () => {
    expect(serverSrc).toMatch(/if \(calibrationGate\?\.bootstrap\)/);
  });

  it('falha ao ler o ledger não derruba o tick (gate indisponível ⇒ WARN e segue)', () => {
    // o Promise.allSettled do batch engole rejeições — sem este catch um erro de
    // leitura pularia o símbolo sem log nenhum.
    expect(serverSrc).toContain('Gate de calibração A-08 indisponível');
  });

  it('a métrica nasce registrada e visível em 0', () => {
    expect(metricsSrc).toContain('signalsSuppressedCalibration');
    expect(metricsSrc).toMatch(/counters\.set\(METRIC_NAMES\.signalsSuppressedCalibration, 0\)/);
  });
});
