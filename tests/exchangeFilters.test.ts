import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  extractSymbolFilters,
  roundPriceToTick,
  checkExecutability,
  type SymbolFilters
} from '../server/services/exchangeFilters.js';

/**
 * 6.5.2 / CA-5.3 — filtros do exchange e executabilidade.
 *
 * Os valores vêm da FIXTURE REAL capturada em 6.1 (tests/fixtures/binance/exchangeInfo.json):
 *   PRICE_FILTER.tickSize / LOT_SIZE.stepSize + minQty / MIN_NOTIONAL.notional ("50").
 * Preços do sinal precisam ser múltiplos do tickSize (stop arredondado para o lado
 * conservador); quantidade abaixo do mínimo (ou notional abaixo do mínimo) ⇒
 * `executable: false` com motivo.
 */

/** Filtrado da fixture real: BTCUSDT — tickSize 0.10, stepSize 0.001, minQty 0.001, notional 50. */
const BTC_FILTERS: SymbolFilters = {
  symbol: 'BTCUSDT',
  tickSize: 0.1,
  stepSize: 0.001,
  minQty: 0.001,
  minNotional: 50
};

describe('6.5.2 — extração dos filtros do exchangeInfo real (CA-5.3)', () => {
  it('extrai tickSize/stepSize/minQty/minNotional da fixture capturada', () => {
    const fixture = JSON.parse(
      fs.readFileSync('tests/fixtures/binance/exchangeInfo.json', 'utf8')
    );
    const root = fixture.symbols ? fixture : (fixture.data?.symbols ? fixture.data : null);
    const symbols = root?.symbols ?? [];
    const btc = symbols.find((s: { symbol: string }) => s.symbol === 'BTCUSDT');
    expect(btc).toBeDefined();

    const f = extractSymbolFilters(btc);
    expect(f).not.toBeNull();
    expect(f!.tickSize).toBe(0.1);
    expect(f!.stepSize).toBe(0.001);
    expect(f!.minQty).toBe(0.001);
    expect(f!.minNotional).toBe(50);
  });

  it('retorna null para símbolo sem filtros reconhecíveis (fail-closed)', () => {
    expect(extractSymbolFilters(null)).toBeNull();
    expect(extractSymbolFilters({ symbol: 'X', filters: [] })).toBeNull();
  });
});

describe('6.5.2 — roundPriceToTick (múltiplos do tickSize)', () => {
  it('preço de entrada é múltiplo do tickSize', () => {
    expect(roundPriceToTick(65432.14, BTC_FILTERS.tickSize)).toBe(65432.1); // nearest
    expect(roundPriceToTick(65432.17, BTC_FILTERS.tickSize)).toBe(65432.2); // nearest
  });

  it('stop LONG arredonda para BAIXO (conservador: dispara antes)', () => {
    expect(roundPriceToTick(65431.96, BTC_FILTERS.tickSize, 'conservative-long-stop')).toBe(65431.9);
  });

  it('stop SHORT arredonda para CIMA (conservador: dispara antes)', () => {
    expect(roundPriceToTick(65431.91, BTC_FILTERS.tickSize, 'conservative-short-stop')).toBe(65432);
  });

  it('sobra binária não vira tick falso: 65432.1 é múltiplo de 0.1', () => {
    const p = roundPriceToTick(65432.1, BTC_FILTERS.tickSize);
    expect(Number.isInteger(Number((p / BTC_FILTERS.tickSize).toPrecision(12)))).toBe(true);
  });
});

describe('6.5.2 — checkExecutability (quantidade/notional mínimos)', () => {
  it('sugestão de quantidade é arredondada para BAIXO ao stepSize (0.001567 → 0.001)', () => {
    const r = checkExecutability({ quantity: 0.001567, entryPrice: 60000, filters: BTC_FILTERS });
    expect(r.executable).toBe(true);
    expect(r.suggestedQuantity).toBe(0.001);
  });

  it('quantidade abaixo do minQty ⇒ executable false com motivo', () => {
    // 0.0004 × 60000 = 24 < minQty 0.001
    const r = checkExecutability({ quantity: 0.0004, entryPrice: 60000, filters: BTC_FILTERS });
    expect(r.executable).toBe(false);
    expect(r.reason!.toLowerCase()).toContain('minqty');
  });

  it('notional abaixo do mínimo ⇒ executable false com motivo', () => {
    // 0.001 × 40000 = 40 < 50
    const r = checkExecutability({ quantity: 0.001, entryPrice: 40000, filters: BTC_FILTERS });
    expect(r.executable).toBe(false);
    expect(r.reason!.toLowerCase()).toContain('notional');
  });
});
