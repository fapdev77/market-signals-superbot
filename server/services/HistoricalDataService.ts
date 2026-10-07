import { historicalKlinesDao, type HistoricalKlineRow } from '../backtest_db/index.js';
import { getErrorMessage } from '../utils/errors.js';
import { requestJsonLimited } from '../utils/httpClient.js';
// A-06: parsing com proveniência compartilhado com o ingest de klines do live.
import { parseMeasuredNumber } from '../utils/klineParsing.js';
import { BinanceRateLimiter } from '../utils/binanceRateLimiter.js';
// R-2: a geração de candles fabricados foi movida para server/demo/.
import { generateSynthetic1mKlineRows } from '../demo/syntheticKlines.js';

export interface SyncProgress {
  symbol: string;
  progress: number; // 0 to 100
  status: 'IDLE' | 'SYNCING' | 'DONE' | 'ERROR';
  error?: string;
}

const syncStates: Record<string, SyncProgress> = {};

/**
 * A-06 (FASE 1) — converte uma kline crua da exchange em linha do histórico
 * preservando a PROVENIÊNCIA do taker volume.
 *
 * Antes: `parseFloat(k[9]) || parseFloat(k[5]) * 0.5` — campo ausente virava
 * "50% de compra taker" e o backtest decidia sobre CVD fabricado, enquanto o
 * live já marcava a ausência. A paridade live↔backtest (A-05) exige que os dois
 * lados apliquem a MESMA regra: a de `parseMeasuredNumber`, em um só lugar.
 *
 * `takerBuyVolumeAvailable: false` = valor gravado como 0 POR AUSÊNCIA.
 */
export function toHistoricalKlineRow(symbol: string, k: any): HistoricalKlineRow {
  const volume = parseMeasuredNumber(k[5]) ?? 0;
  const quoteAssetVolume = parseMeasuredNumber(k[7]) ?? 0;
  const takerBuyBaseVolume = parseMeasuredNumber(k[9]);
  const takerBuyQuoteVolume = parseMeasuredNumber(k[10]);

  return {
    symbol,
    interval: '1m',
    openTime: k[0],
    closeTime: k[6],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume,
    quoteAssetVolume,
    trades: parseInt(k[8]) || 100,
    takerBuyBaseVolume: takerBuyBaseVolume ?? 0,
    takerBuyQuoteVolume: takerBuyQuoteVolume ?? 0,
    takerBuyVolumeAvailable: takerBuyBaseVolume !== null
  };
}

export class HistoricalDataService {
  static getSyncState(symbol: string): SyncProgress {
    return syncStates[symbol] || { symbol, progress: 0, status: 'IDLE' };
  }

  static async getStats(symbol: string) {
    try {
      return await historicalKlinesDao.stats(symbol);
    } catch (err) {
      console.error('Error fetching stats:', err);
      return { count: 0, minTime: null, maxTime: null };
    }
  }

