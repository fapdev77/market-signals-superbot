import { describe, it, expect } from 'vitest';
import exchangeInfoFixture from './fixtures/binance/exchangeInfo.json';
import { classifyTradfiContract, TRADFI_UNDERLYING_NO_CALENDAR } from '../server/binanceService.js';

const tradfiSymbols = exchangeInfoFixture.symbols.filter(
  (s: any) => s.contractType === 'TRADIFI_PERPETUAL'
);

function symbolWithUnderlyingType(type: string): any {
  return tradfiSymbols.find((s: any) => String(s.underlyingType || '').toUpperCase() === type);
}

describe('M1.2 & CA-1.5: TradFi classification against the real fixture', () => {
  it('classifica todo TRADIFI_PERPETUAL, exceto categorias documentadas como sem calendário', () => {
    expect(tradfiSymbols.length).toBeGreaterThan(0);

    const unclassified = tradfiSymbols.filter((s: any) => classifyTradfiContract(s) === null);

    // CA-1.4: o não classificado só é aceitável quando a categoria está documentada como sem calendário.
    for (const s of unclassified) {
      expect(TRADFI_UNDERLYING_NO_CALENDAR.has(String(s.underlyingType || '').toUpperCase())).toBe(true);
    }
  });

  it('classifica um contrato EQUITY como EQUITY', () => {
    const equity = symbolWithUnderlyingType('EQUITY');
    expect(equity).toBeTruthy();
    expect(classifyTradfiContract(equity)).toBe('EQUITY');
  });

  it('classifica um contrato COMMODITY como COMMODITY', () => {
    const commodity = symbolWithUnderlyingType('COMMODITY');
    expect(commodity).toBeTruthy();
    expect(classifyTradfiContract(commodity)).toBe('COMMODITY');
  });

  it('classifica um contrato FX como FOREX', () => {
    const fx = symbolWithUnderlyingType('FX');
    expect(fx).toBeTruthy();
    expect(classifyTradfiContract(fx)).toBe('FOREX');
  });

  it('classifica contratos de equity regional (KR/HK/CN) como EQUITY', () => {
    for (const type of ['KR_EQUITY', 'HK_EQUITY', 'CN_EQUITY']) {
      const s = symbolWithUnderlyingType(type);
      if (s) expect(classifyTradfiContract(s)).toBe('EQUITY');
    }
  });
});
