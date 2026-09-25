import { Router, Request, Response } from 'express';
import { 
  getDatabaseStats, 
  vacuumDatabase, 
  clearTable, 
  exportDatabaseJson, 
  factoryResetDatabase 
} from '../db.js';
import { BotState } from '../../src/types.js';
import { getDefaultIndicatorWeights } from '../../src/constants/strategyPresets.js';
import { defaultModels } from '../../src/config/defaultModels.js';

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

  // Optimize & compact SQLite database (VACUUM)
  router.post('/database-vacuum', async (req: Request, res: Response) => {
    try {
      const result = await vacuumDatabase();
      res.json(result);
    } catch (err: any) {
      console.error('Failed to vacuum database:', err);
      res.status(500).json({ error: 'Falha ao otimizar banco de dados', details: err?.message });
    }
  });

  // Clear specific clearable table
  router.post('/table-clear', async (req: Request, res: Response) => {
    const { tableName } = req.body || {};
    if (!tableName || typeof tableName !== 'string') {
      return res.status(400).json({ error: 'Nome da tabela inválido ou ausente.' });
    }

    try {
      const result = await clearTable(tableName);
      if (triggerMarketScan) {
        triggerMarketScan().catch(err => console.warn('Background scan warning after clear:', err));
      }
      res.json(result);
    } catch (err: any) {
      console.error(`Failed to clear table ${tableName}:`, err);
      res.status(400).json({ error: err?.message || 'Falha ao limpar tabela' });
    }
  });

  // Export full JSON database backup
  router.get('/database-export', async (req: Request, res: Response) => {
    try {
      const data = await exportDatabaseJson();
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

  // GLOBAL FACTORY RESET
  router.post('/factory-reset', async (req: Request, res: Response) => {
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
