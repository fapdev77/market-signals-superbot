import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests,
  getTradfiSession,
  isTradfiSessionAllowed,
  getTradfiExtendedScoreBonus,
  canGenerateSignalsForAsset
} from '../server/binanceService.js';
import tradingScheduleFixture from './fixtures/binance/tradingSchedule.json';

describe('M1.4 & CA-1.1: TradFi Session Policy', () => {
  beforeEach(() => {
    __applyTradingScheduleForTests(tradingScheduleFixture.marketSchedules as any);
  });

  afterEach(() => {
    __resetTradingScheduleForTests();
  });

  it('identifies sessions from tradingSchedule fixture', () => {
    // 1774857600000 + 1000 = inside PRE_MARKET (EQUITY)
    const preMarketDate = new Date(1774857600000 + 1000);
    const sessionPre = getTradfiSession('EQUITY', preMarketDate);
    expect(sessionPre?.type).toBe('PRE_MARKET');

    // 1774877400000 + 1000 = inside REGULAR
    const regularDate = new Date(1774877400000 + 1000);
    const sessionReg = getTradfiSession('EQUITY', regularDate);
    expect(sessionReg?.type).toBe('REGULAR');

    // 1774900800000 + 1000 = inside AFTER_MARKET
    const afterDate = new Date(1774900800000 + 1000);
    const sessionAfter = getTradfiSession('EQUITY', afterDate);
    expect(sessionAfter?.type).toBe('AFTER_MARKET');

    // 1774915200000 + 1000 = inside OVERNIGHT
    const overnightDate = new Date(1774915200000 + 1000);
    const sessionOvernight = getTradfiSession('EQUITY', overnightDate);
    expect(sessionOvernight?.type).toBe('OVERNIGHT');
  });

  it('allows REGULAR, PRE_MARKET, and AFTER_MARKET, and blocks OVERNIGHT and NO_TRADING (D2 & CA-1.1)', () => {
    expect(isTradfiSessionAllowed('REGULAR')).toBe(true);
    expect(isTradfiSessionAllowed('PRE_MARKET')).toBe(true);
    expect(isTradfiSessionAllowed('AFTER_MARKET')).toBe(true);
    expect(isTradfiSessionAllowed('OVERNIGHT')).toBe(false);
    expect(isTradfiSessionAllowed('NO_TRADING')).toBe(false);
  });

  it('returns score bonus of 5 points for extended sessions (PRE_MARKET and AFTER_MARKET)', () => {
    expect(getTradfiExtendedScoreBonus('REGULAR')).toBe(0);
    expect(getTradfiExtendedScoreBonus('PRE_MARKET')).toBe(5);
    expect(getTradfiExtendedScoreBonus('AFTER_MARKET')).toBe(5);
  });

  it('fails closed when tradingSchedule is missing and TRADFI_SCHEDULE_FALLBACK is not clock (M1.5 & CA-1.3)', () => {
    __resetTradingScheduleForTests();
    const oldFallback = process.env.TRADFI_SCHEDULE_FALLBACK;
    delete process.env.TRADFI_SCHEDULE_FALLBACK;

    try {
      const decision = canGenerateSignalsForAsset({
        symbol: 'AAPLUSDT',
        contractType: 'TRADIFI_PERPETUAL',
        tradfiCategory: 'EQUITY'
      }, new Date('2026-10-01T15:00:00Z'));

      expect(decision.allow).toBe(false);
      expect(decision.reason).toMatch(/tradingSchedule indisponível.*fail-closed/i);
    } finally {
      if (oldFallback) process.env.TRADFI_SCHEDULE_FALLBACK = oldFallback;
    }
  });
});
