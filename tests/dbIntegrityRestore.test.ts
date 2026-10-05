import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import {
  checkDatabaseIntegrity,
  restoreLatestValidBackup,
  initOrRestoreDatabase,
  setSqlInstanceForTests
} from '../server/services/BackupService.js';
import { applyMigrations } from '../server/migrations/index.js';

describe('M4.3 & CA-4.3: Database Integrity Check and Automatic Restore', () => {
  // O diretório de teste carrega o PID do worker, como `tests/setup.ts` já faz
  // para o SQLite. Com um caminho fixo, este arquivo apagava `data/test-integrity`
  // de forma incondicional em cada `beforeEach`/`afterEach`; rodando em paralelo
  // com outra suíte, uma delas podia remover o backup entre a escrita e a leitura
  // neste teste, fazendo-o falhar de forma intermitente sem causa no código.
  const testDir = path.join(process.cwd(), 'data', `test-integrity.${process.pid}`);
  const dbPath = path.join(testDir, 'superbot.db');
  const backupDir = path.join(testDir, 'backups');

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });
    const SQL = await initSqlJs();
    setSqlInstanceForTests(SQL);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('detects healthy database with PRAGMA quick_check', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    applyMigrations(db);
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    const check = checkDatabaseIntegrity(dbPath);
    expect(check.healthy).toBe(true);
  });

  it('detects corrupted database (truncated file / invalid bytes)', () => {
    fs.writeFileSync(dbPath, Buffer.from('corrupted sqlite header and invalid data'));
    const check = checkDatabaseIntegrity(dbPath);
    expect(check.healthy).toBe(false);
  });

  it('CA-4.3: restores corrupted database from the latest valid backup', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    applyMigrations(db);
    db.run(`CREATE TABLE test_table (id INTEGER PRIMARY KEY, msg TEXT);`);
    db.run(`INSERT INTO test_table (msg) VALUES ('valid-backup-data');`);
    const validData = Buffer.from(db.export());

    // Create a valid backup
    const backupFile = path.join(backupDir, 'superbot-backup-2026-09-30T10-00-00.db');
    fs.writeFileSync(backupFile, validData);

    // Corrupt the main db
    fs.writeFileSync(dbPath, Buffer.from('corrupted sqlite file content here'));
    expect(checkDatabaseIntegrity(dbPath).healthy).toBe(false);

    // Call restore
    const restored = restoreLatestValidBackup(dbPath, backupDir);
    expect(restored.success).toBe(true);
    expect(restored.backupPath).toBe(backupFile);

    // Main db should now be healthy and have our table
    const checkAfter = checkDatabaseIntegrity(dbPath);
    expect(checkAfter.healthy).toBe(true);

    const reloadedDb = new SQL.Database(fs.readFileSync(dbPath));
    const rows = reloadedDb.exec("SELECT msg FROM test_table;");
    expect(rows[0].values[0][0]).toBe('valid-backup-data');
  });

  it('CA-4.3: refuses to start and throws clear message when corrupted and no valid backup exists', () => {
    // Corrupt main db
    fs.writeFileSync(dbPath, Buffer.from('corrupted file with no backups'));

    expect(() => {
      initOrRestoreDatabase(dbPath, backupDir);
    }).toThrow(/banco de dados corrompido/i);
  });
});
