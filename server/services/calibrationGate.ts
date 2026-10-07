/**
 * A-08 (FASE 2) — gate de calibração na emissão de sinais.
 *
 * `scoreCalibration.ts` (puro, sem I/O) já traduz a força de confluência em
 * expectativa calibrada por tier — mas até aqui isso era apenas um probe da UI.
 * Este módulo é a decisão: emitir SÓ com `expectancyR > 0` e
 * `confidence ≠ UNCALIBRATED` (§8, item 19).
 *
 * Exceção explícita de bootstrap: ledger TOTALMENTE sem amostras
 * (`priorSampleSize = 0`) ⇒ `allowed: true` com `bootstrap: true` (aviso de "sem
 * base rate"). Sem ela o robô nasceria mudo e permaneceria mudo: sem emissão não
 * há sinais fechados, sem sinais fechados o gate nunca sairia de UNCALIBRATED.
 * A partir da 1ª amostra fechada o gate vale literalmente.
 *
 * Escopo: emissão live (server.ts). O backtest é instrumento de medição e não é
 * gateado — a paridade live↔backtest de contexto é do A-05 (weights).
 */
import { signalLedgerDao } from '../db.js';
import { generateEvidenceSummary } from './EvidenceService.js';
import {
  calibrateScore,
  type CalibrationConfidence,
  type CalibrationInput
} from './scoreCalibration.js';
import type { OriginFilter } from '../../src/types.js';

export interface CalibrationGateResult {
  allowed: boolean;
  /** `true` quando a exceção de bootstrap (ledger sem amostras) liberou a emissão. */
  bootstrap: boolean;
  expectancyR: number;
  confidence: CalibrationConfidence;
  sampleSize: number;
  priorSampleSize: number;
  reason: string;
}

/**
 * Monta o input de calibração a partir do ledger fechado — fonte única usada pelo
 * gate E pela rota `GET /api/evidence/calibration` (antes cada chamador montava o
 * objeto à mão; duas cópias do mesmo payload é como os dois lados passam a ler
 * bases diferentes sem ninguém acusar).
 */
export async function loadCalibrationInput(origin: OriginFilter = 'LIVE'): Promise<CalibrationInput> {
  const closedSignals = await signalLedgerDao.getClosedSignalsEvidence(origin);
  const summary = generateEvidenceSummary(closedSignals, { origin });
  return {
    overall: {
      n: summary.totalSignals,
      wins: summary.wins,
      losses: summary.losses,
      winRate: summary.winRate,
      wilsonInterval: summary.wilsonInterval,
      rExpectancy: summary.rExpectancy,
      avgMfe: summary.avgMfe,
      avgMae: summary.avgMae,
      // M2: `aggregateMetrics` já soma os netR — a rota escrevia 0 e propagava
      // uma métrica que parecia medida e não era. O payload compartilhado preserva o valor.
      cumulativeR: summary.cumulativeR,
      maxDrawdownR: summary.maxDrawdownR
    },
    byScoreTier: summary.byScoreTier
  };
}

/**
 * A regra do gate, pura e síncrona (testável sem I/O):
 *
 * 1. `priorSampleSize <= 0` (ledger vazio) ⇒ bootstrap: emite com aviso.
 * 2. `confidence === 'UNCALIBRATED'` (tier sem amostra) ⇒ bloqueia, mesmo que o
 *    prior global seja positivo — prior alheio não é lastro do tier.
 * 3. `expectancyR > 0` estritamente ⇒ permite; 0 ou negativo ⇒ bloqueia.
 */
export function evaluateCalibrationGate(
  rawScore: number,
  input?: CalibrationInput | null
): CalibrationGateResult {
  const cal = calibrateScore(rawScore, input);
  const base = {
    expectancyR: cal.expectancyR,
    confidence: cal.confidence,
    sampleSize: cal.sampleSize,
    priorSampleSize: cal.priorSampleSize
  };

  if (cal.priorSampleSize <= 0) {
    return {
      ...base,
      allowed: true,
      bootstrap: true,
      reason: 'Bootstrap A-08: ledger sem amostras fechadas — emissão liberada em modo "sem base rate".'
    };
  }

  if (cal.confidence === 'UNCALIBRATED') {
    return {
      ...base,
      allowed: false,
      bootstrap: false,
      reason: `Gate A-08: tier ${cal.tierKey} sem amostra fechada (UNCALIBRATED) — expectancy calibrada indisponível.`
    };
  }

  if (!(cal.expectancyR > 0)) {
    return {
      ...base,
      allowed: false,
      bootstrap: false,
      reason: `Gate A-08: expectancy calibrada ${cal.expectancyR} R/sinal não positiva (confidence ${cal.confidence}, tier ${cal.tierKey}).`
    };
  }

  return {
    ...base,
    allowed: true,
    bootstrap: false,
    reason: `Gate A-08: expectancy ${cal.expectancyR} R/sinal (confidence ${cal.confidence}, tier ${cal.tierKey}).`
  };
}
