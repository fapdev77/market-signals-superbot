import { describe, it, expect } from 'vitest';
import {
  calculateHistoricalFundingCost,
  type HistoricalFundingRecord
} from '../server/services/FundingService.js';

describe('M2.1 & CA-2.1: Real funding calculation per trade in backtest', () => {
  it('calculates exact funding cost for 24h trade crossing multiple funding cycles', () => {
    // 24h position from t=1000 to t=87400000
    const entryTime = 1774857600000; // 00:00 UTC
    const exitTime = entryTime + 24 * 3600 * 1000; // +24h

    // 3 funding events at 00:00 (excluded if at exact entry or included if strictly during), 08:00, 16:00, 24:00
    const fundingRecords: HistoricalFundingRecord[] = [
      {
        symbol: 'BTCUSDT',
        fundingTime: entryTime + 8 * 3600 * 1000, // 08:00 UTC
        fundingRate: 0.00015, // 0.015%
        markPrice: 68000,
        rateType: 'Normal'
      },
      {
        symbol: 'BTCUSDT',
        fundingTime: entryTime + 16 * 3600 * 1000, // 16:00 UTC
        fundingRate: 0.00010, // 0.010%
        markPrice: 68500,
        rateType: 'Normal'
      }
    ];

    // Long position pays positive funding
    const longCost = calculateHistoricalFundingCost({
      direction: 'LONG',
      positionSize: 1, // 100% size
      entryTime,
      exitTime,
      fundingRecords
    });

    // 0.015% + 0.010% = 0.025% = 0.00025 of notional (0.025% total funding cost)
    expect(longCost.totalFundingCostPct).toBeCloseTo(0.025, 5);
    expect(longCost.cyclesCrossed).toBe(2);
    expect(longCost.specialFundingCostPct).toBe(0);

    // Short position receives positive funding (cost is negative)
    const shortCost = calculateHistoricalFundingCost({
      direction: 'SHORT',
      positionSize: 1,
      entryTime,
      exitTime,
      fundingRecords
    });

    expect(shortCost.totalFundingCostPct).toBeCloseTo(-0.025, 5);
    expect(shortCost.cyclesCrossed).toBe(2);
  });

  it('separates Special funding (e.g. dividend adjustment on equity perps)', () => {
    const entryTime = 1774857600000;
    const exitTime = entryTime + 12 * 3600 * 1000;

    const fundingRecords: HistoricalFundingRecord[] = [
      {
        symbol: 'AAPLUSDT',
        fundingTime: entryTime + 4 * 3600 * 1000,
        fundingRate: 0.0001, // Normal funding
        markPrice: 220,
        rateType: 'Normal'
      },
      {
        symbol: 'AAPLUSDT',
        fundingTime: entryTime + 8 * 3600 * 1000,
        fundingRate: 0.0050, // Special corporate action / dividend funding
        markPrice: 220,
        rateType: 'Special'
      }
    ];

    const cost = calculateHistoricalFundingCost({
      direction: 'LONG',
      positionSize: 1,
      entryTime,
      exitTime,
      fundingRecords
    });

    expect(cost.totalFundingCostPct).toBeCloseTo(0.51, 4); // 0.01% + 0.50%
    expect(cost.normalFundingCostPct).toBeCloseTo(0.01, 4);
    expect(cost.specialFundingCostPct).toBeCloseTo(0.50, 4);
    expect(cost.hasSpecialFunding).toBe(true);
  });

  it('falls back to baseline assumption when no historical funding records exist', () => {
    const entryTime = 1774857600000;
    const exitTime = entryTime + 8 * 3600 * 1000; // 8 hours = 1 standard cycle

    const cost = calculateHistoricalFundingCost({
      direction: 'LONG',
      positionSize: 1,
      entryTime,
      exitTime,
      fundingRecords: [],
      fallbackFundingRatePer8h: 0.0001 // 0.01%
    });

    expect(cost.isFallback).toBe(true);
    expect(cost.totalFundingCostPct).toBeCloseTo(0.01, 4);
  });
});
