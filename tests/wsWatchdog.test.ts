import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WS_SILENCE_MS,
  evaluateWsFeedHealth,
  initBinanceWebSocket,
  getWebSocketStatus,
  stopBinanceWebSocket
} from '../server/binanceWebsocket.js';
import { getFeedHealth } from '../server/services/feedHealth.js';

describe('M0.4 & CA-0.3: WebSocket silence watchdog and health reporting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopBinanceWebSocket();
    vi.useRealTimers();
  });

  it('defines WS_SILENCE_MS as 15000ms', () => {
    expect(WS_SILENCE_MS).toBe(15000);
  });

  it('detects silence if last tick is older than WS_SILENCE_MS and flags as degraded', () => {
    const now = 1000000;
    const lastTickAt = now - 16000; // 16s ago > 15s

    const decision = evaluateWsFeedHealth({
      connected: true,
      lastTickAt,
      now
    });

    expect(decision.isHealthy).toBe(false);
    expect(decision.isDegraded).toBe(true);
    expect(decision.reason).toMatch(/sem mensagens de ticker/i);
    expect(decision.needsReconnect).toBe(true);
  });

  it('marks feed as healthy if tick is recent (< 15s)', () => {
    const now = 1000000;
    const lastTickAt = now - 4000; // 4s ago

    const decision = evaluateWsFeedHealth({
      connected: true,
      lastTickAt,
      now
    });

    expect(decision.isHealthy).toBe(true);
    expect(decision.isDegraded).toBe(false);
    expect(decision.needsReconnect).toBe(false);
  });
});
