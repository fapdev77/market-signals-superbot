/**
 * 6.4.1/6.4.2 / CA-4.1 — Gate TradFi ÚNICO no caminho ao vivo.
 *
 * - Sábado: perpétuo `PERPETUAL` lastreado em ouro (PAXGUSDT) NÃO é bloqueado.
 * - `TRADIFI_PERPETUAL` de ações é BLOQUEADO em `OVERNIGHT` e liberado em
 *   `REGULAR`, `PRE_MARKET` e `AFTER_MARKET`.
 * - O tick decide somente via `evaluateTickTradfiGate` (que usa
 *   `canGenerateSignalsForAsset`); `isTradfiMarketOpen` fica fora do caminho.
 * - 6.4.2: o registro expõe `scheduleGated` por símbolo (gate só para
 *   `TRADIFI_PERPETUAL`; PAXG/XAUT permanecem informativos, sem bloqueio).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  evaluateTickTradfiGate,
  isScheduleGatedSymbol,
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests,
  type TradingSchedule
} from '../server/binanceService.js';

const SATURDAY_NOON_UTC = new Date('2026-10-03T12:00:00Z'); // sábado
const WEDNESDAY = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 7, h, m)); // quarta-feira

function scheduleFor(marketKey: string, sessions: Array<{ type: string; startTime: number; endTime: number }>): TradingSchedule {
  return {
    [marketKey]: {
      sessions: sessions.map(s => ({
        type: s.type as any,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    }
  } as unknown as TradingSchedule;
}

describe('6.4.1 / CA-4.1 — gate único no tick', () => {
  beforeEach(() => {
    __resetTradingScheduleForTests();
  });

  it('sábado: PERPETUAL lastreado em ouro NÃO é bloqueado (sem calendário para PERPETUAL)', () => {
    const decision = evaluateTickTradfiGate(
      { symbol: 'PAXGUSDT', contractType: 'PERPETUAL' },
      SATURDAY_NOON_UTC
    );
    expect(decision.allow).toBe(true);
    expect(decision.scheduleGated).toBe(false);
  });

  it('sábado: TRADIFI_PERPETUAL de ações é bloqueado (sem sessão = fail-closed)', () => {
    const decision = evaluateTickTradfiGate(
      { symbol: 'SPXUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
      SATURDAY_NOON_UTC
    );
    expect(decision.allow).toBe(false);
    expect(decision.scheduleGated).toBe(true);
  });

  it('TRADIFI_PERPETUAL de ações: bloqueado em OVERNIGHT', () => {
    // Sessão OVERNIGHT: 03:00–05:00 UTC na quarta.
    const base = Date.UTC(2026, 9, 7, 3, 0);
    __applyTradingScheduleForTests(
      scheduleFor('EQUITY', [{ type: 'OVERNIGHT', startTime: base, endTime: base + 2 * 3600_000 }]),
      Date.now()
    );

    const decision = evaluateTickTradfiGate(
      { symbol: 'SPXUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
      WEDNESDAY(4)
    );
    expect(decision.allow).toBe(false);
    expect(decision.session).toBe('OVERNIGHT');
    expect(decision.scheduleGated).toBe(true);
  });

  it('TRADIFI_PERPETUAL de ações: liberado em REGULAR, PRE_MARKET e AFTER_MARKET', () => {
    const base = Date.UTC(2026, 9, 7, 8, 0);
    __applyTradingScheduleForTests(
      scheduleFor('EQUITY', [
        { type: 'PRE_MARKET', startTime: base, endTime: base + 3600_000 },
        { type: 'REGULAR', startTime: base + 2 * 3600_000, endTime: base + 3 * 3600_000 },
        { type: 'AFTER_MARKET', startTime: base + 4 * 3600_000, endTime: base + 5 * 3600_000 }
      ]),
      Date.now()
    );

    for (const [hour, expected] of [
      [8, 'PRE_MARKET'],
      [10, 'REGULAR'],
      [12, 'AFTER_MARKET']
    ] as const) {
      const decision = evaluateTickTradfiGate(
        { symbol: 'SPXUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
        WEDNESDAY(hour)
      );
      expect(decision.allow, `hora ${hour} deveria liberar`).toBe(true);
      expect(decision.session).toBe(expected);
    }
  });
});

describe('6.4.2 — escopo do gate + scheduleGated', () => {
  beforeEach(() => {
    __resetTradingScheduleForTests();
  });

  it('isScheduleGatedSymbol: true só para TRADIFI_PERPETUAL', () => {
    expect(isScheduleGatedSymbol({ symbol: 'SPXUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' })).toBe(true);
    expect(isScheduleGatedSymbol({ symbol: 'PAXGUSDT', contractType: 'PERPETUAL' })).toBe(false);
    expect(isScheduleGatedSymbol({ symbol: 'BTCUSDT', contractType: 'PERPETUAL' })).toBe(false);
    expect(isScheduleGatedSymbol({ symbol: 'XAUTUSDT', contractType: 'PERPETUAL' })).toBe(false);
  });

  it('PAXG/XAUT PERPETUAL: categoria informativa, sem bloqueio por calendário', () => {
    const decision = evaluateTickTradfiGate(
      { symbol: 'XAUTUSDT', contractType: 'PERPETUAL' },
      SATURDAY_NOON_UTC
    );
    expect(decision.allow).toBe(true);
    expect(decision.scheduleGated).toBe(false);
  });

  it('TRADIFI_PERPETUAL sem categoria mapeada: fail-closed', () => {
    const decision = evaluateTickTradfiGate(
      { symbol: 'WEIRDUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: null },
      WEDNESDAY(10)
    );
    expect(decision.allow).toBe(false);
  });
});
