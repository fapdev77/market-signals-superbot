/**
 * R-13 — Health por feed com estado observável.
 *
 * Registro in-memory central do último resultado de cada feed de dado:
 *   ticker (REST/WS), klines, openInterest, funding, longShort, depth, ws, tradingSchedule.
 *
 * Regras:
 *  - Feed sem registro nenhum nasce UNKNOWN (nunca OK inventado — mesma honestidade do R-2);
 *  - `FEED_DEGRADED_THRESHOLD` falhas seguidas viram DEGRADED (falha isolada permanece OK,
 *    com o erro anotado);
 *  - Sucesso reseta a contagem e atualiza `lastSuccessAt`/`lastLatencyMs`;
 *  - Feed OK sem sucesso dentro de `FEED_OK_MAX_AGE_MS` é reportado STALE na leitura
 *    (a leitura aceita `now` injetado para ser testável);
 *  - Memória limitada: o histórico de erros guarda no máximo os 5 últimos.
 *
 * Consumidores chamam `recordFeedSuccess`/`recordFeedFailure` nos caminhos de fetch;
 * `GET /api/system/feed-health` (systemRoutes) e o `SystemHealthWidget` leem `getFeedHealth()`.
 * R-15: cada falha de feed também incrementa `feed_errors.<feed>` nas métricas do processo.
 */
import { incrementMetric } from '../utils/metrics.js';
import { emitOperationalAlert } from './operationalAlerts.js';

export type FeedName =
  | 'ticker'
  | 'klines'
  | 'openInterest'
  | 'funding'
  | 'longShort'
  | 'depth'
  | 'ws'
  | 'tradingSchedule';

export type FeedStatus = 'OK' | 'DEGRADED' | 'STALE' | 'UNKNOWN';

export interface FeedHealthEntry {
  status: FeedStatus;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
}

export interface FeedHealthSnapshot {
  generatedAt: number;
  feeds: Record<FeedName, FeedHealthEntry>;
  summary: {
    totalFeeds: number;
    ok: number;
    degraded: number;
    stale: number;
    unknown: number;
  };
}

/** Falhas seguidas que derrubam o feed para DEGRADED. */
const FEED_DEGRADED_THRESHOLD = 3;
/** Idade máxima de um último sucesso para o feed seguir OK na leitura. */
const FEED_OK_MAX_AGE_MS = 90 * 1000;
const MAX_ERROR_HISTORY = 5;

const FEED_NAMES: FeedName[] = [
  'ticker',
  'klines',
  'openInterest',
  'funding',
  'longShort',
  'depth',
  'ws',
  'tradingSchedule'
];

interface FeedState {
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  recentErrors: string[];
}

const feedStates = new Map<FeedName, FeedState>();

function stateOf(feed: FeedName): FeedState {
  let state = feedStates.get(feed);
  if (!state) {
    state = {
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastLatencyMs: null,
      lastError: null,
      recentErrors: []
    };
    feedStates.set(feed, state);
  }
  return state;
}

/** Registra sucesso de feed (latência opcional em ms). Reseta a contagem de falhas. */
export function recordFeedSuccess(feed: FeedName, latencyMs?: number): void {
  const state = stateOf(feed);
  state.consecutiveFailures = 0;
  state.lastSuccessAt = Date.now();
  if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
    state.lastLatencyMs = Math.max(0, Math.round(latencyMs));
  }
}

/** Registra falha de feed. Após o threshold, o feed fica DEGRADED (e emite FEED_DEGRADED uma vez). */
export function recordFeedFailure(feed: FeedName, error?: string): void {
  const state = stateOf(feed);
  state.consecutiveFailures += 1;
  state.lastFailureAt = Date.now();
  state.lastError = error ? String(error).slice(0, 300) : 'erro desconhecido';
  state.recentErrors.unshift(state.lastError);
  if (state.recentErrors.length > MAX_ERROR_HISTORY) state.recentErrors.pop();

  // R-15: erros por feed também viram contador de métrica (feed_errors.<feed>).
  try {
    incrementMetric(`feed_errors.${feed}`);
  } catch {
    /* telemetria nunca pode derrubar o caminho de dados */
  }

  // 6.6: transição OK→DEGRADED (threshold de falhas seguidas) emite FEED_DEGRADED uma
  // única vez por janela de dedup — a reemissão contínua é suprimida pela fachada.
  if (state.consecutiveFailures === FEED_DEGRADED_THRESHOLD) {
    void emitOperationalAlert(
      'FEED_DEGRADED',
      'HIGH',
      `Feed "${feed}" degradado após ${state.consecutiveFailures} falhas seguidas: ${state.lastError}`,
      { feed, consecutiveFailures: state.consecutiveFailures }
    );
  }
}

/**
 * Snapshot do estado dos feeds. `now` é injetável (testes/diagnóstico) — um feed OK cujo
 * último sucesso é mais antigo que `FEED_OK_MAX_AGE_MS` é reportado como STALE.
 */
export function getFeedHealth(now: number = Date.now()): FeedHealthSnapshot {
  const feeds = {} as Record<FeedName, FeedHealthEntry>;
  let ok = 0;
  let degraded = 0;
  let stale = 0;
  let unknown = 0;

  for (const feed of FEED_NAMES) {
    const state = feedStates.get(feed);
    let status: FeedStatus;
    if (!state || (state.lastSuccessAt === null && state.lastFailureAt === null)) {
      status = 'UNKNOWN';
      unknown++;
    } else if (state.consecutiveFailures >= FEED_DEGRADED_THRESHOLD) {
      status = 'DEGRADED';
      degraded++;
    } else if (state.lastSuccessAt !== null && now - state.lastSuccessAt > FEED_OK_MAX_AGE_MS) {
      status = 'STALE';
      stale++;
    } else {
      status = 'OK';
      ok++;
    }

    feeds[feed] = {
      status,
      consecutiveFailures: state?.consecutiveFailures ?? 0,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastFailureAt: state?.lastFailureAt ?? null,
      lastLatencyMs: state?.lastLatencyMs ?? null,
      lastError: state?.lastError ?? null
    };
  }

  return {
    generatedAt: now,
    feeds,
    summary: {
      totalFeeds: FEED_NAMES.length,
      ok,
      degraded,
      stale,
      unknown
    }
  };
}

/** Test-only: zera todo o registro de feeds. */
export function resetFeedHealthForTests(): void {
  feedStates.clear();
}
