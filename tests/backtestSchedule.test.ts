import { describe, it, expect } from 'vitest';
import { isScheduleDue, computeNextExecutionTime } from '../server/services/BacktestScheduler.js';
import { BacktestScheduleRow } from '../server/backtest_db/index.js';

describe('Backtest Automated Daily Schedule & Historical Comparison', () => {
  const baseSchedule: BacktestScheduleRow = {
    id: 'daily-default',
    enabled: true,
    timeOfDay: '00:00',
    timezone: 'UTC',
    symbol: 'BTCUSDT',
    days: 30,
    profile: 'daytrade',
    lastRunAt: null,
    lastRunStatus: null,
    lastResultId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('triggers when enabled and current UTC time matches timeOfDay and has not run today', () => {
    // Construct a date at exactly 00:00 UTC
    const dateAtMidnight = new Date('2026-10-01T00:00:15.000Z').getTime();
    const due = isScheduleDue(baseSchedule, dateAtMidnight);
    expect(due).toBe(true);
  });

  it('does NOT trigger when schedule is disabled', () => {
    const disabledSchedule = { ...baseSchedule, enabled: false };
    const dateAtMidnight = new Date('2026-10-01T00:00:15.000Z').getTime();
    const due = isScheduleDue(disabledSchedule, dateAtMidnight);
    expect(due).toBe(false);
  });

  it('does NOT trigger when current time does not match timeOfDay', () => {
    const dateAtNoon = new Date('2026-10-01T12:30:00.000Z').getTime();
    const due = isScheduleDue(baseSchedule, dateAtNoon);
    expect(due).toBe(false);
  });

  it('does NOT trigger if already executed within the past 23 hours', () => {
    const dateAtMidnight = new Date('2026-10-01T00:00:15.000Z').getTime();
    const alreadyRunSchedule: BacktestScheduleRow = {
      ...baseSchedule,
      lastRunAt: dateAtMidnight - (2 * 3600 * 1000) // ran 2 hours ago
    };
    const due = isScheduleDue(alreadyRunSchedule, dateAtMidnight);
    expect(due).toBe(false);
  });

  it('triggers again if last execution was more than 23 hours ago', () => {
    const dateAtMidnight = new Date('2026-10-02T00:00:15.000Z').getTime();
    const oldRunSchedule: BacktestScheduleRow = {
      ...baseSchedule,
      lastRunAt: dateAtMidnight - (24 * 3600 * 1000) // ran 24 hours ago
    };
    const due = isScheduleDue(oldRunSchedule, dateAtMidnight);
    expect(due).toBe(true);
  });

  it('computes next execution time correctly when scheduled for later today', () => {
    const nowMs = new Date('2026-10-01T10:00:00.000Z').getTime();
    const nextInfo = computeNextExecutionTime({ enabled: true, timeOfDay: '15:30', lastRunAt: null }, nowMs);
    expect(nextInfo).not.toBeNull();
    expect(nextInfo?.isToday).toBe(true);
    expect(nextInfo?.formattedUTC).toContain('Hoje');
    expect(nextInfo?.formattedUTC).toContain('15:30 UTC');
    expect(nextInfo?.timeRemainingFormatted).toBe('5h 30m');
  });

  it('computes next execution time as tomorrow when scheduled time has already passed today', () => {
    const nowMs = new Date('2026-10-01T16:00:00.000Z').getTime();
    const nextInfo = computeNextExecutionTime({ enabled: true, timeOfDay: '00:00', lastRunAt: null }, nowMs);
    expect(nextInfo).not.toBeNull();
    expect(nextInfo?.isToday).toBe(false);
    expect(nextInfo?.formattedUTC).toContain('Amanhã');
    expect(nextInfo?.formattedUTC).toContain('00:00 UTC');
    expect(nextInfo?.timeRemainingFormatted).toBe('8h 0m');
  });

  it('returns null for next execution time when schedule is disabled', () => {
    const nowMs = new Date('2026-10-01T10:00:00.000Z').getTime();
    const nextInfo = computeNextExecutionTime({ enabled: false, timeOfDay: '15:30' }, nowMs);
    expect(nextInfo).toBeNull();
  });
});
