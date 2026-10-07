import { getDb, scheduleDbSave, setDatabaseFilePathForTests } from '../db.js';
import type { DataOrigin, OriginFilter, KlineCandle } from '../../src/types.js';
import { runWithRetry } from '../utils/dbRetry.js';

/**
 * R-14 — Driver SQLite unificado.
 *
 * As tabelas `historical_klines` e `backtest_results` viviam em um segundo
 * banco (data/backtest.db) acessado por drizzle-orm + @libsql/client, enquanto
 * todo o resto da aplicação vivia em data/superbot.sqlite via sql.js. Isso
 * significava duas bibliotecas de SQLite, dois arquivos, duas políticas de
 * backup e um export parcial. Agora tudo vive no banco unificado, acessado por
 * esta DAO simples (sql.js puro).
 *
 * As tabelas são criadas pelas migrações versionadas (003/004 em
 * server/migrations/index.ts) — este módulo NÃO cria schema.
 */

export interface HistoricalKlineRow {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteAssetVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  /**
   * A-06 — proveniência do `takerBuyBaseVolume`.
   * `false` = o campo NÃO veio medido da exchange (o número gravado é 0 por
   * ausência, não uma medição) e não deve pontuar CVD/entrada. Ausente em
   * fixtures antigas é tratado como medido, igual à convenção de `KlineCandle`.
   */
  takerBuyVolumeAvailable?: boolean;
}

/**
 * A-06 (FASE 1): converte uma linha do histórico em `KlineCandle` SEM fabricar
 * taker volume. Antes era `takerBuyBaseVolume || volume * 0.50`, o que fazia o
 * backtest rodar sobre CVD metade inventado enquanto o live era honesto — a
 * paridade live↔backtest que A-05 declara não existe se os dados diferem.
 */
export function rowToKlineCandle(k: HistoricalKlineRow): KlineCandle {
  const takerBuyVolumeAvailable = k.takerBuyVolumeAvailable !== false;
  return {
    timestamp: k.openTime,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
    takerBuyVolume: takerBuyVolumeAvailable ? k.takerBuyBaseVolume : 0,
    takerBuyVolumeAvailable
  };
}

export interface BacktestResultRow {
  id: string;
  symbol: string;
  strategyId: string;
  startTime: number;
  endTime: number;
  totalTrades: number;
  winRate: number;
  /** `null` when no losing position closed, i.e. the factor was never measured. */
  profitFactor: number | null;
  maxDrawdown: number;
  netProfit: number;
  /** JSON string with the full result payload (equity curve, trades, etc). */
  config: string;
  createdAt: number;
}

/** Test-only: redirects the unified database file (delegates to server/db.ts). */
export function __setBacktestDbFilePathForTests(filePath: string): void {
  setDatabaseFilePathForTests(filePath);
}

type SqlJsStatementValues = Array<number | string | null>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * M8 — `num()` converte `null` em 0, que é um profit factor perfeitamente válido à
 * vista. A ausência precisa sobreviver até o consumidor.
 */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * R-2 — filtro de proveniência em `historical_klines`. `ALL` só é usado explicitamente e os
 * valores vêm de um union fechado, então a interpolação é segura.
 */
function klinesOriginClause(origin: OriginFilter): string {
  return origin === 'ALL' ? '' : ` AND origin = '${origin}'`;
}

