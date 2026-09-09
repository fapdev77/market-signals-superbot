import { Router, Request, Response } from 'express';
import { getBinanceLogs } from '../binanceWebsocket.js';
import { fetchKlines } from '../binanceService.js';
import { getRecentSignals, saveIndicatorWeights, saveAIModels } from '../db.js';
import { TickerData, BotState } from '../../src/types.js';

export function createMarketRouter(
  getBotState: () => BotState,
  getTickerCache: () => Record<string, TickerData>
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
    const newWeights = req.body;
    botState.weights = { ...botState.weights, ...newWeights };
    await saveIndicatorWeights(botState.weights);
    res.json({ success: true, weights: botState.weights });
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

  return router;
}
