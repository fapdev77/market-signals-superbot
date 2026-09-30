import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AlertService,
  type AlertSink,
  type AlertPayload
} from '../server/services/AlertService.js';

describe('M4.7: AlertService Sinks and Deduplication Window', () => {
  let mockSink: AlertSink;
  let sentAlerts: AlertPayload[];

  beforeEach(() => {
    sentAlerts = [];
    mockSink = {
      name: 'mock',
      send: async (payload: AlertPayload) => {
        sentAlerts.push(payload);
        return true;
      }
    };
  });

  it('sends alert through registered sink when triggered', async () => {
    const alertService = new AlertService({
      dedupWindowMs: 10 * 60 * 1000,
      sinks: [mockSink]
    });

    const now = 1000000;
    const sent = await alertService.emitAlert(
      'clock_drift',
      'HIGH',
      'Deriva de relógio detectada',
      { driftMs: 3100 },
      now
    );

    expect(sent).toBe(true);
    expect(sentAlerts.length).toBe(1);
    expect(sentAlerts[0].key).toBe('clock_drift');
    expect(sentAlerts[0].severity).toBe('HIGH');
  });

  it('deduplicates alerts for the same key within the 10 min window', async () => {
    const alertService = new AlertService({
      dedupWindowMs: 10 * 60 * 1000,
      sinks: [mockSink]
    });

    const t0 = 1000000;
    // First trigger -> sends
    const first = await alertService.emitAlert('feed_degraded', 'HIGH', 'Feed ticker degradado', {}, t0);
    expect(first).toBe(true);
    expect(sentAlerts.length).toBe(1);

    // Second trigger 2 minutes later -> suppressed by dedup window
    const second = await alertService.emitAlert('feed_degraded', 'HIGH', 'Feed ticker ainda degradado', {}, t0 + 2 * 60 * 1000);
    expect(second).toBe(false);
    expect(sentAlerts.length).toBe(1);

    // Different key -> sends immediately
    const diffKey = await alertService.emitAlert('kill_switch', 'CRITICAL', 'Kill switch ativado', {}, t0 + 3 * 60 * 1000);
    expect(diffKey).toBe(true);
    expect(sentAlerts.length).toBe(2);

    // After 10 min (e.g. 11 min) -> sends again
    const afterWindow = await alertService.emitAlert('feed_degraded', 'HIGH', 'Feed ticker degradado novamente', {}, t0 + 11 * 60 * 1000);
    expect(afterWindow).toBe(true);
    expect(sentAlerts.length).toBe(3);
  });
});
