import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTradfiMarketOpen,
  canGenerateSignalsForAsset,
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests
} from '../server/binanceService.js';
import tradingScheduleFixture from './fixtures/binance/tradingSchedule.json';

describe('M1.3 & CA-1.2: Gate Scope - Only TRADIFI_PERPETUAL contracts are gate-blocked', () => {
  beforeEach(() => {
    __applyTradingScheduleForTests(tradingScheduleFixture.marketSchedules as any);
  });

  afterEach(() => {
    __resetTradingScheduleForTests();
  });

  it('allows crypto perpetuals (PERPETUAL) 24/7 on weekends', () => {
    // Saturday afternoon: 2026-10-03 16:00 UTC
    const saturday = new Date('2026-10-03T16:00:00Z');

    // BTCUSDT is PERPETUAL
    const btcDecision = canGenerateSignalsForAsset({
      symbol: 'BTCUSDT',
      contractType: 'PERPETUAL',
      tradfiCategory: null
    }, saturday);

    expect(btcDecision.allow).toBe(true);

    // PAXGUSDT is gold-backed commodity token but has contractType PERPETUAL -> NOT blocked by market calendar
    const paxgDecision = canGenerateSignalsForAsset({
      symbol: 'PAXGUSDT',
      contractType: 'PERPETUAL',
      tradfiCategory: 'COMMODITY'
    }, saturday);

    expect(paxgDecision.allow).toBe(true);
  });

  it('blocks equity TRADIFI_PERPETUAL contracts on Saturday', () => {
    // Saturday afternoon: 2026-10-03 16:00 UTC
    const saturday = new Date('2026-10-03T16:00:00Z');

    const aaplDecision = canGenerateSignalsForAsset({
      symbol: 'AAPLUSDT',
      contractType: 'TRADIFI_PERPETUAL',
      tradfiCategory: 'EQUITY'
    }, saturday);

    expect(aaplDecision.allow).toBe(false);
    expect(aaplDecision.reason).toMatch(/mercado.*fechado|sessão.*fechada|fail-closed/i);
  });
});
