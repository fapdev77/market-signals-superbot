import { Router, Request, Response } from 'express';
import { signalLedgerDao, resetSignalLedger, recordAuditLog } from '../db.js';
import { parseOriginFilter } from '../utils/dataOrigin.js';
import {
  generateEvidenceSummary,
  evaluateGoNoGo,
  type ClosedSignalEvidence
} from '../services/EvidenceService.js';
import { calculateBootstrapConfidenceInterval } from '../services/autoTuneOptimizer.js';
import { getAuditActor } from '../middleware/auth.js';

export function createEvidenceRouter(): Router {
  const router = Router();

  /**
   * M3.3: GET /api/evidence/summary
   * Aggregates closed signals by score tier, strategy category and TradFi session.
   * Computes win rate with Wilson score interval, R expectancy, avg MFE/MAE, and cumulative R drawdown.
   * Default: origin = 'LIVE'.
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const origin = parseOriginFilter(req.query.origin, 'LIVE');
      const closedSignals = await signalLedgerDao.getClosedSignalsEvidence(origin);
      const summary = generateEvidenceSummary(closedSignals, { origin });

      res.json({
        success: true,
        origin,
        summary
      });
    } catch (err: any) {
      console.error('Failed to generate evidence summary:', err);
      res.status(500).json({ error: 'Falha ao gerar resumo de evidência operacional', details: err?.message });
    }
  });

  /**
   * M3.4: GET /api/evidence/go-no-go
   * Evaluates the pre-registered institutional Go/No-Go criteria:
   * - n >= 100 closed signals AND >= 60 calendar days
   * - Net expectancy >= +0.10 R
   * - Lower bound of 95% bootstrap CI > 0
   * - Max drawdown <= 15.0 R
   * - No score tier with negative expectancy and n >= 30 remains enabled
   */
  router.get('/go-no-go', async (req: Request, res: Response) => {
    try {
      const origin = parseOriginFilter(req.query.origin, 'LIVE');
      const closedSignals = await signalLedgerDao.getClosedSignalsEvidence(origin);
      const summary = generateEvidenceSummary(closedSignals, { origin });

      let calendarDays = 0;
      if (closedSignals.length > 0) {
        const timestamps = closedSignals.map(s => s.closedAt);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        calendarDays = Math.max(1, Math.round((maxT - minT) / (1000 * 60 * 60 * 24)));
      }

      // Compute bootstrap 95% CI lower bound for net R
      const rValues = closedSignals.map(s => s.netR);
      const ci = calculateBootstrapConfidenceInterval(rValues, 1000, 42);
      const bootstrapLower95R = ci.lowerBound;

      const scoreTiers = Object.entries(summary.byScoreTier).map(([tier, m]) => ({
        tier,
        n: m.n,
        netExpectancyR: m.rExpectancy,
        enabled: true
      }));

      const decision = evaluateGoNoGo({
        closedSignalsCount: summary.totalSignals,
        calendarDays,
        netExpectancyR: summary.rExpectancy,
        bootstrapLower95R,
        maxDrawdownR: summary.maxDrawdownR,
        scoreTiers
      });

      res.json({
        success: true,
        origin,
        decision,
        summary
      });
    } catch (err: any) {
      console.error('Failed to evaluate go/no-go:', err);
      res.status(500).json({ error: 'Falha ao avaliar critérios go/no-go', details: err?.message });
    }
  });

  /**
   * M3.1 / CA-3.1: POST /api/evidence/reset
   * Dedicated ledger reset requiring exact confirmation: { confirm: 'RESET_LEDGER' }
   */
  router.post('/reset', async (req: Request, res: Response) => {
    try {
      const { confirm } = req.body || {};
      if (confirm !== 'RESET_LEDGER') {
        res.status(400).json({
          error: 'Confirmação dedicada obrigatória: envie { confirm: "RESET_LEDGER" }'
        });
        return;
      }

      const result = await resetSignalLedger({ confirm: 'RESET_LEDGER' });
      await recordAuditLog('RESET_LEDGER', req.originalUrl, getAuditActor(req));

      res.json(result);
    } catch (err: any) {
      console.error('Failed to reset signal ledger:', err);
      res.status(400).json({ error: err?.message || 'Falha ao resetar signal ledger' });
    }
  });

  return router;
}
