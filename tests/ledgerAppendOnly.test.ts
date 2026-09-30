import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { applyMigrations } from '../server/migrations/index.js';
import { factoryResetDatabase, resetSignalLedger } from '../server/db.js';
import { getDefaultIndicatorWeights } from '../src/constants/strategyPresets.js';

describe('M3.1 & CA-3.1: Append-only Signal Ledger & Events with SQLite Triggers', () => {
  let db: Database;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    applyMigrations(db);
  });

  it('allows inserting signals into signal_ledger and events into signal_events', () => {
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, tradfi_session, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'sig-test-1',
        'BTCUSDT',
        'SCALP',
        'LONG',
        65000,
        64500,
        65750,
        66500,
        85,
        JSON.stringify({ volumeSurge: true }),
        'LIVE',
        'BINANCE',
        'REGULAR',
        1700000000000
      ]
    );

    db.run(
      `INSERT INTO signal_events (
        signal_id, event_type, price, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?)`,
      ['sig-test-1', 'ENTRY', 65000, 1700000000000, JSON.stringify({ r: 0 })]
    );

    const resLedger = db.exec(`SELECT count(*) FROM signal_ledger WHERE id = 'sig-test-1'`);
    expect(resLedger[0].values[0][0]).toBe(1);

    const resEvents = db.exec(`SELECT count(*) FROM signal_events WHERE signal_id = 'sig-test-1'`);
    expect(resEvents[0].values[0][0]).toBe(1);
  });

  it('fails with an error when attempting UPDATE on signal_ledger', () => {
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, created_at
      ) VALUES ('sig-imm-1', 'ETHUSDT', 'DAYTRADE', 'SHORT', 3500, 3600, 3350, 3200, 80, '{}', 'LIVE', 'BINANCE', 1700000000000)`
    );

    expect(() => {
      db.run(`UPDATE signal_ledger SET score = 95 WHERE id = 'sig-imm-1'`);
    }).toThrow(/signal_ledger is append-only/i);
  });

  it('fails with an error when attempting DELETE on signal_ledger', () => {
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, created_at
      ) VALUES ('sig-imm-2', 'ETHUSDT', 'DAYTRADE', 'SHORT', 3500, 3600, 3350, 3200, 80, '{}', 'LIVE', 'BINANCE', 1700000000000)`
    );

    expect(() => {
      db.run(`DELETE FROM signal_ledger WHERE id = 'sig-imm-2'`);
    }).toThrow(/signal_ledger is append-only/i);
  });

  it('fails with an error when attempting UPDATE on signal_events', () => {
    db.run(
      `INSERT INTO signal_events (signal_id, event_type, price, timestamp)
       VALUES ('sig-imm-1', 'PARTIAL', 3350, 1700000050000)`
    );

    expect(() => {
      db.run(`UPDATE signal_events SET price = 3300 WHERE signal_id = 'sig-imm-1'`);
    }).toThrow(/signal_events is append-only/i);
  });

  it('fails with an error when attempting DELETE on signal_events', () => {
    db.run(
      `INSERT INTO signal_events (signal_id, event_type, price, timestamp)
       VALUES ('sig-imm-1', 'PARTIAL', 3350, 1700000050000)`
    );

    expect(() => {
      db.run(`DELETE FROM signal_events WHERE signal_id = 'sig-imm-1'`);
    }).toThrow(/signal_events is append-only/i);
  });

  it('standard factoryReset preserves signal_ledger and signal_events', async () => {
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, created_at
      ) VALUES ('sig-keep-1', 'SOLUSDT', 'SWING', 'LONG', 150, 140, 165, 180, 88, '{}', 'LIVE', 'BINANCE', 1700000000000)`
    );

    db.run(
      `INSERT INTO signal_events (signal_id, event_type, price, timestamp)
       VALUES ('sig-keep-1', 'ENTRY', 150, 1700000000000)`
    );

    // Run standard factory reset passing the database instance
    await factoryResetDatabase(getDefaultIndicatorWeights(), [], db);

    const countLedger = db.exec(`SELECT count(*) FROM signal_ledger`);
    expect(countLedger[0].values[0][0]).toBe(1);

    const countEvents = db.exec(`SELECT count(*) FROM signal_events`);
    expect(countEvents[0].values[0][0]).toBe(1);
  });

  it('dedicated resetSignalLedger clears ledger only when confirm is RESET_LEDGER', async () => {
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, created_at
      ) VALUES ('sig-del-1', 'BNBUSDT', 'SCALP', 'LONG', 600, 590, 615, 630, 80, '{}', 'LIVE', 'BINANCE', 1700000000000)`
    );

    // Fails without exact confirmation
    await expect(
      resetSignalLedger({ confirm: 'WRONG' as any }, db)
    ).rejects.toThrow(/RESET_LEDGER/i);

    // Succeeds with exact confirmation
    const res = await resetSignalLedger({ confirm: 'RESET_LEDGER' }, db);
    expect(res.success).toBe(true);

    const countLedger = db.exec(`SELECT count(*) FROM signal_ledger`);
    expect(countLedger[0].values[0][0]).toBe(0);

    // And ensures triggers are re-enabled afterwards
    db.run(
      `INSERT INTO signal_ledger (
        id, symbol, category, direction, entry_price, stop_loss, take_profit1, take_profit2,
        score, factors, origin, data_source, created_at
      ) VALUES ('sig-del-2', 'BNBUSDT', 'SCALP', 'LONG', 600, 590, 615, 630, 80, '{}', 'LIVE', 'BINANCE', 1700000000000)`
    );

    expect(() => {
      db.run(`DELETE FROM signal_ledger WHERE id = 'sig-del-2'`);
    }).toThrow(/signal_ledger is append-only/i);
  });
});
