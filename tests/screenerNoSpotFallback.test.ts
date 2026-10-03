/**
 * 6.4.3 / CA-4.2 — Sem fallback spot: com os endpoints `fapi` indisponíveis,
 * o screener retorna lista vazia, marca o feed como degradado
 * (`dataUnavailable`) e NENHUMA requisição a `/api/v3/` é feita.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { buildScreenerCandidates, type ScreenerFetchDeps } from '../server/services/screenerScoring.js';

function makeDeps(overrides: Partial<ScreenerFetchDeps> = {}): ScreenerFetchDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    fetchTickers: async (url: string) => {
      calls.push(url);
      throw new Error('fapi indisponível (simulado)');
    },
    fetchExchangeInfo: async () => {
      calls.push('exchangeInfo');
      throw new Error('exchangeInfo indisponível (simulado)');
    },
    ...overrides,
    calls
  } as any;
}

describe('6.4.3 / CA-4.2 — screener sem fallback spot', () => {
  beforeEach(() => {
    delete process.env.ALLOW_SYNTHETIC_DATA;
  });

  it('fapi fora ⇒ lista vazia, feed degradado, nenhuma chamada a /api/v3/', async () => {
    const deps = makeDeps();

    const result = await buildScreenerCandidates(deps);

    expect(result.tickers).toEqual([]);
    expect(result.dataUnavailable).toBe(true);
    expect(result.degradedFeeds.length).toBeGreaterThan(0);
    // Nenhuma URL spot foi tocada.
    expect(deps.calls.some(c => c.includes('/api/v3/'))).toBe(false);
  });

  it('mesmo com ALLOW_SYNTHETIC_DATA, sem fetch do screener não há universo fabricado', async () => {
    process.env.ALLOW_SYNTHETIC_DATA = 'true';
    const deps = makeDeps();

    const result = await buildScreenerCandidates(deps);

    expect(result.tickers).toEqual([]);
    expect(result.dataUnavailable).toBe(true);
  });

  it('fapi ok: tickers do fapi, sem degradação', async () => {
    const deps = makeDeps({
      fetchTickers: async (url: string) => {
        if (url.includes('/fapi/')) {
          return [
            { symbol: 'BTCUSDT', lastPrice: '50000', priceChangePercent: '1.0', volume: '10', quoteVolume: '500000000', highPrice: '51000', lowPrice: '49000' }
          ];
        }
        throw new Error('endpoint inesperado: ' + url);
      },
      fetchExchangeInfo: async () => ({
        symbols: [{ symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' }]
      })
    });

    const result = await buildScreenerCandidates(deps);

    expect(result.dataUnavailable).toBe(false);
    expect(result.tickers.length).toBe(1);
    expect(result.universe.size).toBe(1);
  });
});
