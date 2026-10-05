import { describe, it, expect } from 'vitest';

import {
  resolveRawTicker,
  resolveMarketInputs,
  evaluatePositionManagement,
  type RawTickerLike,
  type PositionAction
} from '../server/services/TickProcessor.js';
import type { TickerData, TradeSignal } from '../src/types.js';

/**
 * `PositionAction` é união discriminada: `UPDATE_SIGNAL` carrega o sinal
 * inteiro em vez de um id. Estes testes sóilians os ramos de fechamento, então
 * filtram por `type` — narrowing explícito, não `as any`.
 */
function closures(actions: PositionAction[]): Array<[string, string]> {
  return actions
    .filter((a): a is Extract<PositionAction, { type: 'HIT_TARGET2' | 'STOPPED_OUT' }> =>
      a.type === 'HIT_TARGET2' || a.type === 'STOPPED_OUT'
    )
    .map(a => [a.signalId, a.type]);
}

/**
 * M6 — suíte de caracterização do `TickProcessor`.
 *
 * O arquivo foi extraído do loop `runMarketTick` em `server.ts` com o objetivo
 * explícito de ser testável, mas nunca ganhou suíte própria. Os testes que
 * existem (`tickTradfiGate`, `tickWeightBudget`) cobrem o gate TradFi e o
 * orçamento de pesos no binanceService — não `resolveRawTicker`,
 * `resolveMarketInputs` nem `evaluatePositionManagement`, que é exatamente onde
 * o sistema decide se mantém, corrige ou encerra uma posição.
 *
 * Estes testes são de CARACTERIZAÇÃO: fixam o comportamento que o motor já tem,
 * incluindo as duas correções de integridade que o cabeçalho do arquivo
 * documenta. Não propõem comportamento novo — a falha aqui significaria que uma
 * invariante já garantida regrediu.
 *
 * Invariantes que este arquivo existe para proteger:
 *  1. Cotação reconstituída do cache mantém o `updatedAt` original e é marcada
 *     STALE. Perder o timestamp fazia `processTickerState` carimbar `Date.now()`
 *     e o DataGate via um preço congelado como fresco — um preço parado podia
 *     gerar sinal e resolver stop.
 *  2. Feed indisponível é reportado como indisponível, nunca coagido a 0 (que o
 *     scorer lia como leitura neutra real).
 *  3. Stop tem precedência sobre alvo quando o mesmo candle toca os dois.
 */

const CACHED_AT = 1_760_000_000_000;

function cachedTicker(overrides: Partial<TickerData> = {}): TickerData {
  return {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    name: 'Bitcoin',
    marketType: 'crypto_futures',
    price: 100,
    priceChangePercent24h: 1.5,
    high24h: 105,
    low24h: 95,
    volume24h: 1234,
    quoteVolume24h: 123400,
    openInterest: 50_000,
    openInterestChange24h: 2,
    openInterestChange1h: 0.5,
    fundingRate: 0.0001,
    fundingRateDaily: 0.0003,
    fundingRateAnnualized: 11,
    cvd: 1000,
    cvdDelta: 50,
    cvdDeltaPercent: 1,
    cvdDirection: 'BUY',
    takerBuyRatio: 0.52,
    fibonacci: { fib50: 100, fib618: 98, fib68: 97 },
    updatedAt: CACHED_AT,
    ...overrides
  } as TickerData;
}

function signal(overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    id: 'SIG-1',
    symbol: 'BTCUSDT',
    marketType: 'crypto_futures',
    signalType: 'LONG',
    direction: 'LONG',
    entryZone: [99, 101],
    currentPrice: 100,
    stopLoss: 95,
    target1: 110,
    target2: 120,
    riskRewardRatio: 2,
    confluenceScore: 80,
    confluenceFactors: [],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: CACHED_AT - 60_000,
    status: 'ACTIVE',
    ...overrides
  } as TradeSignal;
}

