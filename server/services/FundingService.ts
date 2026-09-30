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
