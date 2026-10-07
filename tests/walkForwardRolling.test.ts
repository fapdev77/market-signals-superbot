import { describe, it, expect, beforeAll } from 'vitest';
import {
  BacktestEngine,
  buildWalkForwardWindows,
  aggregateWalkForward,
  resolveWalkForwardOptions
} from '../server/services/BacktestEngine.js';
import { historicalKlinesDao } from '../server/backtest_db/index.js';
import { HistoricalDataService } from '../server/services/HistoricalDataService.js';
import { IndicatorWeights } from '../src/types.js';
import { seedBacktestKlines, alignedNow } from './helpers/backtestSeed.js';

/**
 * R-10 — Walk-forward rolante com tuning restrito ao in-sample.
 *
 * Antes: um único corte 70/30 por ÍNDICE de candles (dependente de quantos
 * candles foram carregados) e o Auto-Tuning escolhia pesos com o fitness da
 * série INTEIRA — ou seja, a seleção de parâmetros era contaminada pelo trecho
 * que deveria servir de validação (vazamento OOS→IS).
 *
 * Agora: janelas rolantes derivadas de TEMPO (treino→teste, deslizando pelo
 * passo) e o tuning avalia candidatos com `isOnlyUntil`, que trunca a
 * simulação no fim do treino — o otimizador literalmente não lê o OOS.
 */

const DAY = 24 * 60 * 60 * 1000;
const START = 1_700_000_000_000;
const END = START + 30 * DAY;

const weights: IndicatorWeights = {
  volumeSurgeWeight: 20,
  openInterestWeight: 20,
  fundingRateWeight: 10,
  cvdImbalanceWeight: 15,
  fibonacciZoneWeight: 15,
  rangePocWeight: 10,
  supportResistanceWeight: 10,
  volumeProfileRange: 20,
  minRiskRewardRatio: 2.5
};

