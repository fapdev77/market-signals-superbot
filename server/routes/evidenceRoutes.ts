import { Router, Request, Response } from 'express';
import { getErrorMessage } from '../utils/errors.js';
import { signalLedgerDao, resetSignalLedger, recordAuditLog } from '../db.js';
import { parseOriginFilter } from '../utils/dataOrigin.js';
import {
  generateEvidenceSummary,
  evaluateGoNoGo,
  type ClosedSignalEvidence
} from '../services/EvidenceService.js';
import { calculateBootstrapConfidenceInterval } from '../services/autoTuneOptimizer.js';
import { getAuditActor } from '../middleware/auth.js';
// SDD Fase 9 / S2 — calibracao do score contra a base rate do ledger.
import { calibrateScore, MIN_SAMPLE_FOR_CALIBRATION } from '../services/scoreCalibration.js';

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
    } catch (err) {
      console.error('Failed to generate evidence summary:', err);
      res.status(500).json({ error: 'Falha ao gerar resumo de evidência operacional', details: getErrorMessage(err) });
    }
  });

  /**
   * SDD Fase 9 / S2: GET /api/evidence/calibration
   *
   * Traduz a FORÇA de confluência (0..100, o que o motor já chamava `confluenceScore`)
   * em EXPECTATIVA calibrada por tier de score, em R por sinal fechado.
   *
   * Por que isto existe: a UI exibia "NN% CONFLUÊNCIA", e o operador lia aquilo como
   * probabilidade de acerto. Não é. Este endpoint devolve a medida certa — R por sinal,
   * depois de taxas, slippage e funding — junto com o tamanho da amostra e a confiança
   * (CALIBRATED / THIN_SAMPLE / UNCALIBRATED), para que a UI possa dizer quando NÃO há
   * amostra suficiente em vez de mostrar um número sem lastro.
   */
  router.get('/calibration', async (req: Request, res: Response) => {
    try {
      const origin = parseOriginFilter(req.query.origin, 'LIVE');
      const closedSignals = await signalLedgerDao.getClosedSignalsEvidence(origin);
      const summary = generateEvidenceSummary(closedSignals, { origin });

      const input = {
        overall: {
          n: summary.totalSignals,
          wins: summary.wins,
          losses: summary.losses,
          winRate: summary.winRate,
          wilsonInterval: summary.wilsonInterval,
          rExpectancy: summary.rExpectancy,
          avgMfe: summary.avgMfe,
          avgMae: summary.avgMae,
          cumulativeR: 0,
          maxDrawdownR: summary.maxDrawdownR
        },
        byScoreTier: summary.byScoreTier
      };

      const tiers: Record<string, unknown> = {};
      for (const tierKey of Object.keys(summary.byScoreTier)) {
        const probe = calibrateScore(Number(tierKey.split('-')[0]) || 0, input);
        tiers[tierKey] = probe;
      }

      res.json({
        success: true,
        origin,
        priorR: calibrateScore(0, input).expectancyR,
        priorSampleSize: summary.totalSignals,
        minSampleForCalibration: MIN_SAMPLE_FOR_CALIBRATION,
        tiers
      });
    } catch (err) {
      console.error('Failed to build score calibration:', err);
      res.status(500).json({ error: 'Falha ao calibrar score contra a base rate', details: getErrorMessage(err) });
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
    } catch (err) {
      console.error('Failed to evaluate go/no-go:', err);
      res.status(500).json({ error: 'Falha ao avaliar critérios go/no-go', details: getErrorMessage(err) });
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
    } catch (err) {
      console.error('Failed to reset signal ledger:', err);
      res.status(400).json({ error: getErrorMessage(err) || 'Falha ao resetar signal ledger' });
    }
  });

  /**
   * GET /api/evidence/burnin-report
   * Consolidates 60-day burn-in metrics, signal executability, Go/No-Go verdict,
   * drawdown, and win rate. Supports ?format=json (default) and ?format=csv.
   */
  router.get('/burnin-report', async (req: Request, res: Response) => {
    try {
      const origin = parseOriginFilter(req.query.origin, 'LIVE');
      const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';
      const closedSignals = await signalLedgerDao.getClosedSignalsEvidence(origin);
      const summary = generateEvidenceSummary(closedSignals, { origin });

      let calendarDays = 0;
      if (closedSignals.length > 0) {
        const timestamps = closedSignals.map(s => s.closedAt);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        calendarDays = Math.max(1, Math.round((maxT - minT) / (1000 * 60 * 60 * 24)));
      }

      const rValues = closedSignals.map(s => s.netR);
      const ci = calculateBootstrapConfidenceInterval(rValues, 1000, 42);

      const totalNetR = closedSignals.reduce((acc, s) => acc + (s.netR || 0), 0);

      const decision = evaluateGoNoGo({
        closedSignalsCount: summary.totalSignals,
        calendarDays,
        netExpectancyR: summary.rExpectancy,
        bootstrapLower95R: ci.lowerBound,
        maxDrawdownR: summary.maxDrawdownR,
        scoreTiers: Object.entries(summary.byScoreTier).map(([tier, m]) => ({
          tier,
          n: m.n,
          netExpectancyR: m.rExpectancy,
          enabled: true
        }))
      });

      const wilsonMin = summary.wilsonInterval ? (summary.wilsonInterval[0] * 100).toFixed(2) : '0.00';
      const wilsonMax = summary.wilsonInterval ? (summary.wilsonInterval[1] * 100).toFixed(2) : '0.00';

      const reportData = {
        generatedAt: new Date().toISOString(),
        origin,
        calendarDays,
        totalClosedSignals: summary.totalSignals,
        winRatePct: (summary.winRate || 0).toFixed(2),
        wilsonScoreInterval: [wilsonMin, wilsonMax],
        netExpectancyR: (summary.rExpectancy || 0).toFixed(3),
        bootstrapLower95R: ci.lowerBound.toFixed(3),
        maxDrawdownR: (summary.maxDrawdownR || 0).toFixed(2),
        totalNetR: totalNetR.toFixed(3),
        goNoGoStatus: decision.status,
        canClaimPerformance: decision.canClaimPerformance,
        goNoGoReasons: decision.reasons,
        byScoreTier: summary.byScoreTier,
        byCategory: summary.byCategory,
        byTradFiSession: summary.byTradFiSession
      };

      if (format === 'csv') {
        const lines: string[] = [
          '# Market Signals SuperBot - Relatorio de Auditoria & Burn-In',
          `Data de Geracao,${reportData.generatedAt}`,
          `Origem,${reportData.origin}`,
          `Dias Calendario,${reportData.calendarDays}`,
          `Total Sinais Concluidos,${reportData.totalClosedSignals}`,
          `Taxa de Acerto (%),${reportData.winRatePct}`,
          `Intervalo Wilson 95% Min (%),${reportData.wilsonScoreInterval[0]}`,
          `Intervalo Wilson 95% Max (%),${reportData.wilsonScoreInterval[1]}`,
          `Expectativa Liquida (R),${reportData.netExpectancyR}`,
          `Bootstrap 95% Limite Inferior (R),${reportData.bootstrapLower95R}`,
          `Max Drawdown (R),${reportData.maxDrawdownR}`,
          `Total R Liquido,${reportData.totalNetR}`,
          `Veredito Go/No-Go,${reportData.goNoGoStatus}`,
          `Pode Reivindicar Performance,${reportData.canClaimPerformance ? 'SIM' : 'NAO'}`,
          '',
          '# Criterios Institucionais Go/No-Go',
          ...(decision.reasons.length > 0
            ? decision.reasons.map((r, i) => `Condicao Pendente ${i + 1},"${r}"`)
            : ['Status,"Todos os criterios atendidos com sucesso"']),
          '',
          '# Performance por Faixa de Confluencia',
          'Faixa,Trades,Taxa Acerto (%),Expectativa (R),Max DD (R)',
          ...Object.entries(summary.byScoreTier).map(([t, m]) => `"${t}",${m.n},${(m.winRate || 0).toFixed(1)},${(m.rExpectancy || 0).toFixed(3)},${(m.maxDrawdownR || 0).toFixed(2)}`)
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="burnin-report-${Date.now()}.csv"`);
        return res.send(lines.join('\n'));
      }

      res.json({
        success: true,
        report: reportData
      });
    } catch (err) {
      console.error('Failed to generate burnin report:', err);
      res.status(500).json({ error: 'Falha ao gerar relatório consolidado de burn-in', details: getErrorMessage(err) });
    }
  });

  return router;
}
