/**
 * FundingService (M2.1 - Phase 5)
 *
 * Implements real funding rate calculation for backtest & live trades.
 * - Tracks exact funding events crossed while position is active.
 * - Long positions pay positive funding; Short positions receive positive funding.
 * - Separates Special funding (e.g. equity perps dividend adjustments) from Normal funding.
 * - Fallback to standard baseline (0.01% / 8h) when no historical data exists.
 */

export interface HistoricalFundingRecord {
  symbol: string;
  fundingTime: number;
  fundingRate: number;
  markPrice?: number;
  rateType?: 'Normal' | 'Special' | string;
}

export interface CalculateFundingParams {
  direction: 'LONG' | 'SHORT';
  positionSize: number; // 0..1 (fraction of position)
  entryTime: number;
  exitTime: number;
  fundingRecords?: HistoricalFundingRecord[];
  fallbackFundingRatePer8h?: number;
  fundingIntervalHours?: number;
}

export interface FundingCostResult {
  totalFundingCostPct: number;
  normalFundingCostPct: number;
  specialFundingCostPct: number;
  cyclesCrossed: number;
  hasSpecialFunding: boolean;
  isFallback: boolean;
}

/** 6.3.4 — resultado do funding por trecho, com cobertura real vs. fallback. */
export interface FundingCostCoverageResult extends FundingCostResult {
  /** Eventos de funding esperados na janela (janela / intervalo, piso). */
  expectedEvents: number;
  /** Eventos com registro real dentro da janela. */
  coveredEvents: number;
  /** Percentual 0..100 de eventos cobertos por dado real. */
  fundingCoverage: number;
  /** Custo (%) dos eventos com registro real, já com sinal da direção. */
  realFundingCostPct: number;
  /** Custo (%) dos eventos cobrados pela taxa fixa (trecho sem dado). */
  fallbackFundingCostPct: number;
  /** Suposições declaradas quando parte da janela usa a taxa fixa. */
  assumptions: string[];
}

export function calculateHistoricalFundingCost(params: CalculateFundingParams): FundingCostResult {
  const {
    direction,
    positionSize = 1,
    entryTime,
    exitTime,
    fundingRecords = [],
    fallbackFundingRatePer8h = 0.0001, // 0.01% standard baseline
    fundingIntervalHours = 8
  } = params;

  // Filter funding events that occurred strictly during holding period: entryTime < fundingTime <= exitTime
  const relevantRecords = fundingRecords.filter(
    r => r.fundingTime > entryTime && r.fundingTime <= exitTime
  );

  if (relevantRecords.length === 0 && fundingRecords.length === 0) {
    // Fallback baseline when no historical dataset is loaded
    const durationHours = Math.max(0, (exitTime - entryTime) / (3600 * 1000));
    const cycles = durationHours / fundingIntervalHours;
    const baseCostPct = cycles * (fallbackFundingRatePer8h * 100) * positionSize;
    const totalCostPct = direction === 'LONG' ? baseCostPct : -baseCostPct;

    return {
      totalFundingCostPct: totalCostPct,
      normalFundingCostPct: totalCostPct,
      specialFundingCostPct: 0,
      cyclesCrossed: Math.floor(cycles),
      hasSpecialFunding: false,
      isFallback: true
    };
  }

  let normalRateSum = 0;
  let specialRateSum = 0;

  for (const record of relevantRecords) {
    const isSpecial = record.rateType === 'Special';
    if (isSpecial) {
      specialRateSum += record.fundingRate;
    } else {
      normalRateSum += record.fundingRate;
    }
  }

  const normalPct = normalRateSum * 100 * positionSize;
  const specialPct = specialRateSum * 100 * positionSize;

  // Direction: LONG pays positive funding rate, SHORT receives positive funding rate (negative cost)
  const totalNormal = direction === 'LONG' ? normalPct : -normalPct;
  const totalSpecial = direction === 'LONG' ? specialPct : -specialPct;

  return {
    totalFundingCostPct: totalNormal + totalSpecial,
    normalFundingCostPct: totalNormal,
    specialFundingCostPct: totalSpecial,
    cyclesCrossed: relevantRecords.length,
    hasSpecialFunding: specialRateSum > 0,
    isFallback: false
  };
}

/**
 * 6.3.4 / CA-3.2 e CA-3.3 — funding POR INTERVALO com cobertura declarada.
 *
 * Onde houver registro real, usa o real (custo = soma exata dos registros da
 * janela). Onde não houver, cobra a taxa fixa SOMENTE nos eventos esperados
 * sem registro — nunca zera o trecho — e declara isso em `assumptions`.
 * `fundingCoverage` é o percentual de eventos cobertos por dado real.
 */
export function calculateFundingCostWithCoverage(
  params: CalculateFundingParams
): FundingCostCoverageResult {
  const {
    direction,
    positionSize = 1,
    entryTime,
    exitTime,
    fundingRecords = [],
    fallbackFundingRatePer8h = 0.0001,
    fundingIntervalHours = 8
  } = params;

  const intervalMs = Math.max(1, fundingIntervalHours) * 3600 * 1000;
  const durationMs = Math.max(0, exitTime - entryTime);
  const expectedEvents = Math.floor(durationMs / intervalMs);

  // Eventos com registro real na janela (mesma regra de atravessamento).
  const relevantRecords = fundingRecords.filter(
    r => r.fundingTime > entryTime && r.fundingTime <= exitTime
  );
  const coveredEvents = Math.min(relevantRecords.length, expectedEvents);
  const fallbackEvents = Math.max(0, expectedEvents - relevantRecords.length);

  const sign = direction === 'LONG' ? 1 : -1;

  let realRateSum = 0;
  let specialRateSum = 0;
  for (const record of relevantRecords) {
    if (record.rateType === 'Special') {
      specialRateSum += record.fundingRate;
    } else {
      realRateSum += record.fundingRate;
    }
  }

  const realFundingCostPct = sign * (realRateSum + specialRateSum) * 100 * positionSize;
  const fallbackFundingCostPct = sign * fallbackEvents * (fallbackFundingRatePer8h * 100) * positionSize;
  const totalFundingCostPct = realFundingCostPct + fallbackFundingCostPct;

  const fundingCoverage =
    expectedEvents > 0 ? Math.min(100, (coveredEvents / expectedEvents) * 100) : 100;

  const assumptions: string[] = [];
  if (fallbackEvents > 0) {
    assumptions.push(
      `${fallbackEvents} evento(s) de funding sem registro real cobrado(s) à taxa fixa de ${fallbackFundingRatePer8h * 100}%/intervalo`
    );
  }

  return {
    totalFundingCostPct,
    normalFundingCostPct: realFundingCostPct,
    specialFundingCostPct: 0,
    cyclesCrossed: relevantRecords.length,
    hasSpecialFunding: specialRateSum !== 0,
    isFallback: relevantRecords.length === 0,
    expectedEvents,
    coveredEvents,
    fundingCoverage,
    realFundingCostPct,
    fallbackFundingCostPct,
    assumptions
  };
}
