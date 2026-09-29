import './server/utils/bootstrap.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_SYMBOLS, TRADFI_ASSETS, isTradfiMarketOpen, fetchBinanceFuturesTickers, fetchOpenInterest, fetchFundingRate, fetchKlines, fetchLongShortRatio } from './server/binanceService.js';
import { initBinanceWebSocket, getWebSocketStatus } from './server/binanceWebsocket.js';
import { processTickerState, buildTradeSignal } from './server/signalEngine.js';
import { saveSignal, getIndicatorWeights, getActiveSignalsBySymbol, updateSignalStatus, updateSignal, getAIModels, expireStaleSignals, expireActiveSignalsByCategory, expireAllActiveSignals, recordAuditLog } from './server/db.js';
import { marketScreener } from './server/services/MarketScreenerService.js';
import { TickerData, BotState, IndicatorWeights, StrategyCategory } from './src/types.js';
import { createMarketRouter } from './server/routes/marketRoutes.js';
import { createAIRouter } from './server/routes/aiRoutes.js';
import { createBacktestRouter } from './server/routes/backtestRoutes.js';
import { createSystemRouter } from './server/routes/systemRoutes.js';
import { resolveActiveStrategies, configToWeights, getDefaultIndicatorWeights } from './src/constants/strategyPresets.js';
import { requireAuth, getEffectiveAuthToken, validateTokenConstantTime } from './server/middleware/auth.js';
import { canGenerateSignals, canEvaluateActiveTrades } from './server/services/DataGate.js';

// Prevent unhandled internal runtime assertions (e.g. Node 24 undici socket parser ERR_ASSERTION: false == true) from crashing the server
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ERR_ASSERTION' && (err?.stack?.includes('undici') || String(err?.message || '').includes('false == true'))) {
    console.warn('⚠️ [Node.js Engine Guard] Intercepted internal Undici socket assertion (false == true); process preserved.');
    return;
  }
  console.error('❌ [Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('⚠️ [Unhandled Promise Rejection]:', reason?.message || reason);
});

