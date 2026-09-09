import { Router, Request, Response } from 'express';
import { HistoricalDataService } from '../services/HistoricalDataService.js';
import { BacktestEngine } from '../services/BacktestEngine.js';
import { BotState } from '../../src/types.js';

export function createBacktestRouter(getBotState: () => BotState): Router {
  const router = Router();

  router.post('/sync', async (req: Request, res: Response) => {
    const { symbol, days, forceFull } = req.body;
    HistoricalDataService.syncSymbol(symbol, days || 30, forceFull === true);
    res.json({ success: true, message: `Sync initiated for ${symbol}` });
  });

  router.get('/sync/:symbol', (req: Request, res: Response) => {
    const state = HistoricalDataService.getSyncState(req.params.symbol);
    res.json(state);
  });

  router.get('/stats/:symbol', async (req: Request, res: Response) => {
    try {
      const stats = await HistoricalDataService.getStats(req.params.symbol.toUpperCase());
      res.json({ success: true, stats });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/run', async (req: Request, res: Response) => {
    try {
      const { symbol, days, profile, weights, useCache } = req.body;
      const botState = getBotState();
      const activeWeights = weights || botState.weights;
      const result = await BacktestEngine.runBacktest({
        symbol,
        days: days || 30,
        profile: profile || 'daytrade',
        weights: activeWeights
      }, useCache !== false);
      res.json({ success: true, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/autotune', async (req: Request, res: Response) => {
    try {
      const { symbol, profile, days, iterations } = req.body;
      const botState = getBotState();
      const tuneResult = await BacktestEngine.runAutoTune(
        symbol || 'BTCUSDT',
        profile || 'scalp',
        days || 30,
        iterations || 20,
        botState.weights
      );
      res.json({ success: true, tuneResult });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/trade-candles', async (req: Request, res: Response) => {
    try {
      const { symbol, startTime, endTime } = req.query;
      if (!symbol || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing parameters' });
      }
      const klines = await HistoricalDataService.getTradeCandles(
        (symbol as string).toUpperCase(),
        parseInt(startTime as string, 10),
        parseInt(endTime as string, 10)
      );
      res.json({ success: true, klines });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
