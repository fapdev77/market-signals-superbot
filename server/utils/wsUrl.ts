/**
 * WebSocket URL Builder and Stream Categorizer for Binance Futures.
 *
 * Implements Binance Futures Base URL Split & Migration (Notice April 2026):
 * - /market: Tickers, Liquidations (!ticker@arr, !forceOrder@arr, markPrice)
 * - /public: Depth, BookTicker, Trades, Klines
 * - /private: User Data Streams
 */

export type FuturesWsCategory = 'public' | 'market' | 'private';

export interface BuildWsUrlOptions {
  validateStreamCategories?: boolean;
  baseWsHost?: string; // defaults to fstream.binance.com
}

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  jitter?: number;
}

/**
 * Categorizes a stream into 'market', 'public', or 'private'.
 */
export function categorizeFuturesStream(streamName: string): FuturesWsCategory {
  const s = streamName.trim().toLowerCase();

  // All-market aggregated streams
  if (s.startsWith('!ticker') || s.startsWith('!miniticker') || s.startsWith('!forceorder') || s.startsWith('!markprice')) {
    return 'market';
  }

  // Ticker streams for specific symbols
  if (s.endsWith('@ticker') || s.endsWith('@miniticker') || s.endsWith('@markprice') || s.endsWith('@forceorder')) {
    return 'market';
  }

  // User data streams
  if (s.length >= 60 && !s.includes('@')) {
    return 'private';
  }

  // Depth, bookTicker, trades, aggTrades, klines, continuous klines
  return 'public';
}

/**
 * Builds standard compliant WebSocket connection URL for Binance Futures.
 * Example: wss://fstream.binance.com/market/stream?streams=!ticker@arr/!forceOrder@arr
 */
export function buildFuturesWsUrl(
  category: FuturesWsCategory,
  streams: string[],
  options: BuildWsUrlOptions = {}
): string {
  if (!streams || streams.length === 0) {
    throw new Error('É necessário fornecer pelo menos uma stream para conectar ao WebSocket.');
  }

  if (options.validateStreamCategories) {
    for (const st of streams) {
      const detected = categorizeFuturesStream(st);
      if (detected !== category) {
        throw new Error(
          `Não é permitido combinar streams de categorias diferentes na mesma conexão. Stream '${st}' é da categoria '${detected}', mas a URL foi requisitada para '${category}'.`
        );
      }
    }
  }

  const host = options.baseWsHost || 'fstream.binance.com';
  const cleanStreams = streams.map(s => s.trim()).filter(Boolean);
  const streamQuery = cleanStreams.join('/');

  return `wss://${host}/${category}/stream?streams=${streamQuery}`;
}

/**
 * Calculates exponential backoff with jitter and a strict cap.
 */
export function calculateWsBackoff(
  attempt: number,
  options: BackoffOptions = {}
): number {
  const baseMs = options.baseMs ?? 1000;
  const maxMs = options.maxMs ?? 60000;
  const jitterRatio = options.jitter ?? 0.2;

  const rawDelay = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const cappedDelay = Math.min(rawDelay, maxMs);

  if (jitterRatio <= 0) {
    return cappedDelay;
  }

  const min = cappedDelay * (1 - jitterRatio);
  const max = cappedDelay * (1 + jitterRatio);
  const withJitter = min + Math.random() * (max - min);

  return Math.min(Math.round(withJitter), maxMs);
}
