import { describe, it, expect } from 'vitest';
import { runWithRetry, isBusyError } from '../server/utils/dbRetry.js';

/**
 * R-16 — SQLITE_BUSY explícito.
 * Antes: o aviso de SQLITE_BUSY aparecia engolido no stderr da suíte e nenhuma
 * operação era reexecutada. Agora toda operação de banco pode passar por
 * runWithRetry, que faz backoff curto e reexecuta em caso de busy.
 */

const makeBusyError = (): Error => {
  const err: any = new Error('database is locked');
  err.code = 'SQLITE_BUSY';
  return err;
};

describe('R-16 runWithRetry (SQLITE_BUSY backoff)', () => {
  it('classifies SQLITE_BUSY (code, message, and nested message) as busy', () => {
    const byCode: any = new Error('x');
    byCode.code = 'SQLITE_BUSY';
    expect(isBusyError(byCode)).toBe(true);

    const byMessage: any = new Error('SQLite is BUSY: database table is locked');
    expect(isBusyError(byMessage)).toBe(true);

    const wrapped: any = new Error('operation failed: SQLITE_BUSY: database is locked');
    expect(isBusyError(wrapped)).toBe(true);

    expect(isBusyError(new Error('syntax error in statement'))).toBe(false);
    expect(isBusyError(null)).toBe(false);
    expect(isBusyError('SQLITE_BUSY' as any)).toBe(false);
  });

  it('returns the value on first attempt when there is no error', async () => {
    let calls = 0;
    const result = await runWithRetry(() => {
      calls++;
      return Promise.resolve('ok');
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries a busy error and succeeds on a later attempt', async () => {
    let calls = 0;
    const result = await runWithRetry(
      () => {
        calls++;
        if (calls < 3) throw makeBusyError();
        return Promise.resolve(42);
      },
      { baseDelayMs: 1 }
    );
    expect(result).toBe(42);
    expect(calls).toBe(3);
  });

  it('retries when the busy error is thrown asynchronously (rejected promise)', async () => {
    let calls = 0;
    await expect(
      runWithRetry(
        () => {
          calls++;
          return calls < 2 ? Promise.reject(makeBusyError()) : Promise.resolve('recovered');
        },
        { baseDelayMs: 1 }
      )
    ).resolves.toBe('recovered');
    expect(calls).toBe(2);
  });

  it('does NOT retry on non-busy errors', async () => {
    let calls = 0;
    await expect(
      runWithRetry(
        () => {
          calls++;
          return Promise.reject(new Error('constraint failed'));
        },
        { baseDelayMs: 1 }
      )
    ).rejects.toThrow('constraint failed');
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts and rethrows the last busy error', async () => {
    let calls = 0;
    await expect(
      runWithRetry(
        () => {
          calls++;
          return Promise.reject(makeBusyError());
        },
        { maxAttempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    expect(calls).toBe(3);
  });

  it('honours a custom maxAttempts of 1 (no retry at all)', async () => {
    let calls = 0;
    await expect(
      runWithRetry(() => {
        calls++;
        return Promise.reject(makeBusyError());
      }, { maxAttempts: 1, baseDelayMs: 1 })
    ).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    expect(calls).toBe(1);
  });
});
