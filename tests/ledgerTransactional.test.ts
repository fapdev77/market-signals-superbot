/**
 * 6.2.3 / CA-2.3 — Escrita confiável:
 * - O registro do sinal no ledger ocorre na MESMA transação do saveSignal.
 * - Fail-closed: se o ledger não puder ser gravado, o sinal NÃO é emitido
 *   (saveSignalAndLedger falha como um todo), exatamente 1 alerta é disparado
 *   e o símbolo é marcado como degradado.
 * - Eventos posteriores são aguardados, com até 3 tentativas com backoff.
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
  recordEventWithRetry,
  markSymbolDegraded,
  isSymbolDegraded
} from '../server/db.js';
import { AlertService } from '../server/services/AlertService.js';
import { resetLedgerAlertServiceForTests, setLedgerAlertServiceForTests } from '../server/db.js';
import type { TradeSignal } from '../src/types.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-tx-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  resetLedgerAlertServiceForTests();
  rmSync(dir, { recursive: true, force: true });
});

function makeSignal(id: string): TradeSignal {
  return {
    id,
    symbol: 'ETHUSDT',
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
  } as TradeSignal;
}

describe('6.2.3 / CA-2.3 — escrita transacional fail-closed', () => {
  it('sucesso: saveSignal + ledger + ENTRY na mesma operação (ambos persistidos ou nada)', async () => {
    await saveSignalAndLedger(makeSignal('tx-ok-1'), { tradfiCategory: 'CRYPTO' });

    const db = await getDb();
    const sig = db.exec(`SELECT count(*) FROM trade_signals WHERE id = 'tx-ok-1'`);
    const led = db.exec(`SELECT count(*) FROM signal_ledger WHERE id = 'tx-ok-1'`);
    const ev = db.exec(`SELECT count(*) FROM signal_events WHERE signal_id = 'tx-ok-1' AND event_type = 'ENTRY'`);
    expect(Number(sig[0].values[0][0])).toBe(1);
    expect(Number(led[0].values[0][0])).toBe(1);
    expect(Number(ev[0].values[0][0])).toBe(1);
  });

  it('falha do ledger: sinal não é gravado, exatamente 1 alerta, símbolo degradado', async () => {
    let alerts = 0;
    const alertService = new AlertService({ dedupWindowMs: 0 });
    const originalEmit = alertService.emitAlert.bind(alertService);
    alertService.emitAlert = async (...args: any[]) => {
      alerts++;
      return (originalEmit as any)(...args);
    };
    setLedgerAlertServiceForTests(alertService);

    const broken = makeSignal('tx-fail-1');
    // ledgerWriteHook quebrado simula ledger indisponível.
    const { setLedgerWriteHookForTests } = await import('../server/db.js');
    setLedgerWriteHookForTests(() => {
      throw new Error('ledger unavailable (simulated)');
    });

    await expect(saveSignalAndLedger(broken, { tradfiCategory: 'CRYPTO' })).rejects.toThrow();

    const db = await getDb();
    const sig = db.exec(`SELECT count(*) FROM trade_signals WHERE id = 'tx-fail-1'`);
    const led = db.exec(`SELECT count(*) FROM signal_ledger WHERE id = 'tx-fail-1'`);
    expect(Number(sig[0].values[0][0])).toBe(0);
    expect(Number(led[0].values[0][0])).toBe(0);

    expect(alerts).toBe(1);
    expect(isSymbolDegraded('ETHUSDT')).toBe(true);

    setLedgerWriteHookForTests(null);
    resetLedgerAlertServiceForTests();
  });

  it('markSymbolDegraded é idempotente e consultável', () => {
    markSymbolDegraded('SOLUSDT');
    markSymbolDegraded('SOLUSDT');
    expect(isSymbolDegraded('SOLUSDT')).toBe(true);
    expect(isSymbolDegraded('OUTROS')).toBe(false);
  });

  it('recordEventWithRetry: tenta até 3 vezes com backoff e grava na 2ª tentativa', async () => {
    let attempts = 0;
    await recordEventWithRetry(
      { signalId: 'tx-retry-1', eventType: 'PARTIAL', price: 103, timestamp: 1000 },
      {
        maxAttempts: 3,
        backoffMs: 1,
        writeFn: async () => {
          attempts++;
          if (attempts === 1) throw new Error('transient failure');
        }
      }
    );
    expect(attempts).toBe(2);
  });

  it('recordEventWithRetry: falha persistente lança após esgotar as tentativas', async () => {
    let attempts = 0;
    await expect(
      recordEventWithRetry(
        { signalId: 'tx-retry-2', eventType: 'TARGET2', price: 110, timestamp: 1000 },
        {
          maxAttempts: 3,
          backoffMs: 1,
          writeFn: async () => {
            attempts++;
            throw new Error('persistent failure');
          }
        }
      )
    ).rejects.toThrow('persistent failure');
    expect(attempts).toBe(3);
  });

  it('recordEventWithRetry: caminho real grava o evento no banco', async () => {
    await saveSignalAndLedger(makeSignal('tx-real-1'), { tradfiCategory: 'CRYPTO' });
    await recordEventWithRetry({ signalId: 'tx-real-1', eventType: 'TARGET2', price: 110, timestamp: 2000 });

    const db = await getDb();
    const ev = db.exec(`SELECT count(*) FROM signal_events WHERE signal_id = 'tx-real-1' AND event_type = 'TARGET2'`);
    expect(Number(ev[0].values[0][0])).toBe(1);
  });
});
