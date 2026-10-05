import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  historicalKlinesDao,
  backtestResultsDao,
  __setBacktestDbFilePathForTests,
  type HistoricalKlineRow,
  type BacktestResultRow
} from '../server/backtest_db/index.js';
import { getDb } from '../server/db.js';

/**
 * R-14 — Driver SQLite unificado.
 *
 * Antes: historical_klines/backtest_results viviam em data/backtest.db via
 * drizzle-orm + @libsql/client, enquanto todo o resto vivia em
 * data/superbot.sqlite via sql.js. Agora tudo vive no MESMO banco sql.js,
 * acessado por esta DAO — sem segunda biblioteca, sem segundo arquivo.
 */

const TEST_DB_PATH = path.join(process.cwd(), 'data', `superbot.test.${Date.now()}.sqlite`);
const UNIQUE = Date.now();

const makeKline = (openTime: number, close = 100): HistoricalKlineRow => ({
  symbol: `TEST${UNIQUE}USDT`,
  interval: '1m',
  openTime,
  closeTime: openTime + 59_999,
  open: close,
  high: close * 1.01,
  low: close * 0.99,
  close,
  volume: 10,
  quoteAssetVolume: close * 10,
  trades: 50,
  takerBuyBaseVolume: 5,
  takerBuyQuoteVolume: close * 5
});

beforeAll(async () => {
  __setBacktestDbFilePathForTests(TEST_DB_PATH);
  await getDb(); // initialises the unified database + migrations
});

afterAll(() => {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // best effort cleanup
  }
});

describe('R-14 unified backtest DAO', () => {
  it('inserts klines with conflict-ignore on (symbol, interval, open_time) and reads them back ordered', async () => {
    const symbol = `TEST${UNIQUE}USDT`;
    const k1 = makeKline(1_000_000);
    const k2 = makeKline(1_060_000, 101);

    await historicalKlinesDao.insertMany([k1, k2]);
    // duplicate: must be ignored, not duplicated
    await historicalKlinesDao.insertMany([k1]);

    const all = await historicalKlinesDao.getBySymbolAndRange(symbol, '1m', 0, 2_000_000);
    expect(all.length).toBe(2);
    expect(all[0].openTime).toBe(1_000_000);
    expect(all[1].openTime).toBe(1_060_000);
    expect(all[1].close).toBe(101);
  });

  it('stats() reports count and min/max open_time per symbol', async () => {
    const symbol = `TEST${UNIQUE}USDT`;
    const stats = await historicalKlinesDao.stats(symbol);
    expect(stats.count).toBe(2);
    expect(stats.minTime).toBe(1_000_000);
    expect(stats.maxTime).toBe(1_060_000);
  });

  it('getLatestOpenTime() returns the newest 1m open_time and null when empty', async () => {
    const symbol = `TEST${UNIQUE}USDT`;
    expect(await historicalKlinesDao.getLatestOpenTime(symbol, '1m')).toBe(1_060_000);
    expect(await historicalKlinesDao.getLatestOpenTime(`NOPE${UNIQUE}`, '1m')).toBeNull();
  });

  it('deleteBySymbol() removes only that symbol rows', async () => {
    const other: HistoricalKlineRow = { ...makeKline(5_000_000), symbol: `OTHER${UNIQUE}` };
    await historicalKlinesDao.insertMany([other]);
    await historicalKlinesDao.deleteBySymbol(`TEST${UNIQUE}USDT`);

    expect((await historicalKlinesDao.stats(`TEST${UNIQUE}USDT`)).count).toBe(0);
    expect((await historicalKlinesDao.stats(`OTHER${UNIQUE}`)).count).toBe(1);
  });

  it('persists and retrieves a backtest result by (symbol, strategyId), newest first', async () => {
    const symbol = `BT${UNIQUE}USDT`;
    const strategyId = `strat-${UNIQUE}`;

    const row: BacktestResultRow = {
      id: `id-a-${UNIQUE}`,
      symbol,
      strategyId,
      startTime: 1,
      endTime: 2,
      totalTrades: 10,
      winRate: 55.5,
      profitFactor: 1.7,
      maxDrawdown: 6.2,
      netProfit: 12.4,
      config: JSON.stringify({ profile: 'daytrade', trades: [{ pnl: 1 }] }),
      createdAt: 1_000
    };
    const newer: BacktestResultRow = { ...row, id: `id-b-${UNIQUE}`, winRate: 60, createdAt: 2_000 };

    await backtestResultsDao.insert(row);
    await backtestResultsDao.insert(newer);

    const fetched = await backtestResultsDao.getLatest(symbol, strategyId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(newer.id);
    expect(fetched!.winRate).toBe(60);
    expect(fetched!.symbol).toBe(symbol);
    expect(fetched!.strategyId).toBe(strategyId);
  });

  it('getLatest() returns null for unknown symbol/strategy', async () => {
    const fetched = await backtestResultsDao.getLatest(`UNKNOWN${UNIQUE}`, 'no-strategy');
    expect(fetched).toBeNull();
  });

  it('writes to the SAME database file as the main app (single sqlite file)', async () => {
    const db = await getDb();
    // Both tables exist in the unified database
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.values).flat().map(r => String(r[0]));
    expect(tables).toContain('historical_klines');
    expect(tables).toContain('backtest_results');
    expect(tables).toContain('trade_signals');
    expect(tables).toContain('schema_migrations');
  });
});