export const historicalKlinesDao = {
  /**
   * R-2: `origin` é gravado por linha. Candles baixados da Binance são `LIVE`; candles
   * gerados por `HistoricalDataService.seedSyntheticKlines` são `DEMO` e ficam marcados como
   * tal no banco, em vez de se misturarem silenciosamente com o histórico real.
   */
  async insertMany(rows: HistoricalKlineRow[], origin: DataOrigin = 'LIVE'): Promise<void> {
    if (rows.length === 0) return;
    const db = await getDb();
    await runWithRetry(() => {
      db.run('BEGIN TRANSACTION;');
      try {
        for (const k of rows) {
          db.run(
            `INSERT OR IGNORE INTO historical_klines (
              symbol, interval, open_time, close_time, open, high, low, close,
              volume, quote_asset_volume, trades, taker_buy_base_volume, taker_buy_quote_volume, taker_buy_volume_available, origin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              k.symbol, k.interval, k.openTime, k.closeTime, k.open, k.high, k.low,
              k.close, k.volume, k.quoteAssetVolume, k.trades,
              k.takerBuyBaseVolume, k.takerBuyQuoteVolume,
              k.takerBuyVolumeAvailable === false ? 0 : 1, origin
            ] as SqlJsStatementValues
          );
        }
        db.run('COMMIT;');
      } catch (err) {
        try { db.run('ROLLBACK;'); } catch { /* already rolled back */ }
        throw err;
      }
    });
    // Bulk kline writes are the most expensive to flush (~140 MB image), so they
    // coalesce with any other pending state write instead of forcing a rewrite each time.
    scheduleDbSave();
  },

  async getBySymbolAndRange(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
    /** Optional padding in ms applied to both ends (HistoricalDataService uses 15min). */
    paddingMs: number = 0,
    /**
     * R-2: default `ALL` porque o único consumidor é o backtest, que roda de propósito sobre
     * dado sintético quando a flag está ligada. Quem quiser só mercado passa `'LIVE'`.
     */
    origin: OriginFilter = 'ALL'
  ): Promise<HistoricalKlineRow[]> {
    const db = await getDb();
    const res = db.exec(
      `SELECT symbol, interval, open_time, close_time, open, high, low, close,
              volume, quote_asset_volume, trades, taker_buy_base_volume, taker_buy_quote_volume,
              taker_buy_volume_available
       FROM historical_klines
       WHERE symbol = ? AND interval = ? AND open_time >= ? AND open_time <= ?${klinesOriginClause(origin)}
       ORDER BY open_time ASC`,
      [symbol, interval, startTime - paddingMs, endTime + paddingMs] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => ({
      symbol: String(row[0]),
      interval: String(row[1]),
      openTime: num(row[2]),
      closeTime: num(row[3]),
      open: num(row[4]),
      high: num(row[5]),
      low: num(row[6]),
      close: num(row[7]),
      volume: num(row[8]),
      quoteAssetVolume: num(row[9]),
      trades: num(row[10]),
      takerBuyBaseVolume: num(row[11]),
      takerBuyQuoteVolume: num(row[12]),
      // A-06: a ausência sobrevive até o consumidor (coluna nasce com 1 por
      // default — as linhas atuais vieram do fetch da Binance, que traz o campo).
      takerBuyVolumeAvailable: row[13] === undefined ? true : Number(row[13]) !== 0
    }));
  },

  /**
   * R-2: default `LIVE` de propósito — a sincronização incremental retoma do último candle
   * **real**. Se o último candle fosse sintético, o próximo lote real seria anexado no preço
   * errado (as séries têm bases diferentes) e a série viraria ficção sem aviso.
   */
  async getLatestOpenTime(symbol: string, interval: string, origin: OriginFilter = 'LIVE'): Promise<number | null> {
    const db = await getDb();
    const res = db.exec(
      `SELECT open_time FROM historical_klines WHERE symbol = ? AND interval = ?${klinesOriginClause(origin)} ORDER BY open_time DESC LIMIT 1`,
      [symbol, interval] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values.length) return null;
    return num(res[0].values[0][0]);
  },

  async stats(
    symbol: string,
    /** R-2: default `ALL` (o operador quer ver o que está guardado); a decomposição por origem
     *  vem em `statsByOrigin`. */
    origin: OriginFilter = 'ALL'
  ): Promise<{ count: number; minTime: number | null; maxTime: number | null }> {
    const db = await getDb();
    const res = db.exec(
      `SELECT count(*), min(open_time), max(open_time) FROM historical_klines WHERE symbol = ?${klinesOriginClause(origin)}`,
      [symbol] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values.length) return { count: 0, minTime: null, maxTime: null };
    const count = num(res[0].values[0][0]);
    return {
      count,
      minTime: count > 0 ? num(res[0].values[0][1]) : null,
      maxTime: count > 0 ? num(res[0].values[0][2]) : null
    };
  },

  async deleteBySymbol(symbol: string): Promise<void> {
    const db = await getDb();
    await runWithRetry(() => {
      // R-2: apaga as duas origens — um resync completo substitui o que existia, real ou sintético.
      db.run(`DELETE FROM historical_klines WHERE symbol = ?`, [symbol] as SqlJsStatementValues);
    });
    scheduleDbSave();
  }
};

export interface HistoricalFundingRow {
  symbol: string;
  fundingTime: number;
  fundingRate: number;
  markPrice: number | null;
  rateType: string;
}

export const historicalFundingDao = {
  async insertBatch(rows: HistoricalFundingRow[]): Promise<void> {
    if (!rows.length) return;
    const db = await getDb();
    await runWithRetry(() => {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO historical_funding (symbol, funding_time, funding_rate, mark_price, rate_type)
         VALUES (?, ?, ?, ?, ?)`
      );
      try {
        for (const row of rows) {
          stmt.run([row.symbol, row.fundingTime, row.fundingRate, row.markPrice, row.rateType || 'Normal']);
        }
      } finally {
        stmt.free();
      }
    });
    scheduleDbSave();
  },

  async getBySymbolAndRange(symbol: string, startTime: number, endTime: number): Promise<HistoricalFundingRow[]> {
    const db = await getDb();
    const res = db.exec(
      `SELECT symbol, funding_time, funding_rate, mark_price, rate_type
       FROM historical_funding
       WHERE symbol = ? AND funding_time >= ? AND funding_time <= ?
       ORDER BY funding_time ASC`,
      [symbol, startTime, endTime] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(row => ({
      symbol: String(row[0]),
      fundingTime: num(row[1]),
      fundingRate: num(row[2]),
      markPrice: row[3] !== null ? num(row[3]) : null,
      rateType: String(row[4] || 'Normal')
    }));
  }
};

export const backtestResultsDao = {
  async insert(row: BacktestResultRow): Promise<void> {
    const db = await getDb();
    await runWithRetry(() => {
      db.run(
        `INSERT OR REPLACE INTO backtest_results (
          id, symbol, strategy_id, start_time, end_time, total_trades,
          win_rate, profit_factor, max_drawdown, net_profit, config, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.symbol, row.strategyId, row.startTime, row.endTime,
          row.totalTrades, row.winRate, row.profitFactor, row.maxDrawdown,
          row.netProfit, row.config, row.createdAt
        ] as SqlJsStatementValues
      );
    });
    scheduleDbSave();
  },

  async getLatest(symbol: string, strategyId: string): Promise<BacktestResultRow | null> {
    const db = await getDb();
    const res = db.exec(
      `SELECT id, symbol, strategy_id, start_time, end_time, total_trades,
              win_rate, profit_factor, max_drawdown, net_profit, config, created_at
       FROM backtest_results
       WHERE symbol = ? AND strategy_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [symbol, strategyId] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values.length) return null;
    const row = res[0].values[0];
    return {
      id: String(row[0]),
      symbol: String(row[1]),
      strategyId: String(row[2]),
      startTime: num(row[3]),
      endTime: num(row[4]),
      totalTrades: num(row[5]),
      winRate: num(row[6]),
      profitFactor: numOrNull(row[7]),
      maxDrawdown: num(row[8]),
      netProfit: num(row[9]),
      config: String(row[10] ?? '{}'),
      createdAt: num(row[11])
    };
  },

  async listRecent(limit: number = 30, symbol?: string): Promise<BacktestResultRow[]> {
    const db = await getDb();
    const sql = symbol
      ? `SELECT id, symbol, strategy_id, start_time, end_time, total_trades,
                win_rate, profit_factor, max_drawdown, net_profit, config, created_at
         FROM backtest_results
         WHERE symbol = ?
         ORDER BY created_at DESC LIMIT ?`
      : `SELECT id, symbol, strategy_id, start_time, end_time, total_trades,
                win_rate, profit_factor, max_drawdown, net_profit, config, created_at
         FROM backtest_results
         ORDER BY created_at DESC LIMIT ?`;
    const params = symbol ? [symbol, limit] : [limit];
    const res = db.exec(sql, params as SqlJsStatementValues);
    if (!res.length || !res[0].values.length) return [];
    return res[0].values.map(row => ({
      id: String(row[0]),
      symbol: String(row[1]),
      strategyId: String(row[2]),
      startTime: num(row[3]),
      endTime: num(row[4]),
      totalTrades: num(row[5]),
      winRate: num(row[6]),
      profitFactor: numOrNull(row[7]),
      maxDrawdown: num(row[8]),
      netProfit: num(row[9]),
      config: String(row[10] ?? '{}'),
      createdAt: num(row[11])
    }));
  }
};

export interface BacktestScheduleRow {
  id: string;
  enabled: boolean;
  timeOfDay: string;
  timezone: string;
  symbol: string;
  days: number;
  profile: string;
  lastRunAt: number | null;
  lastRunStatus: string | null;
  lastResultId: string | null;
  createdAt: number;
  updatedAt: number;
}

export const backtestScheduleDao = {
  async getSchedule(id: string = 'daily-default'): Promise<BacktestScheduleRow | null> {
    const db = await getDb();
    const res = db.exec(
      `SELECT id, enabled, time_of_day, timezone, symbol, days, profile,
              last_run_at, last_run_status, last_result_id, created_at, updated_at
       FROM backtest_schedules
       WHERE id = ? LIMIT 1`,
      [id] as SqlJsStatementValues
    );
    if (!res.length || !res[0].values.length) return null;
    const row = res[0].values[0];
    return {
      id: String(row[0]),
      enabled: Boolean(row[1]),
      timeOfDay: String(row[2]),
      timezone: String(row[3]),
      symbol: String(row[4]),
      days: num(row[5]),
      profile: String(row[6]),
      lastRunAt: row[7] !== null ? num(row[7]) : null,
      lastRunStatus: row[8] !== null ? String(row[8]) : null,
      lastResultId: row[9] !== null ? String(row[9]) : null,
      createdAt: num(row[10]),
      updatedAt: num(row[11])
    };
  },

  async saveSchedule(schedule: Partial<BacktestScheduleRow> & { id?: string }): Promise<BacktestScheduleRow> {
    const db = await getDb();
    const id = schedule.id || 'daily-default';
    const existing = await this.getSchedule(id);
    const now = Date.now();
    const merged: BacktestScheduleRow = {
      id,
      enabled: schedule.enabled !== undefined ? schedule.enabled : (existing?.enabled ?? true),
      timeOfDay: schedule.timeOfDay || existing?.timeOfDay || '00:00',
      timezone: schedule.timezone || existing?.timezone || 'UTC',
      symbol: schedule.symbol || existing?.symbol || 'BTCUSDT',
      days: schedule.days !== undefined ? schedule.days : (existing?.days ?? 30),
      profile: schedule.profile || existing?.profile || 'daytrade',
      lastRunAt: schedule.lastRunAt !== undefined ? schedule.lastRunAt : (existing?.lastRunAt ?? null),
      lastRunStatus: schedule.lastRunStatus !== undefined ? schedule.lastRunStatus : (existing?.lastRunStatus ?? null),
      lastResultId: schedule.lastResultId !== undefined ? schedule.lastResultId : (existing?.lastResultId ?? null),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await runWithRetry(() => {
      db.run(
        `INSERT OR REPLACE INTO backtest_schedules (
          id, enabled, time_of_day, timezone, symbol, days, profile,
          last_run_at, last_run_status, last_result_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          merged.id,
          merged.enabled ? 1 : 0,
          merged.timeOfDay,
          merged.timezone,
          merged.symbol,
          merged.days,
          merged.profile,
          merged.lastRunAt,
          merged.lastRunStatus,
          merged.lastResultId,
          merged.createdAt,
          merged.updatedAt
        ] as SqlJsStatementValues
      );
    });
    scheduleDbSave();
    return merged;
  },

  async updateLastRun(id: string, status: string, resultId?: string): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    await runWithRetry(() => {
      db.run(
        `UPDATE backtest_schedules
         SET last_run_at = ?, last_run_status = ?, last_result_id = ?, updated_at = ?
         WHERE id = ?`,
        [now, status, resultId || null, now, id] as SqlJsStatementValues
      );
    });
    scheduleDbSave();
  }
};


