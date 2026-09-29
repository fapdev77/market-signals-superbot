import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * Phase 2.5.9: these tests import the REAL application built by `createApp` and used by `server.ts`.
 *
 * Previously the HTTP tests mounted their own minimal Express instance, so the production middleware
 * order, CORS policy, body limit and rate limiters were never exercised by the suite — only by manual
 * smoke testing.
 */
describe('Real application HTTP contract (createApp)', () => {
  const TEST_TOKEN = 'test-token-for-app-http-suite-0001';
  const originalEnv = { ...process.env };

  let app: ReturnType<typeof createApp>;

  const buildApp = () =>
    createApp({
      botState: {
        isMonitoring: false,
        activeTickersCount: 0,
        lastTickTime: Date.now(),
        ticksProcessed: 0,
        signalsGenerated24h: 0,
        weights: {} as any,
        aiModels: [],
        aiAnalysisEnabled: false
      } as BotState,
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });

  beforeAll(() => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    process.env.NODE_ENV = 'test';
    app = buildApp();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Authentication is enforced on the real app', () => {
    it('exposes /health without a token', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('rejects a protected endpoint without a token', async () => {
      const res = await request(app).get('/api/tickers');
      expect(res.status).toBe(401);
    });

    it('rejects a protected endpoint with a wrong token', async () => {
      const res = await request(app).get('/api/tickers').set('Authorization', 'Bearer definitely-not-it');
      expect(res.status).toBe(401);
    });

    it('accepts the configured token', async () => {
      const res = await request(app).get('/api/tickers').set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(res.status).not.toBe(401);
    });

    it('accepts the token via the x-api-token header as well', async () => {
      const res = await request(app).get('/api/tickers').set('x-api-token', TEST_TOKEN);
      expect(res.status).not.toBe(401);
    });
  });

  describe('Auth status endpoint', () => {
    it('never returns the effective token', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(TEST_TOKEN);
      expect(res.body.authenticated).toBe(false);
    });

    it('reports authenticated=true when the right token is presented', async () => {
      const res = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(res.body.authenticated).toBe(true);
    });
  });

  describe('CORS policy', () => {
    it('rejects a non-allowlisted origin in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.example.com';
      const prodApp = buildApp();

      try {
        // A Cloud Run host owned by somebody else used to be accepted by the `.run.app` suffix rule.
        const res = await request(prodApp)
          .get('/health')
          .set('Origin', 'https://someone-elses-service-abc123.run.app');
        // cors() surfaces the rejection through the error handler; no ACAO header is the key signal.
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      } finally {
        process.env.NODE_ENV = 'test';
        delete process.env.ALLOWED_ORIGINS;
      }
    });

    it('allows an explicitly allowlisted origin in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.example.com';
      const prodApp = buildApp();

      try {
        const res = await request(prodApp)
          .get('/health')
          .set('Origin', 'https://app.example.com');
        expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
      } finally {
        process.env.NODE_ENV = 'test';
        delete process.env.ALLOWED_ORIGINS;
      }
    });
  });

  describe('Body payload limit', () => {
    it('rejects a payload larger than 100kb', async () => {
      const huge = 'x'.repeat(200 * 1024);
      const res = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .send({ token: huge });
      expect(res.status).toBe(413);
    });
  });

  it('does not advertise the tech stack via x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
