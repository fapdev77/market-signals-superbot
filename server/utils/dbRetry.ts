/**
 * R-16 — Tratamento explícito de SQLITE_BUSY.
 *
 * O aviso de SQLITE_BUSY observado no stderr da suíte de testes era engolido
 * silenciosamente e nenhuma operação era reexecutada. Toda operação de banco
 * pode agora ser executada através de `runWithRetry`, que:
 *  - detecta busy (código SQLITE_BUSY ou mensagens "database is locked"/"busy");
 *  - reexecuta com backoff exponencial curto (default: 20ms, 40ms, 80ms);
 *  - repassa imediatamente qualquer erro não-busy.
 */

const BUSY_ERROR_CODES = new Set(['SQLITE_BUSY', 'SQLITE_LOCKED']);

/** Detects whether an unknown error represents a SQLite busy/locked condition. */
export function isBusyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && BUSY_ERROR_CODES.has(code)) return true;

  const message =
    (err as { message?: unknown }).message !== undefined
      ? String((err as { message: unknown }).message)
      : String(err);
  return /sqlite_(?:busy|locked)|database is locked|database table is locked/i.test(message);
}

export interface RetryOptions {
  /** Total attempts (first call + retries). Default 3. */
  maxAttempts?: number;
  /** Backoff base in ms (doubles each retry). Default 20. */
  baseDelayMs?: number;
  /** Maximum backoff between attempts in ms. Default 200. */
  maxDelayMs?: number;
  /** Internal test hook: replaces the sleep (defaults to a real timer). */
  sleepFn?: (ms: number) => Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs `operation` retrying while the error is a SQLite busy/locked condition.
 * Non-busy errors are rethrown immediately without consuming attempts.
 */
export async function runWithRetry<T>(
  operation: () => Promise<T> | T,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 20);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 200);
  const sleepFn = options.sleepFn ?? sleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const busy = isBusyError(err);
      const canRetry = attempt < maxAttempts && busy;
      if (canRetry) {
        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
        await sleepFn(delay);
        continue;
      }
      throw err;
    }
  }

  // Unreachable (the loop always returns or throws), kept for exhaustiveness.
  throw lastError;
}