describe('R-10 walk-forward rolante', () => {
  describe('buildWalkForwardWindows — janelas por tempo', () => {
    it('gera janelas rolantes treino→teste com passo explícito', () => {
      const windows = buildWalkForwardWindows(START, END, { trainDays: 10, testDays: 5, stepDays: 5 }, 30);

      expect(windows.map(w => w.index)).toEqual([0, 1, 2, 3]);
      expect(windows.map(w => [w.isStart, w.isEnd, w.oosStart, w.oosEnd])).toEqual([
        [START, START + 10 * DAY, START + 10 * DAY, START + 15 * DAY],
        [START + 5 * DAY, START + 15 * DAY, START + 15 * DAY, START + 20 * DAY],
        [START + 10 * DAY, START + 20 * DAY, START + 20 * DAY, START + 25 * DAY],
        [START + 15 * DAY, START + 25 * DAY, START + 25 * DAY, END]
      ]);
    });

    it('usa defaults derivados de `days` quando não há opções', () => {
      expect(resolveWalkForwardOptions(30)).toEqual({ trainDays: 15, testDays: 6, stepDays: 6 });

      const windows = buildWalkForwardWindows(START, END, undefined, 30);
      expect(windows.length).toBe(3);
      expect(windows[0].isEnd).toBe(START + 15 * DAY);
      expect(windows[windows.length - 1].oosEnd).toBe(END);
    });

    it('trunca a última janela no fim da série e não perde a cauda', () => {
      const windows = buildWalkForwardWindows(START, END, { trainDays: 10, testDays: 5, stepDays: 12 }, 30);
      expect(windows.length).toBeGreaterThan(0);
      expect(windows[windows.length - 1].oosEnd).toBeLessThanOrEqual(END);
    });

    it('é determinístico: mesmas fronteiras para a mesma janela', () => {
      const opts = { trainDays: 10, testDays: 5, stepDays: 5 };
      expect(buildWalkForwardWindows(START, END, opts, 30)).toEqual(
        buildWalkForwardWindows(START, END, opts, 30)
      );
    });
  });

  describe('aggregateWalkForward — IS/OOS agregados e por janela', () => {
    const windows = buildWalkForwardWindows(START, END, { trainDays: 10, testDays: 5, stepDays: 5 }, 30);
    const firstIsEnd = windows[0].isEnd;

    const mk = (entryTime: number, pnlPct: number, pnlValue: number) => ({
      entryTime,
      pnlPct,
      pnlValue,
      isWin: pnlPct > 0
    });

    it('classifica IS pelo primeiro treino e OOS por tudo depois dele', () => {
      const trades = [
        mk(START + DAY, 1.5, 150),            // IS
        mk(firstIsEnd - 1, -0.5, -50),        // IS
        mk(firstIsEnd + DAY, 2.0, 200),       // OOS
        mk(END - DAY, -1.0, -100)             // OOS
      ];
      const agg = aggregateWalkForward(trades, windows);

      expect(agg.inSampleWins).toBe(1);
      expect(agg.inSampleLosses).toBe(1);
      expect(agg.inSampleProfit).toBeCloseTo(100, 6);
      expect(agg.outOfSampleWins).toBe(1);
      expect(agg.outOfSampleLosses).toBe(1);
      expect(agg.outOfSampleProfit).toBeCloseTo(100, 6);
      expect(agg.outOfSampleTrades).toBe(2);
    });

    it('agrega o OOS por janela (win rate e soma de PnL)', () => {
      const trades = [
        mk(windows[0].oosStart + 60_000, 1.0, 100),   // janela 0 OOS
        mk(windows[0].oosStart + 120_000, -0.5, -50), // janela 0 OOS
        mk(windows[1].oosStart + 60_000, 3.0, 300)    // janela 1 OOS
      ];
      const agg = aggregateWalkForward(trades, windows);

      expect(agg.windowResults).toHaveLength(windows.length);
      expect(agg.windowResults[0].oosTrades).toBe(2);
      expect(agg.windowResults[0].oosWinRate).toBe(50);
      expect(agg.windowResults[0].oosProfitPct).toBeCloseTo(0.5, 6);
      expect(agg.windowResults[1].oosTrades).toBe(1);
      expect(agg.windowResults[1].oosWinRate).toBe(100);
      expect(agg.windowResults[1].oosProfitPct).toBeCloseTo(3, 6);
    });
  });

  describe('BacktestEngine — integração', () => {
    beforeAll(async () => {
      await seedBacktestKlines(['BTCUSDT', 'ETHUSDT'], 10);
    });

    it('expõe nº de janelas, OOS agregado e mantém os campos legados', async () => {
      const result = await BacktestEngine.runBacktest({
        symbol: 'ETHUSDT',
        days: 6,
        profile: 'daytrade',
        weights,
        seed: 4242,
        asOf: alignedNow()
      }, false);

      expect(result.walkForward).toBeDefined();
      // campos legados (contrato preservado para a UI e a suíte existente)
      expect(typeof result.walkForward!.inSampleWinRate).toBe('number');
      expect(typeof result.walkForward!.outOfSampleWinRate).toBe('number');
      expect(typeof result.walkForward!.overfitRatio).toBe('number');
      expect(typeof result.walkForward!.isRobust).toBe('boolean');
      // novos campos do R-10
      expect(result.walkForward!.windows).toBeGreaterThanOrEqual(1);
      expect(typeof result.walkForward!.outOfSampleTrades).toBe('number');
      expect(Array.isArray(result.walkForward!.windowResults)).toBe(true);
      expect(result.walkForward!.windowResults!.length).toBe(result.walkForward!.windows);
    });

    it('a chave de cache muda quando as opções de walk-forward mudam', async () => {
      const base = {
        symbol: 'BTCUSDT',
        days: 6,
        profile: 'daytrade' as const,
        weights,
        seed: 99,
        asOf: alignedNow()
      };
      const a = await BacktestEngine.runBacktest(base, false);
      const b = await BacktestEngine.runBacktest({
        ...base,
        walkForward: { trainDays: 3, testDays: 2, stepDays: 2 }
      }, false);

      expect(a.strategyId).not.toBe(b.strategyId);
    });
  });

  describe('sem vazamento OOS→IS (tuning restrito ao treino)', () => {
    const SYM = 'LEAKUSDT';
    const DAYS = 6;
    const OPTS = { trainDays: 3, testDays: 2, stepDays: 2 };
    let asOf: number;
    let isOnlyTrades = 0;
    let fullTrades = 0;

    const run = (overrides: Record<string, unknown>) => BacktestEngine.runBacktest({
      symbol: SYM,
      days: DAYS,
      profile: 'daytrade',
      weights,
      seed: 777,
      asOf,
      walkForward: OPTS,
      ...overrides
    }, false);

    beforeAll(async () => {
      // Âncora FIXA (não `alignedNow()`): as asserções deste bloco comparam
      // CONTAGENS de trades entre janelas, e o gerador sintético deriva o stream de
      // (symbol, startTime). Com `alignedNow()` o stream — e a distribuição dos trades
      // entre treino e OOS — mudava a cada 15 min, então `full` e o subconjunto
      // truncado podiam coincidir por acaso: falha de RELÓGIO, não de lógica (o
      // invariante anti-vazamento sempre passou). `END` é a linha do tempo fixa que
      // os testes puros deste mesmo arquivo já usam.
      asOf = END;
      const start = asOf - DAYS * DAY;
      await historicalKlinesDao.deleteBySymbol(SYM);
      await HistoricalDataService.seedSyntheticKlines(SYM, start, asOf);

      const full = await run({});
      const windows = buildWalkForwardWindows(full.startTime, full.endTime, OPTS, DAYS);
      const isOnly = await run({ isOnlyUntil: windows[0].isEnd });

      fullTrades = full.totalTrades;
      isOnlyTrades = isOnly.totalTrades;
      expect(isOnlyTrades).toBeGreaterThan(0);
      expect(isOnlyTrades).toBeLessThan(fullTrades);
    });

    it('reavaliar só com o treino ignora QUALQUER mudança no trecho OOS', async () => {
      const before = await run({});
      const beforeIsOnly = await run({
        isOnlyUntil: buildWalkForwardWindows(before.startTime, before.endTime, OPTS, DAYS)[0].isEnd
      });

      // Mesma origem/stream sintético, cauda OOS encurtada: o treino é idêntico,
      // só o OOS muda.
      const start = asOf - DAYS * DAY;
      await historicalKlinesDao.deleteBySymbol(SYM);
      await HistoricalDataService.seedSyntheticKlines(SYM, start, asOf - 2 * DAY);

      const after = await run({ isOnlyUntil: buildWalkForwardWindows(before.startTime, before.endTime, OPTS, DAYS)[0].isEnd });
      const afterFull = await run({});

      // IS-only: byte a byte igual (o tuning não vê o OOS)
      expect(after.totalTrades).toBe(beforeIsOnly.totalTrades);
      expect(after.winRate).toBe(beforeIsOnly.winRate);
      expect(after.netProfit).toBe(beforeIsOnly.netProfit);
      // sanidade: o dataset realmente mudou
      expect(afterFull.totalTrades).not.toBe(before.totalTrades);
    });

    it('runAutoTune usa o treino como baseline, não a série completa', async () => {
      const start = asOf - DAYS * DAY;
      await historicalKlinesDao.deleteBySymbol(SYM);
      await HistoricalDataService.seedSyntheticKlines(SYM, start, asOf);

      const full = await run({});
      // 6.7.5: a fronteira de treino do AutoTune é o split 60/20/20 (fim do bloco de
      // treino = início da validação), verificada contra a fronteira que o próprio
      // resultado declara em `trainedUntil`.
      const autoTune = await BacktestEngine.runAutoTune(SYM, 'daytrade', DAYS, 1, weights, 777, asOf, OPTS);
      expect(autoTune.trainedUntil).toBeGreaterThan(full.startTime);
      expect(autoTune.trainedUntil).toBeLessThan(full.endTime);
      expect(autoTune.holdoutValidation).toBeDefined();

      const isOnly = await run({ isOnlyUntil: autoTune.trainedUntil });
      expect(autoTune.initialResult.totalTrades).toBe(isOnly.totalTrades);
      expect(autoTune.initialResult.totalTrades).toBeLessThan(full.totalTrades);

      await historicalKlinesDao.deleteBySymbol(SYM);
    });
  });
});
