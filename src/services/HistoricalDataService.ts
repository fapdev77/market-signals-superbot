import { db } from '../db';
import { historicalKlines } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface SyncProgress {
  symbol: string;
  progress: number; // 0 to 100
  status: 'IDLE' | 'SYNCING' | 'DONE' | 'ERROR';
  error?: string;
}

const syncStates: Record<string, SyncProgress> = {};

export class HistoricalDataService {
  static getSyncState(symbol: string): SyncProgress {
    return syncStates[symbol] || { symbol, progress: 0, status: 'IDLE' };
  }

  static async syncSymbol(symbol: string, days: number = 30): Promise<void> {
    if (syncStates[symbol]?.status === 'SYNCING') return;

    syncStates[symbol] = { symbol, progress: 0, status: 'SYNCING' };

    try {
      const now = Date.now();
      const startTime = now - days * 24 * 60 * 60 * 1000;
      let fetchTime = startTime;

      // Check if we have recent data and start from there if we do
      const latestKlines = await db
        .select({ openTime: historicalKlines.openTime })
        .from(historicalKlines)
        .where(
          and(
            eq(historicalKlines.symbol, symbol),
            eq(historicalKlines.interval, '1m')
          )
        )
        .orderBy(desc(historicalKlines.openTime))
        .limit(1);

      if (latestKlines.length > 0 && latestKlines[0].openTime > startTime) {
        fetchTime = latestKlines[0].openTime + 60000; // Start from next minute
      }

      const totalTimeSpan = now - fetchTime;
      if (totalTimeSpan <= 0) {
        syncStates[symbol] = { symbol, progress: 100, status: 'DONE' };
        return; // Already up to date
      }

      while (fetchTime < now) {
        const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1m&limit=1000&startTime=${fetchTime}`;
        const res = await fetch(url);
        
        if (!res.ok) {
           if (res.status === 429) {
             // rate limit, wait
             await new Promise(r => setTimeout(r, 2000));
             continue;
           }
           throw new Error(`Binance API error: ${res.statusText}`);
        }

        const data = await res.json();
        
        if (!data || data.length === 0) {
          break;
        }

        const rowsToInsert = data.map((k: any) => ({
          symbol,
          interval: '1m',
          openTime: k[0],
          closeTime: k[6],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          quoteAssetVolume: parseFloat(k[7]),
          trades: k[8],
          takerBuyBaseVolume: parseFloat(k[9]),
          takerBuyQuoteVolume: parseFloat(k[10]),
        }));

        // Insert in batches using SQLite upsert behavior (ON CONFLICT DO NOTHING)
        // Drizzle SQLite has onConflictDoNothing
        await db.insert(historicalKlines).values(rowsToInsert).onConflictDoNothing();

        fetchTime = data[data.length - 1][6] + 1; // Start from end of last candle
        
        const currentSpan = fetchTime - startTime;
        let progress = Math.floor((currentSpan / (now - startTime)) * 100);
        if (progress > 99) progress = 99;
        syncStates[symbol].progress = progress;
        
        // Wait a bit to not blast the API too much
        await new Promise(r => setTimeout(r, 100));
      }

      syncStates[symbol] = { symbol, progress: 100, status: 'DONE' };
    } catch (err: any) {
      console.error(`Sync error for ${symbol}:`, err);
      syncStates[symbol] = { symbol, progress: syncStates[symbol].progress, status: 'ERROR', error: err.message };
    }
  }
}