describe('M6 — TickProcessor: proveniência da cotação', () => {
  it('cotação da API é usada como está e NÃO é marcada stale', () => {
    const live: RawTickerLike = {
      symbol: 'BTCUSDT',
      lastPrice: '101',
      priceChangePercent: '2',
      highPrice: '106',
      lowPrice: '96',
      volume: '1300',
      quoteVolume: '130000',
      updatedAt: CACHED_AT + 5_000
    };

    const res = resolveRawTicker('BTCUSDT', live, cachedTicker());

    expect(res?.stale).toBe(false);
    expect(res?.raw.lastPrice).toBe('101');
  });

  it('símbolo ausente da resposta: reconstrói do cache PRESERVANDO updatedAt', () => {
    // O updatedAt original é o que permite ao DataGate rejeitar a cotação. Se
    // este campo voltar a ser Date.now(), o preço congelado passa por fresco.
    const res = resolveRawTicker('BTCUSDT', null, cachedTicker());

    expect(res?.stale).toBe(true);
    expect(res?.raw.updatedAt).toBe(CACHED_AT);
    expect(res?.raw.updatedAt).not.toBeGreaterThan(CACHED_AT + 1);
    expect(res?.raw.source).toBe('STALE');
    expect(res?.raw.lastPrice).toBe('100');
  });

  it('símbolo ausente e sem cache devolve null (não inventa cotação)', () => {
    expect(resolveRawTicker('NOVOUSDT', undefined, undefined)).toBeNull();
  });
});

describe('M6 — TickProcessor: disponibilidade por fator', () => {
  it('feed saudável é marcado disponível e o valor passa', () => {
    const res = resolveMarketInputs({
      cached: cachedTicker(),
      oiData: { openInterest: 77_000, change24h: 3, change1h: 1 },
      fundingData: { fundingRate: 0.0002, fundingIntervalHours: 8 },
      longShortData: { longShortRatio: 1.8, longAccount: 0.64, shortAccount: 0.36 } as any
    });

    expect(res.availability).toEqual({ openInterest: true, funding: true, longShort: true });
    expect(res.openInterest).toBe(77_000);
    expect(res.realOiChange).toEqual({ change24h: 3, change1h: 1 });
  });

  it('feed DEGRADADO é indisponível e o valor cai no cache, nunca em 0 inventado', () => {
    const res = resolveMarketInputs({
      cached: cachedTicker({ openInterest: 50_000, fundingRate: 0.0001 }),
      oiData: { openInterest: 0, isDegraded: true },
      fundingData: { fundingRate: 0, fundingIntervalHours: 8, isDegraded: true }
    });

    expect(res.availability.openInterest).toBe(false);
    expect(res.availability.funding).toBe(false);
    // O cache ainda alimenta a exibição, mas o scorer sabe que não é medição.
    expect(res.openInterest).toBe(50_000);
    expect(res.fundingRate).toBe(0.0001);
  });

  it('OI indisponível não propaga variação — 0% seria leitura neutra falsa', () => {
    const res = resolveMarketInputs({
      cached: cachedTicker(),
      oiData: { openInterest: 1, isDegraded: false, change24h: 9, change1h: 4 }
    });

    // openInterest > 0 e não degradado conta como disponível...
    expect(res.availability.openInterest).toBe(true);
    expect(res.realOiChange).toEqual({ change24h: 9, change1h: 4 });

    // ...mas sem o dado, a variação tem de sumir em vez de virar 0%.
    const semOi = resolveMarketInputs({ cached: cachedTicker() });
    expect(semOi.availability.openInterest).toBe(false);
    expect(semOi.realOiChange).toEqual({});
  });

  it('long/short ausente vira undefined, não objeto zerado', () => {
    const res = resolveMarketInputs({ cached: cachedTicker(), longShortData: null });
    expect(res.availability.longShort).toBe(false);
    expect(res.longShortData).toBeUndefined();
  });

  it('intervalo de funding cai no default quando nada informa', () => {
    const res = resolveMarketInputs({ cached: cachedTicker() });
    expect(res.fundingIntervalHours).toBe(8);
  });
});

