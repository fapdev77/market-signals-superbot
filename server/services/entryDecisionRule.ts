/**
 * 7.2.3 — Regra de decisão PRÉ-REGISTRADA da confirmação de entrada (D3/D8).
 *
 * Pura e sem I/O: recebe as métricas dos dois braços (controle sem confirmação ×
 * com confirmação) e o IC bootstrap da DIFERENÇA de expectativa POR SINAL EMITIDO
 * (não preenchido conta 0 R), e decide se a flag pode ser ligada.
 *
 * Valores propostos e APROVADOS (specs/phase-7.md §10.5):
 *  (a) ≥ 30 trades preenchidos no braço com confirmação;
 *  (b) diferença média de expectativa por sinal emitido > 0;
 *  (c) drawdown máximo no braço com confirmação não mais de 20% pior que o controle.
 */

export interface EntryArmMetrics {
  signalsEmitted: number;
  entriesFilled: number;
  closedTrades: number;
  winRate: number;
  /** Expectativa líquida em R por SINAL EMITIDO (não preenchido = 0). */
  expectancyR: number;
  /** Drawdown máximo observado (%). */
  maxDrawdownPct: number;
  /** Parcela de sinais emitidos que terminaram ENTRY_NOT_FILLED (0..1). */
  notFilledShare: number;
  avgFillMinutes: number;
}

export interface ExpectancyDiff {
  mean: number;
  ciLow: number;
  ciHigh: number;
}

export interface EntryDecisionParams {
  control: EntryArmMetrics;
  withConfirmation: EntryArmMetrics;
  /** Diferença (comConfirmação − controle) de expectativa por sinal emitido, com IC. */
  expectancyDiff: ExpectancyDiff;
  minFilledTrades?: number;
  maxDrawdownWorsePct?: number;
}

export interface EntryDecision {
  enable: boolean;
  /** Motivos do veredito (o que passou e o que barrou). */
  reasons: string[];
}

export const MIN_FILLED_TRADES_DEFAULT = 30;
export const MAX_DRAWDOWN_WORSE_PCT_DEFAULT = 20;

export function evaluateEntryConfirmationDecision(params: EntryDecisionParams): EntryDecision {
  const { control, withConfirmation, expectancyDiff } = params;
  const minTrades = params.minFilledTrades ?? MIN_FILLED_TRADES_DEFAULT;
  const maxWorsePct = params.maxDrawdownWorsePct ?? MAX_DRAWDOWN_WORSE_PCT_DEFAULT;

  const reasons: string[] = [];

  const enoughTrades = withConfirmation.entriesFilled >= minTrades;
  reasons.push(
    enoughTrades
      ? `(a) ${withConfirmation.entriesFilled} trades preenchidos ≥ ${minTrades} — OK.`
      : `(a) apenas ${withConfirmation.entriesFilled} trades preenchidos < ${minTrades} — insuficiente.`
  );

  const positiveDiff = expectancyDiff.mean > 0;
  reasons.push(
    positiveDiff
      ? `(b) diferença de expectativa por sinal emitido = ${expectancyDiff.mean.toFixed(4)} R > 0 — OK.`
      : `(b) diferença de expectativa por sinal emitido = ${expectancyDiff.mean.toFixed(4)} R ≤ 0 — barra.`
  );

  const ddLimit = control.maxDrawdownPct * (1 + maxWorsePct / 100);
  const drawdownOk = withConfirmation.maxDrawdownPct <= ddLimit;
  reasons.push(
    drawdownOk
      ? `(c) drawdown ${withConfirmation.maxDrawdownPct.toFixed(2)}% ≤ ${ddLimit.toFixed(2)}% (controle ${control.maxDrawdownPct.toFixed(2)}% + ${maxWorsePct}%) — OK.`
      : `(c) drawdown ${withConfirmation.maxDrawdownPct.toFixed(2)}% excede ${ddLimit.toFixed(2)}% (controle + ${maxWorsePct}%) — barra.`
  );

  const enable = enoughTrades && positiveDiff && drawdownOk;
  if (!enable) {
    reasons.push('Veredito: manter a flag DESLIGADA (motivo registrado).');
  } else {
    reasons.push('Veredito: flag PODE ser ligada; registrar a decisão e congelar o motor (tag engine-freeze-*).');
  }
  return { enable, reasons };
}
