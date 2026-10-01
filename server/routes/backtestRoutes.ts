import { Router, Request, Response } from 'express';
import { HistoricalDataService } from '../services/HistoricalDataService.js';
import { BacktestEngine } from '../services/BacktestEngine.js';
import { BotState } from '../../src/types.js';
import { ensureFundingCoverage, defaultFundingBudgetPerMinute } from '../services/FundingCoverageTrigger.js';

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
      const effectiveDays = days || 30;
      // 6.3.3: garante cobertura de funding do intervalo do símbolo ANTES de
      // cada backtest (incremental, idempotente, com orçamento/minuto). Falha
      // aqui NÃO bloqueia o backtest — o resultado declara a cobertura menor.
      try {
        await ensureFundingCoverage(symbol, effectiveDays, {
          budgetPerMinute: defaultFundingBudgetPerMinute()
        });
      } catch (fundErr: any) {
        console.warn(`[backtest] Falha ao sincronizar funding para ${symbol} (seguindo com cobertura existente):`, fundErr?.message || fundErr);
      }
      const result = await BacktestEngine.runBacktest({
        symbol,
        days: effectiveDays,
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

  // Agendamento diário automático de backtest
  router.get('/schedule', async (_req: Request, res: Response) => {
    try {
      const { backtestScheduleDao } = await import('../backtest_db/index.js');
      const { computeNextExecutionTime } = await import('../services/BacktestScheduler.js');
      let schedule = await backtestScheduleDao.getSchedule();
      if (!schedule) {
        schedule = await backtestScheduleDao.saveSchedule({
          id: 'daily-default',
          enabled: true,
          timeOfDay: '00:00',
          timezone: 'UTC',
          symbol: 'BTCUSDT',
          days: 30,
          profile: 'daytrade'
        });
      }
      const nextRun = computeNextExecutionTime(schedule);
      res.json({ success: true, schedule, nextRun });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/schedule', async (req: Request, res: Response) => {
    try {
      const { backtestScheduleDao } = await import('../backtest_db/index.js');
      const { computeNextExecutionTime } = await import('../services/BacktestScheduler.js');
      const { enabled, timeOfDay, timezone, symbol, days, profile } = req.body;
      const updated = await backtestScheduleDao.saveSchedule({
        id: 'daily-default',
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
        timeOfDay: typeof timeOfDay === 'string' ? timeOfDay : undefined,
        timezone: typeof timezone === 'string' ? timezone : undefined,
        symbol: typeof symbol === 'string' ? symbol.toUpperCase() : undefined,
        days: typeof days === 'number' ? days : undefined,
        profile: typeof profile === 'string' ? profile : undefined
      });
      const nextRun = computeNextExecutionTime(updated);
      res.json({ success: true, schedule: updated, nextRun });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/schedule/run-now', async (_req: Request, res: Response) => {
    try {
      const { backtestScheduleDao } = await import('../backtest_db/index.js');
      const { executeScheduledBacktest } = await import('../services/BacktestScheduler.js');
      const schedule = await backtestScheduleDao.getSchedule();
      if (!schedule) {
        return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
      }
      const botState = getBotState();
      const outcome = await executeScheduledBacktest(schedule, botState);
      res.json({ success: outcome.success, outcome });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  // Histórico de backtests salvos para comparação histórica
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const { backtestResultsDao } = await import('../backtest_db/index.js');
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined;
      const results = await backtestResultsDao.listRecent(limit, symbol);
      res.json({ success: true, count: results.length, results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
