/**
 * BackupService (M4.3 / R-26)
 *
 * Implements:
 * - PRAGMA quick_check integrity verification on database boot
 * - Automatic restore from latest valid backup if corrupted
 * - Refusal to boot if corrupted and no valid backup exists (CA-4.3)
 * - Atomic backup creation
 * - Retention policy: last 8 backups + 1 per day for 14 days (CA-4.4)
 */

import fs from 'fs';
import { getErrorMessage } from '../utils/errors.js';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { renameWithRetry } from '../utils/fsRename.js';

export interface IntegrityCheckResult {
  healthy: boolean;
  details?: string;
}

export interface RestoreResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

export interface BackupFileEntry {
  filename: string;
  fullPath: string;
  timestamp: number;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');
let SQLInstance: any = null;

export async function ensureSqlInstance(): Promise<any> {
  if (!SQLInstance) {
    try {
      SQLInstance = await initSqlJs({
        locateFile: file => path.join(wasmPath, file)
      });
    } catch (err) {
      console.warn('Could not initialize sql.js wasm:', err);
    }
  }
  return SQLInstance;
}

export function setSqlInstanceForTests(instance: any): void {
  SQLInstance = instance;
}

/**
 * Checks database integrity using PRAGMA quick_check.
 */
export function checkDatabaseIntegrity(dbPath: string, sqlEngine?: any): IntegrityCheckResult {
  if (!fs.existsSync(dbPath)) {
    return { healthy: true, details: 'File does not exist yet (clean slate)' };
  }

  try {
    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length === 0) {
      return { healthy: false, details: 'Database file is empty (0 bytes)' };
    }

    // Direct header sanity check for SQLite ("SQLite format 3\0")
    if (fileBuffer.length < 16 || fileBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
      return { healthy: false, details: 'Invalid SQLite header' };
    }

    const engine = sqlEngine || SQLInstance;
    if (!engine) {
      // If SQLInstance was not initialized yet, verify SQLite header length and magic bytes
      return { healthy: true, details: 'Header valid (quick_check deferred)' };
    }

    const tempDb = new engine.Database(fileBuffer);
    const result = tempDb.exec('PRAGMA quick_check;');
    tempDb.close();

    if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
      const status = String(result[0].values[0][0]);
      if (status.toLowerCase() === 'ok') {
        return { healthy: true, details: 'ok' };
      }
      return { healthy: false, details: status };
    }

    return { healthy: false, details: 'PRAGMA quick_check returned no result' };
  } catch (err) {
    return { healthy: false, details: getErrorMessage(err) };
  }
}

/**
 * Lists all backup files in backupDir sorted from newest to oldest.
 */
