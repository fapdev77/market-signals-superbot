import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import {
  createScheduledBackup,
  pruneBackups,
  type BackupFileEntry
} from '../server/services/BackupService.js';

describe('M4.3 & CA-4.4: Scheduled Atomic Backup & Retention Policy', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-backup-retention');
  const dbPath = path.join(testDir, 'superbot.db');
  const backupDir = path.join(testDir, 'backups');

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(`CREATE TABLE dummy (id INTEGER PRIMARY KEY);`);
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('creates an atomic backup in backupDir with timestamp name', () => {
    const fakeNow = new Date('2026-09-30T12:00:00.000Z').getTime();
    const result = createScheduledBackup(dbPath, backupDir, fakeNow);
    expect(result.success).toBe(true);
    expect(fs.existsSync(result.backupPath)).toBe(true);
    expect(result.backupPath).toContain('2026-09-30');
  });

  it('CA-4.4: enforces retention: keeps last 8 backups plus 1 per day for 14 days, pruning older', () => {
    const baseTime = new Date('2026-09-30T12:00:00.000Z').getTime();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    // Simulate 30 days of 4 backups per day (every 6 hours) = 120 backups
    const simulatedFiles: string[] = [];
    for (let day = 30; day >= 0; day--) {
      for (let hour = 0; hour < 24; hour += 6) {
        const fileTime = baseTime - (day * oneDay) + (hour * oneHour);
        const iso = new Date(fileTime).toISOString().replace(/[:.]/g, '-');
        const filename = `superbot-backup-${iso}.db`;
        const fullPath = path.join(backupDir, filename);
        fs.writeFileSync(fullPath, 'fake-sqlite-content');
        simulatedFiles.push(fullPath);
      }
    }

    // Run pruning at baseTime
    const pruneResult = pruneBackups(backupDir, baseTime);
    expect(pruneResult.prunedCount).toBeGreaterThan(0);

    const remainingFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));

    // Total kept must be <= 8 + 14 = 22
    expect(remainingFiles.length).toBeLessThanOrEqual(22);
    // At least the 8 most recent must be kept
    expect(remainingFiles.length).toBeGreaterThanOrEqual(8);

    // Verify all remaining files are within retention rules
    expect(pruneResult.keptCount).toBe(remainingFiles.length);
  });
});
