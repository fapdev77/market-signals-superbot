import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import { getDb, saveDbToDisk, flushDbSave, isDbSavePending } from '../server/db.js';

/**
 * On Windows the atomic `.tmp` → `.sqlite` rename can fail transiently with EPERM/EACCES
 * because an antivirus/indexer still holds a handle on the freshly written 140 MB file.
 * A bounded retry keeps the write from being dropped (which, with the debounced save,
 * would mean the last state never reaches disk).
 */
function makeErr(code: string): NodeJS.ErrnoException {
  const err = new Error(`simulated ${code}`) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe('saveDbToDisk rename retry (Windows EPERM)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retries a transient EPERM and succeeds without throwing', async () => {
    await getDb();
    const real = fs.renameSync;
    let calls = 0;
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(((from: any, to: any) => {
      calls += 1;
      if (calls <= 2) throw makeErr('EPERM');
      return (real as any)(from, to);
    }) as any);

    expect(() => saveDbToDisk()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('retries EBUSY and gives up only after the last attempt, without throwing to callers', async () => {
    await getDb();
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation((() => {
      throw makeErr('EBUSY');
    }) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveDbToDisk()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(4);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not retry a non-transient error', async () => {
    await getDb();
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation((() => {
      throw makeErr('ENOSPC');
    }) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveDbToDisk()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('a coalesced flush still lands the pending image after a transient rename failure', async () => {
    await getDb();
    const real = fs.renameSync;
    let calls = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(((from: any, to: any) => {
      calls += 1;
      if (calls === 1) throw makeErr('EPERM');
      return (real as any)(from, to);
    }) as any);

    flushDbSave();
    expect(calls).toBe(2);
    expect(isDbSavePending()).toBe(false);
  });
});
