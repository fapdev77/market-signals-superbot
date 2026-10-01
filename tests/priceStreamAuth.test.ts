import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * T6.8.1 / CA-8.1 — Stream de preços pelo servidor, autenticado.
 *
 * 1. grep CA-8.1: nenhum `wss://fstream.binance.com` em `src/` — o navegador
 *    não conecta mais direto à Binance; o servidor faz a ponte e os gates
 *    (qualidade de dados, TradFi, kill-switch) valem para o que a UI mostra.
 * 2. O endpoint de stream responde 401 sem token (fail-closed).
 * 3. Com token (Bearer no HEADER — nunca em URL), emite um snapshot inicial
 *    de tickers em formato SSE parseável.
 */
describe('T6.8.1 — Stream de preços pelo servidor + auth (CA-8.1)', () => {
  const TEST_TOKEN = 'test-token-for-price-stream-suite-001';
  const originalEnv = { ...process.env };

  const tickerFixture = {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    name: 'Bitcoin',
    marketType: 'CRYPTO',
    price: 65000,
    priceChangePercent24h: 1.5,
    high24h: 66000,
    low24h: 64000,
    volume24h: 1234.5,
    quoteVolume24h: 80000000
  } as unknown as TickerData; // fixture mínimo: só os campos lidos pelo stream são relevantes

  const buildApp = () =>
    createApp({
      botState: {
        isMonitoring: true,
        activeTickersCount: 1,
        lastTickTime: Date.now(),
        ticksProcessed: 0,
        signalsGenerated24h: 0,
        weights: {} as any,
        aiModels: [],
        aiAnalysisEnabled: false
      } as BotState,
      tickerStateCache: { BTCUSDT: tickerFixture },
      triggerMarketScan: async () => {}
    });

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('CA-8.1: grep não encontra wss://fstream.binance.com em src/', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('wss://fstream.binance.com')) offenders.push(path.relative(process.cwd(), full));
        }
      }
    };
    walk(srcDir);
    expect(offenders, `conexão direta à Binance encontrada em: ${offenders.join(', ')}`).toEqual([]);
  });

  it('stream responde 401 sem token (fail-closed)', async () => {
    const res = await request(buildApp()).get('/api/stream/tickers');
    expect(res.status).toBe(401);
  });

  it('stream responde 401 com token errado', async () => {
    const res = await request(buildApp())
      .get('/api/stream/tickers')
      .set('Authorization', 'Bearer definitely-wrong-token');
    expect(res.status).toBe(401);
  });

  it('com Bearer no header emite snapshot inicial parseável (event: tickers)', async () => {
    // Cap de snapshots: faz a resposta SSE terminar sozinha, determinística para o teste.
    process.env.STREAM_TICKERS_MAX_SNAPSHOTS = '1';
    try {
      const res = await request(buildApp())
        .get('/api/stream/tickers')
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .expect(200)
        .expect('Content-Type', /text\/event-stream/);

      const body = res.text as string;
      // SSE: linhas event:/data:; o snapshot inicial deve conter o ticker do cache.
      expect(body).toContain('event: tickers');
      const dataLine = body.split('\n').find(l => l.startsWith('data:'));
      expect(dataLine).toBeTruthy();
      const payload = JSON.parse(dataLine!.slice('data:'.length).trim());
      const tickers: Array<{ symbol: string; price: number }> = Array.isArray(payload) ? payload : payload.tickers;
      expect(Array.isArray(tickers)).toBe(true);
      const btc = tickers.find(t => t.symbol === 'BTCUSDT');
      expect(btc).toBeTruthy();
      expect(btc!.price).toBe(65000);
    } finally {
      delete process.env.STREAM_TICKERS_MAX_SNAPSHOTS;
    }
  });

  it('token nunca trafega em URL (query string é rejeitada mesmo com token válido)', async () => {
    // Defesa em profundidade: a rota não aceita token via query (?token=...).
    const res = await request(buildApp()).get(`/api/stream/tickers?token=${TEST_TOKEN}`);
    expect(res.status).toBe(401);
  });
});
