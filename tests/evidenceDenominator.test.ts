/**
 * 6.2.5 / CA-2.5 — Denominador completo: win rate, expectativa e go/no-go
 * consideram TODOS os sinais fechados, incluindo expirados. 10 sinais com
 * alvo e 10 expirados a preço de entrada produzem win rate de 50% (nunca
 * 100%). O resumo informa `expiredCount`, `expiredShare` e a quebra por
 * motivo.
 *
 * 6.2.6 / CA-2.6 — Toda linha nova do ledger tem `engineVersion` (hash do
 * commit), `weightsHash` e perfil de estratégia preenchidos.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger
} from '../server/db.js';
import {
  calculateSignalOutcomeR,
  generateEvidenceSummary,
  type ClosedSignalEvidence
} from '../server/services/EvidenceService.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-evidence-denominator-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

function buildEvidence(id: string, kind: 'WIN' | 'EXPIRED'): ClosedSignalEvidence {
  const signal = {
    id,
    symbol: 'BTCUSDT',
    category: 'INTRADAY',
    direction: 'LONG' as const,
    entryPrice: 100,
    stopLoss: 90,
    takeProfit1: 105,
    takeProfit2: 110,
    score: 80,
    origin: 'LIVE' as const
  };
  const events =
    kind === 'WIN'
      ? [
          { signalId: id, eventType: 'ENTRY' as const, price: 100, timestamp: 1000 },
          { signalId: id, eventType: 'TARGET2' as const, price: 110, timestamp: 2000 }
        ]
      : [
          { signalId: id, eventType: 'ENTRY' as const, price: 100, timestamp: 1000 },
          { signalId: id, eventType: 'EXPIRED' as const, price: 100, timestamp: 2000, metadata: { reason: 'TTL' } }
        ];
  const outcome = calculateSignalOutcomeR(signal, events);
  return {
    id,
    symbol: 'BTCUSDT',
    category: 'INTRADAY',
    direction: 'LONG',
    score: 80,
    scoreTier: '80-89',
    tradfiSession: 'REGULAR',
    origin: 'LIVE',
    netR: outcome.netR,
    mfeR: 1,
    maeR: -0.5,
    isWin: outcome.netR > 0,
    closedAt: 2000,
    outcomeType: outcome.outcomeType,
    expiredReason: kind === 'EXPIRED' ? 'TTL' : undefined
  };
}

describe('6.2.5 / CA-2.5 — denominador completo', () => {
  it('10 alvos + 10 expirados a preço de entrada ⇒ win rate 50%, nunca 100%', () => {
    const signals: ClosedSignalEvidence[] = [];
    for (let i = 0; i < 10; i++) signals.push(buildEvidence(`win-${i}`, 'WIN'));
    for (let i = 0; i < 10; i++) signals.push(buildEvidence(`exp-${i}`, 'EXPIRED'));

    const summary = generateEvidenceSummary(signals, { origin: 'ALL' });

    expect(summary.totalSignals).toBe(20);
    expect(summary.winRate).toBeCloseTo(50, 2);
    expect(summary.winRate).toBeLessThan(100);

    // Contagem de expirados e quebra por motivo.
    expect(summary.expiredCount).toBe(10);
    expect(summary.expiredShare).toBeCloseTo(0.5, 4);
    expect(summary.expiredByReason['TTL']).toBe(10);
  });

  it('expirado a preço de entrada é perda líquida (custos), não vitória', () => {
    const s = buildEvidence('exp-single', 'EXPIRED');
    expect(s.outcomeType).toBe('EXPIRED');
    expect(s.isWin).toBe(false);
    expect(s.netR).toBeLessThan(0);
  });
});

describe('6.2.6 / CA-2.6 — contexto de reprodutibilidade no ledger', () => {
  it('toda linha nova gravada com contexto tem engineVersion, weightsHash e strategy_profile', async () => {
    const db = await getDb();
    await saveSignalAndLedger(
      {
        id: 'ctx-1',
        symbol: 'BTCUSDT',
        marketType: 'crypto_futures',
        signalType: 'LONG',
        direction: 'LONG',
        strategyCategory: 'INTRADAY',
        entryZone: [99, 101],
        currentPrice: 100,
        stopLoss: 90,
        target1: 105,
        target2: 110,
        riskRewardRatio: 2.0,
        confluenceScore: 80,
        confluenceFactors: [],
        timeframe: '15m',
        validationStatus: 'CONFIRMED',
        validationStage: 'VALIDADO',
        candle1mConfirmed: true,
        candle5mConfirmed: true,
        createdAt: 1000,
        status: 'ACTIVE'
      } as any,
      {
        tradfiCategory: 'CRYPTO',
        engineVersion: 'commit-abc1234',
        weightsHash: 'weights-deadbeef',
        strategyProfile: 'multi-strategy-v1'
      }
    );

    const row = db.exec(
      `SELECT engine_version, weights_hash, strategy_profile FROM signal_ledger WHERE id = 'ctx-1'`
    )[0].values[0];
    expect(String(row[0])).toBe('commit-abc1234');
    expect(String(row[1])).toBe('weights-deadbeef');
    expect(String(row[2])).toBe('multi-strategy-v1');
  });
});
