import { describe, it, expect } from 'vitest';
import { WebSocketServer } from 'ws';
import http from 'http';
import { buildFuturesWsUrl } from '../server/utils/wsUrl.js';

describe('CA-0.1: WebSocket connects using valid /market/ path', () => {
  it('requests path starting with /market/ for ticker and liquidation streams', async () => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });

    let receivedPath = '';

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;

    wss.on('connection', (_ws, req) => {
      receivedPath = req.url || '';
    });

    const marketWsUrl = buildFuturesWsUrl('market', ['!ticker@arr'], {
      baseWsHost: `127.0.0.1:${port}`
    });

    // Replace wss:// with ws:// for local mock server
    const localWsUrl = marketWsUrl.replace('wss://', 'ws://');

    const wsClient = new (await import('ws')).default(localWsUrl);

    await new Promise<void>((resolve, reject) => {
      wsClient.on('open', () => {
        wsClient.close();
        resolve();
      });
      wsClient.on('error', (err) => {
        reject(err);
      });
    });

    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => {
          resolve();
        });
      });
    });

    expect(receivedPath).toMatch(/^\/market\//);
    expect(receivedPath).toBe('/market/stream?streams=!ticker@arr');
  });
});
