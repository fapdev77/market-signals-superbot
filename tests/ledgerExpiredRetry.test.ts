/**
 * 7.3.1 / CA-3.1 — a gravação de EXPIRED usa a mesma rotina de 3 tentativas +
 * backoff dos demais eventos. Falha persistente produz EXATAMENTE UM alerta
 * (`operational.ledger_write_failed`, deduplicado) e deixa o sinal para a
 * reconciliação, que cria o evento retroativo.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  expireStaleSignals,
  setLedgerExpiryWriteForTests,
  setLedgerAlertServiceForTests,
  resetLedgerAlertServiceForTests,
  reconcileLedgerWithSignals,
  getLedgerInvariantViolations,
  signalLedgerDao
} from '../server/db.js';
import { AlertService, type AlertSink, type AlertPayload } from '../server/services/AlertService.js';
import type { TradeSignal } from '../src/types.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-retry-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setLedgerExpiryWriteForTests(null);
  resetLedgerAlertServiceForTests();
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  setLedgerExpiryWriteForTests(null);
  resetLedgerAlertServiceForTests();
});

function makeSignal(id: string): TradeSignal {
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
    confluenceFactors: ['volumeSurge'],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: 1000,
    expiresAt: 2000,
    ttlMinutes: 15,
    status: 'ACTIVE'
  } as TradeSignal;
}

class CountingSink implements AlertSink {
  name = 'counter';
  payloads: AlertPayload[] = [];
  async send(payload: AlertPayload): Promise<boolean> {
    this.payloads.push(payload);
    return true;
  }
}

describe('7.3.1 / CA-3.1 — retry do EXPIRED e alerta único', () => {
  it('falha persistente: 3 tentativas, 1 alerta LEDGER_WRITE_FAILED e evento retroativo na reconciliação', async () => {
    const db = await getDb();
    await saveSignalAndLedger(makeSignal('retry-1'));

    let writeCalls = 0;
    setLedgerExpiryWriteForTests(() => {
      writeCalls++;
      throw new Error('disco cheio (simulado)');
    });

    const sink = new CountingSink();
    setLedgerAlertServiceForTests(new AlertService({ sinks: [sink] }));

    const swept = await expireStaleSignals(3000);
    expect(swept).toBeGreaterThanOrEqual(1);

    // 3 tentativas para o único evento EXPIRED.
    expect(writeCalls).toBe(3);

    // Exatamente um alerta de falha de escrita (dedup por chave na janela).
    const writeAlerts = sink.payloads.filter(p => p.key === 'operational.ledger_write_failed');
    expect(writeAlerts).toHaveLength(1);

    // O sinal ficou EXPIRED e o evento foi recuperado pela reconciliação pós-sweep.
    const statusRes = db.exec(`SELECT status FROM trade_signals WHERE id = 'retry-1'`);
    expect(String(statusRes[0].values[0][0])).toBe('EXPIRED');

    const events = await signalLedgerDao.getRawEvents('retry-1');
    const expired = events.filter(e => e.eventType === 'EXPIRED');
    expect(expired).toHaveLength(1);
    expect(expired[0].metadata?.reconciled).toBe(true);

    // Invariantes voltam a zero após a reconciliação.
    const violations = await getLedgerInvariantViolations();
    expect(violations.terminalSignalsMissingEvent).toBe(0);
    expect(violations.total).toBe(0);

    // Segunda reconciliação não duplica.
    const second = await reconcileLedgerWithSignals();
    expect(second.created).toBe(0);
  });

  it('gravação bem-sucedida: sem alerta e evento gravado na 1ª tentativa', async () => {
    const db = await getDb();
    await saveSignalAndLedger(makeSignal('retry-ok'));

    let writeCalls = 0;
    setLedgerExpiryWriteForTests(event => {
      writeCalls++;
      db.run(
        `INSERT INTO signal_events (signal_id, event_type, price, timestamp, metadata) VALUES (?, ?, ?, ?, ?)`,
        [event.signalId, event.eventType, event.price, event.timestamp, JSON.stringify(event.metadata ?? {})]
      );
    });

    const sink = new CountingSink();
    setLedgerAlertServiceForTests(new AlertService({ sinks: [sink] }));

    await expireStaleSignals(3000);

    expect(writeCalls).toBe(1);
    expect(sink.payloads).toHaveLength(0);

    const events = await signalLedgerDao.getRawEvents('retry-ok');
    expect(events.filter(e => e.eventType === 'EXPIRED')).toHaveLength(1);
  });
});
