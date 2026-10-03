/**
 * 8.2.2 — Regra de decisão PRÉ-REGISTRADA v2 da confirmação de entrada.
 *
 * Pura e sem I/O. Substitui a regra relativa da 7.2.3, que comparava dois braços
 * NÃO pareados (amostras independentes de tamanhos diferentes) e só olhava a
 * diferença — por isso "melhorar" de −1,22 R para −0,53 R por sinal virou
 * "LIGAR a flag" mesmo com os dois braços PERDENDO dinheiro (specs/phase-8.md §2).
 *
 * A regra v2 exige TODAS as condições:
 *   (a) ≥ 30 posições preenchidas POR BRAÇO E no agregado;
 *   (b) limite inferior do IC 95% da diferença PAREADA por sinal > 0;
 *   (c) drawdown do braço com confirmação ≤ 120% do controle;
 *   (d) expectativa líquida absoluta do braço com confirmação ≥ 0 OU aceite
 *       explícito do dono registrado para ligar mesmo com expectativa negativa.
 *
 * Aprovada como proposta (specs/phase-8.md §10.3) e registrada pelo dono.
 */

export interface PairedArmMetrics {
  signalsEmitted: number;
  entriesFilled: number;
  positionsClosed: number;
  winRate: number;
  /** Expectativa líquida em R por SINAL PAREADO (ausente/não preenchido = 0). */
  expectancyR: number;
  maxDrawdownPct: number;
  notFilledShare: number;
}

export interface PairedDiff {
  mean: number;
  ciLow: number;
  ciHigh: number;
  /** Nº de sinais pareados usados no bootstrap. */
  pairs: number;
}

export interface OwnerAcceptance {
  acceptedNegativeExpectancy: boolean;
  reason?: string;
}

export interface EntryDecisionV2Params {
  control: PairedArmMetrics;
  withConfirmation: PairedArmMetrics;
  pairedDiff: PairedDiff;
  ownerAcceptance?: OwnerAcceptance;
  minFilledPerArm?: number;
  maxDrawdownWorsePct?: number;
}

export interface EntryDecisionV2 {
  enable: boolean;
  reasons: string[];
}

export const MIN_FILLED_PER_ARM_DEFAULT = 30;
export const MAX_DRAWDOWN_WORSE_PCT_DEFAULT_V2 = 20;

export function evaluateEntryConfirmationDecisionV2(
  params: EntryDecisionV2Params
): EntryDecisionV2 {
  const { control, withConfirmation, pairedDiff, ownerAcceptance } = params;
  const minFilled = params.minFilledPerArm ?? MIN_FILLED_PER_ARM_DEFAULT;
  const maxWorsePct = params.maxDrawdownWorsePct ?? MAX_DRAWDOWN_WORSE_PCT_DEFAULT_V2;
  const reasons: string[] = [];

  // (a) amostra suficiente POR BRAÇO e no agregado.
  const aggregateFilled = control.entriesFilled + withConfirmation.entriesFilled;
  const enoughPerArm =
    control.entriesFilled >= minFilled && withConfirmation.entriesFilled >= minFilled;
  const enoughAggregate = aggregateFilled >= 2 * minFilled;
  const enough = enoughPerArm && enoughAggregate;
  reasons.push(
    enough
      ? `(a) preenchidos por braço ${control.entriesFilled}/${withConfirmation.entriesFilled} ≥ ${minFilled} e agregado ${aggregateFilled} ≥ ${2 * minFilled} — OK.`
      : `(a) amostra insuficiente: controle ${control.entriesFilled}, confirmação ${withConfirmation.entriesFilled} (mínimo ${minFilled}/braço e ${2 * minFilled} no agregado) — barra.`
  );

  // (b) IC pareado inteiramente acima de zero.
  const positiveCi = pairedDiff.ciLow > 0;
  reasons.push(
    positiveCi
      ? `(b) IC 95% pareado da diferença = [${pairedDiff.ciLow.toFixed(4)}, ${pairedDiff.ciHigh.toFixed(4)}] R, limite inferior ${pairedDiff.ciLow.toFixed(4)} > 0 — OK.`
      : `(b) limite inferior do IC 95% pareado = ${pairedDiff.ciLow.toFixed(4)} R ≤ 0 — barra.`
  );

  // (c) drawdown do braço com confirmação não passa de 120% do controle.
  const ddLimit = control.maxDrawdownPct * (1 + maxWorsePct / 100);
  const drawdownOk = withConfirmation.maxDrawdownPct <= ddLimit;
  reasons.push(
    drawdownOk
      ? `(c) drawdown ${withConfirmation.maxDrawdownPct.toFixed(2)}% ≤ ${ddLimit.toFixed(2)}% (controle ${control.maxDrawdownPct.toFixed(2)}% + ${maxWorsePct}%) — OK.`
      : `(c) drawdown ${withConfirmation.maxDrawdownPct.toFixed(2)}% excede ${ddLimit.toFixed(2)}% (controle + ${maxWorsePct}%) — barra.`
  );

  // (d) expectativa absoluta ≥ 0 OU aceite explícito do dono.
  const absoluteOk = withConfirmation.expectancyR >= 0;
  const ownerAccepted = ownerAcceptance?.acceptedNegativeExpectancy === true;
  const expectationOk = absoluteOk || ownerAccepted;
  reasons.push(
    absoluteOk
      ? `(d) expectativa líquida absoluta do braço com confirmação = ${withConfirmation.expectancyR.toFixed(4)} R ≥ 0 — OK.`
      : ownerAccepted
        ? `(d) expectativa absoluta = ${withConfirmation.expectancyR.toFixed(4)} R < 0, mas há ACEITE EXPLÍCITO do dono${ownerAcceptance?.reason ? `: ${ownerAcceptance.reason}` : ''} — OK (experimental).`
        : `(d) expectativa absoluta = ${withConfirmation.expectancyR.toFixed(4)} R < 0 e sem aceite do dono — barra.`
  );

  const enable = enough && positiveCi && drawdownOk && expectationOk;
  if (!enable) {
    reasons.push('Veredito: MANTER a flag DESLIGADA (motivo registrado).');
  } else {
    reasons.push(
      'Veredito: flag PODE ser ligada; registrar a decisão, regenerar o documento e congelar (tag engine-freeze-*).'
    );
  }
  return { enable, reasons };
}
