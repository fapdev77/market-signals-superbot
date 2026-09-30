/**
 * 6.7.3 — Integração do ciclo PENDING_ENTRY na camada de persistência:
 *  - CA-7.2: sinal cujo preço nunca toca a zona expira ENTRY_NOT_FILLED e NÃO entra
 *    no cálculo de R do ledger (não aparece no denominador da evidência).
 *  - Sinal PENDING_ENTRY na emissão NÃO grava evento ENTRY (com withEntryEvent: false).
 *  - ACTIVATED grava ENTRY no fill real e o updateLedgerEntryPrice alinha o R ao fill.
 *  - TTL de pendente: expira com razão própria e metadata ENTRY_NOT_FILLED.
 *  - Sinais pré-6.7 (com ENTRY na emissão) continuam no denominador (comportamento preservado).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  expireStaleSignals,
  updateSignalStatus,
  signalLedgerDao
} from '../server/db.js';
import type { TradeSignal } from '../src/types.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-pending-6-7-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

function makeSignal(id: string, overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    id,
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
    validationStatus: 'PENDING_VALIDATION',
    validationStage: 'EM VALIDAÇÃO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: 1_000,
    status: 'PENDING_ENTRY',
    ...overrides
  } as TradeSignal;
}

describe('6.7.3 — ciclo PENDING_ENTRY no ledger', () => {
  it('emissão de pendente NÃO grava ENTRY (withEntryEvent: false)', async () => {
    await saveSignalAndLedger(makeSignal('pend-no-entry-1'), { withEntryEvent: false });

    const db = await getDb();
    const ev = db.exec(`SELECT count(*) FROM signal_events WHERE signal_id = 'pend-no-entry-1' AND event_type = 'ENTRY'`);
    expect(Number(ev[0].values[0][0])).toBe(0);
  });

  it('CA-7.2: pendente sem ENTRY nunca preenchido NÃO entra na evidência de R (não-evento)', async () => {
    // Sinal pré-6.7 (padrão antigo, ENTRY na emissão) — deve APARECER na evidência.
    await saveSignalAndLedger(makeSignal('pend-legacy-1', { status: 'ACTIVE' }));
    // Pendente pós-6.7 sem ENTRY — NÃO deve aparecer.
    await saveSignalAndLedger(makeSignal('pend-not-filled-1'), { withEntryEvent: false });

    await updateSignalStatus('pend-legacy-1', 'EXPIRED', 'TTL Expirado');
    await updateSignalStatus('pend-not-filled-1', 'EXPIRED', 'Sem preenchimento em 3 candles 1m');
    await signalLedgerDao.recordEvent({ signalId: 'pend-legacy-1', eventType: 'EXPIRED', price: 100, timestamp: 2_000 });
    await signalLedgerDao.recordEvent({
      signalId: 'pend-not-filled-1',
      eventType: 'EXPIRED',
      price: 100,
      timestamp: 2_000,
      metadata: { reason: 'ENTRY_NOT_FILLED', reasonText: 'não-evento para o R' }
    });

    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    const ids = evidence.map(e => e.id);
    expect(ids).toContain('pend-legacy-1');
    expect(ids).not.toContain('pend-not-filled-1');
  });

  it('ACTIVATED: ENTRY no fill real é registrado e o R da evidência corre do fill (D3)', async () => {
    await saveSignalAndLedger(makeSignal('pend-fill-1'), { withEntryEvent: false });

    // Fill real (clamp do close 1m na zona) gravado pelo server.ts no preço do
    // evento ENTRY com fillSource (ledger append-only, sem UPDATE).
    await signalLedgerDao.recordEvent({
      signalId: 'pend-fill-1',
      eventType: 'ENTRY',
      price: 100.5,
      timestamp: 1_500,
      metadata: { fillSource: 'PENDING_ENTRY_ACTIVATED' }
    });
    // Terminal no alvo 2: com fill 100.5 e stop 90 (risco 10.5), gain até 110 = 0.9048 R
    await signalLedgerDao.recordEvent({ signalId: 'pend-fill-1', eventType: 'TARGET2', price: 110, timestamp: 3_000 });
    await updateSignalStatus('pend-fill-1', 'TARGET_REACHED', 'Alvo 2');

    const raw = await signalLedgerDao.getRawEvents('pend-fill-1');
    const entry = raw.find(e => e.eventType === 'ENTRY');
    expect(entry).toBeDefined();
    expect(entry!.price).toBe(100.5);

    // O R da evidência usa o fill (100.5) e não o entry_price da emissão (100)
    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    const mine = evidence.find(e => e.id === 'pend-fill-1');
    expect(mine).toBeDefined();
    // gain = 110 - 100.5 = 9.5; risco = 100.5 - 90 = 10.5; grossR ≈ 0.9048 (sem custos de funding)
    expect(mine!.netR).toBeGreaterThan(0.85);
    expect(mine!.netR).toBeLessThan(0.95);
  });

  it('TTL de pendente expira via expireStaleSignals com PENDING_ENTRY', async () => {
    const db = await getDb();
    const expiredAt = 500;
    db.run(
      `INSERT OR REPLACE INTO trade_signals (
        id, symbol, market_type, signal_type, direction, entry_min, entry_max,
        current_price, stop_loss, target1, target2, risk_reward, confluence_score,
        confluence_factors, timeframe, validation_status, validation_stage,
        candle_1m_confirmed, candle_5m_confirmed, ai_review, ai_confidence, created_at,
        status, strategy_category, expires_at, ttl_minutes, expiration_reason,
        is_breakeven_active, origin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pend-ttl-1', 'BTCUSDT', 'crypto_futures', 'LONG', 'LONG', 99, 101,
        100, 90, 105, 110, 2.0, 80, '[]', '15m', 'PENDING_VALIDATION', 'EM VALIDAÇÃO',
        1, 1, '', 0, 1_000,
        'PENDING_ENTRY', 'INTRADAY', expiredAt, 10, null,
        0, 'LIVE'
      ]
    );

    const changed = await expireStaleSignals(1_000);
    expect(changed).toBeGreaterThanOrEqual(1);

    const status = db.exec(`SELECT status, expiration_reason FROM trade_signals WHERE id = 'pend-ttl-1'`);
    expect(String(status[0].values[0][0])).toBe('EXPIRED');
    expect(String(status[0].values[0][1])).toContain('TTL');

    // EXPIRED do pendente carrega a razão ENTRY_NOT_FILLED no metadata
    const events = await signalLedgerDao.getRawEvents('pend-ttl-1');
    const expiredEvent = events.find(e => e.eventType === 'EXPIRED');
    expect(expiredEvent).toBeDefined();
    expect(expiredEvent!.metadata?.reason).toBe('ENTRY_NOT_FILLED');
  });
});
