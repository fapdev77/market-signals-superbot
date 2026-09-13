import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createMarketRouter } from '../server/routes/marketRoutes.js';
import { safeFetch } from '../server/utils/safeFetch.js';
import { BotState, TickerData } from '../src/types.js';

describe('Express REST API Endpoints Suite', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  let mockBotState: BotState;
  let mockTickerCache: Record<string, TickerData>;

  beforeEach(async () => {
    mockBotState = {
      isMonitoring: true,
      aiAnalysisEnabled: true,
      activeTickersCount: 2,
      signalsGenerated24h: 12,
      ticksProcessed: 140,
      lastTickTime: Date.now(),
      weights: {
        volumeSurgeWeight: 20,
        openInterestWeight: 20,
        fundingRateWeight: 10,
        cvdImbalanceWeight: 15,
        fibonacciZoneWeight: 15,
        rangePocWeight: 10,
        supportResistanceWeight: 10,
        volumeProfileRange: 20,
        minRiskRewardRatio: 3.0
      },
      aiModels: []
    };

    mockTickerCache = {
      BTCUSDT: {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        name: 'Bitcoin',
        marketType: 'crypto_futures',
        price: 92450,
        priceChangePercent24h: 3.2,
        high24h: 93000,
        low24h: 89000,
        volume24h: 12000,
        quoteVolume24h: 1100000000,
        openInterest: 80000,
        openInterestChange24h: 4.5,
        openInterestChange1h: 1.2,
        fundingRate: 0.0001,
        fundingRateDaily: 0.0003,
        fundingRateAnnualized: 0.1,
        fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
        cvd: 4500000,
        cvdDelta: 600000,
        cvdDeltaPercent: 12,
        cvdDirection: 'BUY',
        takerBuyRatio: 0.61,
        fibonacci: { fib50: 91000, fib618: 90500, fib68: 90200, swingHigh: 93000, swingLow: 89000, inGoldenPocket: true },
        rangeProfile: { vah: 92800, val: 91200, poc: 92100, inValueArea: true },
        keyLevels: { support1: 91200, support2: 89500, resistance1: 92800, resistance2: 93500, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
        confluenceScore: 84,
        signalType: 'LONG',
        signalReason: 'CVD + Golden Pocket',
        confluenceFactors: ['CVD Positive'],
        updatedAt: Date.now()
      }
    };

    app = express();
    app.use(express.json());
    app.use('/api', createMarketRouter(() => mockBotState, () => mockTickerCache));

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  it('GET /api/bot/status returns current bot state and weights', async () => {
    try {
      const res = await safeFetch(`${baseUrl}/api/bot/status`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isMonitoring).toBe(true);
      expect(json.ticksProcessed).toBe(140);
      expect(json.weights.minRiskRewardRatio).toBe(3.0);
    } finally {
      server.close();
    }
  });

  it('POST /api/bot/toggle toggles monitoring state', async () => {
    try {
      const res = await safeFetch(`${baseUrl}/api/bot/toggle`, { method: 'POST' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isMonitoring).toBe(false);
      expect(mockBotState.isMonitoring).toBe(false);
    } finally {
      server.close();
    }
  });

  it('POST /api/bot/toggle-ai toggles AI analysis state', async () => {
    try {
      const res = await safeFetch(`${baseUrl}/api/bot/toggle-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.aiAnalysisEnabled).toBe(false);
      expect(mockBotState.aiAnalysisEnabled).toBe(false);
    } finally {
      server.close();
    }
  });

  it('GET /api/tickers returns cached market tickers', async () => {
    try {
      const res = await safeFetch(`${baseUrl}/api/tickers`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(1);
      expect(json[0].symbol).toBe('BTCUSDT');
      expect(json[0].price).toBe(92450);
    } finally {
      server.close();
    }
  });

  it('GET & POST /api/settings/weights manages dynamic indicator weights', async () => {
    try {
      const postRes = await safeFetch(`${baseUrl}/api/settings/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minRiskRewardRatio: 4.0, volumeSurgeWeight: 30 })
      });
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.weights.minRiskRewardRatio).toBe(4.0);

      const getRes = await safeFetch(`${baseUrl}/api/settings/weights`);
      const getJson = await getRes.json();
      expect(getJson.minRiskRewardRatio).toBe(4.0);
      expect(getJson.volumeSurgeWeight).toBe(30);
    } finally {
      server.close();
    }
  });

  it('GET /api/signals returns list of recent trade signals', async () => {
    try {
      const res = await safeFetch(`${baseUrl}/api/signals`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    } finally {
      server.close();
    }
  });
});
