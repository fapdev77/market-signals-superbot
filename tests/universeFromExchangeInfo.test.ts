/**
 * 6.4.6 / CA-4.5 — Universo a partir do `exchangeInfo`: `status == TRADING`,
 * `contractType` em `PERPETUAL`/`TRADIFI_PERPETUAL` e moeda de cotação
 * configurável (padrão USDT). Símbolos em `SETTLING` ou `BREAK` ficam FORA.
 * Nada de `endsWith('USDT')` sobre a lista do ticker.
 */
import { describe, it, expect } from 'vitest';

import { buildUniverseFromExchangeInfo } from '../server/services/screenerScoring.js';

const info = {
  symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'ETHUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'SPXUSDT', status: 'TRADING', contractType: 'TRADIFI_PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'OLDUSDT', status: 'SETTLING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'PAUSEDUSDT', status: 'BREAK', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'PREADMITUSDT', status: 'PREADMIT_TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'BTCUSDC', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDC' },
    { symbol: 'BTCBRL', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'BRL' },
    { symbol: 'DELUSDT', status: 'DELIVERING', contractType: 'PERPETUAL', quoteAsset: 'USDT' }
  ]
};

describe('6.4.6 / CA-4.5 — universo a partir do exchangeInfo', () => {
  it('SETTLING e BREAK ficam fora; TRADING PERPETUAL/TRADIFI_PERPETUAL entram', () => {
    const universe = buildUniverseFromExchangeInfo(info, { quoteAssets: ['USDT'] });

    expect(universe.has('BTCUSDT')).toBe(true);
    expect(universe.has('ETHUSDT')).toBe(true);
    expect(universe.has('SPXUSDT')).toBe(true);

    expect(universe.has('OLDUSDT')).toBe(false);   // SETTLING
    expect(universe.has('PAUSEDUSDT')).toBe(false); // BREAK
    expect(universe.has('PREADMITUSDT')).toBe(false);
    expect(universe.has('DELUSDT')).toBe(false);   // DELIVERING
  });

  it('moeda de cotação configurável: USDC incluso quando pedido', () => {
    const universe = buildUniverseFromExchangeInfo(info, { quoteAssets: ['USDT', 'USDC'] });
    expect(universe.has('BTCUSDC')).toBe(true);
    expect(universe.has('BTCBRL')).toBe(false);
  });

  it('exchangeInfo vazio ⇒ universo vazio (nada é inventado)', () => {
    expect(buildUniverseFromExchangeInfo({ symbols: [] }, { quoteAssets: ['USDT'] }).size).toBe(0);
    expect(buildUniverseFromExchangeInfo(null as any, { quoteAssets: ['USDT'] }).size).toBe(0);
  });
});
