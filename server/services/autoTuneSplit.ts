/**
 * 6.7.5 — Split temporal em três partes (G-15) — módulo PURO, sem I/O.
 *
 * treino (busca de pesos) → validação (escolha entre candidatos) → holdout INTACTO.
 * Blocos CONTÍGUOS e sem sobreposição: o holdout nunca é visto pelo avaliador de
 * candidatos (CA-7.4 — o espião no teste prova isso).
 *
 * Default 60/20/20; split determinístico (sem embaralhamento — série temporal).
 * Dados insuficientes (menos de 3 por parte mínima) lançam erro em vez de
 * silenciar o holdout.
 */

export interface SplitResult<T> {
  train: T[];
  validation: T[];
  holdout: T[];
  /** Timestamp inicial do holdout (para o espião/auditoria). */
  holdoutStart?: number;
  seed?: number;
}

export function splitThreeWay<T extends { timestamp: number }>(
  data: T[],
  options: {
    trainFraction?: number;
    validationFraction?: number;
    /** Aceito para compatibilidade de contrato; o split é determinístico por design. */
    seed?: number;
  } = {}
): SplitResult<T> {
  const trainFraction = options.trainFraction ?? 0.6;
  const validationFraction = options.validationFraction ?? 0.2;

  const n = data.length;
  const minPart = 3;
  if (!Number.isFinite(n) || n < minPart * 3) {
    throw new Error(`autoTuneSplit: dados insuficientes para split 3-way (${n} pontos; mínimo ${minPart * 3}).`);
  }

  const trainEnd = Math.max(minPart, Math.floor(n * trainFraction));
  const validationEnd = Math.max(minPart, Math.floor(n * (trainFraction + validationFraction)));

  const train = data.slice(0, trainEnd);
  const validation = data.slice(trainEnd, validationEnd);
  const holdout = data.slice(validationEnd);

  if (train.length === 0 || validation.length === 0 || holdout.length === 0) {
    throw new Error('autoTuneSplit: frações produzem bloco vazio — ajuste trainFraction/validationFraction.');
  }

  // Contiguidade temporal (série ordenada por timestamp).
  const last = (arr: T[]) => arr[arr.length - 1].timestamp;
  const first = (arr: T[]) => arr[0].timestamp;
  if (last(train) > first(validation) || last(validation) > first(holdout)) {
    throw new Error('autoTuneSplit: dados não estão ordenados por timestamp.');
  }

  return {
    train,
    validation,
    holdout,
    holdoutStart: first(holdout),
    seed: options.seed
  };
}
