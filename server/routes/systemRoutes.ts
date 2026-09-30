import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getDatabaseStats, 
  vacuumDatabase, 
  clearTable, 
  exportDatabaseJson, 
  factoryResetDatabase,
  recordAuditLog,
  getAuditLogs,
  getActiveSignals,
  getDbMetrics,
  getDb
} from '../db.js';
import {
  DEFAULT_RISK_LIMITS,
  evaluatePortfolioRisk,
  getKillSwitch,
  setKillSwitch,
  getRiskLimits,
  updateRiskLimits,
  saveRiskLimitsToDb,
  saveKillSwitchToDb,
  type RiskLimits
} from '../services/RiskManager.js';
import { getFeedHealth } from '../services/feedHealth.js';
import { getMetrics } from '../utils/metrics.js';
import { getTradingScheduleStatus } from '../binanceService.js';
import { getWebSocketStatus } from '../binanceWebsocket.js';
import { isClockDegraded, getClockDriftMs, getLastClockCheckTime } from '../services/ClockService.js';
import { parseOriginFilter } from '../utils/dataOrigin.js';
import { BotState } from '../../src/types.js';
import { getDefaultIndicatorWeights } from '../../src/constants/strategyPresets.js';
import { defaultModels } from '../../src/config/defaultModels.js';
import { validateBody, resetConfirmationSchema, tableClearConfirmationSchema } from '../middleware/validation.js';
import { getAuditActor } from '../middleware/auth.js';

