/**
 * 6.2.4 / CA-2.4 — Reconciliação: `reconcileLedgerWithSignals()` roda no boot.
 * Para todo sinal em `trade_signals` com estado terminal (alvo, stop, expirado)
 * sem evento terminal correspondente no ledger, cria o evento retroativo com
 * `reconciled = true`. Cobre o histórico anterior à correção. Rodar duas vezes
 * NÃO duplica eventos.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  reconcileLedgerWithSignals,
  signalLedgerDao
} from '../server/db.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-reconcile-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

function insertLegacySignal(
  db: any,
  id: string,
  status: string,
  expirationReason: string | null
): void {
  // Linha "antiga": criada antes da correção, sem correspondência no ledger.
  db.run(
    `INSERT INTO trade_signals (
      id, symbol, market_type, signal_type, direction, entry_min, entry_max,
      current_price, stop_loss, target1, target2, risk_reward, confluence_score,
      confluence_factors, timeframe, validation_status, validation_stage,
      candle_1m_confirmed, candle_5m_confirmed, ai_review, ai_confidence,
      created_at, status, strategy_category, origin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, 'BTCUSDT', 'crypto_futures', 'LONG', 'LONG', 99, 101, 100, 90, 105, 110, 2.0, 80,
      '[]', '15m', 'CONFIRMED', 'VALIDADO', 1, 1, '', 0,
      1000, status, 'INTRADAY', 'LIVE'
    ]
  );
  if (expirationReason) {
    db.run(`UPDATE trade_signals SET expiration_reason = ? WHERE id = ?`, [expirationReason, id]);
  }
}

describe('6.2.4 / CA-2.4 — reconcileLedgerWithSignals', () => {
  it('sinais terminais sem evento no ledger ganham evento retroativo reconciled', async () => {
    const db = await getDb();
    insertLegacySignal(db, 'rec-target', 'TARGET_REACHED', 'Alvo 2');
    insertLegacySignal(db, 'rec-stop', 'STOPPED_OUT', 'Stop Loss');
    insertLegacySignal(db, 'rec-expired', 'EXPIRED', 'TTL Expirado (Tempo Limite Atingido)');
    // Sinal ativo não deve receber evento terminal.
    insertLegacySignal(db, 'rec-active', 'ACTIVE', null);

    const summary = await reconcileLedgerWithSignals();
    expect(summary.created).toBeGreaterThanOrEqual(3);

    const dbEvents = async (id: string) =>
      (await signalLedgerDao.getRawEvents(id)).map(e => ({ type: e.eventType, reconciled: e.metadata?.reconciled }));

    expect(await dbEvents('rec-target')).toContainEqual({ type: 'TARGET2', reconciled: true });
    expect(await dbEvents('rec-stop')).toContainEqual({ type: 'STOP', reconciled: true });
    expect(await dbEvents('rec-expired')).toContainEqual({ type: 'EXPIRED', reconciled: true });

    const activeEvents = (await dbEvents('rec-active')).filter(e => ['TARGET2', 'STOP', 'EXPIRED'].includes(e.type));
    expect(activeEvents.length).toBe(0);
  });

  it('rodar duas vezes não duplica eventos (idempotente)', async () => {
    const first = await reconcileLedgerWithSignals();
    const second = await reconcileLedgerWithSignals();

    expect(second.created).toBe(0);

    const ev = (await signalLedgerDao.getRawEvents('rec-target')).filter(e => e.eventType === 'TARGET2');
    expect(ev.length).toBe(1);

    expect(first.created).toBeGreaterThanOrEqual(0);
  });
});
