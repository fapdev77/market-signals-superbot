/**
 * 6.3.4 / CA-3.2 e CA-3.3 — O backtest cobra funding POR INTERVALO:
 * - onde houver registro real usa o real (custo = soma exata dos registros da
 *   janela) e reporta `fundingCoverage = 100`;
 * - onde não houver, usa a suposição fixa SOMENTE naquele trecho (eventos
 *   esperados sem registro) e declara isso em `assumptions`.
 */
import { describe, it, expect } from 'vitest';

import {
  calculateFundingCostWithCoverage,
  type HistoricalFundingRecord
} from '../server/services/FundingService.js';

const HOUR8 = 8 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function rec(fundingTime: number, rate: string, rateType: string = 'Regular'): HistoricalFundingRecord {
  return { symbol: 'BTCUSDT', fundingTime, fundingRate: Number(rate), markPrice: 100, rateType };
}

describe('6.3.4 — funding real por trecho com cobertura', () => {
  it('CA-3.2: janela totalmente cobrada por registros reais ⇒ custo = soma exata, coverage = 100', () => {
    // Janela de exatamente 3 intervalos; 3 registros reais (um por evento).
    const entry = T0;
    const exit = T0 + 3 * HOUR8;
    const records = [rec(T0 + 1 * HOUR8, '0.0001'), rec(T0 + 2 * HOUR8, '0.0002'), rec(T0 + 3 * HOUR8, '0.0001')];

    const result = calculateFundingCostWithCoverage({
      direction: 'LONG',
      positionSize: 1,
      entryTime: entry,
      exitTime: exit,
      fundingRecords: records
    });

    // Soma exata dos registros: (0.0001 + 0.0002 + 0.0001) = 0.0004 ⇒ 0.04%.
    expect(result.totalFundingCostPct).toBeCloseTo(0.04, 8);
    expect(result.fundingCoverage).toBe(100);
    expect(result.isFallback).toBe(false);
    expect(result.assumptions.length).toBe(0);
  });

  it('CA-3.3: cobertura parcial ⇒ trecho sem dado usa taxa fixa e aparece em assumptions', () => {
    // Janela de 4 intervalos; só 1 registro real ⇒ 3 eventos esperados sem dado.
    const entry = T0;
    const exit = T0 + 4 * HOUR8;
    const records = [rec(T0 + 1 * HOUR8, '0.0001')];

    const result = calculateFundingCostWithCoverage({
      direction: 'LONG',
      positionSize: 1,
      entryTime: entry,
      exitTime: exit,
      fundingRecords: records,
      fallbackFundingRatePer8h: 0.0001
    });

    // Real: 0.0001 ⇒ 0.01%. Fallback: 3 eventos × 0.0001 ⇒ 0.03%. Total: 0.04%.
    expect(result.fundingCoverage).toBe(25);
    expect(result.realFundingCostPct).toBeCloseTo(0.01, 8);
    expect(result.fallbackFundingCostPct).toBeCloseTo(0.03, 8);
    expect(result.totalFundingCostPct).toBeCloseTo(0.04, 8);
    expect(result.isFallback).toBe(false); // misto: real + fallback por trecho
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions[0]).toMatch(/3/i);
  });

  it('SHORT recebe o sinal invertido também no trecho de fallback', () => {
    const entry = T0;
    const exit = T0 + 2 * HOUR8;
    const result = calculateFundingCostWithCoverage({
      direction: 'SHORT',
      positionSize: 1,
      entryTime: entry,
      exitTime: exit,
      fundingRecords: [],
      fallbackFundingRatePer8h: 0.0001
    });

    // Sem registros: 2 eventos × 0.01% = 0.02%, SHORT recebe (custo negativo).
    expect(result.fundingCoverage).toBe(0);
    expect(result.isFallback).toBe(true);
    expect(result.totalFundingCostPct).toBeCloseTo(-0.02, 8);
  });

  it('período menor que um intervalo ⇒ nada a cobrar, coverage 100', () => {
    const result = calculateFundingCostWithCoverage({
      direction: 'LONG',
      positionSize: 1,
      entryTime: T0,
      exitTime: T0 + 2 * 60 * 60 * 1000, // 2h < 8h
      fundingRecords: []
    });

    expect(result.expectedEvents).toBe(0);
    expect(result.fundingCoverage).toBe(100);
    expect(result.totalFundingCostPct).toBeCloseTo(0, 8);
  });
});
