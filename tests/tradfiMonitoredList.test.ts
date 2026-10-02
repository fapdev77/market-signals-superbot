import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TRADFI_MONITORED_SYMBOLS,
  getConfiguredTradfiMonitoredSymbols,
  getTradfiMaxMonitored,
  getTradfiMonitoredSymbols,
  __resetTradfiMonitoredWarningsForTests,
  type TradfiAsset
} from '../server/binanceService.js';

/**
 * 7.1.2 / CA-1.4 — lista TradFi monitorada configurável, interseção com o
 * registro descoberto e teto `TRADFI_MAX_MONITORED`.
 */

const ENV_KEYS = ['TRADFI_MONITORED_SYMBOLS', 'TRADFI_MAX_MONITORED'];
let saved: Record<string, string | undefined>;

function asset(symbol: string): TradfiAsset {
  return {
    symbol,
    name: symbol,
    baseAsset: symbol.replace('USDT', ''),
    quoteAsset: 'USDT',
    tradfiCategory: 'EQUITY',
    contractType: 'TRADIFI_PERPETUAL'
  };
}

const SEVEN = DEFAULT_TRADFI_MONITORED_SYMBOLS.map(asset);

describe('7.1.2 / CA-1.4 — lista TradFi monitorada', () => {
  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    __resetTradfiMonitoredWarningsForTests();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('padrão: exatamente os 7 símbolos TradFi', () => {
    expect(getConfiguredTradfiMonitoredSymbols()).toEqual(DEFAULT_TRADFI_MONITORED_SYMBOLS);
    expect(DEFAULT_TRADFI_MONITORED_SYMBOLS).toHaveLength(7);
  });

  it('env TRADFI_MONITORED_SYMBOLS sobrepõe a lista padrão (normalizada)', () => {
    process.env.TRADFI_MONITORED_SYMBOLS = ' aaplusdt , msftusdt ';
    expect(getConfiguredTradfiMonitoredSymbols()).toEqual(['AAPLUSDT', 'MSFTUSDT']);
  });

  it('interseção: símbolo fora do registro é ignorado', () => {
    // Registro só tem AAPLUSDT e SOLUSDT (este último nem consta na lista padrão)
    const registry = [asset('AAPLUSDT'), asset('SOLUSDT')];
    expect(getTradfiMonitoredSymbols(registry)).toEqual(['AAPLUSDT']);
  });

  it('CA-1.4: com a lista padrão e registro completo, inclui os 7 e nenhum outro', () => {
    expect(getTradfiMonitoredSymbols(SEVEN)).toEqual([...DEFAULT_TRADFI_MONITORED_SYMBOLS]);
  });

  it('CA-1.4: TRADFI_MAX_MONITORED=3 trunca para 3', () => {
    process.env.TRADFI_MAX_MONITORED = '3';
    expect(getTradfiMaxMonitored()).toBe(3);
    expect(getTradfiMonitoredSymbols(SEVEN)).toHaveLength(3);
  });

  it('registro vazio ⇒ nenhum símbolo TradFi monitorado (fail-closed)', () => {
    expect(getTradfiMonitoredSymbols([])).toEqual([]);
  });
});