/**
 * M8 — um backtest sem nenhuma posição perdedora não tem profit factor.
 *
 * A coluna era `REAL NOT NULL`, então o motor só podia gravar 0 ou a constante
 * 9.9. A migration 013 tira o NOT NULL; este teste fecha o contrato nas duas
 * pontas: a coluna aceita `null` e o DAO não a transforma de volta em 0 no
 * caminho de leitura — que é onde o zero silencioso nasceria.
 */
describe('M8 — profit_factor nullável sobrevive à persistência', () => {
  const symbol = `PFNULL${UNIQUE}USDT`;
  const strategyId = 'pf-null-strategy';

  afterAll(async () => {
    const db = await getDb();
    db.run('DELETE FROM backtest_results WHERE symbol = ?', [symbol]);
  });

  const baseRow = (id: string, profitFactor: number | null, createdAt: number): BacktestResultRow => ({
    id: `${id}-${UNIQUE}`,
    symbol,
    strategyId,
    startTime: 1_000,
    endTime: 2_000,
    totalTrades: 7,
    winRate: 100,
    profitFactor,
    maxDrawdown: 3,
    netProfit: 4.2,
    config: '{}',
    createdAt
  });

  it('grava e lê null sem virar 0', async () => {
    await backtestResultsDao.insert(baseRow('pf-null', null, 3_000));
    const fetched = await backtestResultsDao.getLatest(symbol, strategyId);
    expect(fetched).not.toBeNull();
    expect(fetched!.profitFactor).toBeNull();
  });

  it('preserva um profit factor medido', async () => {
    await backtestResultsDao.insert(baseRow('pf-set', 2.4, 4_000));
    const fetched = await backtestResultsDao.getLatest(symbol, strategyId);
    expect(fetched!.profitFactor).toBeCloseTo(2.4, 6);
  });

  it('listRecent distingue o ausente do medido', async () => {
    const rows = await backtestResultsDao.listRecent(10, symbol);
    const byId = new Map(rows.map(r => [r.id, r.profitFactor]));
    expect(byId.get(`pf-null-${UNIQUE}`)).toBeNull();
    expect(byId.get(`pf-set-${UNIQUE}`)).toBeCloseTo(2.4, 6);
  });

  it('a coluna realmente aceita NULL (a constraint foi removida)', async () => {
    const db = await getDb();
    const ddl = db
      .exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='backtest_results'")[0]
      .values[0][0] as string;
    expect(ddl).toMatch(/profit_factor\s+REAL\s*[,\n)]/);
    expect(ddl).not.toMatch(/profit_factor[^,)]*\bNOT\s+NULL\b/i);
  });
});
