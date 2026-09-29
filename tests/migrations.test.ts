import { describe, it, expect } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import {
  MIGRATIONS,
  applyMigrations,
  readSchemaVersion,
  MIGRATION_LOG_TABLE
} from '../server/migrations/index.js';
import { getDb, saveSignal } from '../server/db.js';
import { TradeSignal } from '../src/types.js';

/**
 * R-3 — Migrações versionadas (PRAGMA user_version).
 *
 * Antes: colunas novas eram adicionadas com `try { ALTER TABLE ... } catch {}`
 * a cada boot, e o purge de HIST-* rodava a cada boot sem registro. Agora cada
 * migração roda exatamente uma vez, é registrada em schema_migrations e avança
 * PRAGMA user_version.
 */

async function freshDb(): Promise<Database> {
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(wasmPath, f) });
  return new SQL.Database();
}

describe('R-3 versioned migrations', () => {
  it('exposes an ordered, non-empty migration list', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (let i = 0; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBe(i + 1);
      expect(typeof MIGRATIONS[i].id).toBe('string');
      expect(MIGRATIONS[i].id.length).toBeGreaterThan(3);
      expect(typeof MIGRATIONS[i].up).toBe('function');
    }
  });

  it('applies all migrations to a fresh database and sets user_version', async () => {
    const db = await freshDb();
    try {
      const applied = applyMigrations(db);
      expect(applied.length).toBe(MIGRATIONS.length);
      expect(readSchemaVersion(db)).toBe(MIGRATIONS.length);

      // Recorded exactly once each, in the audit table
      const logRes = db.exec(`SELECT version, id FROM ${MIGRATION_LOG_TABLE} ORDER BY version`);
      expect(logRes[0].values.map(r => Number(r[0]))).toEqual(MIGRATIONS.map(m => m.version));
    } finally {
      db.close();
    }
  });

  it('is idempotent: re-running on an already migrated database applies nothing', async () => {
    const db = await freshDb();
    try {
      applyMigrations(db);
      const secondRun = applyMigrations(db);
      expect(secondRun.length).toBe(0);
      expect(readSchemaVersion(db)).toBe(MIGRATIONS.length);

      // No duplicated rows in the migration log
      const logRes = db.exec(`SELECT count(*) FROM ${MIGRATION_LOG_TABLE}`);
      expect(Number(logRes[0].values[0][0])).toBe(MIGRATIONS.length);
    } finally {
      db.close();
    }
  });

  it('migrates a legacy database that already has some columns (partial state)', async () => {
    const db = await freshDb();
    try {
      // Simulate the legacy layout: baseline tables with a few of the columns already added.
      db.run(`
        CREATE TABLE trade_signals (
          id TEXT PRIMARY KEY,
          symbol TEXT NOT NULL,
          market_type TEXT,
          signal_type TEXT,
          direction TEXT,
          entry_min REAL, entry_max REAL,
          current_price REAL, stop_loss REAL, target1 REAL, target2 REAL,
          risk_reward REAL, confluence_score REAL, confluence_factors TEXT,
          timeframe TEXT, validation_status TEXT, validation_stage TEXT,
          candle_1m_confirmed INTEGER, candle_5m_confirmed INTEGER,
          ai_review TEXT, ai_confidence REAL, created_at INTEGER,
          validated_at INTEGER, rejected_at INTEGER, status TEXT,
          strategy_category TEXT
        );
        CREATE TABLE historical_klines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL, interval TEXT NOT NULL, open_time INTEGER NOT NULL,
          close_time INTEGER NOT NULL, open REAL NOT NULL, high REAL NOT NULL,
          low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL,
          quote_asset_volume REAL NOT NULL, trades INTEGER NOT NULL,
          taker_buy_base_volume REAL NOT NULL, taker_buy_quote_volume REAL NOT NULL
        );
      `);
      // A fabricated HIST-* row that the purge migration must remove.
      db.run(`INSERT INTO trade_signals (id, symbol, status) VALUES ('HIST-FAKE-1', 'BTCUSDT', 'ACTIVE');`);

      const applied = applyMigrations(db);
      expect(applied.length).toBe(MIGRATIONS.length);
      expect(readSchemaVersion(db)).toBe(MIGRATIONS.length);

      // The purge migration removed the fabricated row.
      const histRes = db.exec(`SELECT count(*) FROM trade_signals WHERE id LIKE 'HIST-%'`);
      expect(Number(histRes[0].values[0][0])).toBe(0);
    } finally {
      db.close();
    }
  });

  it('getDb() ships with migrations applied and the schema_migrations log populated', async () => {
    // getDb() is a process-wide singleton over data/superbot.sqlite. When the
    // database was created after R-3, migrations were applied at creation time —
    // the purge is one-time, so later HIST-* inserts are NOT auto-deleted.
    await getDb();
    const db = await getDb();

    const versionRes = db.exec('PRAGMA user_version');
    expect(Number(versionRes[0].values[0][0])).toBe(MIGRATIONS.length);

    const logRes = db.exec(`SELECT count(*) FROM ${MIGRATION_LOG_TABLE}`);
    expect(Number(logRes[0].values[0][0])).toBe(MIGRATIONS.length);

    const histRes = db.exec(`SELECT count(*) FROM trade_signals WHERE id LIKE 'HIST-%'`);
    expect(Number(histRes[0].values[0][0])).toBe(0);
  });

  it('exposes the HIST purge as a registered migration (not a silent boot task)', () => {
    const purge = MIGRATIONS.find(m => m.id.includes('purge-hist-signals'));
    expect(purge).toBeDefined();
  });
});
