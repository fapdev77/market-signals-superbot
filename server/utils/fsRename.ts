import fs from 'fs';

/**
 * Blocking sleep used between rename attempts. `Atomics.wait` parks the thread without
 * burning CPU; the busy-loop fallback exists only if the runtime forbids waiting.
 */
export function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) { /* spin */ }
  }
}

const RENAME_MAX_ATTEMPTS = 4;
/** Transient on Windows: antivirus/indexer holds a handle on the freshly written file. */
const RENAME_RETRYABLE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

/**
 * Renames the temp image onto the live file, retrying the transient Windows failures
 * (EPERM/EACCES/EBUSY) that a scanner or indexer can cause on a just-written file.
 * Non-retryable errors and the last attempt propagate to the caller.
 *
 * Shared by the two paths that swap a file onto a live database image: the periodic
 * save (`db.ts`) and the corruption restore (`BackupService.ts`). Both need this
 * because both rename over a file that was written moments earlier; without the retry
 * a transient lock leaves the caller believing the write never landed.
 */
export function renameWithRetry(tempPath: string, targetPath: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tempPath, targetPath);
      if (attempt > 1) {
        console.warn(`⚠️ [DB] rename bem-sucedido na tentativa ${attempt} (${attempt - 1} EPERM/EBUSY transitório).`);
      }
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (!code || !RENAME_RETRYABLE_CODES.has(code) || attempt >= RENAME_MAX_ATTEMPTS) {
        throw err;
      }
      console.warn(`⚠️ [DB] rename falhou (${code}); nova tentativa ${attempt + 1}/${RENAME_MAX_ATTEMPTS}...`);
      sleepSync(25 * attempt);
    }
  }
}
