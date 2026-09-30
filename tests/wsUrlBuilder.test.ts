import { describe, it, expect } from 'vitest';
import {
  buildFuturesWsUrl,
  categorizeFuturesStream,
  FuturesWsCategory
} from '../server/utils/wsUrl.js';

describe('M0.2: buildFuturesWsUrl and stream categorization', () => {
  it('builds market stream URL for single ticker array stream', () => {
    const url = buildFuturesWsUrl('market', ['!ticker@arr']);
    expect(url).toBe('wss://fstream.binance.com/market/stream?streams=!ticker@arr');
  });

  it('builds market stream URL for multiple market streams', () => {
    const url = buildFuturesWsUrl('market', ['!ticker@arr', '!forceOrder@arr']);
    expect(url).toBe('wss://fstream.binance.com/market/stream?streams=!ticker@arr/!forceOrder@arr');
  });

  it('builds public stream URL for public depth and kline streams', () => {
    const url = buildFuturesWsUrl('public', ['btcusdt@depth20@100ms', 'ethusdt@kline_1m']);
    expect(url).toBe('wss://fstream.binance.com/public/stream?streams=btcusdt@depth20@100ms/ethusdt@kline_1m');
  });

  it('categorizes well-known streams correctly', () => {
    expect(categorizeFuturesStream('!ticker@arr')).toBe('market');
    expect(categorizeFuturesStream('!forceOrder@arr')).toBe('market');
    expect(categorizeFuturesStream('btcusdt@depth20@100ms')).toBe('public');
    expect(categorizeFuturesStream('btcusdt@bookTicker')).toBe('public');
    expect(categorizeFuturesStream('btcusdt@kline_1m')).toBe('public');
  });

  it('throws an error when trying to combine mixed categories under a single category URL', () => {
    expect(() => {
      buildFuturesWsUrl('market', ['!ticker@arr', 'btcusdt@depth20@100ms'], { validateStreamCategories: true });
    }).toThrow(/combinar streams de categorias diferentes/i);
  });

  it('throws an error if no streams are provided', () => {
    expect(() => {
      buildFuturesWsUrl('market', []);
    }).toThrow(/pelo menos uma stream/i);
  });
});