export function listBackupFiles(backupDir: string): BackupFileEntry[] {
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
  const entries: BackupFileEntry[] = [];

  for (const filename of files) {
    const fullPath = path.join(backupDir, filename);
    let timestamp = 0;

    // Parse superbot-backup-YYYY-MM-DDTHH-mm-ss-sssZ.db
    const match = filename.match(/superbot-backup-(.+)\.db$/);
    if (match) {
      const rawDate = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
      const parsed = Date.parse(rawDate);
      if (!isNaN(parsed)) {
        timestamp = parsed;
      }
    }

    if (timestamp === 0) {
      try {
        timestamp = fs.statSync(fullPath).mtimeMs;
      } catch {
        timestamp = 0;
      }
    }

    entries.push({ filename, fullPath, timestamp });
  }

  // Sort descending (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

/**
 * Restores the most recent valid backup into dbPath.
 */
export function restoreLatestValidBackup(dbPath: string, backupDir: string): RestoreResult {
  const backups = listBackupFiles(backupDir);

  for (const backup of backups) {
    const integrity = checkDatabaseIntegrity(backup.fullPath);
    if (integrity.healthy) {
      try {
        const tempPath = `${dbPath}.restore-tmp`;
        fs.copyFileSync(backup.fullPath, tempPath);
        // Rename over the corrupt file can hit a transient EPERM/EBUSY on Windows when a
        // scanner holds the handle. Retrying matters more here than on the save path: a
        // restore that gives up leaves the database corrupt, and the boot sequence then
        // refuses to start instead of recovering from a backup that is sitting right there.
        renameWithRetry(tempPath, dbPath);
        console.warn(`♻️ [DB RECOVERY] Banco corrompido restaurado com sucesso a partir de: ${backup.filename}`);
        return { success: true, backupPath: backup.fullPath };
      } catch (err) {
        console.error(`Falha ao copiar backup ${backup.filename}:`, err);
      }
    } else {
      console.warn(`⚠️ Backup ${backup.filename} também está corrompido, tentando anterior...`);
    }
  }

  return {
    success: false,
    error: 'Nenhum backup válido encontrado no diretório de backups.'
  };
}

/**
 * Verifies integrity of the DB file on boot. If corrupted, restores from backup or throws.
 */
export function initOrRestoreDatabase(dbPath: string, backupDir: string): { restored: boolean; backupUsed?: string } {
  if (!fs.existsSync(dbPath)) {
    return { restored: false };
  }

  const check = checkDatabaseIntegrity(dbPath);
  if (check.healthy) {
    return { restored: false };
  }

  console.error(`❌ [DB CORRUPTION DETECTED] Banco de dados corrompido (${check.details}). Tentando restauração...`);
  const restore = restoreLatestValidBackup(dbPath, backupDir);

  if (!restore.success) {
    throw new Error(
      `❌ [FATAL] Banco de dados corrompido e nenhum backup válido disponível para restauração no diretório: ${backupDir}. ` +
      `Intervenção do operador necessária.`
    );
  }

  return { restored: true, backupUsed: restore.backupPath };
}

/**
 * Creates an atomic backup of the database file.
 */
export function createScheduledBackup(
  dbPath: string,
  backupDir: string,
  now: number = Date.now()
): { success: boolean; backupPath: string } {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Arquivo de banco ${dbPath} não existe.`);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const iso = new Date(now).toISOString().replace(/[:.]/g, '-');
  const filename = `superbot-backup-${iso}.db`;
  const finalPath = path.join(backupDir, filename);
  const tempPath = `${finalPath}.tmp`;

  fs.copyFileSync(dbPath, tempPath);
  fs.renameSync(tempPath, finalPath);

  // Apply retention pruning
  pruneBackups(backupDir, now);

  return { success: true, backupPath: finalPath };
}

/**
 * Enforces backup retention policy (M4.3 & CA-4.4):
 * - Keeps the most recent 8 backups unconditionally.
 * - For backups older than the 8th: keeps 1 per calendar day (UTC) up to 14 days ago.
 * - Prunes all backups older than 14 days or duplicate daily backups.
 */
export function pruneBackups(
  backupDir: string,
  now: number = Date.now()
): { prunedCount: number; keptCount: number } {
  const backups = listBackupFiles(backupDir);
  const cutoffTime = now - FOURTEEN_DAYS_MS;

  const keptPaths = new Set<string>();
  const seenDays = new Set<string>();

  backups.forEach((b, index) => {
    // 1. Unconditionally keep the most recent 8
    if (index < 8) {
      keptPaths.add(b.fullPath);
      const dayKey = new Date(b.timestamp).toISOString().slice(0, 10);
      seenDays.add(dayKey);
      return;
    }

    // 2. Beyond the 8th, reject if older than 14 days
    if (b.timestamp < cutoffTime) {
      return; // will be pruned
    }

    // 3. Keep 1 per day for up to 14 days
    const dayKey = new Date(b.timestamp).toISOString().slice(0, 10);
    if (!seenDays.has(dayKey)) {
      seenDays.add(dayKey);
      keptPaths.add(b.fullPath);
    }
  });

  let prunedCount = 0;
  for (const b of backups) {
    if (!keptPaths.has(b.fullPath)) {
      try {
        fs.unlinkSync(b.fullPath);
        prunedCount++;
      } catch (err) {
        console.warn(`Falha ao podar backup ${b.filename}:`, err);
      }
    }
  }

  return {
    prunedCount,
    keptCount: keptPaths.size
  };
}