  static async syncSymbol(symbol: string, days: number = 30, forceFull: boolean = false): Promise<void> {
    if (syncStates[symbol]?.status === 'SYNCING') return;

    syncStates[symbol] = { symbol, progress: 0, status: 'SYNCING' };

    try {
      // R-5: the klines sync is the heaviest Binance consumer (1000 candles per
      // request, looping). It must refuse to run while the limiter is in
      // cooldown instead of hammering the API outside of weight control.
      BinanceRateLimiter.assertAllowed();
      if (forceFull) {
        await historicalKlinesDao.deleteBySymbol(symbol);
      }

      const now = Date.now();
      const startTime = now - days * 24 * 60 * 60 * 1000;
      let fetchTime = startTime;

      if (!forceFull) {
        // Check if we have recent data
        const latestOpenTime = await historicalKlinesDao.getLatestOpenTime(symbol, '1m');
        if (latestOpenTime !== null && latestOpenTime > startTime) {
          fetchTime = latestOpenTime + 60000;
        }
      }

      const totalTimeSpan = now - fetchTime;
      if (totalTimeSpan <= 0) {
        syncStates[symbol] = { symbol, progress: 100, status: 'DONE' };
        return;
      }

      const endpoints = [
        `https://data-api.binance.vision/api/v3/klines`,
        `https://fapi.binance.com/fapi/v1/klines`,
        `https://fapi1.binance.com/fapi/v1/klines`,
        `https://api.binance.com/api/v3/klines`
      ];

      let attemptsFailed = 0;

      while (fetchTime < now) {
        let fetchedData: any = null;

        for (const ep of endpoints) {
          try {
            const url = `${ep}?symbol=${symbol}&interval=1m&limit=1000&startTime=${fetchTime}`;
            const res = await requestJsonLimited(url, { timeoutMs: 4000 });
            if (Array.isArray(res.data) && res.data.length > 0) {
              fetchedData = res.data;
              break;
            }
          } catch (e) {
            // Try next endpoint
          }
        }

        if (!fetchedData || fetchedData.length === 0) {
          attemptsFailed++;
          if (attemptsFailed > 2) {
            // Revisão R-2: fabricar histórico é opt-in como todo o resto do dado sintético
            // (BacktestEngine, fetchKlines, screener e WS fazem o mesmo gate). Sem a flag o sync
            // termina sem inventar candles — o backtest falha fechado mais tarde, em vez de
            // rodar sobre séries fabricadas que o operador pediu para serem reais.
            if (process.env.ALLOW_SYNTHETIC_DATA === 'true') {
              await this.seedSyntheticKlines(symbol, fetchTime, now);
            } else {
              console.warn(`⚠️ [HIST] Sem resposta da exchange para ${symbol}; histórico sintético não gerado (ALLOW_SYNTHETIC_DATA !== 'true').`);
            }
            break;
          }
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const rowsToInsert: HistoricalKlineRow[] = fetchedData.map((k: any) =>
          toHistoricalKlineRow(symbol, k)
        );

        // R-2: candles baixados da Binance são proveniência LIVE.
        await historicalKlinesDao.insertMany(rowsToInsert, 'LIVE');

        fetchTime = fetchedData[fetchedData.length - 1][6] + 1;
        
        const currentSpan = fetchTime - startTime;
        let progress = Math.floor((currentSpan / (now - startTime)) * 100);
        if (progress > 99) progress = 99;
        syncStates[symbol].progress = progress;
        
        await new Promise(r => setTimeout(r, 50));
      }

      syncStates[symbol] = { symbol, progress: 100, status: 'DONE' };
    } catch (err) {
      console.error(`Sync error for ${symbol}:`, err);
      syncStates[symbol] = { symbol, progress: syncStates[symbol].progress, status: 'ERROR', error: getErrorMessage(err) };
    }
  }

  /**
   * Generates realistic synthetic 1m klines into database when the remote API is unavailable.
   * R-2: tudo aqui é gravado com `origin = 'DEMO'` — dado fabricado nunca se passa por mercado.
   * O chamador é responsável pelo gate `ALLOW_SYNTHETIC_DATA === 'true'` (regra do diretório em
   * `server/demo/`); BacktestEngine e o fallback do syncSymbol fazem esse gate.
   */
  public static async seedSyntheticKlines(symbol: string, startTime: number, endTime: number): Promise<void> {
    const rows = generateSynthetic1mKlineRows(symbol, startTime, endTime);

    // Insert in chunks of 500 (a 30-day window is ~43k rows; one statement per row is far slower).
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await historicalKlinesDao.insertMany(rows.slice(i, i + CHUNK), 'DEMO');
    }
  }

  public static async getTradeCandles(symbol: string, startTime: number, endTime: number): Promise<HistoricalKlineRow[]> {
    try {
      const paddingMs = 15 * 60 * 1000; // 15 mins padding on both ends
      return await historicalKlinesDao.getBySymbolAndRange(symbol, '1m', startTime, endTime, paddingMs);
    } catch (err) {
      console.error('Error fetching trade candles:', err);
      return [];
    }
  }
}

