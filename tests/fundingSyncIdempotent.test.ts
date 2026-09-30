/**
 * 6.3.1 / CA-3.1 — Idempotência: rodar a sincronização duas vezes para a mesma
 * janela NÃO duplica registros em `historical_funding` (chave única
 * `symbol + funding_time`, upsert). 6.3.2 — `rateType` da resposta real é
 * persistido por registro (fixture real traz "Regular").
 *
 * Usa banco temporário real (setDatabaseFilePathForTests) e o DAO real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { setDatabaseFilePathForTests, setDbForTesting, getDb } from '../server/db.js';
import { historicalFundingDao } from '../server/backtest_db/index.js';
import { syncFundingForSymbol, type FundingSyncDeps } from '../server/services/FundingSyncService.js';

let dir: string;

const HOUR8 = 8 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function makeRows(count: number): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      symbol: 'ETHUSDT',
      fundingTime: T0 + i * HOUR8,
      fundingRate: '0.00012000',
      markPrice: '3000.00000000',
      rateType: 'Regular'
    });
  }
  return rows;
}

function makeDeps(allRows: Array<Record<string, any>>): FundingSyncDeps {
  return {
    fetchPage: async params => ({
      rows: allRows.filter(r => r.fundingTime > params.startTime).slice(0, params.limit)
    }),
    insertBatch: async rows => {
      await historicalFundingDao.insertBatch(
        rows.map(r => ({
          symbol: r.symbol,
          fundingTime: r.fundingTime,
          fundingRate: Number(r.fundingRate),
          markPrice: r.markPrice != null ? Number(r.markPrice) : null,
          rateType: r.rateType
        }))
      );
    },
    maxPagesPerMinute: 100,
    now: () => 1_000_000,
    log: () => {}
  };
}

async function countRows(): Promise<number> {
  const db = await getDb();
  const res = db.exec(`SELECT count(*) FROM historical_funding WHERE symbol = 'ETHUSDT'`);
  return Number(res[0].values[0][0]);
}

describe('6.3.1 / CA-3.1 — sincronização idempotente com banco real', () => {
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'msb-funding-sync-'));
    setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
    await getDb();
  });

  afterAll(() => {
    setDbForTesting(null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('2ª execução na mesma janela não duplica registros', async () => {
    const rows = makeRows(120);
    const deps = makeDeps(rows);
    const window = { startTime: T0 - 1, endTime: T0 + 120 * HOUR8 };

    const first = await syncFundingForSymbol('ETHUSDT', window, deps);
    expect(first.status).toBe('COMPLETE');
    expect(await countRows()).toBe(120);

    const second = await syncFundingForSymbol('ETHUSDT', window, deps);
    expect(second.status).toBe('COMPLETE');
    expect(await countRows()).toBe(120); // ← idempotência
  });

  it('6.3.2: rateType real ("Regular") é persistido por registro', async () => {
    // Símbolo próprio para isolar do teste anterior (mesmo banco temporário).
    const rows = makeRows(3).map(r => ({ ...r, symbol: 'XRPUSDT' }));
    const deps = makeDeps(rows);
    await syncFundingForSymbol('XRPUSDT', { startTime: T0 - 1, endTime: T0 + 3 * HOUR8 }, deps);

    const stored = await historicalFundingDao.getBySymbolAndRange('XRPUSDT', T0 - 1, T0 + 3 * HOUR8);
    expect(stored.length).toBe(3);
    for (const row of stored) {
      expect(row.rateType).toBe('Regular');
      expect(row.fundingRate).toBeCloseTo(0.00012, 8);
    }
  });
});
