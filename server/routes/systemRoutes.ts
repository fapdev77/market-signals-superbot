import { Router, Request, Response } from 'express';
import { 
  getDatabaseStats, 
  vacuumDatabase, 
  clearTable, 
  exportDatabaseJson, 
  factoryResetDatabase,
  recordAuditLog,
  getAuditLogs
} from '../db.js';
import { BotState } from '../../src/types.js';
import { getDefaultIndicatorWeights } from '../../src/constants/strategyPresets.js';
import { defaultModels } from '../../src/config/defaultModels.js';
import { validateBody, resetConfirmationSchema, tableClearConfirmationSchema } from '../middleware/validation.js';

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
      await recordAuditLog('DATABASE_VACUUM', req.originalUrl, 'ADMIN', result);
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
      await recordAuditLog('TABLE_CLEAR', req.originalUrl, 'ADMIN', { table, rowsRemoved: result.rowsRemoved });
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
      await recordAuditLog('DATABASE_EXPORT', req.originalUrl, 'ADMIN');
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

      await recordAuditLog('FACTORY_RESET', req.originalUrl, 'ADMIN', { scope: req.body.scope || 'ALL' });

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

  return router;
}
