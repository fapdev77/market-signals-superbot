import { Router, Request, Response } from 'express';import {
  getDatabaseStats, 
  vacuumDatabase, 
  clearTable, 
  exportDatabaseJson, 
  factoryResetDatabase,
  recordAuditLog,
  getAuditLogs,
  getActiveSignals
} from '../db.js';
import { DEFAULT_RISK_LIMITS, evaluatePortfolioRisk, getKillSwitch, setKillSwitch } from '../services/RiskManager.js';
import { getFeedHealth } from '../services/feedHealth.js';
import { getMetrics } from '../utils/metrics.js';
import { getTradingScheduleStatus } from '../binanceService.js';
import { getWebSocketStatus } from '../binanceWebsocket.js';
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
  // R-15: métricas em memória (contadores de ticks, sinais, bloqueios e erros por feed).
  // JSON simples conforme a spec; Prometheus só se houver demanda.
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      res.json({ success: true, metrics: getMetrics() });
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao obter métricas', details: err?.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // R-13: health por feed — estado observável de cada fonte de dado.
  // Inclui o estado do calendário R-11 (assumptions quando em fallback por relógio) e do WS.
  // ---------------------------------------------------------------------------------------------
  router.get('/feed-health', (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        health: {
          ...getFeedHealth(),
          ws: getWebSocketStatus(),
          tradingSchedule: getTradingScheduleStatus()
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao obter health dos feeds', details: err?.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Phase 3.4: risk posture and kill-switch
  // ---------------------------------------------------------------------------------------------

  // Current halt state plus the portfolio risk computed from the open signals.
  //
  // R-2: default ALL (ao contrário das leituras de conteúdo), porque esta rota descreve a postura
  // que o motor realmente aplica: se um sinal DEMO está aberto, ele ocupa margem e concorre aos
  // limites. `?origin=LIVE` mostra a visão só de mercado.
  router.get('/risk-status', async (req: Request, res: Response) => {
    try {
      const openSignals = await getActiveSignals(parseOriginFilter(req.query.origin, 'ALL'));
      res.json({
        killSwitch: getKillSwitch(),
        limits: DEFAULT_RISK_LIMITS,
        portfolio: evaluatePortfolioRisk(openSignals, DEFAULT_RISK_LIMITS)
      });
    } catch (err: any) {
      console.error('Failed to compute risk status:', err);
      res.status(500).json({ error: 'Falha ao calcular o status de risco', details: err?.message });
    }
  });

  // Activate or release the trading halt. Activating requires a reason.
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
      await recordAuditLog('KILL_SWITCH', req.originalUrl, actor, { enabled, reason: reason || null });
      res.json({ success: true, killSwitch: state });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Falha ao alterar o kill-switch' });
    }
  });

  return router;
}
