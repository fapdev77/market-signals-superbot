/**
 * 7.3.2 / CA-3.2, CA-3.4 — reconciliação periódica corrige o sinal e zera os
 * invariantes; eventos retroativos disparam LEDGER_RECONCILED uma única vez por
 * janela de deduplicação.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  reconcileLedgerWithSignals,
  getLedgerInvariantViolations
} from '../server/db.js';
import { AlertService, type AlertSink, type AlertPayload } from '../server/services/AlertService.js';
import {
  setOperationalAlertServiceForTests,
  resetOperationalAlertsForTests
} from '../server/services/operationalAlerts.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-periodic-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  resetOperationalAlertsForTests();
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  resetOperationalAlertsForTests();
});

class CountingSink implements AlertSink {
  name = 'counter';
  payloads: AlertPayload[] = [];
  async send(payload: AlertPayload): Promise<boolean> {
    this.payloads.push(payload);
    return true;
  }
}

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

describe('7.3.2 / CA-3.2, CA-3.4 — reconciliação periódica', () => {
  it('corrige o sinal (cria evento retroativo) e zera os invariantes', async () => {
    const db = await getDb();
    insertTerminalSignal(db, 'periodic-1', 'EXPIRED');

    const before = await getLedgerInvariantViolations();
    expect(before.terminalSignalsMissingEvent).toBeGreaterThanOrEqual(1);

    const summary = await reconcileLedgerWithSignals();
    expect(summary.created).toBeGreaterThanOrEqual(1);

    const after = await getLedgerInvariantViolations();
    expect(after.terminalSignalsMissingEvent).toBe(0);
    expect(after.total).toBe(0);
  });

  it('CA-3.4 — LEDGER_RECONCILED é entregue uma única vez por janela', async () => {
    const db = await getDb();
    const sink = new CountingSink();
    setOperationalAlertServiceForTests(new AlertService({ sinks: [sink] }));

    insertTerminalSignal(db, 'reconciled-a', 'TARGET_REACHED');
    await reconcileLedgerWithSignals();

    const reconciled = sink.payloads.filter(p => p.key === 'operational.ledger_reconciled');
    expect(reconciled).toHaveLength(1);

    // Nova falha na MESMA janela: reconciliação cria evento, mas o alerta é deduplicado.
    insertTerminalSignal(db, 'reconciled-b', 'STOPPED_OUT');
    const second = await reconcileLedgerWithSignals();
    expect(second.created).toBeGreaterThanOrEqual(1);

    expect(sink.payloads.filter(p => p.key === 'operational.ledger_reconciled')).toHaveLength(1);
  });
});
