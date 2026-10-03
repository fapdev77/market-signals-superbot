/**
 * FundingCoverageTrigger (Fase 6.3.3)
 *
 * Gatilhos de sincronização de funding:
 * - ANTES de cada backtest: garante cobertura do intervalo do símbolo
 *   (janela = dias solicitados + margem), de forma incremental e idempotente.
 * - DIÁRIO: para os símbolos monitorados, com orçamento máximo de páginas por
 *   minuto (`FUNDING_SYNC_BUDGET_PER_MINUTE`, default 60 — o endpoint divide
 *   com `fundingInfo` o limite de 500 req/5min por IP).
 *
 * Toda sincronização passa pelo rate limiter (requestJsonLimited dentro das
 * dependências default do FundingSyncService).
 */

import { syncFundingForSymbol, createDefaultFundingSyncDeps, type FundingSyncDeps } from './FundingSyncService.js';
import { getErrorMessage } from '../utils/errors.js';
import { historicalFundingDao } from '../backtest_db/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Margem adicional antes do início da janela (registros antigos podem ter sido capturados antes). */
const MARGIN_MS = 2 * DAY_MS;

export function defaultFundingBudgetPerMinute(): number {
  const parsed = Number(process.env.FUNDING_SYNC_BUDGET_PER_MINUTE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60;
}

export interface EnsureFundingCoverageOptions {
  budgetPerMinute?: number;
  /** Injeção para testes. */
  deps?: FundingSyncDeps;
  now?: () => number;
}

/**
 * Garante que `historical_funding` cobre a janela [now - days, now] do
 * símbolo. Idempotente: só sincroniza a partir do último registro existente
 * (ou da janela completa quando não há nada).
 */
export async function ensureFundingCoverage(
  symbol: string,
  days: number,
  options: EnsureFundingCoverageOptions = {}
): Promise<{ synced: boolean; records: number }> {
  const deps = options.deps ?? createDefaultFundingSyncDeps();
  const now = (options.now ?? Date.now)();
  const windowStart = now - Math.max(1, days) * DAY_MS - MARGIN_MS;

  // Ponto de partida incremental: último registro gravado do símbolo.
  let startTime = windowStart;
  try {
    const existing = await historicalFundingDao.getBySymbolAndRange(symbol, 0, now);
    if (existing.length > 0) {
      const lastTime = existing[existing.length - 1].fundingTime;
      if (lastTime >= now) {
        return { synced: false, records: 0 }; // já coberto até agora
      }
      startTime = Math.max(windowStart, lastTime);
    }
  } catch {
    // Sem leitura prévia, sincroniza a janela completa (fail-open: o backtest
    // declara a cobertura real de qualquer forma).
  }

  const result = await syncFundingForSymbol(
    symbol,
    { startTime, endTime: now },
    {
      fetchPage: deps.fetchPage,
      insertBatch: deps.insertBatch,
      maxPagesPerMinute: options.budgetPerMinute ?? defaultFundingBudgetPerMinute(),
      now: options.now ?? (() => Date.now()),
      log: message => console.log(message)
    }
  );

  return { synced: true, records: result.recordsSynced };
}

// ============================================================================
// 6.3.3 — Gatilho diário para os símbolos monitorados
// ============================================================================

interface DailyTriggerState {
  lastRunDay: string | null;
  timer: NodeJS.Timeout | null;
}

const dailyTrigger: DailyTriggerState = { lastRunDay: null, timer: null };

/** 8.3.2 — instante da ÚLTIMA sincronização diária de funding (métrica observável). */
let fundingSyncLastRunAt: number | null = null;

export function getFundingSyncLastRunAt(): number | null {
  return fundingSyncLastRunAt;
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** 8.3.1 — teto de símbolos por execução (evita rajada de peso REST). */
export function maxFundingSymbolsPerRun(): number {
  const parsed = Number(process.env.FUNDING_SYNC_MAX_SYMBOLS ?? process.env.TRADFI_MAX_MONITORED);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10;
}

/** 8.3.1 — aplica o teto de símbolos por execução (exportado para teste). */
export function capFundingSymbols(symbols: string[], max: number = maxFundingSymbolsPerRun()): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of symbols) {
    const sym = String(s || '').trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    unique.push(sym);
    if (unique.length >= max) break;
  }
  return unique;
}

/** Test-only: zera o marcador do gatilho diário. */
export function __resetDailyFundingSyncForTests(): void {
  dailyTrigger.lastRunDay = null;
  fundingSyncLastRunAt = null;
}

/**
 * Roda a sincronização diária dos símbolos informados com orçamento total de
 * páginas por minuto. Idempotente por dia (UTC). Retorna as estatísticas.
 */
export async function runDailyFundingSync(
  symbols: string[],
  options: { budgetPerMinute?: number; deps?: FundingSyncDeps; now?: () => number } = {}
): Promise<Array<{ symbol: string; status: string; recordsSynced: number }>> {
  const now = (options.now ?? Date.now)();
  dailyTrigger.lastRunDay = dayKey(now);
  fundingSyncLastRunAt = now;
  // 8.3.1 — teto de símbolos por execução.
  const cappedSymbols = capFundingSymbols(symbols);

  const budgetPerSymbol = Math.max(
    1,
    Math.floor((options.budgetPerMinute ?? defaultFundingBudgetPerMinute()) / Math.max(1, cappedSymbols.length))
  );

  const results: Array<{ symbol: string; status: string; recordsSynced: number }> = [];
  for (const symbol of cappedSymbols) {
    try {
      const coverage = await ensureFundingCoverage(symbol, 2, {
        budgetPerMinute: budgetPerSymbol,
        deps: options.deps,
        now: options.now
      });
      results.push({ symbol, status: coverage.synced ? 'SYNCED' : 'UPTODATE', recordsSynced: coverage.records });
    } catch (err) {
      console.warn(`[FundingSync] Falha no gatilho diário para ${symbol}:`, getErrorMessage(err));
      results.push({ symbol, status: 'ERROR', recordsSynced: 0 });
    }
  }
  return results;
}

/** Já rodou a sincronização diária hoje (UTC)? */
export function hasDailySyncRunToday(now: number = Date.now()): boolean {
  return dailyTrigger.lastRunDay === dayKey(now);
}

/**
 * Agenda o gatilho diário (chamado no boot do servidor). O callback
 * `getSymbols` fornece os símbolos monitorados no momento da execução.
 */
export function scheduleDailyFundingSync(
  getSymbols: () => string[],
  options: { intervalMs?: number; budgetPerMinute?: number; deps?: FundingSyncDeps } = {}
): void {
  if (dailyTrigger.timer) return;
  const intervalMs = options.intervalMs ?? 60 * 60 * 1000; // checa a cada hora
  dailyTrigger.timer = setInterval(() => {
    const symbols = getSymbols();
    if (!symbols.length || hasDailySyncRunToday()) return;
    runDailyFundingSync(symbols, {
      budgetPerMinute: options.budgetPerMinute,
      deps: options.deps
    }).catch(err => console.warn('[FundingSync] Gatilho diário falhou:', getErrorMessage(err)));
  }, intervalMs);
  if (typeof dailyTrigger.timer.unref === 'function') dailyTrigger.timer.unref();
}
