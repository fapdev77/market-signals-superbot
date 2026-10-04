/**
 * SDD Fase 9 / S2 (B3) — rótulo honesto para o score de confluência.
 *
 * Por que este módulo existe:
 *
 * `confluenceScore` é `Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25))`. Ele
 * mede FORÇA DE CONFLUÊNCIA entre fatores detectores — quantos fatores apontam na mesma
 * direção e com que peso. Não é probabilidade de o trade fechar no lucro, e não é
 * "72% de chance". Duas consequências que a tela antiga ignorava:
 *
 *   1. `netScore = 0` (nenhum fator a favor, nenhum contra) produz 25. O número começa
 *      em 25 sem nenhuma informação e satura em 100 com ~4 fatores moderados;
 *   2. o único número que o operador deveria usar para decidir — a expectativa em R por
 *      sinal, depois de taxas, slippage e funding — não aparecia em lugar nenhum.
 *
 * Este módulo é a apresentação, não o cálculo: a calibração vive no servidor
 * (`scoreCalibration.ts`), e aqui só se decide o que a tela diz. A regra que ele impõe é
 * que **força alta com edge negativo deve parecer risco**, e que a ausência de amostra
 * tem que ser visível — omitir o "sem base rate" deixa o número sozinho na tela, e o
 * operador conclui que ele é uma medição.
 *
 * Função pura e sem React: testável sem DOM.
 */

/** Confiança da calibração. espelha `server/services/scoreCalibration.ts`. */
export type CalibrationConfidence = 'CALIBRATED' | 'THIN_SAMPLE' | 'UNCALIBRATED';

/** Subconjunto do payload do servidor de que a apresentação precisa. Estrutural de propósito:
 *  `src/` não deve importar tipos de `server/`. */
export interface ScoreCalibrationLike {
  expectancyR: number;
  sampleSize: number;
  confidence: CalibrationConfidence;
  label: string;
}

/** A cor segue o EDGE medido, não a força bruta. */
export type ScoreTone = 'positive' | 'negative' | 'neutral';

export interface ScoreDisplay {
  /** Rótulo principal. NUNCA uma porcentagem de chance. */
  primary: string;
  /** Expectativa calibrada (ou a declaração de que não há base rate). */
  secondary: string;
  tone: ScoreTone;
  /** `true` quando a tela precisa dizer que não há amostra suficiente. */
  insufficientSample: boolean;
  /** Texto de tooltip: separa força de probabilidade para quem quiser entender. */
  title: string;
}

const FORCE_TITLE =
  'Força de confluência entre fatores (0 = nenhum fator concordante, 100 = saturação). ' +
  'NÃO é probabilidade de lucro — a expectativa em R aparece abaixo.';

/**
 * Descreve o score para a tela.
 *
 * Sem `calibration` (endpoint indisponível, ledger vazio ou ainda sem amostra), devolve
 * força + "sem base rate" e tom NEUTRO. Nunca devolve um número com ar de medição.
 */
export function describeScore(
  rawScore: number,
  calibration?: ScoreCalibrationLike | null
): ScoreDisplay {
  const force = Number.isFinite(rawScore) ? Math.round(rawScore) : 0;

  if (!calibration || !Number.isFinite(calibration.expectancyR)) {
    return {
      primary: `força ${force}`,
      secondary: 'sem base rate — ainda não há sinais fechados suficientes para medir R',
      tone: 'neutral',
      insufficientSample: true,
      title: FORCE_TITLE
    };
  }

  const calibrated = calibration.confidence === 'CALIBRATED';
  const r = calibration.expectancyR;
  const tone: ScoreTone = !calibrated || r === 0 ? 'neutral' : r > 0 ? 'positive' : 'negative';

  return {
    primary: `força ${force}`,
    secondary: calibration.label,
    tone,
    insufficientSample: !calibrated,
    title: FORCE_TITLE
  };
}

/** Payload de `GET /api/evidence/calibration`. */
export interface ScoreCalibrationResponse {
  success?: boolean;
  origin?: string;
  /** Expectativa global encolhida: o prior de todos os tiers. */
  priorR: number;
  priorSampleSize: number;
  minSampleForCalibration: number;
  /** Um registro por tier de score presente no ledger. */
  tiers: Record<string, ScoreCalibrationLike>;
}

/** Classes de cor por tom, para as surfaces não reimplementarem o mapeamento. */
export function toneClass(tone: ScoreTone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-400';
    case 'negative':
      return 'text-rose-400';
    default:
      return 'text-neutral-400';
  }
}