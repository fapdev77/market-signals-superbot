import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { TickerData, BotState } from '../src/types.js';
import { createMarketRouter } from './routes/marketRoutes.js';
import { createAIRouter } from './routes/aiRoutes.js';
import { createBacktestRouter } from './routes/backtestRoutes.js';
import { createSystemRouter } from './routes/systemRoutes.js';
import { createEvidenceRouter } from './routes/evidenceRoutes.js';
import { requireAuth, getEffectiveAuthToken, validateTokenConstantTime } from './middleware/auth.js';

/**
 * Phase 2.5.9: the Express application used to be constructed inline inside `startServer()`.
 * HTTP tests could not import it, so they mounted their own Express instance and the real middleware
 * order, CORS policy, body limit and rate limiters were never exercised. `createApp` builds the real
 * application; `server.ts` only adds the Vite/static layer and starts listening.
 */
export interface AppContext {
  botState: BotState;
  tickerStateCache: Record<string, TickerData>;
  triggerMarketScan: (options?: { resetCategory?: string }) => Promise<void>;
}

export function createApp(ctx: AppContext): express.Express {
  const { botState, tickerStateCache, triggerMarketScan } = ctx;
  const app = express();

  // S2: Enable trust proxy (essential for Cloud Run, reverse proxies and rate-limiting)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // S2: Configured CORS middleware
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin iframe in dev)
      if (!origin) return callback(null, true);
      // Phase 2.5.8: development stays permissive for local tooling. Production honours ONLY the
      // explicit ALLOWED_ORIGINS allowlist — the previous `origin.endsWith('.run.app')` rule accepted
      // any Cloud Run service owned by anyone.
      if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Bloqueado por política de CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token']
  }));

  // S2: Hardening HTTP Headers via Helmet (with iframe & WASM support)
  app.use(helmet({
    contentSecurityPolicy: false, // Vite Dev & preview iframe compatibility
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // S2: Body payload limit (100 kb max)
  app.use(express.json({ limit: '100kb' }));

  // S2: Rate limiters
  const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Limite de requisições excedido. Aguarde 1 minuto.' }
  });

  const strictSensitiveLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 45,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Limite de requisições para operações sensíveis atingido.' }
  });

  const authBruteForceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15, // Max 15 token verifications per minute to stop brute-force
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Muitas tentativas de validação de token. Aguarde 1 minuto.' }
  });

  app.use('/api', globalApiLimiter);
  app.use('/api/ai', strictSensitiveLimiter);
  app.use('/api/system/factory-reset', strictSensitiveLimiter);
  app.use('/api/system/table-clear', strictSensitiveLimiter);
  app.use('/api/auth/verify', authBruteForceLimiter);

  // Health check endpoint (Public, unauthenticated for probes)
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

  // Auth Status & Verification (Public)
  app.get('/api/auth/status', (req, res) => {
    const authHeader = req.headers['authorization'];
    let providedToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (req.headers['x-api-token']) {
      providedToken = String(req.headers['x-api-token']).trim();
    }
    const effectiveToken = getEffectiveAuthToken();
    const isValid = Boolean(providedToken && validateTokenConstantTime(providedToken, effectiveToken));

    res.json({
      authenticated: isValid,
      hasExplicitTokenConfigured: Boolean(process.env.API_AUTH_TOKEN)
    });
  });

  app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body || {};
    const effectiveToken = getEffectiveAuthToken();
    const isValid = Boolean(token && validateTokenConstantTime(String(token).trim(), effectiveToken));
    res.json({ valid: isValid });
  });

  // S1: Authentication enforcement on all other API endpoints
  app.use('/api', requireAuth);

  // Mount Application Routes
  app.use('/api', createMarketRouter(() => botState, () => tickerStateCache, triggerMarketScan));
  app.use('/api/ai', createAIRouter(() => botState, () => tickerStateCache));
  app.use('/api/backtest', createBacktestRouter(() => botState));
  app.use('/api/system', createSystemRouter(() => botState, triggerMarketScan));
  app.use('/api/evidence', createEvidenceRouter());

  return app;
}
