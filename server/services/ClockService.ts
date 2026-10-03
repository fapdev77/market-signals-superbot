/**
 * ClockService (M4.6 / R-27)
 *
 * Compares local system time with Binance exchange server time (GET /fapi/v1/time).
 * - Max allowed drift: 2000 ms (2.0s).
 * - Drift > 2000 ms marks system degraded and triggers an alert via AlertService (with deduplication).
 * - If drift drops back <= 2000 ms, degradation clears.
 */

import { AlertService, defaultAlertService } from './AlertService.js';
import { getErrorMessage } from '../utils/errors.js';

export const MAX_CLOCK_DRIFT_MS = 2000; // 2 seconds

let clockDegraded = false;
let lastKnownDriftMs = 0;
let lastCheckedAt = 0;

export function isClockDegraded(): boolean {
  return clockDegraded;
}

export function getClockDriftMs(): number {
  return lastKnownDriftMs;
}

export function getLastClockCheckTime(): number {
  return lastCheckedAt;
}

export function resetClockServiceForTests(): void {
  clockDegraded = false;
  lastKnownDriftMs = 0;
  lastCheckedAt = 0;
}

export interface ClockDriftParams {
  localTime?: number;
  serverTime: number;
  alertService?: AlertService;
}

/**
 * Pure evaluation function for clock drift.
 */
export async function evaluateClockDrift(params: ClockDriftParams): Promise<{
  driftMs: number;
  degraded: boolean;
}> {
  const local = params.localTime ?? Date.now();
  const server = params.serverTime;
  const driftMs = Math.abs(local - server);
  const degraded = driftMs > MAX_CLOCK_DRIFT_MS;

  lastKnownDriftMs = driftMs;
  lastCheckedAt = local;
  clockDegraded = degraded;

  if (degraded) {
    const alertSvc = params.alertService ?? defaultAlertService;
    await alertSvc.emitAlert(
      'clock_drift',
      'HIGH',
      `Deriva de relógio do sistema detectada: ${driftMs}ms (limite máximo tolerado: ${MAX_CLOCK_DRIFT_MS}ms). ` +
      `O sistema foi marcado como DEGRADADO para prevenir distorções no DataGate.`,
      { driftMs, maxAllowedMs: MAX_CLOCK_DRIFT_MS, localTime: local, serverTime: server },
      local
    );
  }

  return { driftMs, degraded };
}

/**
 * Checks Binance server time via REST /fapi/v1/time.
 */
export async function checkBinanceServerTimeDrift(
  alertService: AlertService = defaultAlertService
): Promise<{ driftMs: number; degraded: boolean }> {
  try {
    const start = Date.now();
    const res = await fetch('https://fapi.binance.com/fapi/v1/time', {
      signal: AbortSignal.timeout(4000)
    });
    const roundtrip = Date.now() - start;
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json() as { serverTime: number };
    // Adjust serverTime by half the roundtrip latency
    const adjustedServerTime = data.serverTime + Math.round(roundtrip / 2);
    return await evaluateClockDrift({
      localTime: Date.now(),
      serverTime: adjustedServerTime,
      alertService
    });
  } catch (err) {
    console.warn('[ClockService] Falha ao consultar /fapi/v1/time:', getErrorMessage(err));
    return { driftMs: lastKnownDriftMs, degraded: clockDegraded };
  }
}
