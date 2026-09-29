import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import { getDb, scheduleDbSave, flushDbSave, isDbSavePending, saveDbToDisk } from '../server/db.js';

/**
 * The unified database is ~140 MB and sql.js rewrites the whole file on save, so state
 * writes must be coalesced instead of paying a multi-second stall per mutation.
 * These tests pin the contract: scheduled writes are deferred + collapsed, explicit
 * flushes win, and nothing ever throws into the caller.
 */
describe('SQLite save coalescing', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defers the write and collapses a burst of schedules into a single write', async () => {
    await getDb();
    vi.useFakeTimers();
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    scheduleDbSave();
    scheduleDbSave();
    scheduleDbSave();
    expect(isDbSavePending()).toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1499);
    expect(writeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(isDbSavePending()).toBe(false);

    // The timer is one-shot: nothing else fires afterwards.
    vi.advanceTimersByTime(10000);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('flushDbSave writes immediately and cancels the pending write', async () => {
    await getDb();
    vi.useFakeTimers();
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    scheduleDbSave();
    flushDbSave();
    expect(isDbSavePending()).toBe(false);
    expect(writeSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('an explicit saveDbToDisk supersedes a pending coalesced write', async () => {
    await getDb();
    vi.useFakeTimers();
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    scheduleDbSave();
    saveDbToDisk();
    expect(writeSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('scheduling and flushing are safe no-ops for callers', async () => {
    await getDb();
    expect(() => {
      scheduleDbSave();
      flushDbSave();
      saveDbToDisk();
    }).not.toThrow();
  });
});
