import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Store the database file in the data folder
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'backtest.db');

export const client = createClient({
  url: `file:${dbPath}`
});

export const db = drizzle(client, { schema });

export async function initDb() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS historical_klines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        close_time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        quote_asset_volume REAL NOT NULL,
        trades INTEGER NOT NULL,
        taker_buy_base_volume REAL NOT NULL,
        taker_buy_quote_volume REAL NOT NULL,
        CONSTRAINT symbol_interval_open_time_unique UNIQUE (symbol, interval, open_time)
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        total_trades INTEGER NOT NULL,
        win_rate REAL NOT NULL,
        profit_factor REAL NOT NULL,
        max_drawdown REAL NOT NULL,
        net_profit REAL NOT NULL,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  } catch (err) {
    console.error('Failed to initialize backtest tables in SQLite:', err);
  }
}

// Guarantee schema initialization
initDb();
