/**
 * R-15 — Contadores em memória do processo.
 *
 * Sem dependência nova: um Map de contadores monotônicos + timestamp de boot,
 * expostos como JSON simples em `GET /api/system/metrics` (Prometheus só se
 * houver demanda, conforme a spec).
 *
 * Nomes canônicos em `METRIC_NAMES`; erros por feed usam o prefixo `feed_errors.`
 * (integrado com o registro de health do R-13).
 */

export const METRIC_NAMES = {
  ticksProcessed: 'ticks_processed',
  signalsEmitted: 'signals_emitted',
  signalsSuppressedKillswitch: 'signals_suppressed_killswitch',
  signalsBlockedDatagate: 'signals_blocked_datagate',
  signalsBlockedRiskLimit: 'signals_blocked_risk_limit',
  signalsSuppressedLedgerFailure: 'signals_suppressed_ledger_failure',
  signalsEvaluated: 'signals_evaluated',
  tradingScheduleBlocks: 'trading_schedule_blocks',
  ledgerWriteFailures: 'ledger_write_failures',
  feedErrors: 'feed_errors' // prefixo: feed_errors.<feed>
} as const;

const counters = new Map<string, number>();
const startedAt = Date.now();

// Métricas canônicas nascem visíveis em 0 (o snapshot é estável para dashboards).
counters.set(METRIC_NAMES.ticksProcessed, 0);
counters.set(METRIC_NAMES.signalsEmitted, 0);
counters.set(METRIC_NAMES.signalsSuppressedKillswitch, 0);
counters.set(METRIC_NAMES.signalsBlockedDatagate, 0);
counters.set(METRIC_NAMES.signalsBlockedRiskLimit, 0);
counters.set(METRIC_NAMES.signalsSuppressedLedgerFailure, 0);
counters.set(METRIC_NAMES.signalsEvaluated, 0);
counters.set(METRIC_NAMES.tradingScheduleBlocks, 0);
counters.set(METRIC_NAMES.ledgerWriteFailures, 0);

/** Incrementa um contador (delta default 1). Nomes são normalizados para snake_case. */
export function incrementMetric(name: string, delta: number = 1): void {
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_');
  if (!key) return;
  counters.set(key, (counters.get(key) ?? 0) + (Number.isFinite(delta) ? delta : 1));
}

/** Snapshot imutável dos contadores + uptime. */
export function getMetrics(): {
  startedAt: number;
  generatedAt: number;
  uptimeMs: number;
  counters: Record<string, number>;
} {
  const generatedAt = Date.now();
  return {
    startedAt,
    generatedAt,
    uptimeMs: generatedAt - startedAt,
    counters: Object.fromEntries(
      [...counters.entries()].sort(([a], [b]) => a.localeCompare(b))
    )
  };
}

/** Test-only: zera os contadores (não o startedAt); canônicos voltam a 0 visível. */
export function resetMetricsForTests(): void {
  counters.clear();
  for (const name of Object.values(METRIC_NAMES)) {
    if (name !== METRIC_NAMES.feedErrors) counters.set(name, 0);
  }
}