async function startServer() {
  // S1: Production startup assertion
  if (process.env.NODE_ENV === 'production' && !process.env.API_AUTH_TOKEN) {
    console.error('❌ [FATAL SECURITY ERROR] API_AUTH_TOKEN is required in production environment.');
    process.exit(1);
  }

  const app = express();
  // Environment constraint: Dev server must run on port 3000 in AI Studio
  const PORT = process.env.NODE_ENV === 'production' ? (Number(process.env.PORT) || 3000) : 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  // S2: Enable trust proxy (essential for Cloud Run, reverse proxies and rate-limiting)
  app.set('trust proxy', 1);

  // S2: Configured CORS middleware
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin iframe in dev)
      if (!origin) return callback(null, true);
      // In dev/preview environments, allow same host or explicit origins
      if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
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

  // Default indicator weights and models for immediate startup
  const defaultWeights: IndicatorWeights = getDefaultIndicatorWeights();

  // In-memory active ticker state cache
  const tickerStateCache: Record<string, TickerData> = {};

  const botState: BotState = {
    isMonitoring: true,
    activeTickersCount: DEFAULT_SYMBOLS.length,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: defaultWeights,
    aiModels: [],
    aiAnalysisEnabled: true
  };

  // Async load weights & models from DB without blocking server bind
  getIndicatorWeights().then(w => {
    botState.weights = w;
  }).catch(e => console.warn('Could not load weights from DB, using defaults:', e));

  getAIModels().then(m => {
    botState.aiModels = m;
  }).catch(e => console.warn('Could not load AI models from DB:', e));

  /**
   * Continuous Tick-by-Tick Market Monitoring Loop
   */
  let isMarketTickRunning = false;
  async function runMarketTick(forced = false) {
    if ((!botState.isMonitoring && !forced) || isMarketTickRunning) return;
    isMarketTickRunning = true;

    try {
      // Periodic institutional TTL sweep across all active signals
      await expireStaleSignals();

      // 1. Fetch live Binance Futures 24h Tickers
      const activeSymbols = marketScreener.getMonitoredSymbols();
      const rawFutures = await fetchBinanceFuturesTickers(activeSymbols);
      const weights = botState.weights;
      botState.activeTickersCount = activeSymbols.length;

      // Process in batches of 4 to prevent socket burst congestion and avoid rate limits
      const BATCH_SIZE = 4;
      for (let i = 0; i < activeSymbols.length; i += BATCH_SIZE) {
        const batch = activeSymbols.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (symbol) => {
          try {
            const existingCache = tickerStateCache[symbol];
            let raw = rawFutures.find((t: any) => t.symbol === symbol);
            
            if (!raw && existingCache) {
              raw = {
                symbol,
                lastPrice: String(existingCache.price),
                priceChangePercent: String(existingCache.priceChangePercent24h),
                highPrice: String(existingCache.high24h),
                lowPrice: String(existingCache.low24h),
                volume: String(existingCache.volume24h),
                quoteVolume: String(existingCache.quoteVolume24h)
              };
            }

            if (!raw) {
              return;
            }

            // Fetch live Kline data (15m timeframe, 60 candles)
            const klines = await fetchKlines(symbol, '15m', 60);

            // Fetch live Open Interest with real change tracking (Phase 2.2)
            const oiData = await fetchOpenInterest(symbol);
            const liveOI = (oiData && oiData.openInterest > 0) 
              ? oiData.openInterest 
              : (existingCache?.openInterest || 0);
            const realOiChange = {
              change24h: oiData?.change24h ?? existingCache?.openInterestChange24h,
              change1h: oiData?.change1h ?? existingCache?.openInterestChange1h
            };

            // Fetch live Funding Rate with contract interval (Phase 2.2)
            const fundingData = await fetchFundingRate(symbol);
            const liveFunding = fundingData ? fundingData.fundingRate : (existingCache?.fundingRate || 0.0001);
            const fundingIntervalHours = fundingData?.fundingIntervalHours || existingCache?.fundingIntervalHours || 8;

            // Fetch Long/Short Ratio
            let lsData = undefined;
            try {
              lsData = await fetchLongShortRatio(symbol, raw?.lastPrice ? parseFloat(raw.lastPrice) : undefined);
            } catch {
              // Non-blocking
            }

            // D3/D5 & Phase 2.2: Process ticker state strictly from real live data
            const processed = processTickerState(
              raw,
              klines,
              liveOI,
              liveFunding,
              weights,
              lsData,
              undefined,
              realOiChange,
              fundingIntervalHours
            );
            if (!processed) {
              return;
            }

            tickerStateCache[symbol] = processed;

            // D3: DataGate Evaluation (Geração e avaliação bloqueadas se dados forem desatualizados ou degradados)
            const gateDecision = canGenerateSignals(processed);
            const activeTradeGate = canEvaluateActiveTrades(processed);

            // Strategy & Signal Evaluation across enabled presets
            const activeConfigs = resolveActiveStrategies(weights);

            for (const stratConfig of activeConfigs) {
              const strategyWeights = configToWeights(stratConfig);
              const targetCategory = stratConfig.category;
              const targetTimeframe = stratConfig.timeframe;

              const activeSignalsForCategory = await getActiveSignalsBySymbol(symbol, targetCategory);

              if (activeSignalsForCategory.length === 0) {
                const minScore = weights.minConfluenceScore ?? 65;
                
                // Phase 2.4: Ensure underlying TradFi market is open before emitting signals
                const tradfiAsset = TRADFI_ASSETS.find(a => a.symbol === symbol);
                const isTradfiAllowed = !tradfiAsset || isTradfiMarketOpen(tradfiAsset.tradfiCategory);

                if (gateDecision.allow && isTradfiAllowed && processed.confluenceScore >= minScore) {
                  const newSignal = buildTradeSignal(
                    processed, 
                    klines, 
                    stratConfig.minRiskRewardRatio,
                    targetCategory,
                    targetTimeframe,
                    weights.signalTtlSettings
                  );
                  if (newSignal) {
                    await saveSignal(newSignal);
                    botState.signalsGenerated24h++;
                    console.log(`⚡ [NEW ${targetCategory} SIGNAL] ${symbol} ${newSignal.direction} Score: ${newSignal.confluenceScore}% RR: 1:${newSignal.riskRewardRatio}`);
                  }
                }
              } else if (activeTradeGate.allow) {
                // Monitor active trades for targets, stop-loss or breakeven updates
                for (const activeSignal of activeSignalsForCategory) {
                  let signalModified = false;

                  if (activeSignal.direction === 'LONG') {
                    // Check if Target 1 reached -> Activate Breakeven
                    if (!activeSignal.isBreakevenActive && processed.price >= activeSignal.target1) {
                      activeSignal.isBreakevenActive = true;
                      activeSignal.stopLoss = activeSignal.entryZone[0];
                      signalModified = true;
                      console.log(`🛡️ [BREAKEVEN ACTIVATED] Long ${symbol} hit Target 1. Stop raised to entry: ${activeSignal.stopLoss}`);
                    }

                    if (processed.price >= activeSignal.target2) {
                      await updateSignalStatus(activeSignal.id, 'TARGET_REACHED', 'Alvo 2 atingido (+100% expansão de lucro)');
                      console.log(`🎯 [TARGET 2 HIT] Long ${symbol} hit final take profit: ${activeSignal.target2}`);
                    } else if (processed.price <= activeSignal.stopLoss) {
                      const reason = activeSignal.isBreakevenActive 
                        ? 'Saída no Breakeven (Risco Zero)' 
                        : 'Stop Loss Atingido';
                      await updateSignalStatus(activeSignal.id, 'STOPPED_OUT', reason);
                      console.log(`🛑 [STOPPED OUT] Long ${symbol} hit stop at ${activeSignal.stopLoss} (${reason})`);
                    } else if (signalModified) {
                      await updateSignal(activeSignal);
                    }
                  } else if (activeSignal.direction === 'SHORT') {
                    // Check if Target 1 reached -> Activate Breakeven
                    if (!activeSignal.isBreakevenActive && processed.price <= activeSignal.target1) {
                      activeSignal.isBreakevenActive = true;
                      activeSignal.stopLoss = activeSignal.entryZone[1];
                      signalModified = true;
                      console.log(`🛡️ [BREAKEVEN ACTIVATED] Short ${symbol} hit Target 1. Stop lowered to entry: ${activeSignal.stopLoss}`);
                    }

                    if (processed.price <= activeSignal.target2) {
                      await updateSignalStatus(activeSignal.id, 'TARGET_REACHED', 'Alvo 2 atingido (+100% expansão de lucro)');
                      console.log(`🎯 [TARGET 2 HIT] Short ${symbol} hit final take profit: ${activeSignal.target2}`);
                    } else if (processed.price >= activeSignal.stopLoss) {
                      const reason = activeSignal.isBreakevenActive 
                        ? 'Saída no Breakeven (Risco Zero)' 
                        : 'Stop Loss Atingido';
                      await updateSignalStatus(activeSignal.id, 'STOPPED_OUT', reason);
                      console.log(`🛑 [STOPPED OUT] Short ${symbol} hit stop at ${activeSignal.stopLoss} (${reason})`);
                    } else if (signalModified) {
                      await updateSignal(activeSignal);
                    }
                  }
                }
              }
            }
          } catch (itemErr) {
            console.warn(`Error processing tick for ${symbol}:`, itemErr);
          }
        }));
      }

      botState.ticksProcessed++;
      botState.lastTickTime = Date.now();
    } catch (tickErr) {
      console.error('Market tick scan exception:', tickErr);
    } finally {
      isMarketTickRunning = false;
    }
  }

  // Scan trigger helper for strategy changes
  const triggerMarketScan = async (options?: { resetCategory?: string }) => {
    if (options?.resetCategory) {
      if (options.resetCategory === 'ALL') {
        await expireAllActiveSignals();
      } else {
        await expireActiveSignalsByCategory(options.resetCategory);
      }
    }
    await runMarketTick(true);
  };

  const getBotState = () => botState;
  const getTickerCache = () => tickerStateCache;

  // Mount Application Routes
  app.use('/api', createMarketRouter(getBotState, getTickerCache, triggerMarketScan));
  app.use('/api/ai', createAIRouter(getBotState, getTickerCache));
  app.use('/api/backtest', createBacktestRouter(getBotState));
  app.use('/api/system', createSystemRouter(getBotState, triggerMarketScan));

  // VITE MIDDLEWARE (Dev) / STATIC FILES (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🤖 Market Signals SuperBot running securely on http://${HOST}:${PORT}`);
    console.log(`🔒 Authentication: Bearer Token active. (Effective token initialized)`);

    // Initialize background workers AFTER server is listening
    try {
      initBinanceWebSocket();
    } catch (wsErr) {
      console.warn('WebSocket init warning:', wsErr);
    }

    runMarketTick();
    setInterval(runMarketTick, 4000);

    // Initial Market Screener scan & recurring periodic rescan
    marketScreener.runScreenerScan().then(() => {
      runMarketTick(true);
    }).catch(err => {
      console.warn('Initial market screener scan warning:', err);
    });

    // Check periodically (every 5 minutes) if screener is due for rescan
    setInterval(async () => {
      try {
        const { getScreenerSettings } = await import('./server/db.js');
        const settings = await getScreenerSettings();
        const intervalMs = (settings.rescanIntervalMinutes || 15) * 60 * 1000;
        if (Date.now() - settings.lastRescanTimestamp >= intervalMs) {
          await marketScreener.runScreenerScan();
          runMarketTick(true);
        }
      } catch (err) {
        console.warn('Scheduled screener rescan error:', err);
      }
    }, 60000);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Market Signals SuperBot server:', err);
  process.exit(1);
});