export function createSystemRouter(
  getBotState: () => BotState,
  triggerMarketScan?: () => Promise<void>
): Router {
  const router = Router();

  // Get comprehensive database & system storage statistics
  router.get('/database-info', async (req: Request, res: Response) => {
    try {
      const stats = await getDatabaseStats();
      res.json(stats);
    } catch (err: any) {
      console.error('Failed to get database stats:', err);
      res.status(500).json({ error: 'Falha ao obter estatísticas do banco de dados', details: err?.message });
    }
  });

  // Get Security Audit Logs
  router.get('/audit-logs', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(200, Math.max(10, parseInt((req.query.limit as string) || '50', 10)));
      const logs = await getAuditLogs(limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao buscar logs de auditoria', details: err?.message });
    }
  });

  // Optimize & compact SQLite database (VACUUM)
  router.post('/database-vacuum', async (req: Request, res: Response) => {
    try {
      const result = await vacuumDatabase();
      await recordAuditLog('DATABASE_VACUUM', req.originalUrl, getAuditActor(req), result);
      res.json(result);
    } catch (err: any) {
      console.error('Failed to vacuum database:', err);
      res.status(500).json({ error: 'Falha ao otimizar banco de dados', details: err?.message });
    }
  });

  // Clear specific clearable table (requires explicit confirmation)
  router.post('/table-clear', validateBody(tableClearConfirmationSchema), async (req: Request, res: Response) => {
    const table = req.body.table || req.body.tableName;
    try {
      const result = await clearTable(table);
      await recordAuditLog('TABLE_CLEAR', req.originalUrl, getAuditActor(req), { table, rowsRemoved: result.rowsRemoved });
      if (triggerMarketScan) {
        triggerMarketScan().catch(err => console.warn('Background scan warning after clear:', err));
      }
      res.json(result);
    } catch (err: any) {
      console.error(`Failed to clear table ${table}:`, err);
      res.status(400).json({ error: err?.message || 'Falha ao limpar tabela' });
    }
  });

  // Export full JSON database backup (secrets redacted)
  router.get('/database-export', async (req: Request, res: Response) => {
    try {
      const data = await exportDatabaseJson();
      await recordAuditLog('DATABASE_EXPORT', req.originalUrl, getAuditActor(req));
      const isDownload = req.query.download === '1' || req.query.download === 'true';
      if (isDownload) {
        const filename = `superbot-sqlite-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
      }
      res.json(data);
    } catch (err: any) {
      console.error('Failed to export database:', err);
      res.status(500).json({ error: 'Falha ao exportar backup do banco de dados', details: err?.message });
    }
  });

  // GLOBAL FACTORY RESET (requires explicit confirmation { confirm: "RESET" })
  router.post('/factory-reset', validateBody(resetConfirmationSchema), async (req: Request, res: Response) => {
    try {
      const defaultWeights = getDefaultIndicatorWeights();
      const result = await factoryResetDatabase(defaultWeights, defaultModels);

      // Reset in-memory botState to original factory defaults
      const botState = getBotState();
      botState.weights = defaultWeights;
      botState.aiModels = defaultModels;
      botState.signalsGenerated24h = result.signalsReseededCount;
      botState.ticksProcessed = 0;
      botState.lastTickTime = Date.now();
      botState.isMonitoring = true;

      await recordAuditLog('FACTORY_RESET', req.originalUrl, getAuditActor(req), { scope: req.body.scope || 'ALL' });

      if (triggerMarketScan) {
        triggerMarketScan().catch(err => console.warn('Initial market scan after factory reset:', err));
      }

      res.json({
        success: true,
        message: 'Aplicação restaurada para o padrão de fábrica com sucesso.',
        details: result
      });
    } catch (err: any) {
      console.error('Failed to perform global factory reset:', err);
      res.status(500).json({ error: 'Falha ao executar reset de fábrica', details: err?.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // R-15: métricas em memória (contadores de ticks, sinais, bloqueios e erros por feed)
  // M4.4: Métricas de tamanho do arquivo e duração do save do banco de dados
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        metrics: getMetrics(),
        database: getDbMetrics()
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao obter métricas', details: err?.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // R-13: health por feed — estado observável de cada fonte de dado.
  // Inclui o estado do calendário R-11 (assumptions quando em fallback por relógio), do WS
  // e da deriva de relógio (M4.6).
  // ---------------------------------------------------------------------------------------------
  router.get('/feed-health', (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        health: {
          ...getFeedHealth(),
          ws: getWebSocketStatus(),
          tradingSchedule: getTradingScheduleStatus(),
          clock: {
            isDegraded: isClockDegraded(),
            driftMs: getClockDriftMs(),
            lastCheckedAt: getLastClockCheckTime()
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao obter health dos feeds', details: err?.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Phase 3.4 & M4.2: risk posture and kill-switch
  // ---------------------------------------------------------------------------------------------

  // Current halt state plus the portfolio risk computed from the open signals.
  router.get('/risk-status', async (req: Request, res: Response) => {
    try {
      const openSignals = await getActiveSignals(parseOriginFilter(req.query.origin, 'ALL'));
      const limits = getRiskLimits();
      res.json({
        killSwitch: getKillSwitch(),
        limits,
        portfolio: evaluatePortfolioRisk(openSignals, limits)
      });
    } catch (err: any) {
      console.error('Failed to compute risk status:', err);
      res.status(500).json({ error: 'Falha ao calcular o status de risco', details: err?.message });
    }
  });

  const riskLimitsInputSchema = z.object({
    accountEquity: z.number().positive().min(100).max(100_000_000).optional(),
    riskPerTradePct: z.number().positive().min(0.01).max(10).optional(),
    maxConcurrentSignals: z.number().int().min(1).max(50).optional(),
    maxPortfolioRiskPct: z.number().positive().min(0.1).max(50).optional(),
    maxSignalsPerCategory: z.number().int().min(1).max(20).optional()
  });

  // M4.2: Limites de risco editáveis por endpoint validado (zod, com faixas), gravando no audit log.
  router.post('/risk-limits', validateBody(riskLimitsInputSchema), async (req: Request, res: Response) => {
    try {
      const actor = getAuditActor(req);
      const updated = updateRiskLimits(req.body);
      const database = await getDb();
      await saveRiskLimitsToDb(database);
      await recordAuditLog('RISK_LIMITS_UPDATE', req.originalUrl, actor, updated);
      res.json({ success: true, limits: updated });
    } catch (err: any) {
      console.error('Failed to update risk limits:', err);
      res.status(400).json({ error: err?.message || 'Falha ao atualizar limites de risco' });
    }
  });

  // Activate or release the trading halt. Activating requires a reason. Persists to app_state.
  router.post('/kill-switch', async (req: Request, res: Response) => {
    const { enabled, reason } = req.body || {};

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'Campo "enabled" (boolean) é obrigatório.' });
      return;
    }

    if (enabled && (typeof reason !== 'string' || reason.trim().length < 3)) {
      res.status(400).json({ error: 'Ativar o kill-switch exige um "reason" com pelo menos 3 caracteres.' });
      return;
    }

    try {
      const actor = getAuditActor(req);
      const state = setKillSwitch(enabled, actor, reason);
      const database = await getDb();
      await saveKillSwitchToDb(database);
      await recordAuditLog('KILL_SWITCH', req.originalUrl, actor, { enabled, reason: reason || null });
      res.json({ success: true, killSwitch: state });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Falha ao alterar o kill-switch' });
    }
  });

  return router;
}
