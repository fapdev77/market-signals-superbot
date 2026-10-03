import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkSchedulerGuards,
  capSchedulerSymbols,
  executeScheduledBacktest,
  type SchedulerRunDeps
} from '../server/services/BacktestScheduler.js';
import { getFeedHealth, resetFeedHealthForTests, recordFeedFailure } from '../server/services/feedHealth.js';
import {
  setSinksForTests,
  resetOperationalAlertsForTests
} from '../server/services/operationalAlerts.js';
import type { AlertSink } from '../server/services/AlertService.js';

/** 8.3.1 / CA-3.2 — guardas do BacktestScheduler. */

const schedule = {
  id: 'daily-default',
  enabled: true,
  timeOfDay: '00:00',
  timezone: 'UTC',
  symbol: 'BTCUSDT',
  days: 30,
  profile: 'daytrade'
} as never;

function botState() {
  return {
    weights: {
      volumeSurgeWeight: 20,
      openInterestWeight: 20,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 15,
      fibonacciZoneWeight: 15,
      rangePocWeight: 10,
      supportResistanceWeight: 10,
      volumeProfileRange: 20,
      minRiskRatio: 2.5
    }
  } as never;
}

function degradedSnapshot() {
  const snap = getFeedHealth(Date.now());
  snap.feeds.ticker.status = 'DEGRADED';
  return snap;
}

describe('8.3.1 / CA-3.2 — guardas do scheduler', () => {
  beforeEach(() => {
    resetFeedHealthForTests();
  });

  it('pula quando o rate limiter está em cooldown', () => {
    const g = checkSchedulerGuards({ isRateLimiterAllowed: () => false });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe('RATE_LIMITED');
  });

  it('pula com feed crítico DEGRADED', () => {
    const g = checkSchedulerGuards({
      isRateLimiterAllowed: () => true,
      getFeedHealthSnapshot: () => degradedSnapshot()
    });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe('FEED_DEGRADED');
    expect(g.reason).toContain('ticker');
  });

  it('libera com feeds UNKNOWN (fail-open controlado) e limiter ok', () => {
    const g = checkSchedulerGuards({ isRateLimiterAllowed: () => true });
    expect(g.allowed).toBe(true);
    expect(g.code).toBe('OK');
  });

  it('respeita o teto de símbolos por execução (dedup + corte)', () => {
    expect(capSchedulerSymbols(['BTCUSDT', 'btcusdt', 'ETHUSDT', 'SOLUSDT'], 2)).toEqual([
      'BTCUSDT',
      'ETHUSDT'
    ]);
    expect(capSchedulerSymbols([], 5)).toEqual([]);
  });

  it('não roda o backtest nem aplica pesos quando a guarda barra', async () => {
    const runBacktest = vi.fn();
    const state = botState() as { weights: Record<string, number> };
    const before = { ...state.weights };
    const deps: SchedulerRunDeps = {
      isRateLimiterAllowed: () => false,
      runBacktest: runBacktest as never,
      updateLastRun: async () => {}
    };

    const result = await executeScheduledBacktest(schedule, state as never, deps);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Pulado');
    expect(runBacktest).not.toHaveBeenCalled();
    // 8.3.1 — o scheduler não altera pesos.
    expect(state.weights).toEqual(before);
  });

  it('nunca concorre consigo mesmo', async () => {
    let release: (v: unknown) => void = () => {};
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const fakeResult = {
      id: 'r1',
      symbol: 'BTCUSDT',
      winRate: 50,
      profitFactor: 1,
      totalTrades: 0,
      netProfit: 0
    };
    const deps: SchedulerRunDeps = {
      isRateLimiterAllowed: () => true,
      ensureFunding: (async () => ({ synced: false, records: 0 })) as never,
      runBacktest: (() => gate.then(() => fakeResult)) as never,
      updateLastRun: async () => {}
    };

    const first = executeScheduledBacktest(schedule, botState(), deps);
    const second = await executeScheduledBacktest(schedule, botState(), deps);
    expect(second.success).toBe(false);
    expect(second.message).toContain('andamento');

    release(undefined);
    const done = await first;
    expect(done.success).toBe(true);
  });

  it('falha dispara alerta operacional BACKTEST_SCHEDULE_FAILED', async () => {
    resetOperationalAlertsForTests();
    const captured: unknown[] = [];
    const sink: AlertSink = {
      name: 'test',
      send: async payload => {
        captured.push(payload);
        return true;
      }
    };
    setSinksForTests([sink]);

    const deps: SchedulerRunDeps = {
      isRateLimiterAllowed: () => true,
      ensureFunding: (async () => ({ synced: false, records: 0 })) as never,
      runBacktest: (async () => {
        throw new Error('boom');
      }) as never,
      updateLastRun: async () => {}
    };

    const result = await executeScheduledBacktest(schedule, botState(), deps);
    expect(result.success).toBe(false);
    await new Promise(r => setTimeout(r, 10));
    expect(captured.some((p: any) => p?.metadata?.alertType === 'BACKTEST_SCHEDULE_FAILED')).toBe(true);
    resetOperationalAlertsForTests();
  });
});
