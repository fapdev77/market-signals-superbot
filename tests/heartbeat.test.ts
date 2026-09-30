import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  startHeartbeat,
  stopHeartbeat,
  isHeartbeatEnabled,
  HEARTBEAT_INTERVAL_MS
} from '../server/services/heartbeat.js';

/**
 * 6.6.4 / CA-6.4 — heartbeat externo opcional (HEARTBEAT_URL).
 * Sem a variável nada é enviado; com a variável, o ping respeita o intervalo
 * (relógio falso via vi.useFakeTimers + spy no fetch global).
 */

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

describe('6.6.4 — heartbeat externo opcional (CA-6.4)', () => {
  beforeEach(() => {
    stopHeartbeat();
    delete process.env.HEARTBEAT_URL;
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopHeartbeat();
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('sem HEARTBEAT_URL nada é enviado', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;
    startHeartbeat();
    expect(isHeartbeatEnabled()).toBe(false);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('com HEARTBEAT_URL faz ping imediato e depois a cada intervalo (relógio falso)', async () => {
    process.env.HEARTBEAT_URL = 'https://heartbeat.example.com/ping/abc';
    const fetchSpy = vi.fn(async () => ({ ok: true } as any));
    globalThis.fetch = fetchSpy as any;

    startHeartbeat();
    expect(isHeartbeatEnabled()).toBe(true);

    // Ping imediato no start
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Intervalo: 2 períodos → mais 2 pings
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls.every((c: any[]) => String(c[0]).includes('heartbeat.example.com'))).toBe(true);
  });

  it('falha de rede no ping não derruba o heartbeat (continua nos próximos intervalos)', async () => {
    process.env.HEARTBEAT_URL = 'https://heartbeat.example.com/ping/abc';
    let calls = 0;
    const fetchSpy = vi.fn(async () => {
      calls++;
      throw new Error('rede fora');
    });
    globalThis.fetch = fetchSpy as any;

    startHeartbeat();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(calls).toBe(2); // falhou no 1º, tentou de novo no 2º
  });
});
