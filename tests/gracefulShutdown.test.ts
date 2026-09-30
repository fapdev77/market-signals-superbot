import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import {
  setDbForTesting,
  setCustomDbPath,
  saveDbToDisk,
  scheduleDbSave,
  flushDbSave,
  isDbSavePending
} from '../server/db.js';

describe('M4.9: Graceful Shutdown Flushes Database State', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-shutdown');
  const dbPath = path.join(testDir, 'shutdown.db');
  let db: Database;

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(`CREATE TABLE shutdown_test (id INTEGER PRIMARY KEY, val TEXT);`);
    setDbForTesting(db);
    setCustomDbPath(dbPath);
  });

  afterEach(() => {
    setCustomDbPath(null);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('flushes pending coalesced disk write immediately on flushDbSave during SIGTERM', () => {
    // 1. Insert data and schedule debounced save
    db.run(`INSERT INTO shutdown_test (val) VALUES ('pending-in-memory');`);
    scheduleDbSave();
    expect(isDbSavePending()).toBe(true);

    // 2. Perform flushDbSave (as executed in flushDbAndExit handler)
    flushDbSave();
    expect(isDbSavePending()).toBe(false);

    // 3. Verify the file exists and contains the inserted value
    expect(fs.existsSync(dbPath)).toBe(true);
    const SQL = (db as any).constructor;
    const fileBuffer = fs.readFileSync(dbPath);
    const diskDb = new SQL(fileBuffer);
    const rows = diskDb.exec(`SELECT val FROM shutdown_test WHERE val = 'pending-in-memory';`);
    expect(rows[0].values[0][0]).toBe('pending-in-memory');
  });
});
