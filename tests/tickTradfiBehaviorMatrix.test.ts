import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateTickTradfiGate,
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests,
  type TradingSchedule
} from '../server/binanceService.js';

/**
 * 7.1.4 / CA-1.6 — matriz de comportamento TradFi no gate do tick:
 *  - PAXGUSDT (PERPETUAL, ouro tokenizado) nunca é bloqueado por calendário;
 *  - XAUUSDT (TRADIFI_PERPETUAL, COMMODITY) segue o calendário COMMODITY;
 *  - TRADIFI_PERPETUAL de ações: OVERNIGHT bloqueia, PRE/REGULAR/AFTER liberam;
 *  - contratos PREMARKET não geram sinais (fail-closed).
 */

const SATURDAY_NOON_UTC = new Date('2026-10-03T12:00:00Z');
const WEDNESDAY = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 7, h, m));

function scheduleFor(marketKey: string, sessions: Array<{ type: string; startTime: number; endTime: number }>): TradingSchedule {
  return {
    [marketKey]: {
      sessions: sessions.map(s => ({
        type: s.type as TradingSchedule[string]['sessions'][number]['type'],
        startTime: s.startTime,
        endTime: s.endTime
      }))
    }
  } as TradingSchedule;
}

describe('7.1.4 / CA-1.6 — matriz de comportamento TradFi no tick', () => {
  beforeEach(() => {
    __resetTradingScheduleForTests();
  });

  it('PAXGUSDT (PERPETUAL) num sábado NÃO é bloqueado por calendário', () => {
    const decision = evaluateTickTradfiGate({ symbol: 'PAXGUSDT', contractType: 'PERPETUAL' }, SATURDAY_NOON_UTC);
    expect(decision.allow).toBe(true);
    expect(decision.scheduleGated).toBe(false);
  });

  it('XAUUSDT (TRADIFI_PERPETUAL, COMMODITY) segue o calendário COMMODITY', () => {
    const base = Date.UTC(2026, 9, 7, 10, 0);
    __applyTradingScheduleForTests(
      scheduleFor('COMMODITY', [{ type: 'REGULAR', startTime: base, endTime: base + 3600_000 }]),
      Date.now()
    );

    const open = evaluateTickTradfiGate(
      { symbol: 'XAUUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'COMMODITY' },
      new Date(base + 600_000)
    );
    expect(open.allow).toBe(true);

    const closed = evaluateTickTradfiGate(
      { symbol: 'XAUUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'COMMODITY' },
      new Date(base + 5 * 3600_000)
    );
    expect(closed.allow).toBe(false);
  });

  it('TRADIFI_PERPETUAL de ações: OVERNIGHT bloqueia; PRE_MARKET/REGULAR/AFTER_MARKET liberam', () => {
    const base = Date.UTC(2026, 9, 7, 3, 0);
    __applyTradingScheduleForTests(
      scheduleFor('EQUITY', [
        { type: 'OVERNIGHT', startTime: base, endTime: base + 3600_000 },
        { type: 'PRE_MARKET', startTime: base + 3600_000, endTime: base + 2 * 3600_000 },
        { type: 'REGULAR', startTime: base + 2 * 3600_000, endTime: base + 3 * 3600_000 },
        { type: 'AFTER_MARKET', startTime: base + 3 * 3600_000, endTime: base + 4 * 3600_000 }
      ]),
      Date.now()
    );

    const asset = { symbol: 'AAPLUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' as const };
    expect(evaluateTickTradfiGate(asset, WEDNESDAY(3, 30)).allow).toBe(false); // OVERNIGHT
    expect(evaluateTickTradfiGate(asset, WEDNESDAY(4, 30)).allow).toBe(true);  // PRE_MARKET
    expect(evaluateTickTradfiGate(asset, WEDNESDAY(5, 30)).allow).toBe(true);  // REGULAR
    expect(evaluateTickTradfiGate(asset, WEDNESDAY(6, 30)).allow).toBe(true);  // AFTER_MARKET
  });

  it('contratos PREMARKET NÃO geram sinais (fail-closed), mesmo se monitorados', () => {
    const decision = evaluateTickTradfiGate(
      { symbol: 'OPENAIUSDT', contractType: 'TRADIFI_PERPETUAL', underlyingType: 'PREMARKET' },
      WEDNESDAY(12)
    );
    expect(decision.allow).toBe(false);
    expect(decision.reason).toMatch(/PREMARKET|calend/i);
  });
});
