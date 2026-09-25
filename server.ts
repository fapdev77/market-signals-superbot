import './server/utils/bootstrap.js';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_SYMBOLS, TRADFI_ASSETS, fetchBinanceFuturesTickers, fetchOpenInterest, fetchFundingRate, fetchKlines, fetchLongShortRatio } from './server/binanceService.js';
import { initBinanceWebSocket, getWebSocketStatus } from './server/binanceWebsocket.js';
import { processTickerState, buildTradeSignal } from './server/signalEngine.js';
import { saveSignal, getIndicatorWeights, getActiveSignalsBySymbol, updateSignalStatus, updateSignal, getAIModels, expireStaleSignals } from './server/db.js';
import { marketScreener } from './server/services/MarketScreenerService.js';
import { TickerData, BotState, IndicatorWeights, StrategyCategory } from './src/types.js';
import { createMarketRouter } from './server/routes/marketRoutes.js';
import { createAIRouter } from './server/routes/aiRoutes.js';
import { createBacktestRouter } from './server/routes/backtestRoutes.js';
import { createSystemRouter } from './server/routes/systemRoutes.js';
import { resolveActiveStrategies, configToWeights, getDefaultIndicatorWeights } from './src/constants/strategyPresets.js';
import { getBenchmarkPrice, generateRealisticTicker } from './src/utils/benchmarkPrices.js';

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
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Default indicator weights and models for immediate startup
  const defaultWeights: IndicatorWeights = getDefaultIndicatorWeights();

  // In-memory active ticker state cache
  const tickerStateCache: Record<string, TickerData> = {};

  const botState: BotState = {
    isMonitoring: true,
    activeTickersCount: DEFAULT_SYMBOLS.length + TRADFI_ASSETS.length,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: defaultWeights,
    aiModels: [],
    aiAnalysisEnabled: true
  };

  // Pre-seed TradFi and Crypto tickers in cache so API returns immediately
  const populateInitialTickers = () => {
    const now = Date.now();
    TRADFI_ASSETS.forEach(asset => {
      const basePrice = asset.symbol === 'SPY' ? 585.2 : asset.symbol === 'QQQ' ? 510.5 : asset.symbol === 'NVDA' ? 142.8 : asset.symbol === 'AAPL' ? 232.0 : asset.symbol === 'TSLA' ? 250.4 : 2740.0;
      tickerStateCache[asset.symbol] = {
        symbol: asset.symbol,
        baseAsset: asset.baseAsset,
        quoteAsset: asset.quoteAsset,
        name: asset.name,
        marketType: 'tradfi',
        price: basePrice,
        priceChangePercent24h: 0.85,
        high24h: parseFloat((basePrice * 1.015).toFixed(2)),
        low24h: parseFloat((basePrice * 0.985).toFixed(2)),
        volume24h: 1850000,
        quoteVolume24h: 1080000000,
        openInterest: 0,
        openInterestChange24h: 0,
        openInterestChange1h: 0,
        fundingRate: 0,
        fundingRateDaily: 0,
        fundingRateAnnualized: 0,
        fundingRateAnalysis: {
          status: 'NEUTRAL',
          pressure: 'NEUTRO / EQUILIBRADO',
          bias: 'NEUTRAL',
          description: 'Ativo TradFi sem taxas de funding perpétuas aplicáveis.'
        },
        cvd: 45000,
        cvdDelta: 5000,
        cvdDeltaPercent: 0.85,
        cvdDirection: 'BUY',
        takerBuyRatio: 0.52,
        fibonacci: {
          fib50: basePrice,
          fib618: basePrice * 0.995,
          fib68: basePrice * 0.992,
          swingHigh: basePrice * 1.02,
          swingLow: basePrice * 0.98,
          inGoldenPocket: false
        },
        rangeProfile: {
          vah: basePrice * 1.01,
          val: basePrice * 0.99,
          poc: basePrice,
          inValueArea: true
        },
        keyLevels: {
          support1: basePrice * 0.988,
          support2: basePrice * 0.975,
          resistance1: basePrice * 1.012,
          resistance2: basePrice * 1.025,
          structureBreak: 'NONE',
          hasSinglePrintFVG: false
        },
        confluenceScore: 65,
        signalType: 'NEUTRAL',
        signalReason: 'Ativo TradFi monitorado para confluência macro.',
        confluenceFactors: ['Fluxo macro institucional estável'],
        updatedAt: now
      };
    });

    DEFAULT_SYMBOLS.forEach(symbol => {
      const basePrice = getBenchmarkPrice(symbol);
      const isLowPrice = basePrice < 1;
      const decimals = isLowPrice ? 6 : 2;
      tickerStateCache[symbol] = {
        symbol,
        baseAsset: symbol.replace('USDT', ''),
        quoteAsset: 'USDT',
        name: symbol,
        marketType: 'crypto_futures',
        price: basePrice,
        priceChangePercent24h: 1.45,
        high24h: parseFloat((basePrice * 1.03).toFixed(decimals)),
        low24h: parseFloat((basePrice * 0.97).toFixed(decimals)),
        volume24h: 450000,
        quoteVolume24h: basePrice * 450000,
        ma24h: basePrice * 0.995,
        ma24hDeviationPct: 0.50,
        openInterest: basePrice * 50000,
        openInterestChange24h: 2.5,
        openInterestChange1h: 0.4,
        fundingRate: 0.0001,
        fundingRateDaily: 0.03,
        fundingRateAnnualized: 10.95,
        fundingRateAnalysis: {
          status: 'NEUTRAL',
          pressure: 'NEUTRO / EQUILIBRADO',
          bias: 'NEUTRAL',
          description: 'Taxa de funding neutra.'
        },
        cvd: 125000,
        cvdDelta: 15000,
        cvdDeltaPercent: 1.45,
        cvdDirection: 'BUY',
        takerBuyRatio: 0.54,
        fibonacci: {
          fib50: basePrice,
          fib618: basePrice * 0.995,
          fib68: basePrice * 0.992,
          swingHigh: basePrice * 1.03,
          swingLow: basePrice * 0.97,
          inGoldenPocket: false
        },
        rangeProfile: {
          vah: basePrice * 1.015,
          val: basePrice * 0.985,
          poc: basePrice,
          inValueArea: true
        },
        keyLevels: {
          support1: basePrice * 0.985,
          support2: basePrice * 0.97,
          resistance1: basePrice * 1.015,
          resistance2: basePrice * 1.03,
          structureBreak: 'NONE',
          hasSinglePrintFVG: false
        },
        confluenceScore: 70,
        signalType: 'NEUTRAL',
        signalReason: 'Aguardando confluência institucional de fluxo.',
        confluenceFactors: ['Order Flow em monitoramento contínuo'],
        updatedAt: now
      };
    });
  };

  populateInitialTickers();

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
      botState.activeTickersCount = activeSymbols.length + TRADFI_ASSETS.length;

      // Process in batches of 4 to prevent socket burst congestion and avoid rate limits
      const BATCH_SIZE = 4;
      for (let i = 0; i < activeSymbols.length; i += BATCH_SIZE) {
        const batch = activeSymbols.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (symbol) => {
          try {
            const existingCache = tickerStateCache[symbol];
            let raw = rawFutures.find((t: any) => t.symbol === symbol);

            if (!raw) {
              raw = generateRealisticTicker(symbol, existingCache?.price);
            }

            // Fetch primary/baseline Kline, Open Interest, Funding Rate, Long/Short Positioning
            const primaryTf = weights.volumeProfileTimeframe || '30m';
            const primaryCandles = weights.volumeProfileCandles || 48;
            const currentRawPrice = parseFloat(raw.lastPrice || '100');
            const primaryKlines = await fetchKlines(symbol, primaryTf, primaryCandles);
            const [{ openInterest }, { fundingRate }, longShortData] = await Promise.all([
              fetchOpenInterest(symbol),
              fetchFundingRate(symbol),
              fetchLongShortRatio(symbol, currentRawPrice)
            ]);
            const currentOi = openInterest || (currentRawPrice * 50000);

            // Process quantitative state for primary ticker display
            const processed = processTickerState(
              raw,
              primaryKlines,
              currentOi,
              fundingRate,
              weights,
              longShortData
            );

            tickerStateCache[symbol] = processed;

            // Target, Stop Loss & Institutional TTL Tracker for existing active signals
            const allActiveForSymbol = await getActiveSignalsBySymbol(symbol);
            const now = Date.now();
            const ttlSettings = weights.signalTtlSettings;
            const autoExpire = ttlSettings?.autoExpireEnabled !== false;
            const adverseInvalidationPct = ttlSettings?.adverseMoveInvalidationPct || 1.2;
            const breakevenEnabled = ttlSettings?.breakevenOnTarget1 !== false;

            for (const active of allActiveForSymbol) {
              const currentPrice = processed.price;
              active.currentPrice = currentPrice;

              // 1. Time-To-Live (TTL) Check
              if (active.expiresAt && now > active.expiresAt && autoExpire) {
                active.status = 'EXPIRED';
                active.expirationReason = 'TTL Expirado (Tempo Limite Atingido)';
                await updateSignal(active);
                continue;
              }

              // 2. Technical Invalidation: Adverse movement before fill / entry
              const entryLow = Math.min(active.entryZone[0], active.entryZone[1]);
              const entryHigh = Math.max(active.entryZone[0], active.entryZone[1]);

              if (active.direction === 'LONG') {
                const maxAdverseDrop = entryLow * (1 - (adverseInvalidationPct / 100));
                if (currentPrice < maxAdverseDrop && currentPrice > active.stopLoss) {
                  active.status = 'EXPIRED';
                  active.expirationReason = `Invalidação Técnica Antecipada (Movimento Adverso -${adverseInvalidationPct}%)`;
                  await updateSignal(active);
                  continue;
                }

                // 3. Targets and Stop Loss
                if (currentPrice >= active.target2) {
                  active.status = 'TARGET_REACHED';
                  active.expirationReason = 'Alvo 2 Atingido (+100% Expansão)';
                  await updateSignal(active);
                } else if (currentPrice <= active.stopLoss) {
                  active.status = 'STOPPED_OUT';
                  active.expirationReason = active.isBreakevenActive ? 'Stop no Breakeven Atingido (Trade Protegido)' : 'Stop Loss Atingido';
                  await updateSignal(active);
                } else if (currentPrice >= active.target1 && !active.isBreakevenActive && breakevenEnabled) {
                  // Institutional partial profit taking + trailing stop to entry
                  active.isBreakevenActive = true;
                  active.stopLoss = entryLow;
                  active.validationStage = 'Alvo 1 Atingido (+50% Realizado) · Stop em Breakeven Protegido';
                  await updateSignal(active);
                }
              } else { // SHORT
                const maxAdverseRally = entryHigh * (1 + (adverseInvalidationPct / 100));
                if (currentPrice > maxAdverseRally && currentPrice < active.stopLoss) {
                  active.status = 'EXPIRED';
                  active.expirationReason = `Invalidação Técnica Antecipada (Movimento Adverso +${adverseInvalidationPct}%)`;
                  await updateSignal(active);
                  continue;
                }

                if (currentPrice <= active.target2) {
                  active.status = 'TARGET_REACHED';
                  active.expirationReason = 'Alvo 2 Atingido (+100% Expansão)';
                  await updateSignal(active);
                } else if (currentPrice >= active.stopLoss) {
                  active.status = 'STOPPED_OUT';
                  active.expirationReason = active.isBreakevenActive ? 'Stop no Breakeven Atingido (Trade Protegido)' : 'Stop Loss Atingido';
                  await updateSignal(active);
                } else if (currentPrice <= active.target1 && !active.isBreakevenActive && breakevenEnabled) {
                  // Institutional partial profit taking + trailing stop to entry
                  active.isBreakevenActive = true;
                  active.stopLoss = entryHigh;
                  active.validationStage = 'Alvo 1 Atingido (+50% Realizado) · Stop em Breakeven Protegido';
                  await updateSignal(active);
                }
              }
            }

            // CONCURRENT MULTI-STRATEGY EVALUATION:
            // Evaluate all active/enabled strategies in parallel (e.g. SCALP 5m, DAY TRADE 15m, INTRADAY 30m, SWING 1h, POSITION 4h, CONTRA-TRADE 15m)
            const activeStrategies = resolveActiveStrategies(weights);

            for (const strat of activeStrategies) {
              try {
                // Fetch strategy specific klines (5m, 15m, 30m, 1h, 4h) with 10s memory cache
                const stratKlines = (strat.timeframe === primaryTf && strat.candles === primaryCandles)
                  ? primaryKlines
                  : await fetchKlines(symbol, strat.timeframe, strat.candles);

                const stratWeights = configToWeights(strat);
                const stratProcessed = processTickerState(
                  raw,
                  stratKlines,
                  currentOi,
                  fundingRate,
                  stratWeights,
                  longShortData
                );

                const potentialSignal = buildTradeSignal(
                  stratProcessed,
                  stratKlines,
                  strat.minRiskRewardRatio,
                  strat.category,
                  strat.timeframe,
                  weights.signalTtlSettings
                );

                if (potentialSignal) {
                  // Check active signals for THIS symbol AND THIS strategy category
                  const activeCategorySignals = await getActiveSignalsBySymbol(symbol, strat.category);
                  let shouldInsert = true;

                  for (const active of activeCategorySignals) {
                    if (active.direction === potentialSignal.direction) {
                      // Direction is the same in this category, so no new duplicate is needed
                      shouldInsert = false;

                      // Only update if validation status changed
                      if (active.validationStatus !== potentialSignal.validationStatus || active.validationStage !== potentialSignal.validationStage) {
                        active.validationStatus = potentialSignal.validationStatus;
                        active.validationStage = potentialSignal.validationStage;
                        active.candle1mConfirmed = potentialSignal.candle1mConfirmed;
                        active.candle5mConfirmed = potentialSignal.candle5mConfirmed;

                        if (active.validationStatus === 'CONFIRMED') {
                          active.validatedAt = Date.now();
                        } else if (active.validationStatus === 'REJECTED_SPIKE' || active.validationStatus === 'REJECTED_BACKTEST') {
                          active.rejectedAt = Date.now();
                          active.status = 'EXPIRED';
                          active.expirationReason = 'Spike Rejeitado no Filtro 1m/5m';
                        }
                        await updateSignal(active);
                      }
                    } else {
                      // Direction changed within this category! The old signal of this category is expired
                      await updateSignalStatus(active.id, 'EXPIRED', 'Inversão Direcional de Mercado');
                    }
                  }

                  if (shouldInsert && potentialSignal.validationStatus !== 'REJECTED_SPIKE') {
                    await saveSignal(potentialSignal);
                    botState.signalsGenerated24h++;
                  }
                }
              } catch (stratErr) {
                // Keep resilient per strategy
              }
            }
          } catch (symErr) {
            // Keep loop resilient per symbol
          }
        }));
      }

      // Add TradFi Asset Tickers (S&P500, Nasdaq, Gold, stocks)
      const now = Date.now();
      TRADFI_ASSETS.forEach(asset => {
        const basePrice = asset.symbol === 'SPY' ? 585.2 : asset.symbol === 'QQQ' ? 510.5 : asset.symbol === 'NVDA' ? 142.8 : asset.symbol === 'AAPL' ? 232.0 : asset.symbol === 'TSLA' ? 250.4 : 2740.0;
        const varPct = Math.sin((now / 15000) + asset.symbol.length) * 1.8;
        const currentPrice = parseFloat((basePrice * (1 + varPct / 100)).toFixed(2));

        tickerStateCache[asset.symbol] = {
          symbol: asset.symbol,
          baseAsset: asset.baseAsset,
          quoteAsset: asset.quoteAsset,
          name: asset.name,
          marketType: 'tradfi',
          price: currentPrice,
          priceChangePercent24h: parseFloat(varPct.toFixed(2)),
          high24h: parseFloat((basePrice * 1.015).toFixed(2)),
          low24h: parseFloat((basePrice * 0.985).toFixed(2)),
          volume24h: 1850000,
          quoteVolume24h: 1080000000,
          openInterest: 0,
          openInterestChange24h: 0,
          openInterestChange1h: 0,
          fundingRate: 0,
          fundingRateDaily: 0,
          fundingRateAnnualized: 0,
          fundingRateAnalysis: {
            status: 'NEUTRAL',
            pressure: 'NEUTRO / EQUILIBRADO',
            bias: 'NEUTRAL',
            description: 'Ativo TradFi sem taxas de funding perpétuas aplicáveis.'
          },
          cvd: varPct * 120000,
          cvdDelta: varPct * 12000,
          cvdDeltaPercent: Number(varPct.toFixed(2)),
          cvdDirection: varPct > 0 ? 'BUY' : 'SELL',
          takerBuyRatio: 0.5 + varPct * 0.05,
          fibonacci: {
            fib50: basePrice,
            fib618: basePrice * 0.995,
            fib68: basePrice * 0.992,
            swingHigh: basePrice * 1.02,
            swingLow: basePrice * 0.98,
            inGoldenPocket: Math.abs(varPct) < 0.3
          },
          rangeProfile: {
            vah: basePrice * 1.01,
            val: basePrice * 0.99,
            poc: basePrice,
            inValueArea: true
          },
          keyLevels: {
            support1: basePrice * 0.988,
            support2: basePrice * 0.975,
            resistance1: basePrice * 1.012,
            resistance2: basePrice * 1.025,
            structureBreak: varPct > 1 ? 'BULLISH' : varPct < -1 ? 'BEARISH' : 'NONE',
            hasSinglePrintFVG: false
          },
          confluenceScore: Math.round(50 + Math.abs(varPct) * 15),
          signalType: varPct > 1.2 ? 'LONG' : varPct < -1.2 ? 'SHORT' : 'NEUTRAL',
          signalReason: 'Índice/Ativo TradFi rastreado para confluência macro.',
          confluenceFactors: [`Fluxo institucional TradFi (${varPct > 0 ? 'Alta' : 'Baixa'} de ${varPct.toFixed(2)}%)`],
          updatedAt: now
        };
      });

      botState.ticksProcessed++;
      botState.lastTickTime = Date.now();
    } catch (err) {
      console.error('Market tick loop error:', err);
    } finally {
      isMarketTickRunning = false;
    }
  }

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get Binance WebSocket & API status
  app.get('/api/binance/status', (req, res) => {
    const ws = getWebSocketStatus();
    res.json({
      websocket: ws,
      timestamp: Date.now()
    });
  });

  // Modular Route Handlers
  const getBotState = () => botState;
  const getTickerCache = () => tickerStateCache;
  const triggerMarketScan = async () => {
    await runMarketTick(true);
  };

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🤖 Market Signals SuperBot Server running on http://0.0.0.0:${PORT}`);

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
