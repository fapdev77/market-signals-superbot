/**
 * FundingSyncService (Fase 6.3 — G-09)
 *
 * 6.3.1 — Sincronização incremental de `/fapi/v1/fundingRate` para
 * `historical_funding`: pagina por `startTime` (até 1000 registros por
 * chamada, o máximo do endpoint) e é IDEMPOTENTE — a gravação usa upsert na
 * chave única `symbol + funding_time`, então reprocessar a mesma janela não
 * duplica registros.
 *
 * 6.3.2 — `rateType` (Regular/Special) é persistido por registro quando a
 * resposta o traz (confirmado na fixture real de 2026-09-30: "Regular").
 *
 * 6.3.3/CA-3.4 — toda chamada passa pelo orçamento de páginas por minuto
 * (`maxPagesPerMinute`); ao esgotar o orçamento, o serviço para SEM estourar
 * o peso e informa o ponto de retomada (`nextStartTime`). O endpoint divide
 * com `fundingInfo` o limite de 500 req/5min por IP (peso 1 por chamada).
 */

export type FundingSyncStatus = 'COMPLETE' | 'BUDGET_EXHAUSTED';

export interface FundingSyncPageParams {
  symbol: string;
  startTime: number;
  limit: number;
}

export interface FundingSyncRow {
  symbol: string;
  fundingTime: number;
  fundingRate: number;
  markPrice: number | null;
  rateType: string;
}

export interface FundingSyncDeps {
  /** Busca uma página do endpoint de fundingRate (deve passar pelo limiter na implementação real). */
  fetchPage(params: FundingSyncPageParams): Promise<{ rows: Array<Record<string, any>> }>;
  /** Gravação idempotente (upsert) em `historical_funding`. */
  insertBatch(rows: FundingSyncRow[]): Promise<void>;
  /** Orçamento de páginas por minuto (CA-3.4). Default: 60. */
  maxPagesPerMinute?: number;
  now?: () => number;
  log?: (message: string) => void;
}

export interface FundingSyncWindow {
  startTime: number;
  /** Inclusivo; registros com fundingTime > endTime são descartados. */
  endTime: number;
}

export interface FundingSyncResult {
  symbol: string;
  status: FundingSyncStatus;
  pagesFetched: number;
  recordsSynced: number;
  /** Ponto de retomada quando status === 'BUDGET_EXHAUSTED'; null quando completo. */
  nextStartTime: number | null;
}

/** Máximo por chamada do `/fapi/v1/fundingRate`. */
export const FUNDING_RATE_PAGE_LIMIT = 1000;

/**
 * Normaliza uma linha da API para o formato do DAO. `rateType` é preservado
 * quando presente (Regular/Special); ausência vira 'Normal' (6.3.2).
 */
function toDaoRow(apiRow: Record<string, any>, fallbackSymbol: string): FundingSyncRow {
  const rawRateType = apiRow.rateType != null ? String(apiRow.rateType).trim() : '';
  return {
    symbol: String(apiRow.symbol || fallbackSymbol),
    fundingTime: Number(apiRow.fundingTime),
    fundingRate: Number(apiRow.fundingRate),
    markPrice: apiRow.markPrice != null ? Number(apiRow.markPrice) : null,
    rateType: rawRateType !== '' ? rawRateType : 'Normal'
  };
}

/**
 * Sincroniza o funding de um símbolo de `window.startTime` até
 * `window.endTime`, paginando até esgotar os dados ou o orçamento de páginas.
 */
export async function syncFundingForSymbol(
  symbol: string,
  window: FundingSyncWindow,
  deps: FundingSyncDeps
): Promise<FundingSyncResult> {
  const maxPages = Math.max(1, deps.maxPagesPerMinute ?? 60);
  const log = deps.log ?? (() => {});

  let startTime = Math.max(0, Number(window.startTime) || 0);
  let pagesFetched = 0;
  let recordsSynced = 0;
  let lastFundingTime: number | null = null;
  let exhausted = false;

  while (pagesFetched < maxPages) {
    const page = await deps.fetchPage({ symbol, startTime, limit: FUNDING_RATE_PAGE_LIMIT });
    pagesFetched++;

    const rows = Array.isArray(page?.rows) ? page.rows : [];
    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    const inWindow = rows
      .filter(r => Number(r.fundingTime) <= window.endTime)
      .map(r => toDaoRow(r, symbol));
    if (inWindow.length > 0) {
      await deps.insertBatch(inWindow);
      recordsSynced += inWindow.length;
    }

    const pageLast = Number(rows[rows.length - 1].fundingTime);
    lastFundingTime = pageLast;

    // Página curta = último trecho da série; janela encerrada = nada a mais.
    if (rows.length < FUNDING_RATE_PAGE_LIMIT || pageLast >= window.endTime) {
      exhausted = true;
      break;
    }

    // A página seguinte começa ESTRITAMENTE após o último registro recebido.
    startTime = pageLast;
  }

  const status: FundingSyncStatus = exhausted ? 'COMPLETE' : 'BUDGET_EXHAUSTED';
  const nextStartTime = exhausted ? null : lastFundingTime;

  if (status === 'BUDGET_EXHAUSTED') {
    log(
      `[FundingSync] ${symbol}: orçamento de ${maxPages} páginas/min esgotado em ${recordsSynced} registros; retomada em ${nextStartTime}.`
    );
  }

  return { symbol, status, pagesFetched, recordsSynced, nextStartTime };
}

/**
 * Dependências reais: chamadas via `requestJsonLimited` (rate limiter com
 * assertAllowed + headers de peso) e gravação pelo DAO idempotente.
 * Imports dinâmicos mantêm este módulo leve para testes que só usam fakes.
 */
export function createDefaultFundingSyncDeps(options?: { baseUrl?: string }): FundingSyncDeps {
  const baseUrl = options?.baseUrl || 'https://fapi.binance.com';
  return {
    fetchPage: async ({ symbol, startTime, limit }) => {
      const { requestJsonLimited } = await import('../utils/httpClient.js');
      const url = `${baseUrl}/fapi/v1/fundingRate?symbol=${encodeURIComponent(symbol)}&startTime=${startTime}&limit=${limit}`;
      const rows = await requestJsonLimited<any[]>(url, { method: 'GET' });
      return { rows: Array.isArray(rows) ? rows : [] };
    },
    insertBatch: async rows => {
      const { historicalFundingDao } = await import('../backtest_db/index.js');
      await historicalFundingDao.insertBatch(rows);
    }
  };
}
