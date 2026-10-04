import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_RISK_LIMITS,
  getRiskLimits,
  updateRiskLimits,
  evaluatePortfolioRisk
} from '../server/services/RiskManager.js';
import type { TradeSignal } from '../src/types.js';

/**
 * HIGH-2 (auditoria 2026-10-04) — o gate de emissão de sinais usava
 * `DEFAULT_RISK_LIMITS` enquanto o sizing e o endpoint de status usavam
 * `getRiskLimits()`.
 *
 * Consequência: um operador que reduz o risco via `POST /api/system/risk-limits`
 * vê `GET /api/system/risk-status` reportar os limites customizados, mas a emissão
 * continua sendo filtrada pelos defaults — o limite configurado não existe no
 * caminho que decide se o sinal entra. O sistema reporta uma configuração que não
 * está em vigor.
 *
 * Este guard cobre os dois lados:
 *  - comportamento: um porteiro customizado tem de mudar a decisão do gate;
 *  - forma: `server.ts` não pode voltar a passar a constante de defaults.
 */

function makeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    symbol: 'BTCUSDT',
    side: 'LONG',
    strategyCategory: 'SCALP',
    entryPrice: 100,
    stopLoss: 99,
    takeProfit: 102,
    confidence: 80,
    ...overrides
  } as TradeSignal;
}

afterEach(() => {
  updateRiskLimits({ ...DEFAULT_RISK_LIMITS });
});

describe('HIGH-2 — os limites em vigor são os configurados, não os defaults', () => {
  it('updateRiskLimits altera getRiskLimits e o default não muda', () => {
    updateRiskLimits({ maxConcurrentSignals: 1 });
    expect(getRiskLimits().maxConcurrentSignals).toBe(1);
    expect(DEFAULT_RISK_LIMITS.maxConcurrentSignals).toBe(8);
  });

  it('o gate de emissão respeita o limite configurado que o default permitiria', () => {
    const open = [makeSignal(), makeSignal()];
    // Sob o default (8 simultâneos, 3 por categoria) o segundo SCALP passa.
    expect(evaluatePortfolioRisk(open, DEFAULT_RISK_LIMITS, { category: 'SCALP' }).allowed).toBe(true);
    // O operador travou a categoria em 1: o MESMO portfólio tem de ser barrado.
    updateRiskLimits({ maxSignalsPerCategory: 1 });
    const gated = evaluatePortfolioRisk(open, getRiskLimits(), { category: 'SCALP' });
    expect(gated.allowed).toBe(false);
    expect(gated.reasons.join(' ')).toContain('SCALP');
  });

  it('server.ts passa getRiskLimits() para evaluatePortfolioRisk no caminho de emissão', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const calls = src.match(/evaluatePortfolioRisk\([^)]*?\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // DEFAULT_RISK_LIMITS é um default de fallback da própria função; passá-lo
      // explicitamente descarta a configuração em vigor.
      expect(call).not.toContain('DEFAULT_RISK_LIMITS');
    }
  });
});