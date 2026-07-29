import { sqliteTable, integer, real, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const historicalKlines = sqliteTable('historical_klines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull(),
  interval: text('interval').notNull(),
  openTime: integer('open_time').notNull(),
  closeTime: integer('close_time').notNull(),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  volume: real('volume').notNull(),
  quoteAssetVolume: real('quote_asset_volume').notNull(),
  trades: integer('trades').notNull(),
  takerBuyBaseVolume: real('taker_buy_base_volume').notNull(),
  takerBuyQuoteVolume: real('taker_buy_quote_volume').notNull(),
}, (t) => [
  unique('symbol_interval_open_time_unique').on(t.symbol, t.interval, t.openTime)
]);

export const backtestResults = sqliteTable('backtest_results', {
  id: text('id').primaryKey(), // UUID
  symbol: text('symbol').notNull(),
  strategyId: text('strategy_id').notNull(), // A hash or name describing the config
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  totalTrades: integer('total_trades').notNull(),
  winRate: real('win_rate').notNull(),
  profitFactor: real('profit_factor').notNull(),
  maxDrawdown: real('max_drawdown').notNull(),
  netProfit: real('net_profit').notNull(),
  config: text('config').notNull(), // JSON string of parameters used
  createdAt: integer('created_at').default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`).notNull(),
});
