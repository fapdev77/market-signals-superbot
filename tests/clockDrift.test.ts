import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateClockDrift,
  isClockDegraded,
  resetClockServiceForTests,
  getClockDriftMs
} from '../server/services/ClockService.js';
import { AlertService, type AlertPayload } from '../server/services/AlertService.js';

describe('M4.6 & CA-4.5: Clock Drift Detection & Alerting', () => {
  let sentAlerts: AlertPayload[];
  let alertService: AlertService;

  beforeEach(() => {
    sentAlerts = [];
    resetClockServiceForTests();
    alertService = new AlertService({
      dedupWindowMs: 10 * 60 * 1000,
      sinks: [
        {
          name: 'test-sink',
          send: async (p) => {
            sentAlerts.push(p);
            return true;
          }
        }
      ]
    });
  });

  it('tolerates minor drift under 2 seconds (e.g. 500ms)', async () => {
    const localNow = 1700000000500;
    const serverTime = 1700000000000; // 500ms drift

    const result = await evaluateClockDrift({
      localTime: localNow,
      serverTime,
      alertService
    });

    expect(result.driftMs).toBe(500);
    expect(result.degraded).toBe(false);
    expect(isClockDegraded()).toBe(false);
    expect(sentAlerts.length).toBe(0);
  });

  it('CA-4.5: simulated 3s drift marks system degraded and emits exactly one alert within dedup window', async () => {
    const localNow = 1700000003000;
    const serverTime = 1700000000000; // 3000ms = 3s drift (> 2s limit)

    // First check: marks degraded and sends alert
    const check1 = await evaluateClockDrift({
      localTime: localNow,
      serverTime,
      alertService
    });

    expect(check1.degraded).toBe(true);
    expect(check1.driftMs).toBe(3000);
    expect(isClockDegraded()).toBe(true);
    expect(getClockDriftMs()).toBe(3000);
    expect(sentAlerts.length).toBe(1);
    expect(sentAlerts[0].key).toBe('clock_drift');

    // Repeated check 2 minutes later with continuing 3s drift:
    // Still degraded, but alert is suppressed by deduplication window
    const check2 = await evaluateClockDrift({
      localTime: localNow + 2 * 60 * 1000,
      serverTime: serverTime + 2 * 60 * 1000,
      alertService
    });

    expect(check2.degraded).toBe(true);
    expect(isClockDegraded()).toBe(true);
    expect(sentAlerts.length).toBe(1); // exactly one alert!
  });

  it('recovers to healthy when drift drops back below 2s', async () => {
    // 1. Degraded with 3s drift
    await evaluateClockDrift({
      localTime: 1003000,
      serverTime: 1000000,
      alertService
    });
    expect(isClockDegraded()).toBe(true);

    // 2. Recovers with 200ms drift
    const recovered = await evaluateClockDrift({
      localTime: 1005200,
      serverTime: 1005000,
      alertService
    });
    expect(recovered.degraded).toBe(false);
    expect(isClockDegraded()).toBe(false);
  });
});
