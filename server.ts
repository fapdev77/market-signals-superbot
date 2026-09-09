import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_SYMBOLS, TRADFI_ASSETS, fetchBinanceFuturesTickers, fetchOpenInterest, fetchFundingRate, fetchKlines } from './server/binanceService.js';
import { initBinanceWebSocket, getWebSocketStatus } from './server/binanceWebsocket.js';
import { processTickerState, buildTradeSignal } from './server/signalEngine.js';
import { saveSignal, getIndicatorWeights, getActiveSignalsBySymbol, updateSignalStatus, updateSignal, getAIModels } from './server/db.js';
import { TickerData, BotState } from './src/types.js';
import { createMarketRouter } from './server/routes/marketRoutes.js';
import { createAIRouter } from './server/routes/aiRoutes.js';
import { createBacktestRouter } from './server/routes/backtestRoutes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize real-time Binance Futures WebSocket Stream
  initBinanceWebSocket();

  // In-memory active ticker state cache
  let tickerStateCache: Record<string, TickerData> = {};
  let botState: BotState = {
    isMonitoring: true,
    activeTickersCount: DEFAULT_SYMBOLS.length + TRADFI_ASSETS.length,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: await getIndicatorWeights(),
    aiModels: await getAIModels(),
    aiAnalysisEnabled: true
  };

  /**
   * Continuous Tick-by-Tick Market Monitoring Loop
   */
  async function runMarketTick() {
    if (!botState.isMonitoring) return;

    try {
      // 1. Fetch live Binance Futures 24h Tickers
      const rawFutures = await fetchBinanceFuturesTickers();
      const weights = botState.weights;

      for (const symbol of DEFAULT_SYMBOLS) {
        const raw = rawFutures.find((t: any) => t.symbol === symbol) || {
          symbol,
          lastPrice: symbol.includes('BTC') ? '92450.5' : symbol.includes('ETH') ? '3420.1' : symbol.includes('SOL') ? '188.4' : '12.5',
          priceChangePercent: (Math.sin(Date.now() / 10000 + symbol.length) * 3.5).toFixed(2),
          highPrice: '94000',
          lowPrice: '90500',
          volume: '450000',
          quoteVolume: '4100000000'
        };

        // Fetch Kline, Open Interest, Funding Rate
        const klines = await fetchKlines(symbol, '15m', 40);
        const { openInterest } = await fetchOpenInterest(symbol);
        const { fundingRate } = await fetchFundingRate(symbol);

        // Process quantitative state
        const processed = processTickerState(
          raw,
          klines,
          openInterest || (parseFloat(raw.lastPrice || '100') * 50000),
          fundingRate,
          weights
        );

        tickerStateCache[symbol] = processed;

        // Generate signal if high confluence with 1m & 5m validation
        const potentialSignal = buildTradeSignal(processed, klines, weights.minRiskRewardRatio);
        if (potentialSignal) {
          const activeSignals = await getActiveSignalsBySymbol(symbol);
          let shouldInsert = true;

          for (const active of activeSignals) {
            if (active.direction === potentialSignal.direction) {
              // Direction is the same, so no new signal is needed
              shouldInsert = false;
              
              // Only update if validation status changed (e.g. from PENDING to CONFIRMED or REJECTED)
              if (active.validationStatus !== potentialSignal.validationStatus || active.validationStage !== potentialSignal.validationStage) {
                active.validationStatus = potentialSignal.validationStatus;
                active.validationStage = potentialSignal.validationStage;
                active.candle1mConfirmed = potentialSignal.candle1mConfirmed;
                active.candle5mConfirmed = potentialSignal.candle5mConfirmed;
                
                // If rejected, mark as EXPIRED/REJECTED_SPIKE to remove it from active list
                if (active.validationStatus === 'REJECTED_SPIKE') {
                  active.status = 'EXPIRED';
                }
                await updateSignal(active);
              }
            } else {
              // Direction changed! The old signal is no longer valid
              await updateSignalStatus(active.id, 'EXPIRED');
            }
          }

          if (shouldInsert && potentialSignal.validationStatus !== 'REJECTED_SPIKE') {
            await saveSignal(potentialSignal);
            botState.signalsGenerated24h++;
          }
        }
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
    }
  }

  // Run first tick immediately, then poll every 4 seconds
  runMarketTick();
  setInterval(runMarketTick, 4000);

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

  app.use('/api', createMarketRouter(getBotState, getTickerCache));
  app.use('/api/ai', createAIRouter(getBotState, getTickerCache));
  app.use('/api/backtest', createBacktestRouter(getBotState));


  // VITE MIDDLEWARE (Dev) / STATIC FILES (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  });
}

startServer();
