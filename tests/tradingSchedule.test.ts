import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TRADFI_ASSETS,
  isTradfiMarketOpen,
  refreshTradingSchedule,
  getTradingScheduleStatus,
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests,
  type TradingSchedule,
  type TradingMarketSchedule,
  type TradingSession
} from '../server/binanceService.js';
import { processTickerState } from '../server/signalEngine.js';
import type { IndicatorWeights, KlineCandle } from '../src/types.js';

/**
 * R-11 — `GET /fapi/v1/tradingSchedule` (cache diário) cruzado com `isTradfiMarketOpen`.
 *
 * Critérios da spec:
 *  (1) feriado/horário reduzido na fixture bloqueia sinais do contrato afetado;
 *  (2) fallback documentado quando o endpoint não responder (cálculo por America/New_York
 *      + registro em `assumptions`).
 *
 * O formato da fixture reproduz a resposta real observada da Binance:
 * `{ updateTime, marketSchedules: { EQUITY, COMMODITY, FX, ...: { sessions: [{startTime, endTime, type}] } } }`
 * com tipos de sessão `REGULAR | NO_TRADING | PRE_MARKET | AFTER_MARKET | OVERNIGHT`.
 */

// tradingSchedule é buscado via httpClient (fetchWithFallback → requestJson). O mock torna os
// testes determinísticos e evita tocar a exchange. O holder permite cada teste escolher entre
// responder com fixture (caminho feliz) e falhar (fallback).
const state = vi.hoisted(() => ({ respond: null as null | (() => any) }));

vi.mock('../server/utils/httpClient.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/utils/httpClient.js')>();
  return {
    ...actual,
    requestJson: vi.fn(async () => {
      if (state.respond) return state.respond();
      throw new Error('endpoint indisponível (teste)');
    })
  };
});
import { requestJson } from '../server/utils/httpClient.js';

// Semana da fixture: sáb 14/03, feriado na segunda 16/03, horário reduzido na terça 17/03
// (REGULAR termina 13:00 NY), quarta 18/03 é dia normal. Todos os horários já em UTC
// (NY = EDT, UTC-4, na semana de 16/03/2026).
const ms = (iso: string) => new Date(iso).getTime();
const market = (sessions: Array<[string, string, string]>): TradingMarketSchedule => ({
  sessions: sessions.map(([start, end, type]) => ({ startTime: ms(start), endTime: ms(end), type: type as TradingSession['type'] }))
});

const FIXTURE: TradingSchedule = {
  EQUITY: market([
    ['2026-03-14T00:00Z', '2026-03-16T00:00Z', 'NO_TRADING'], // fim de semana
    ['2026-03-16T00:00Z', '2026-03-17T13:30Z', 'NO_TRADING'], // FERIADO de segunda inteira
    ['2026-03-17T13:30Z', '2026-03-17T14:30Z', 'PRE_MARKET'],
    ['2026-03-17T14:30Z', '2026-03-17T17:00Z', 'REGULAR'],    // horário reduzido: fecha 13:00 NY
    ['2026-03-17T17:00Z', '2026-03-17T18:00Z', 'NO_TRADING'],
    ['2026-03-17T18:00Z', '2026-03-17T22:00Z', 'AFTER_MARKET'],
    ['2026-03-17T22:00Z', '2026-03-18T13:30Z', 'OVERNIGHT'],
    ['2026-03-18T13:30Z', '2026-03-18T14:30Z', 'PRE_MARKET'],
    ['2026-03-18T14:30Z', '2026-03-18T20:00Z', 'REGULAR']     // quarta normal: 09:30–16:00 NY
  ]),
  FX: market([
    ['2026-03-16T00:00Z', '2026-03-21T00:00Z', 'REGULAR'],
    ['2026-03-21T00:00Z', '2026-03-22T22:00Z', 'NO_TRADING']
  ]),
  COMMODITY: market([
    ['2026-03-16T00:00Z', '2026-03-21T00:00Z', 'REGULAR'],
    ['2026-03-21T00:00Z', '2026-03-22T00:00Z', 'NO_TRADING']
  ])
};

// Instantes de teste. 15:00Z = 11:00 NY (dentro da sessão regular pelo relógio puro).
const HOLIDAY_MONDAY = new Date('2026-03-16T15:00:00Z');
const EARLY_CLOSE_OPEN = new Date('2026-03-17T16:59:00Z');  // 12:59 NY — ainda aberto
const EARLY_CLOSE_AFTER = new Date('2026-03-17T17:30:00Z'); // 13:30 NY — relógio diria aberto
const NORMAL_WEDNESDAY = new Date('2026-03-18T15:00:00Z');  // 11:00 NY — dia normal
const SATURDAY = new Date('2026-03-21T12:00:00Z');

const sampleWeights: IndicatorWeights = {
  volumeSurgeWeight: 20,
  openInterestWeight: 20,
  fundingRateWeight: 15,
  cvdImbalanceWeight: 20,
  fibonacciZoneWeight: 15,
  rangePocWeight: 15,
  supportResistanceWeight: 15,
  trappedTradersWeight: 25,
  rsiDivergenceWeight: 20,
  volumeProfileRange: 24,
  minRiskRewardRatio: 2.0
} as IndicatorWeights;