describe('M6 — TickProcessor: gestão de posição', () => {
  it('nada tocado no candle ⇒ nenhuma ação', () => {
    const actions = evaluatePositionManagement([signal()], 100, { high: 102, low: 98 });
    expect(actions).toEqual([]);
  });

  it('stop tocado fecha como STOPPED_OUT', () => {
    const actions = evaluatePositionManagement([signal()], 94, { high: 96, low: 94 });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('STOPPED_OUT');
    expect(closures(actions)).toEqual([['SIG-1', 'STOPPED_OUT']]);
  });

  it('ALVO2 tocado fecha como HIT_TARGET2', () => {
    const actions = evaluatePositionManagement([signal()], 121, { high: 121, low: 110 });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('HIT_TARGET2');
  });

  it('STOP tem precedência sobre alvo quando o MESMO candle toca os dois', () => {
    // high 121 >= target2 e low 94 <= stop. Reportar vitória aqui inflaria a
    // performance live em relação ao backtest, que também é stop-first.
    const actions = evaluatePositionManagement([signal()], 100, { high: 121, low: 94 });

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('STOPPED_OUT');
    expect(actions[0].type).not.toBe('HIT_TARGET2');
  });

  it('SHORT: queda abaixo do alvo fecha, e stop acima tem precedência', () => {
    const short = signal({ id: 'SH', direction: 'SHORT', entryZone: [101, 99], stopLoss: 105, target1: 90, target2: 80 });

    const ganho = evaluatePositionManagement([short], 79, { high: 85, low: 79 });
    expect(ganho[0].type).toBe('HIT_TARGET2');

    // high 106 >= stop e low 79 <= target2 no mesmo candle ⇒ stop.
    const ambos = evaluatePositionManagement([short], 90, { high: 106, low: 79 });
    expect(ambos[0].type).toBe('STOPPED_OUT');
  });

  it('TP1 ativa breakeven e devolve o sinal atualizado (partial, não fechamento)', () => {
    const s = signal();
    const actions = evaluatePositionManagement([s], 111, { high: 111, low: 105 });

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('UPDATE_SIGNAL');
    expect(s.isBreakevenActive).toBe(true);
    // O stop sobe para o breakeven depois do TP1.
    expect(s.stopLoss).toBeGreaterThan(95);
  });

  it('ignora a range do candle em que a posição foi aberta', () => {
    // A posição abriu DEPOIS do openTime do candle: o high/low inclui preço de
    // antes da entrada e não pode resolver a posição.
    const openedInside = signal({ createdAt: CACHED_AT + 10_000 });
    const actions = evaluatePositionManagement(
      [openedInside],
      100,
      { high: 121, low: 94, openTime: CACHED_AT }
    );

    // Sem range aplicável, high/low = preço atual (100): nada tocado.
    expect(actions).toEqual([]);
  });

  it('aplica a range quando a posição é mais antiga que o candle', () => {
    const antiga = signal({ createdAt: CACHED_AT - 120_000 });
    const actions = evaluatePositionManagement(
      [antiga],
      100,
      { high: 121, low: 94, openTime: CACHED_AT }
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('STOPPED_OUT');
  });

  it('processa múltiplos sinais do mesmo símbolo, cada um com a SUA range', () => {
    // Mesma range para os dois não serve: stop 94 e alvo2 120 no mesmo candle
    // dão stop-first para ambos, por desenho. Cada posição tem geometria
    // própria, então cada uma é avaliada contra o seu próprio range.
    const winner = signal({ id: 'WIN' });
    const loser = signal({ id: 'LOSE', stopLoss: 97 });

    const emAlvo = evaluatePositionManagement([winner], 100, { high: 121, low: 98 });
    const emStop = evaluatePositionManagement([loser], 100, { high: 101, low: 96 });

    expect(closures(emAlvo)).toEqual([['WIN', 'HIT_TARGET2']]);
    expect(closures(emStop)).toEqual([['LOSE', 'STOPPED_OUT']]);
  });

  it('sinal não tocado no mesmo candle que outro é ignorado', () => {
    const winner = signal({ id: 'WIN' });
    // Stop e alvos de FLAT ficam FORA da range [98,121], então ele não é
    // tocado por nenhum dos dois lados — nem stop, nem TP1.
    const untouched = signal({ id: 'FLAT', stopLoss: 80, target1: 150, target2: 160 });

    const actions = evaluatePositionManagement([winner, untouched], 100, { high: 121, low: 98 });

    expect(closures(actions)).toEqual([['WIN', 'HIT_TARGET2']]);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(evaluatePositionManagement([], 100, { high: 121, low: 94 })).toEqual([]);
  });
});