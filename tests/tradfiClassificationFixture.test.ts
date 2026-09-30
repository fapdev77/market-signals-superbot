import { describe, it, expect } from 'vitest';
import exchangeInfoFixture from './fixtures/binance/exchangeInfo.json';
import { classifyTradfiContract } from '../server/binanceService.js';

describe('M1.2 & CA-1.5: TradFi classification against fixtures', () => {
  it('classifies every TRADIFI_PERPETUAL symbol from the fixture', () => {
    const tradfiSymbols = exchangeInfoFixture.symbols.filter(
      (s: any) => s.contractType === 'TRADIFI_PERPETUAL'
    );

    expect(tradfiSymbols.length).toBeGreaterThan(0);

    const unclassified: string[] = [];

    for (const s of tradfiSymbols) {
      const category = classifyTradfiContract(s);
      if (!category) {
        unclassified.push(s.symbol);
      }
    }

    // CA-1.5: Nenhum TRADIFI_PERPETUAL da fixture fica sem categoria fora da lista documentada.
    expect(unclassified).toEqual([]);
  });

  it('correctly categorizes AAPLUSDT as EQUITY', () => {
    const aapl = exchangeInfoFixture.symbols.find((s: any) => s.symbol === 'AAPLUSDT');
    expect(classifyTradfiContract(aapl)).toBe('EQUITY');
  });

  it('correctly categorizes SPYUSDT as INDEX', () => {
    const spy = exchangeInfoFixture.symbols.find((s: any) => s.symbol === 'SPYUSDT');
    expect(classifyTradfiContract(spy)).toBe('INDEX');
  });

  it('correctly categorizes EURUSDT as FOREX', () => {
    const eur = exchangeInfoFixture.symbols.find((s: any) => s.symbol === 'EURUSDT');
    expect(classifyTradfiContract(eur)).toBe('FOREX');
  });

  it('correctly categorizes XAUUSDT as COMMODITY', () => {
    const xau = exchangeInfoFixture.symbols.find((s: any) => s.symbol === 'COMMODITY' || s.symbol === 'XAUUSDT');
    expect(classifyTradfiContract(xau)).toBe('COMMODITY');
  });
});