describe('R-11 — tradingSchedule da exchange (cache diário) no TradFi', () => {
  beforeEach(() => {
    __resetTradingScheduleForTests();
    state.respond = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('busca o endpoint, cacheia e não re-busca dentro do TTL diário', async () => {
    state.respond = () => ({ status: 200, data: { updateTime: 1, marketSchedules: FIXTURE }, headers: {} });

    await expect(refreshTradingSchedule(true)).resolves.toBe(true);
    expect(vi.mocked(requestJson)).toHaveBeenCalledTimes(1);

    // Dentro do TTL (24h): nova chamada é no-op.
    await expect(refreshTradingSchedule()).resolves.toBe(true);
    expect(vi.mocked(requestJson)).toHaveBeenCalledTimes(1);

    // Passado o TTL diário: re-busca.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    await expect(refreshTradingSchedule()).resolves.toBe(true);
    expect(vi.mocked(requestJson)).toHaveBeenCalledTimes(2);
  });

  it('expõe o status: EXCHANGE_SCHEDULE com mercados e validade quando o cache está fresco', async () => {
    const fetchedAt = Date.now();
    __applyTradingScheduleForTests(FIXTURE, fetchedAt);

    const status = getTradingScheduleStatus();
    expect(status.active).toBe('EXCHANGE_SCHEDULE');
    expect(status.lastFetchedAt).toBe(fetchedAt);
    expect(status.expiresAt).toBe(fetchedAt + 24 * 60 * 60 * 1000);
    expect(status.markets).toEqual(expect.arrayContaining(['EQUITY', 'FX', 'COMMODITY']));
  });

  it('critério 1: feriado bloqueia EQUITY e INDEX mesmo com o relógio dizendo pregão aberto', () => {
    __applyTradingScheduleForTests(FIXTURE, Date.now());

    expect(isTradfiMarketOpen('EQUITY', HOLIDAY_MONDAY)).toBe(false);
    expect(isTradfiMarketOpen('INDEX', HOLIDAY_MONDAY)).toBe(false);
    // Dia normal no mesmo horário: aberto.
    expect(isTradfiMarketOpen('EQUITY', NORMAL_WEDNESDAY)).toBe(true);
  });

  it('critério 1: horário reduzido fecha antes das 16:00 que o relógio puro permitiria', () => {
    __applyTradingScheduleForTests(FIXTURE, Date.now());

    expect(isTradfiMarketOpen('EQUITY', EARLY_CLOSE_OPEN)).toBe(true);
    expect(isTradfiMarketOpen('EQUITY', EARLY_CLOSE_AFTER)).toBe(false);
  });

  it('FX e COMMODITY passam a seguir o schedule (fim de semana de commodity bloqueia)', () => {
    __applyTradingScheduleForTests(FIXTURE, Date.now());

    expect(isTradfiMarketOpen('FOREX', HOLIDAY_MONDAY)).toBe(true);
    // Antes do R-11 COMMODITY era sempre aberto; com schedule da exchange, o fim de semana bloqueia.
    expect(isTradfiMarketOpen('COMMODITY', SATURDAY)).toBe(false);
    expect(isTradfiMarketOpen('COMMODITY', HOLIDAY_MONDAY)).toBe(true);
  });

  it('mercado ausente no schedule volta para o relógio de NY (sem inventar fechamento)', () => {
    const semFx: TradingSchedule = { EQUITY: FIXTURE.EQUITY, COMMODITY: FIXTURE.COMMODITY };
    __applyTradingScheduleForTests(semFx, Date.now());

    // Segunda 11:00 NY: FOREX não está no schedule → fallback por relógio → aberto (24/5).
    expect(isTradfiMarketOpen('FOREX', HOLIDAY_MONDAY)).toBe(true);
  });

  it('critério 2: endpoint fora do ar → fallback por America/New_York documentado em assumptions', async () => {
    state.respond = null; // mock rejeita
    await expect(refreshTradingSchedule(true)).resolves.toBe(false);

    const status = getTradingScheduleStatus();
    expect(status.active).toBe('CLOCK_FALLBACK');
    expect(status.lastError).toMatch(/indisponível|inacessíveis/i);
    expect(status.assumptions.some(a => /America\/New_York|relógio/i.test(a.reason))).toBe(true);

    // Vereditos pelo relógio puro: sábado fechado, segunda 11:00 NY aberta.
    expect(isTradfiMarketOpen('EQUITY', SATURDAY)).toBe(false);
    expect(isTradfiMarketOpen('EQUITY', HOLIDAY_MONDAY)).toBe(true);
  });

  it('critério 1 ponta a ponta: feriado suprime o sinal no motor (NEUTRAL, motivo "fechado")', () => {
    const injected = {
      symbol: 'AAPLBUSDT',
      name: 'Apple Perpetual',
      baseAsset: 'AAPL',
      quoteAsset: 'USDT',
      tradfiCategory: 'EQUITY' as const,
      contractType: 'TRADIFI_PERPETUAL'
    };
    TRADFI_ASSETS.push(injected);
    __applyTradingScheduleForTests(FIXTURE, Date.now());
    vi.useFakeTimers();
    vi.setSystemTime(HOLIDAY_MONDAY); // relógio diria pregão aberto; o schedule diz feriado

    try {
      const rawTicker = {
        symbol: 'AAPLBUSDT',
        lastPrice: '235.50',
        priceChangePercent: '1.5',
        updatedAt: Date.now()
      };
      const candles: KlineCandle[] = [
        { timestamp: 1000, open: 230, high: 236, low: 230, close: 235.5, volume: 5000, takerBuyVolume: 3500 }
      ];

      const result = processTickerState(rawTicker, candles, 5000000, 0.0001, sampleWeights);
      expect(result).not.toBeNull();
      expect(result?.signalType).toBe('NEUTRAL');
      expect(result?.signalReason).toContain('fechado');
    } finally {
      vi.useRealTimers();
      const idx = TRADFI_ASSETS.indexOf(injected);
      if (idx >= 0) TRADFI_ASSETS.splice(idx, 1);
    }
  });
});
