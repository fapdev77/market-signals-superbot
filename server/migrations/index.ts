import type { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

/**
 * R-3 — Migrações versionadas.
 *
 * Substitui o padrão anterior `try { ALTER TABLE ... } catch {}` executado a
 * cada boot. Cada migração:
 *  - roda **uma única vez**, guardada por `PRAGMA user_version`;
 *  - é registrada na tabela `schema_migrations` (version, id, applied_at);
 *  - é idempotente na prática (pragma/IF NOT EXISTS), mas nunca reexecuta.
 *
 * Convenções:
 *  - migrations são **apenas aditivas** (ADD COLUMN, CREATE TABLE, backfill);
 *  - o purge de `HIST-*` é uma migração one-time (decisão 3: sem backup).
 */

export const MIGRATION_LOG_TABLE = 'schema_migrations';

export interface Migration {
  version: number;
  /** Stable identifier used in the audit table; never rename after shipping. */
  id: string;
  /** Human-readable description (pt-BR), also written to the audit table. */
  description: string;
  up: (db: Database) => void;
}

function exec(db: Database, statement: string): void {
  db.run(statement);
}

function tableExists(db: Database, tableName: string): boolean {
  const res = db.exec(
    `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`
  );
  return res.length > 0 && res[0].values.length > 0 && Number(res[0].values[0][0]) > 0;
}

function columnExists(db: Database, tableName: string, columnName: string): boolean {
  const res = db.exec(`PRAGMA table_info(${tableName})`);
  if (!res.length || !res[0].values) return false;
  return res[0].values.some(row => String(row[1]) === columnName);
}

/** Adds a column only when it is missing (safe on legacy partial layouts). */
function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  ddl: string
): void {
  if (tableExists(db, table) && !columnExists(db, table, column)) {
    exec(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
  }
}

/** One-time purge of fabricated HIST-* signals (Phase 1 decision 3: no backup). */
export function purgeHistSignals(db: Database): number {
  if (!tableExists(db, 'trade_signals')) return 0;
  const before = db.exec(`SELECT count(*) FROM trade_signals WHERE id LIKE 'HIST-%'`);
  const count = before.length && before[0].values.length ? Number(before[0].values[0][0]) : 0;
  if (count > 0) {
    exec(db, `DELETE FROM trade_signals WHERE id LIKE 'HIST-%';`);
  }
  return count;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    id: '001-add-trade-signal-lifecycle-columns',
    description: 'Adiciona colunas de ciclo de vida (TTL, validação, breakeven) a trade_signals.',
    up: db => {
      addColumnIfMissing(db, 'trade_signals', 'expires_at', 'INTEGER');
      addColumnIfMissing(db, 'trade_signals', 'ttl_minutes', 'INTEGER');
      addColumnIfMissing(db, 'trade_signals', 'expiration_reason', 'TEXT');
      addColumnIfMissing(db, 'trade_signals', 'is_breakeven_active', 'INTEGER');
    }
  },
  {
    version: 2,
    id: '002-purge-hist-signals',
    description:
      "Remove sinais fabricados HIST-* de trade_signals (one-time, sem backup — decisão aprovada na Fase 1).",
    up: db => {
      const removed = purgeHistSignals(db);
      if (removed > 0) {
        console.log(`🧹 [MIGRATION 002] ${removed} sinais fabricados HIST-* removidos (sem backup, conforme decisão 3).`);
      }
    }
  },
  {
    version: 3,
    id: '003-create-historical-klines',
    description: 'Cria a tabela historical_klines (antes vivia só no banco separado do backtest).',
    up: db => {
      exec(db, `
        CREATE TABLE IF NOT EXISTS historical_klines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          interval TEXT NOT NULL,
          open_time INTEGER NOT NULL,
          close_time INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL NOT NULL,
          quote_asset_volume REAL NOT NULL,
          trades INTEGER NOT NULL,
          taker_buy_base_volume REAL NOT NULL,
          taker_buy_quote_volume REAL NOT NULL
        );
      `);
      exec(
        db,
        `CREATE UNIQUE INDEX IF NOT EXISTS symbol_interval_open_time_unique
         ON historical_klines (symbol, interval, open_time);`
      );
    }
  },
  {
    version: 4,
    id: '004-create-backtest-results',
    description: 'Cria a tabela backtest_results no banco unificado.',
    up: db => {
      exec(db, `
        CREATE TABLE IF NOT EXISTS backtest_results (
          id TEXT PRIMARY KEY,
          symbol TEXT NOT NULL,
          strategy_id TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NOT NULL,
          total_trades INTEGER NOT NULL,
          win_rate REAL NOT NULL,
          profit_factor REAL NOT NULL,
          max_drawdown REAL NOT NULL,
          net_profit REAL NOT NULL,
          config TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    }
  },
  {
    version: 5,
    id: '005-import-legacy-backtest-db',
    description:
      'R-14: marca a importação do antigo data/backtest.db (drizzle/libsql) para o banco unificado.',
    // The actual data import happens synchronously in getDb() (it needs the
    // already-initialised sql.js WASM instance); this migration is the one-time
    // audit marker so the import never runs twice.
    up: () => {
      /* import performed by db.ts pre-migration step */
    }
  },
  {
    version: 6,
    id: '006-add-origin-columns',
    description:
      'R-2: adiciona origin (LIVE/DEMO) a trade_signals e historical_klines; registros existentes viram LIVE.',
    up: db => {
      // Registros anteriores à migração não têm proveniência verificável; a decisão registrada é
      // tratá-los como LIVE (dado de mercado importado) em vez de inventar um 'DEMO' retroativo.
      addColumnIfMissing(db, 'trade_signals', 'origin', "TEXT NOT NULL DEFAULT 'LIVE'");
      addColumnIfMissing(db, 'historical_klines', 'origin', "TEXT NOT NULL DEFAULT 'LIVE'");
    }
  }
];

/** Legacy per-table dump used by the one-time backtest.db import in db.ts. */
export const LEGACY_IMPORT_TABLES = {
  historical_klines: {
    columns: 'symbol, interval, open_time, close_time, open, high, low, close, volume, quote_asset_volume, trades, taker_buy_base_volume, taker_buy_quote_volume',
    placeholders: '?'.repeat(13).split('').join(', ')
  },
  backtest_results: {
    columns: 'id, symbol, strategy_id, start_time, end_time, total_trades, win_rate, profit_factor, max_drawdown, net_profit, config, created_at',
    placeholders: '?'.repeat(12).split('').join(', ')
  }
} as const;

export function readSchemaVersion(db: Database): number {
  const res = db.exec('PRAGMA user_version;');
  if (!res.length || !res[0].values.length) return 0;
  return Number(res[0].values[0][0]) || 0;
}

function writeSchemaVersion(db: Database, version: number): void {
  db.run(`PRAGMA user_version = ${Number(version)};`);
}

function ensureLogTable(db: Database): void {
  exec(db, `
    CREATE TABLE IF NOT EXISTS ${MIGRATION_LOG_TABLE} (
      version INTEGER PRIMARY KEY,
      id TEXT NOT NULL,
      description TEXT,
      applied_at INTEGER NOT NULL
    );
  `);
}

function appliedVersions(db: Database): Set<number> {
  if (!tableExists(db, MIGRATION_LOG_TABLE)) return new Set();
  const res = db.exec(`SELECT version FROM ${MIGRATION_LOG_TABLE}`);
  if (!res.length || !res[0].values) return new Set();
  return new Set(res[0].values.map(row => Number(row[0])));
}

/**
 * Applies every pending migration in order and returns the list of versions
 * applied by THIS call. Safe to call on every boot: no-op when up to date.
 */
export function applyMigrations(db: Database): number[] {
  ensureLogTable(db);

  const current = readSchemaVersion(db);
  const recorded = appliedVersions(db);
  const done: number[] = [];

  for (const migration of MIGRATIONS) {
    const alreadyByPragma = migration.version <= current;
    const alreadyByLog = recorded.has(migration.version);
    if (alreadyByPragma || alreadyByLog) continue;

    migration.up(db);
    db.run(
      `INSERT INTO ${MIGRATION_LOG_TABLE} (version, id, description, applied_at) VALUES (?, ?, ?, ?)`,
      [migration.version, migration.id, migration.description, Date.now()]
    );
    writeSchemaVersion(db, migration.version);
    done.push(migration.version);
  }

  return done;
}
