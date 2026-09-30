import { describe, it, expect } from 'vitest';
import exchangeInfoFixture from './fixtures/binance/exchangeInfo.json';
import tradingScheduleFixture from './fixtures/binance/tradingSchedule.json';
import {
  classifyTradfiContract,
  TRADFI_CATEGORY_TO_SCHEDULE_MARKET,
  TRADFI_UNDERLYING_TO_SCHEDULE_MARKET,
  TRADFI_UNDERLYING_NO_CALENDAR
} from '../server/binanceService.js';

const scheduleKeys = new Set(Object.keys((tradingScheduleFixture as any).marketSchedules));
const tradfiSymbols = exchangeInfoFixture.symbols.filter(
  (s: any) => s.contractType === 'TRADIFI_PERPETUAL'
);

describe('6.1.4 / CA-1.4 — mapeamento categoria → chave do calendário', () => {
  it('o mapeamento de categorias do projeto usa apenas chaves existentes no calendário real', () => {
    expect(scheduleKeys.size).toBeGreaterThan(0);
    for (const [category, key] of Object.entries(TRADFI_CATEGORY_TO_SCHEDULE_MARKET)) {
      expect(scheduleKeys.has(key), `${category} → ${key}`).toBe(true);
    }
  });

  it('toda categoria TRADIFI_PERPETUAL do fixture tem calendário ou está registrada como sem calendário', () => {
    const types = new Set(
      tradfiSymbols.map((s: any) => String(s.underlyingType || '').toUpperCase())
    );
    expect(types.size).toBeGreaterThan(0);

    const offenders = [...types].filter(
      (t) => !(t in TRADFI_UNDERLYING_TO_SCHEDULE_MARKET) && !TRADFI_UNDERLYING_NO_CALENDAR.has(t)
    );
    expect(offenders).toEqual([]);
  });

  it('as chaves do mapeamento de underlyingType existem no calendário capturado', () => {
    for (const [type, key] of Object.entries(TRADFI_UNDERLYING_TO_SCHEDULE_MARKET)) {
      expect(scheduleKeys.has(key), `${type} → ${key}`).toBe(true);
    }
  });

  it('categorias sem calendário fecham o gate (não classificadas como tradáveis)', () => {
    for (const type of TRADFI_UNDERLYING_NO_CALENDAR) {
      const sample = tradfiSymbols.find(
        (s: any) => String(s.underlyingType || '').toUpperCase() === type
      );
      if (sample) {
        expect(classifyTradfiContract(sample)).toBeNull();
      }
    }
  });
});
