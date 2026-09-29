import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { requireAuth, getEffectiveAuthToken } from '../server/middleware/auth.js';
import { validateOutboundAIUrl } from '../server/utils/outboundPolicy.js';
import { canGenerateSignals, canEvaluateActiveTrades } from '../server/services/DataGate.js';
import { TickerData } from '../src/types.js';

describe('Phase 1.1 Hotfix Suite: Security, Auth Fail-Closed & DataGate Enforcement', () => {
  let app: express.Express;
  const validToken = getEffectiveAuthToken();

  beforeAll(() => {
    app = express();
    app.set('trust proxy', 1);

    app.use(cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true
    }));

    app.use(express.json());

    // Public health & auth status routes
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

    app.get('/api/auth/status', (req, res) => {
      const authHeader = req.headers['authorization'];
      let providedToken = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        providedToken = authHeader.slice(7).trim();
      }
      const isValid = Boolean(providedToken && providedToken === validToken);
      res.json({
        authenticated: isValid,
        hasExplicitTokenConfigured: Boolean(process.env.API_AUTH_TOKEN)
      });
    });

    app.post('/api/auth/verify', (req, res) => {
      const { token } = req.body || {};
      const isValid = Boolean(token && token === validToken);
      res.json({ valid: isValid });
    });

    // Protected API area
    app.use('/api', requireAuth);

    app.get('/api/protected/tickers', (req, res) => {
      res.json([{ symbol: 'BTCUSDT', price: 92000 }]);
    });

    app.post('/api/protected/execute', (req, res) => {
      res.json({ success: true });
    });
  });

  describe('1. Fail-Closed Authentication & Token Protection', () => {
    it('MUST reject unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/protected/tickers');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('MUST reject invalid or forged Bearer tokens with 401', async () => {
      const res = await request(app)
        .get('/api/protected/tickers')
        .set('Authorization', 'Bearer invalid-token-xyz-123');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('MUST accept requests with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/protected/tickers')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].symbol).toBe('BTCUSDT');
    });

    it('MUST NOT expose defaultDevToken in /api/auth/status response', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.defaultDevToken).toBeUndefined();
      expect(res.body.authenticated).toBe(false);
    });

    it('MUST correctly verify valid tokens via POST /api/auth/verify', async () => {
      const validRes = await request(app)
        .post('/api/auth/verify')
        .send({ token: validToken });
      expect(validRes.status).toBe(200);
      expect(validRes.body.valid).toBe(true);

      const invalidRes = await request(app)
        .post('/api/auth/verify')
        .send({ token: 'wrong-pass' });
      expect(invalidRes.status).toBe(200);
      expect(invalidRes.body.valid).toBe(false);
    });
  });

  describe('2. Anti-SSRF Outbound Policy & Host Validation', () => {
    it('blocks loopback, RFC 1918 private IPs and link-local cloud metadata', () => {
      expect(validateOutboundAIUrl('http://169.254.169.254/latest/meta-data', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://10.0.0.1/ai', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://192.168.1.1/ai', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://172.16.0.1/ai', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://127.0.0.1:8080/ai', 'gemini').isValid).toBe(false);
    });

    it('blocks IPv6 loopback and Unique Local / Link-Local ranges', () => {
      expect(validateOutboundAIUrl('https://[::1]/ai', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://[fe80::1]/ai', 'gemini').isValid).toBe(false);
      expect(validateOutboundAIUrl('https://[fc00::1]/ai', 'gemini').isValid).toBe(false);
    });

    it('permits official whitelisted providers over HTTPS', () => {
      expect(validateOutboundAIUrl('https://generativelanguage.googleapis.com/v1beta/models', 'gemini').isValid).toBe(true);
      expect(validateOutboundAIUrl('https://openrouter.ai/api/v1', 'openrouter').isValid).toBe(true);
      expect(validateOutboundAIUrl('https://api.anthropic.com/v1/messages', 'anthropic').isValid).toBe(true);
      expect(validateOutboundAIUrl('https://api.openai.com/v1/chat/completions', 'openai').isValid).toBe(true);
    });

    it('allows localhost only when provider is explicitly local (Ollama)', () => {
      expect(validateOutboundAIUrl('http://localhost:11434', 'local').isValid).toBe(true);
      expect(validateOutboundAIUrl('http://127.0.0.1:11434', 'local').isValid).toBe(true);
      expect(validateOutboundAIUrl('http://localhost:11434', 'gemini').isValid).toBe(false);
    });
  });

  describe('3. DataGate Freshness & Data Integrity Enforcement', () => {
    const baseTicker: TickerData = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      marketType: 'crypto_futures',
      price: 92000,
      priceChangePercent24h: 2.1,
      high24h: 93000,
      low24h: 91000,
      volume24h: 5000,
      quoteVolume24h: 460000000,
      openInterest: 100000,
      openInterestChange24h: 1.5,
      openInterestChange1h: 0.5,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 0.1,
      cvd: 1000000,
      cvdDelta: 50000,
      cvdDeltaPercent: 5,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.55,
      fibonacci: { fib50: 91500, fib618: 91200, fib68: 91000, swingHigh: 93000, swingLow: 91000, inGoldenPocket: false },
      rangeProfile: { vah: 92500, val: 91500, poc: 92000, inValueArea: true },
      keyLevels: { support1: 91500, support2: 91000, resistance1: 92500, resistance2: 93000, structureBreak: 'NONE', hasSinglePrintFVG: false },
      confluenceScore: 75,
      signalType: 'LONG',
      signalReason: 'Test Confluence',
      confluenceFactors: ['CVD Positive'],
      dataQuality: { isLive: true, isDegraded: false, lastPriceAgeMs: 500, source: 'WS' },
      updatedAt: Date.now()
    };

    it('allows signal generation when data is fresh and trustworthy (<60s)', () => {
      const decision = canGenerateSignals(baseTicker, Date.now());
      expect(decision.allow).toBe(true);
      expect(decision.isDegraded).toBe(false);
    });

    it('blocks signal generation when market data is stale (>60s)', () => {
      const staleTicker = { ...baseTicker, updatedAt: Date.now() - 75000 };
      const decision = canGenerateSignals(staleTicker, Date.now());
      expect(decision.allow).toBe(false);
      expect(decision.reason).toContain('Feed de dados desatualizado');
    });

    it('blocks signal generation when price is non-positive or NaN', () => {
      const invalidTicker1 = { ...baseTicker, price: 0 };
      expect(canGenerateSignals(invalidTicker1).allow).toBe(false);

      const invalidTicker2 = { ...baseTicker, price: NaN };
      expect(canGenerateSignals(invalidTicker2).allow).toBe(false);
    });

    it('blocks signal generation when source is SYNTHETIC and ALLOW_SYNTHETIC_DATA is not enabled', () => {
      const originalEnv = process.env.ALLOW_SYNTHETIC_DATA;
      delete process.env.ALLOW_SYNTHETIC_DATA;

      const syntheticTicker = {
        ...baseTicker,
        dataQuality: { isLive: false, isDegraded: false, lastPriceAgeMs: 100, source: 'SYNTHETIC' as const }
      };

      const decision = canGenerateSignals(syntheticTicker);
      expect(decision.allow).toBe(false);
      expect(decision.reason).toContain('sintéticos');

      process.env.ALLOW_SYNTHETIC_DATA = originalEnv;
    });

    it('freezes active trade evaluations if data is older than 120s to avoid false stops', () => {
      const veryStaleTicker = { ...baseTicker, updatedAt: Date.now() - 130000 };
      const decision = canEvaluateActiveTrades(veryStaleTicker, Date.now());
      expect(decision.allow).toBe(false);
      expect(decision.reason).toContain('Feed congelado');
    });
  });
});
