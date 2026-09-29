import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import { fetchOpenInterest, fetchLongShortRatio } from '../server/binanceService.js';
import { BinanceRateLimiter } from '../server/utils/binanceRateLimiter.js';
import { HistoricalDataService } from '../server/services/HistoricalDataService.js';

/**
 * R-5 — Rate limiter cobrindo TODAS as chamadas REST da Binance.
 *
 * Antes: openInterest, openInterestHist, os 3 endpoints de long/short e o
 * histórico de klines do sync usavam requestJson direto, fora do controle de
 * peso — podiam queimar o limite e provocar 429/418 (ban) sem que o limiter
 * soubesse. Agora passam por requestJsonLimited, que:
 *  - consulta o cooldown do limiter ANTES de qualquer chamada;
 *  - registra o peso dos headers de resposta;
 *  - dispara backoff em 429/418.
 */

let server: http.Server;
let baseUrl = '';
let requestCount = 0;
let lastSeenUserAgent = '';
let lastSeenWeight = '';
let statusCode = 200;
let body = '{}';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requestCount++;
    lastSeenUserAgent = String(req.headers['user-agent'] || '');
    // The limiter marks its own calls with this header (backoff marker).
    lastSeenWeight = String(req.headers['x-mbx-used-weight-1m'] || '');
    res.writeHead(statusCode, {
      'content-type': 'application/json',
      'x-mbx-used-weight-1m': '100'
    });
    res.end(body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

afterEach(() => {
  statusCode = 200;
  body = '{}';
});

// All binanceService calls accept endpoint bases only via REST_ENDPOINTS / env;
// the fapi bases are fixed in code, so these tests assert limiter behaviour
// indirectly: (a) state changes, (b) 429 triggers backoff, (c) cooldown blocks.
// We exercise the limiter integration through fetchOpenInterest/fetchLongShortRatio
// with unreachable endpoints (no network in sandbox) and through a dedicated
// requestJsonLimited export against the local server.

import { requestJsonLimited } from '../server/utils/httpClient.js';

describe('R-5 requestJsonLimited (limiter-aware HTTP)', () => {
  it('sends the SuperBot user agent and returns parsed JSON', async () => {
    body = JSON.stringify({ openInterest: '123.5' });
    const res = await requestJsonLimited(`${baseUrl}/oi`, { timeoutMs: 2000 });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ openInterest: '123.5' });
    expect(lastSeenUserAgent).toContain('MarketSignalsSuperBot');
  });

  it('records used weight from response headers into the rate limiter', async () => {
    body = '{}';
    requestCount = 0;
    await requestJsonLimited(`${baseUrl}/w`, { timeoutMs: 2000 });
    const state = BinanceRateLimiter.getState();
    expect(state.usedWeight1m).toBeGreaterThanOrEqual(100);
  });

  it('triggers backoff on 429 and blocks the next call while cooling down', async () => {
    statusCode = 429;
    body = '{"code": 429}';
    await expect(requestJsonLimited(`${baseUrl}/rate`, { timeoutMs: 2000 })).rejects.toThrow(/429/);
    expect(BinanceRateLimiter.getState().isThrottled).toBe(true);

    // While the cooldown is active, a new call must NOT reach the server.
    requestCount = 0;
    await expect(
      requestJsonLimited(`${baseUrl}/blocked`, { timeoutMs: 2000 })
    ).rejects.toThrow(/cooldown/i);
    expect(requestCount).toBe(0);
    expect(BinanceRateLimiter.getRemainingCooldownMs()).toBeGreaterThan(0);
  });

  it('triggers backoff on 418 (IP ban warning) as well', async () => {
    BinanceRateLimiter.recordSuccess();
    statusCode = 418;
    body = '{"code": 418}';
    await expect(requestJsonLimited(`${baseUrl}/teapot`, { timeoutMs: 2000 })).rejects.toThrow(/418/);
    expect(BinanceRateLimiter.getState().isThrottled).toBe(true);
    BinanceRateLimiter.recordSuccess();
  });
});

describe('R-5 fetchOpenInterest / fetchLongShortRatio honour the limiter', () => {
  it('fetchOpenInterest fails closed as degraded during limiter cooldown (no fresh-data path)', async () => {
    // Put the limiter into cooldown...
    BinanceRateLimiter.triggerBackoff(429, 5000);
    // ...then the OI fetch must NOT produce a fresh REST reading: it degrades
    // to CACHE (source='CACHE', isDegraded) exactly like an unreachable feed.
    const result = await fetchOpenInterest('BTCUSDT');
    expect(result.source).toBe('CACHE');
    expect(result.isDegraded).toBe(true);
    BinanceRateLimiter.recordSuccess();
  });

  it('fetchLongShortRatio returns null during limiter cooldown (no fabricated data)', async () => {
    BinanceRateLimiter.triggerBackoff(429, 5000);
    const result = await fetchLongShortRatio('BTCUSDT');
    expect(result).toBeNull();
    BinanceRateLimiter.recordSuccess();
  });

  it('HistoricalDataService sync refuses to run while the limiter is in cooldown', async () => {
    BinanceRateLimiter.triggerBackoff(429, 5000);
    await HistoricalDataService.syncSymbol('BTCUSDT', 1);
    const state = HistoricalDataService.getSyncState('BTCUSDT');
    expect(state.status).toBe('ERROR');
    expect(state.error).toMatch(/cooldown/i);
    BinanceRateLimiter.recordSuccess();
  });
});
