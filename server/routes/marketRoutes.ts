import { Router, Request, Response } from 'express';
import { getBinanceLogs } from '../binanceWebsocket.js';
import { fetchKlines, fetchOrderBookDepth } from '../binanceService.js';
import { getRecentSignals, saveIndicatorWeights, saveAIModels, expireActiveSignalsByCategory, expireAllActiveSignals } from '../db.js';
import { TickerData, BotState, StrategyCategory } from '../../src/types.js';

export function createMarketRouter(
  getBotState: () => BotState,
  getTickerCache: () => Record<string, TickerData>,
  triggerMarketScan?: (options?: { resetCategory?: string }) => Promise<void>
): Router {
  const router = Router();

  // Binance connection logs
  router.get('/binance/logs', (req: Request, res: Response) => {
    const logs = getBinanceLogs();
    res.json(logs);
  });

  // Bot Status
  router.get('/bot/status', (req: Request, res: Response) => {
    res.json(getBotState());
  });

  // Toggle Bot Monitoring
  router.post('/bot/toggle', (req: Request, res: Response) => {
    const botState = getBotState();
    botState.isMonitoring = !botState.isMonitoring;
    res.json({ isMonitoring: botState.isMonitoring });
  });

  // Toggle AI Analysis Mode
  router.post('/bot/toggle-ai', (req: Request, res: Response) => {
    const botState = getBotState();
    if (typeof req.body?.enabled === 'boolean') {
      botState.aiAnalysisEnabled = req.body.enabled;
    } else {
      botState.aiAnalysisEnabled = !botState.aiAnalysisEnabled;
    }
    res.json({ aiAnalysisEnabled: botState.aiAnalysisEnabled });
  });

  // All Monitored Tickers
  router.get('/tickers', (req: Request, res: Response) => {
    const tickerCache = getTickerCache();
    const list = Object.values(tickerCache).sort((a, b) => a.symbol.localeCompare(b.symbol));
    res.json(list);
  });

  // Specific Ticker Details & Kline Chart
  router.get('/tickers/:symbol', async (req: Request, res: Response) => {
    const symbol = req.params.symbol.toUpperCase();
    const timeframe = (req.query.tf as string) || '15m';
    const tickerCache = getTickerCache();
    const ticker = tickerCache[symbol];
    const klines = await fetchKlines(symbol, timeframe, 60);
    res.json({ ticker, klines });
  });

  // Order Book Liquidity Depth & Imbalance
  router.get('/tickers/:symbol/depth', async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const limit = Math.min(60, Math.max(10, parseInt((req.query.limit as string) || '35', 10)));
      const tickerCache = getTickerCache();
      const ticker = tickerCache[symbol];
      const depthData = await fetchOrderBookDepth(symbol, ticker?.price, limit);
      res.json(depthData);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch depth data' });
    }
  });

  // Recent Generated Signals from SQLite
  router.get('/signals', async (req: Request, res: Response) => {
    try {
      const signals = await getRecentSignals(50);
      res.json(signals);
    } catch {
      res.status(500).json({ error: 'Failed to fetch signals' });
    }
  });

  // Settings: Indicator Weights
  router.get('/settings/weights', (req: Request, res: Response) => {
    const botState = getBotState();
    res.json(botState.weights);
  });

  router.post('/settings/weights', async (req: Request, res: Response) => {
    const botState = getBotState();
    const payload = req.body || {};
    
    // Support either direct weights or { weights, scope, activeStrategy }
    const newWeights = payload.weights ? payload.weights : payload;
    const scope = payload.scope || 'ALL_FUTURE'; // 'ALL_FUTURE' | 'RESET_AND_RESCAN'
    const activeStrategy = payload.activeStrategy || newWeights.activeStrategy || botState.weights.activeStrategy || 'intraday';

    botState.weights = { 
      ...botState.weights, 
      ...newWeights, 
      activeStrategy 
    };
    
    await saveIndicatorWeights(botState.weights);

    // Map strategy to category
    const categoryMap: Record<string, StrategyCategory> = {
      scalp: 'SCALP',
      daytrade: 'DAY_TRADE',
      intraday: 'INTRADAY',
      swing: 'SWING',
      position: 'POSITION',
      counter: 'COUNTER_TRADE',
      custom: 'CUSTOM'
    };
    const targetCategory = categoryMap[activeStrategy] || 'INTRADAY';

    // If scope is RESET_AND_RESCAN, expire current active signals
    if (scope === 'RESET_AND_RESCAN') {
      if (payload.resetCategory === 'ALL') {
        await expireAllActiveSignals();
      } else {
        await expireActiveSignalsByCategory(targetCategory);
      }
    }

    // Trigger immediate market scan if handler is provided
    if (triggerMarketScan) {
      triggerMarketScan({ resetCategory: scope === 'RESET_AND_RESCAN' ? (payload.resetCategory || targetCategory) : undefined }).catch(err => {
        console.warn('Immediate market scan error:', err);
      });
    }

    res.json({ 
      success: true, 
      weights: botState.weights,
      activeStrategy,
      strategyCategory: targetCategory,
      scope
    });
  });

  // Settings: AI Models
  router.get('/settings/ai-models', (req: Request, res: Response) => {
    const botState = getBotState();
    res.json(botState.aiModels);
  });

  router.post('/settings/ai-models', async (req: Request, res: Response) => {
    const botState = getBotState();
    if (Array.isArray(req.body)) {
      botState.aiModels = req.body;
      await saveAIModels(botState.aiModels);
      res.json({ success: true, models: botState.aiModels });
    } else {
      res.status(400).json({ error: 'Expected array of AIModelConfig' });
    }
  });

  // ==========================================
  // MARKET SCREENER & DYNAMIC UNIVERSE ENDPOINTS
  // ==========================================

  // Get current Screener assets & summary
  router.get('/screener/assets', async (req: Request, res: Response) => {
    try {
      const { marketScreener } = await import('../services/MarketScreenerService.js');
      let assets = marketScreener.getCachedAssets();
      let summary = marketScreener.getLastSummary();

      if (!assets || assets.length === 0) {
        const scanResult = await marketScreener.runScreenerScan();
        assets = scanResult.assets;
        summary = scanResult.summary;
      }

      res.json({ assets, summary, monitoredSymbols: marketScreener.getMonitoredSymbols() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch screener assets' });
    }
  });

  // Toggle favorite symbol (★)
  router.post('/screener/favorites/toggle', async (req: Request, res: Response) => {
    try {
      const { symbol, isFavorite } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ error: 'Symbol is required' });
        return;
      }

      const { toggleFavoriteSymbol } = await import('../db.js');
      const { marketScreener } = await import('../services/MarketScreenerService.js');
      
      const updatedStatus = await toggleFavoriteSymbol(symbol.toUpperCase(), typeof isFavorite === 'boolean' ? isFavorite : undefined);
      
      // Trigger instant screener re-evaluation
      await marketScreener.runScreenerScan(true);

      // Trigger instant market scan loop for immediate UI update
      if (triggerMarketScan) {
        triggerMarketScan().catch(() => {});
      }

      res.json({ success: true, symbol: symbol.toUpperCase(), isFavorite: updatedStatus });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to toggle favorite' });
    }
  });

  // Get Screener settings
  router.get('/screener/settings', async (req: Request, res: Response) => {
    try {
      const { getScreenerSettings } = await import('../db.js');
      const settings = await getScreenerSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch screener settings' });
    }
  });

  // Save Screener settings
  router.post('/screener/settings', async (req: Request, res: Response) => {
    try {
      const { saveScreenerSettings } = await import('../db.js');
      const { marketScreener } = await import('../services/MarketScreenerService.js');
      
      await saveScreenerSettings(req.body);
      const scanResult = await marketScreener.runScreenerScan(true);

      if (triggerMarketScan) {
        triggerMarketScan().catch(() => {});
      }

      res.json({ success: true, settings: req.body, summary: scanResult.summary });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save screener settings' });
    }
  });

  // Force Screener manual re-scan
  router.post('/screener/run-now', async (req: Request, res: Response) => {
    try {
      const { marketScreener } = await import('../services/MarketScreenerService.js');
      const scanResult = await marketScreener.runScreenerScan(true);

      if (triggerMarketScan) {
        triggerMarketScan().catch(() => {});
      }

      res.json({ success: true, summary: scanResult.summary, monitoredCount: scanResult.assets.filter(a => a.isMonitored).length });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to run screener scan' });
    }
  });

  // Toggle Excluded Asset in Screener
  router.post('/screener/exclude/toggle', async (req: Request, res: Response) => {
    try {
      const { symbol, isExcluded } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ error: 'Valid symbol string required' });
        return;
      }

      const { toggleExcludedSymbol } = await import('../db.js');
      const { marketScreener } = await import('../services/MarketScreenerService.js');

      const updatedList = await toggleExcludedSymbol(symbol, isExcluded);
      const scanResult = await marketScreener.runScreenerScan(true);

      if (triggerMarketScan) {
        triggerMarketScan().catch(() => {});
      }

      res.json({ success: true, symbol: symbol.toUpperCase(), excludedSymbols: updatedList, summary: scanResult.summary });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to toggle exclusion' });
    }
  });

  // Reset Excluded Symbols to default standard list
  router.post('/screener/exclude/reset', async (req: Request, res: Response) => {
    try {
      const { resetExcludedSymbols } = await import('../db.js');
      const { marketScreener } = await import('../services/MarketScreenerService.js');

      const defaultList = await resetExcludedSymbols();
      const scanResult = await marketScreener.runScreenerScan(true);

      if (triggerMarketScan) {
        triggerMarketScan().catch(() => {});
      }

      res.json({ success: true, excludedSymbols: defaultList, summary: scanResult.summary });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to reset exclusions' });
    }
  });

  return router;
}
