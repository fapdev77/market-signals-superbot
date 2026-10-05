/**
 * Factor Coverage Calculator (M2.2 - Phase 5)
 *
 * Computes coverage % of historical factors (OI, Funding, Long/Short)
 * across the tested kline dataset.
 * Returns reducedFactorSet: true when any factor has < 100% coverage.
 *
 * M7 — cobertura 0% e "nunca instrumentado" são afirmações diferentes. O motor
 * passava `candlesWithOi: 0` porque não existe coluna de open interest em
 * `historical_klines` nem histórico de long/short — o fator não foi medido porque
 * não pôde ser. Sem o sinal explícito, um relatório de 0% de cobertura lê como
 * medição, e `reducedFactorSet: true` deixa de explicar por quê.
 */

export interface FactorAvailability {
  /** O fator tem dado no histórico e a cobertura foi realmente calculada. */
  openInterest: boolean;
  longShort: boolean;
  funding: boolean;
}

export interface FactorStatsInput {
  totalCandles: number;
  candlesWithOi: number;
  candlesWithFunding: number;
  candlesWithLongShort: number;
  /**
   * Quais fatores puderam ser medidos. Ausente = todos disponíveis (comportamento
   * anterior, preservado para os testes do cálculo puro).
   */
  availability?: FactorAvailability;
}

export interface FactorCoverageResult {
  reducedFactorSet: boolean;
  factorCoverage: {
    openInterest: number;
    funding: number;
    longShort: number;
  };
  /** Mesmo mapa de `factorCoverage`, dizendo o que é medida e o que é ausência. */
  factorCoverageAvailability: FactorAvailability;
  /** Alias de `factorCoverageAvailability`, para os consumidores que leem `availability`. */
  availability: FactorAvailability;
  missingFactors: string[];
}

export function calculateFactorCoverage(stats: FactorStatsInput): FactorCoverageResult {
  const { totalCandles, candlesWithOi, candlesWithFunding, candlesWithLongShort } = stats;
  const availability: FactorAvailability = stats.availability ?? {
    openInterest: true,
    funding: true,
    longShort: true
  };

  const total = Math.max(1, totalCandles);
  const oiPct = Math.min(100, Math.round((candlesWithOi / total) * 100));
  const fundingPct = Math.min(100, Math.round((candlesWithFunding / total) * 100));
  const lsPct = Math.min(100, Math.round((candlesWithLongShort / total) * 100));

  const missing: string[] = [];
  if (oiPct < 100) missing.push('openInterest');
  if (fundingPct < 100) missing.push('funding');
  if (lsPct < 100) missing.push('longShort');

  const reducedFactorSet = missing.length > 0;

  return {
    reducedFactorSet,
    factorCoverage: {
      openInterest: oiPct,
      funding: fundingPct,
      longShort: lsPct
    },
    factorCoverageAvailability: availability,
    availability,
    missingFactors: missing
  };
}
