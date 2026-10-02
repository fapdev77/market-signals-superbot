/**
 * 7.3.3 / CA-3.3 — invariantes do ledger: sinais terminais sem evento terminal
 * (corrigidos pela reconciliação) e eventos órfãos (sem sinal). A reconciliação é
 * idempotente: rodar duas vezes não duplica eventos.
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
  getLedgerInvariantViolations,
  signalLedgerDao
} from '../server/db.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-invariants-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

function insertTerminalSignal(db: any, id: string, status: string): void {
  db.run(
    `INSERT INTO trade_signals (
      id, symbol, market_type, signal_type, direction, entry_min, entry_max,
      current_price, stop_loss, target1, target2, risk_reward, confluence_score,
      confluence_factors, timeframe, validation_status, validation_stage,
      candle_1m_confirmed, candle_5m_confirmed, ai_review, ai_confidence,
      created_at, status, strategy_category, origin, expiration_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, 'BTCUSDT', 'crypto_futures', 'LONG', 'LONG', 99, 101, 100, 90, 105, 110, 2.0, 80,
      '[]', '15m', 'CONFIRMED', 'VALIDADO', 1, 1, '', 0,
      1000, status, 'INTRADAY', 'LIVE', 'TTL Expirado (Tempo Limite Atingido)'
    ]
  );
}

describe('7.3.3 / CA-3.3 — invariantes do ledger', () => {
  it('conta terminais sem evento + eventos órfãos; reconciliação zera os terminais', async () => {
    const db = await getDb();
    insertTerminalSignal(db, 'inv-exp', 'EXPIRED');
    insertTerminalSignal(db, 'inv-stop', 'STOPPED_OUT');
    // Evento órfão: signal_id inexistente em trade_signals.
    db.run(
      `INSERT INTO signal_events (signal_id, event_type, price, timestamp, metadata) VALUES (?, ?, ?, ?, ?)`,
      ['ghost-signal', 'STOP', 100, 1000, null]
    );

    const before = await getLedgerInvariantViolations();
    expect(before.terminalSignalsMissingEvent).toBe(2);
    expect(before.orphanEvents).toBe(1);
    expect(before.total).toBe(3);

    const summary = await reconcileLedgerWithSignals();
    expect(summary.created).toBe(2);

    const after = await getLedgerInvariantViolations();
    expect(after.terminalSignalsMissingEvent).toBe(0);
    // O evento órfão não é resolvido pela reconciliação (não há sinal para casar).
    expect(after.orphanEvents).toBe(1);
    expect(after.total).toBe(1);
  });

  it('rodar a reconciliação duas vezes não duplica eventos', async () => {
    const first = await reconcileLedgerWithSignals();
    const second = await reconcileLedgerWithSignals();
    expect(second.created).toBe(0);
    expect(first.created).toBe(0);

    const expEvents = (await signalLedgerDao.getRawEvents('inv-exp')).filter(e => e.eventType === 'EXPIRED');
    expect(expEvents).toHaveLength(1);

    const stopEvents = (await signalLedgerDao.getRawEvents('inv-stop')).filter(e => e.eventType === 'STOP');
    expect(stopEvents).toHaveLength(1);
  });
});
