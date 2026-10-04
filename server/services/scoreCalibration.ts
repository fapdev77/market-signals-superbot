/**
 * SDD Fase 9 — S2 / CRÍTICO-3: calibração do `confluenceScore` contra base rate.
 *
 * DEFEITO DE ORIGEM: `confluenceScore` é
 *   Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25))
 * `netScore = 0` — nenhum fator a favor, nenhum contra — produz 25%; a saturação em 100
 * chega com ~4 fatores moderados. A UI o exibe como "NN%", que o operador lê como
 * probabilidade de acerto. Não é. `confluenceScore` mede FORÇA DE CONFLUÊNCIA, e
 * força de confluência não é probabilidade de o trade dar lucro.
 *
 * Este módulo NÃO tenta consertar a fórmula (isso é método, e método se calibra com
 * amostra, não com constantes). Ele separa as duas coisas:
 *
 *   - `confluenceScore` continua sendo o que já é: força. Sem unidade, sem porcentagem
 *    implícita, sem promessa de probabilidade;
 *   - `expectancyR` passa a ser a medida derivada da base rate: quanto R o operador ganhou
 *     POR SINAL que caiu naquele tier de score, depois de taxas, slippage e funding.
 *
 * REGRA DE OURO: calibrar contra `rExpectancy` (R), NUNCA contra `winRate`. Win rate não
 * é edge: 92% de acerto com R:R 0,2 é prejuízo, e um painel que só mostra win rate
 * recomenda o pior sistema da lista.
 *
 * Quando a amostra é insuficiente, a função DEGRADA para o prior global e declara isso em
 * `confidence`. Devolver um número sem base rate é exatamente o defeito que estamos
 * corrigindo — então a ausência de evidência aparece na interface, não some dela.
 *
 * Função pura: sem I/O, sem estado, determinística.
 */

import { dAdd, dDiv, dMul, dRound, dSub } from '../utils/decimal.js';
import type { EvidenceGroupMetrics } from './EvidenceService.js';
// Definicao unica da chave de tier, compartilhada com a UI (ver `scoreTier.ts`).
import { tierKeyForScore } from '../../src/utils/scoreTier.js';
export { tierKeyForScore };

/** Confiança da calibração. `UNCALIBRATED` = não há amostra que sustente um número. */
export type CalibrationConfidence = 'CALIBRATED' | 'THIN_SAMPLE' | 'UNCALIBRATED';

/** Onde veio o número devolvido. */
export type CalibrationBasis = 'TIER' | 'GLOBAL_PRIOR';

/**
 * Constante de encolhimento (k): a que distância da média global o bucket precisa
 * carregar para mover metade do caminho até o próprio valor empírico.
 *
 * k = 30 é deliberadamente exigente: com n = 30 a evidência vale 50%, com n = 90 vale
 * 75%. Sem encolhimento, um tier com 3 trades vencidos seria exibido como a
 * estratégia mais forte do sistema — e não é, é um cluster de três trades.
 */
export const SHRINKAGE_K = 30;

/**
 * Mínimo de sinais FECHADOS para que a expectativa do tier seja tratada como medida.
 * Abaixo disso a confiança é `THIN_SAMPLE`: o número sai, mas rotulado como fraco.
 */
export const MIN_SAMPLE_FOR_CALIBRATION = 30;

export interface CalibrationInput {
  /** Métricas agregadas de todos os sinais fechados — é daqui que sai o prior. */
  overall?: EvidenceGroupMetrics | null;
  /** Métricas por tier de score. */
  byScoreTier?: Record<string, EvidenceGroupMetrics> | null;
}

export interface CalibratedScore {
  /** A força de confluência original (0..100). NÃO é probabilidade. */
  rawScore: number;
  /** Tier de score em que o rawScore cai. */
  tierKey: string;
  /** Expectativa encolhida em R por sinal. Round de 4 casas. */
  expectancyR: number;
  /** n do tier usado (0 quando não há bucket). */
  sampleSize: number;
  /** n que sustenta o prior global (0 quando não há base). */
  priorSampleSize: number;
  confidence: CalibrationConfidence;
  basis: CalibrationBasis;
  /** Texto pronto para a UI: identifica a unidade (R) e a força da evidência. */
  label: string;
}


function confidenceFor(n: number): CalibrationConfidence {
  if (n <= 0) return 'UNCALIBRATED';
  return n >= MIN_SAMPLE_FOR_CALIBRATION ? 'CALIBRATED' : 'THIN_SAMPLE';
}

/** Rótulo sem porcentagem — a unidade é R, e "confiança" é sobre a AMOSTRA, não sobre o trade. */
function buildLabel(r: number, confidence: CalibrationConfidence, n: number): string {
  const signed = `${r >= 0 ? '+' : ''}${r.toFixed(3)} R/sinal`;
  if (confidence === 'UNCALIBRATED') return `${signed} — sem amostra (base rate global)`;
  if (confidence === 'THIN_SAMPLE') return `${signed} — amostra fraca (n=${n}, mínimo ${MIN_SAMPLE_FOR_CALIBRATION})`;
  return `${signed} — medido em ${n} sinais fechados`;
}

/**
 * Traduz a força de confluência em expectativa calibrada.
 *
 * `expectancyR = prior + (empirical - prior) * n / (n + k)`
 *
 * O prior é a expectativa global de todos os sinais fechados. O peso `n/(n+k)` é a fração
 * de confiança que a amostra do tier merece. Por construção, o resultado vive SEMPRE
 * entre o prior e o empírico: encolhimento não extrapola, e um tier pequeno não consegue
 * "`vencer" a base rate só porque teve sorte.
 *
 * Quando não existe tier medido, a resposta honesta é "não sei": devolve o prior com
 * `confidence: 'UNCALIBRATED'`, em vez de `0` (que a UI leria como "este score dá zero").
 */
export function calibrateScore(rawScore: number, input?: CalibrationInput | null): CalibratedScore {
  const tierKey = tierKeyForScore(rawScore);

  const overall = input?.overall ?? null;
  const priorSampleSize = overall && Number.isFinite(overall.n) ? Math.max(0, Math.floor(overall.n)) : 0;
  const prior = priorSampleSize > 0 ? dRound(overall!.rExpectancy, 4) : 0;

  const tier = input?.byScoreTier?.[tierKey] ?? null;
  const sampleSize = tier && Number.isFinite(tier.n) ? Math.max(0, Math.floor(tier.n)) : 0;

  if (!tier || sampleSize <= 0) {
    return {
      rawScore,
      tierKey,
      expectancyR: prior,
      sampleSize: 0,
      priorSampleSize,
      confidence: 'UNCALIBRATED',
      basis: 'GLOBAL_PRIOR',
      label: buildLabel(prior, 'UNCALIBRATED', 0)
    };
  }

  const empirical = dRound(tier.rExpectancy, 4);
  const weight = dDiv(sampleSize, dAdd(sampleSize, SHRINKAGE_K));
  const expectancyR = dRound(dAdd(prior, dMul(dSub(empirical, prior), weight)), 4);
  const confidence = confidenceFor(sampleSize);

  return {
    rawScore,
    tierKey,
    expectancyR,
    sampleSize,
    priorSampleSize,
    confidence,
    basis: 'TIER',
    label: buildLabel(expectancyR, confidence, sampleSize)
  };
}