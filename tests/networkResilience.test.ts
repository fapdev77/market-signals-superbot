import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import { safeFetch } from '../server/utils/safeFetch.js';
import { requestJson } from '../server/utils/httpClient.js';
import { addBinanceLog, getBinanceLogs, getWebSocketStatus } from '../server/binanceWebsocket.js';

describe('Network Resilience & Protocol Suite', () => {
  describe('safeFetch native HTTP wrapper', () => {
    it('successfully performs a GET request and parses JSON body', async () => {
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', price: 92450.5 }));
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}/test-json`;

      try {
        const response = await safeFetch(url);
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const json = await response.json();
        expect(json).toEqual({ status: 'ok', price: 92450.5 });
      } finally {
        server.close();
      }
    });

    it('handles aborted requests via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort(new Error('Manual cancellation'));

      await expect(safeFetch('http://127.0.0.1:9999/aborted', { signal: controller.signal }))
        .rejects.toThrow('Manual cancellation');
    });

    it('rejects on timeout if server does not respond in time', async () => {
      const server = http.createServer((_req, _res) => {
        // Intentionally hang and do not respond
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}/timeout-test`;

      try {
        await expect(safeFetch(url, { timeoutMs: 100 })).rejects.toThrow(/Timeout/);
      } finally {
        server.close();
      }
    });

    it('reports failure when body is invalid JSON', async () => {
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('invalid-non-json-string');
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}/bad-json`;

      try {
        const response = await safeFetch(url);
        expect(response.ok).toBe(true);
        await expect(response.json()).rejects.toThrow(/JSON parse failed/);
      } finally {
        server.close();
      }
    });
  });

  describe('requestJson HTTP client', () => {
    it('returns parsed json with status and headers', async () => {
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Custom-Header': 'SuperBot' });
        res.end(JSON.stringify({ symbol: 'BTCUSDT', rate: 0.0001 }));
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}/api/rate`;

      try {
        const res = await requestJson<{ symbol: string; rate: number }>(url, { timeoutMs: 2000 });
        expect(res.status).toBe(200);
        expect(res.data.symbol).toBe('BTCUSDT');
        expect(res.data.rate).toBe(0.0001);
      } finally {
        server.close();
      }
    });

    it('rejects on non-200 HTTP statuses', async () => {
      const server = http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}/not-found`;

      try {
        await expect(requestJson(url)).rejects.toThrow(/HTTP status 404/);
      } finally {
        server.close();
      }
    });
  });

  describe('Binance WebSocket logging & status tracker', () => {
    it('enforces circular buffer max limit of 100 items for logs', () => {
      for (let i = 0; i < 120; i++) {
        addBinanceLog('INFO', 'WEBSOCKET', `Log packet test #${i}`);
      }
      const logs = getBinanceLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
      expect(logs[0].message).toBe('Log packet test #119');
    });

    it('returns valid initial or current websocket state', () => {
      const status = getWebSocketStatus();
      expect(status).toBeDefined();
      expect(status.url).toContain('binance.com');
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.reconnectCount).toBe('number');
    });
  });
});
