import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../src/services/apiClient.js';

describe('Frontend apiClient Service Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getTickers fetches from /api/tickers and returns data', async () => {
    const mockTickers = [{ symbol: 'BTCUSDT', price: 92000 }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTickers
    } as any);

    const data = await apiClient.getTickers();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tickers', expect.any(Object));
    expect(data).toEqual(mockTickers);
  });

  it('getBotStatus calls /api/bot/status', async () => {
    const mockStatus = { isRunning: true, activeCount: 5, totalExecutions: 42, symbols: ['BTCUSDT'], weights: {} };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus
    } as any);

    const data = await apiClient.getBotStatus();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/bot/status', expect.any(Object));
    expect(data.isRunning).toBe(true);
  });

  it('toggleBot posts to /api/bot/toggle', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, isRunning: false })
    } as any);

    const res = await apiClient.toggleBot(false);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/bot/toggle', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ active: false })
    }));
    expect(res.isRunning).toBe(false);
  });

  it('throws ApiError with server error message when request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid parameters provided' })
    } as any);

    await expect(apiClient.getTickers()).rejects.toThrow('Invalid parameters provided');
  });
});
