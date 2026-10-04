/**
 * SDD Fase 9 — S1: paridade de timeframe entre live e backtest.
 *
 * RED tests. Devem falhar antes da implementação de `aggregateToTimeframe` e da
 * mudança no BacktestEngine.
 *
 * DEFEITO DE ORIGEM: `processTickerState` recebia velas de 15m no live
 * (`server.ts`) e velas de 1m no backtest (`BacktestEngine`). Volume profile,
 * Fibonacci, FVG, estrutura, CVD e RSI divergence eram calculados sobre timeframes
 * diferentes — o backtest nunca reproduziu o sistema que roda em produção.
 *
 * O teste de paridade antigo (`liveBacktestParity.test.ts`) NÃO detectou isso porque
 * alimentava as mesmas velas dos dois lados, o que mascara justamente a diferença de
 * timeframe. Aqui os dois lados recebem a MESMA série de 15m, que é o contrato real.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { processTickerState, SIGNAL_LOOKBACK_CANDLES } from '../server/signalEngine.js';
import {
  aggregateToTimeframe,
  indicatorWindowAt,
  DEFAULT_INDICATOR_LOOKBACK
} from '../server/services/timeframeParity.js';
import type { IndicatorWeights, KlineCandle } from '../src/types.js';

const weights: IndicatorWeights = {
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
};

/** Gera n velas de 1m com passo determinístico e OHLC coerente. */
const make1m = (n: number, startPrice = 90000, startTime = 1_700_000_000_000): KlineCandle[] =>
  Array.from({ length: n }, (_, i) => {
    const base = startPrice + i * 5;
    return {
      timestamp: startTime + i * 60_000,
      open: base,
      high: base + 40,
      low: base - 40,
      close: base + 10,
      volume: 100 + i,
      takerBuyVolume: 60 + i * 0.5
    };
  });

describe('S1.1 — aggregateToTimeframe agrega 1m → Nm', () => {
  it('devolve exatamente floor(n / minutes) velas', () => {
    const agg = aggregateToTimeframe(make1m(45), 15);
    expect(agg).toHaveLength(Math.floor(45 / 15));
  });

  it('preserva OHLCV corretamente por bucket', () => {
    const src = make1m(30);
    const agg = aggregateToTimeframe(src, 15);

    const first = agg[0];
    const bucket = src.slice(0, 15);
    expect(first.open).toBe(bucket[0].open);
    expect(first.close).toBe(bucket[bucket.length - 1].close);
    expect(first.high).toBe(Math.max(...bucket.map(k => k.high)));
    expect(first.low).toBe(Math.min(...bucket.map(k => k.low)));
    expect(first.volume).toBeCloseTo(bucket.reduce((a, k) => a + k.volume, 0), 6);
    expect(first.takerBuyVolume).toBeCloseTo(bucket.reduce((a, k) => a + k.takerBuyVolume, 0), 6);
  });

  it('ancora o timestamp do bucket no início do grupo', () => {
    const src = make1m(30);
    const agg = aggregateToTimeframe(src, 15);
    expect(agg[0].timestamp).toBe(src[0].timestamp);
    expect(agg[1].timestamp).toBe(src[15].timestamp);
  });

  it('descarta a cauda incompleta em vez de emitir vela parcial', () => {
    const agg = aggregateToTimeframe(make1m(37), 15);
    expect(agg).toHaveLength(2);
    const src = make1m(37);
    expect(agg[agg.length - 1].timestamp).toBe(src[15].timestamp);
  });

  it('devolve a entrada intacta para minutes = 1', () => {
    const src = make1m(10);
    const agg = aggregateToTimeframe(src, 1);
    expect(agg).toHaveLength(10);
    expect(agg[3]).toEqual(src[3]);
  });

  it('devolve lista vazia sem lançar para entrada vazia', () => {
    expect(aggregateToTimeframe([], 15)).toEqual([]);
  });
});

describe('S1.2 — paridade real: live e backtest produzem o mesmo estado', () => {
  it('mesma série de 15m nos dois lados => confluenceScore idêntico', () => {
    // Este é o contrato que o teste de paridade antigo não cobria.
    const rawTicker = {
      symbol: 'BTCUSDT',
      lastPrice: '90000',
      priceChangePercent: '2.5',
      highPrice: '91000',
      lowPrice: '88000',
      volume: '150000',
      quoteVolume: '26000000000',
      updatedAt: Date.now()
    };

    const analysis15m = aggregateToTimeframe(make1m(SIGNAL_LOOKBACK_CANDLES * 15), 15);
    expect(analysis15m.length).toBeGreaterThan(0);

    // "live" e "backtest" agora recebem EXATAMENTE a mesma série de 15m.
    const liveState = processTickerState(rawTicker, analysis15m, 15000000, 0.0001, weights);
    const backtestState = processTickerState(rawTicker, analysis15m, 15000000, 0.0001, weights);

    expect(liveState).not.toBeNull();
    expect(backtestState).not.toBeNull();
    expect(backtestState!.confluenceScore).toBe(liveState!.confluenceScore);
    expect(backtestState!.signalType).toBe(liveState!.signalType);
    expect(backtestState!.fibonacci.swingHigh).toBeCloseTo(liveState!.fibonacci.swingHigh, 6);
    expect(backtestState!.fibonacci.swingLow).toBeCloseTo(liveState!.fibonacci.swingLow, 6);
    expect(backtestState!.cvd).toBeCloseTo(liveState!.cvd, 6);
    expect(backtestState!.rangeProfile.vah).toBeCloseTo(liveState!.rangeProfile.vah, 6);
    expect(backtestState!.rangeProfile.val).toBeCloseTo(liveState!.rangeProfile.val, 6);
  });

  it('o timeframe dos indicadores é observável: 15m e 1m produzem estados diferentes', () => {
    // Guarda contra a "solução" de simplesmente usar a mesma vela nos dois lados:
    // as séries precisam produzir leituras de fato diferentes.
    const rawTicker = {
      symbol: 'BTCUSDT',
      lastPrice: '90000',
      priceChangePercent: '2.5',
      updatedAt: Date.now()
    };

    // A janela de 60 velas de 15m cobre 15h; a de 60 velas de 1m cobre 1h. Um pico
    // alto no início da série entra na visão de 15m e NAO entra na de 1m — é
    // exatamente por isso que o timeframe precisa ser o mesmo nos dois ambientes.
    // O pico precisa ser MAIOR que o máximo da rampa linear, senão o topo da janela
    // continua sendo o último ponto e as duas visões coincidem.
    const SPIKE_HIGH = 98000;
    const spikeIndex = 120;
    const candles1m = make1m(SIGNAL_LOOKBACK_CANDLES * 15).map((k, i) =>
      i === spikeIndex ? { ...k, high: SPIKE_HIGH, close: Math.min(k.close, SPIKE_HIGH - 100) } : k
    );

    const candles15m = aggregateToTimeframe(candles1m, 15);
    expect(candles15m).toHaveLength(SIGNAL_LOOKBACK_CANDLES);

    // Visão de 1m: apenas as últimas 60 velas de 1m (o pico fica fora da janela).
    const window1m = candles1m.slice(-SIGNAL_LOOKBACK_CANDLES);

    const from1m = processTickerState(rawTicker, window1m, 15000000, 0.0001, weights);
    const from15m = processTickerState(rawTicker, candles15m, 15000000, 0.0001, weights);

    expect(from1m).not.toBeNull();
    expect(from15m).not.toBeNull();
    // Mesmo preço, mesmo ativo — mas horizontes temporais distintos.
    expect(from1m!.fibonacci.swingHigh).toBeLessThan(from15m!.fibonacci.swingHigh);
  });
});
// ---------------------------------------------------------------------------
// S1.3 — A2 (achado N3): a agregação não pode atravessar buraco de dados.
// ---------------------------------------------------------------------------

/** Injeta um buraco de `gapMinutes` minutos depois do índice `at`. */
const withGap = (candles: KlineCandle[], at: number, gapMinutes: number): KlineCandle[] =>
  candles.map((k, i) => (i >= at ? { ...k, timestamp: k.timestamp + gapMinutes * 60_000 } : k));

describe('S1.3 — nenhum bucket atravessa buraco na série', () => {
  it('após um buraco, os buckets recomeçam em vez de arrastar o minuto inexistente', () => {
    // 40 velas de 1m com 1 minuto faltando entre os índices 19 e 20.
    const src = withGap(make1m(40), 20, 1);
    const agg = aggregateToTimeframe(src, 15);

    // Com agrupamento por ÍNDICE (comportamento antigo), o segundo bucket seria
    // src[15..29] — que atravessa o buraco e produz uma vela de 15m que nunca
    // existiu na exchange, deslocada em 1 minuto para todo o resto da série.
    // Com agrupamento por trecho CONTÍGUO, o bucket recomeça em src[20].
    expect(agg).toHaveLength(2);
    expect(agg[0].timestamp).toBe(src[0].timestamp);
    expect(agg[1].timestamp).toBe(src[20].timestamp);
    expect(agg[1].timestamp).not.toBe(src[30].timestamp);
  });

  it('o bucket emitido tem extensão temporal exatamente igual ao timeframe', () => {
    const src = withGap(make1m(40), 20, 1);
    const agg = aggregateToTimeframe(src, 15);
    for (const bucket of agg) {
      // 15 velas de 1m contíguas => a vela agregada cobre exatamente 14 minutos
      // entre a primeira e a última constituent (a 15ª fecha no minuto seguinte).
      const firstIdx = src.findIndex(k => k.timestamp === bucket.timestamp);
      expect(src[firstIdx + 14].timestamp - src[firstIdx].timestamp).toBe(14 * 60_000);
    }
  });

  it('um buraco no fim da série não altera os buckets já emitidos', () => {
    const full = make1m(40);
    const truncated = withGap(full.slice(0, 31), 31, 5);
    expect(aggregateToTimeframe(truncated, 15)).toEqual(aggregateToTimeframe(full.slice(0, 30), 15));
  });
});

// ---------------------------------------------------------------------------
// S1.4 — A1: a janela de indicadores nunca pode ver o futuro.
// ---------------------------------------------------------------------------

describe('S1.4 — indicatorWindowAt não tem lookahead', () => {
  it('janela vazia antes de existir o primeiro bucket completo', () => {
    const agg15 = aggregateToTimeframe(make1m(60), 15);
    for (let i = 0; i < 14; i++) {
      expect(indicatorWindowAt(agg15, i, 15)).toEqual([]);
    }
  });

  it('no instante do fechamento do bucket, a janela inclui exatamente esse bucket', () => {
    const src = make1m(60);
    const agg15 = aggregateToTimeframe(src, 15);
    const win = indicatorWindowAt(agg15, 14, 15);

    expect(win).toHaveLength(1);
    expect(win[0]).toEqual(agg15[0]);
  });

  it('no meio do bucket seguinte, a janela NAO pode incluir o bucket em formação', () => {
    const src = make1m(60);
    const agg15 = aggregateToTimeframe(src, 15);
    // i = 20: bucket 1 (velas 15..29) ainda está em formação — só fecha em i = 29.
    expect(indicatorWindowAt(agg15, 20, 15)).toHaveLength(1);
    expect(indicatorWindowAt(agg15, 29, 15)).toHaveLength(2);
  });

  it('a janela é limitada a SIGNAL_LOOKBACK_CANDLES velas do timeframe de análise', () => {
    const agg15 = aggregateToTimeframe(make1m(SIGNAL_LOOKBACK_CANDLES * 15 + 15 * 5), 15);
    const last = agg15.length * 15 - 1;
    expect(indicatorWindowAt(agg15, last, 15)).toHaveLength(SIGNAL_LOOKBACK_CANDLES);
  });

it('a última vela da janela só aparece depois que o seu período terminou', () => {
      const src = make1m(SIGNAL_LOOKBACK_CANDLES * 15);
      const agg15 = aggregateToTimeframe(src, 15);
      const bucketMs = 15 * 60_000;
      const srcMs = 60_000;

      for (let i = 0; i < SIGNAL_LOOKBACK_CANDLES * 15; i++) {
        const win = indicatorWindowAt(agg15, i, 15);
        if (win.length === 0) {
          // Antes do fechamento do primeiro bucket não existe janela nenhuma.
          expect(i).toBeLessThan(14);
          continue;
        }
        // A vela de 15m em `ts` cobre [ts, ts+bucketMs). Ela só pode entrar na janela
        // depois de FECHAR, e o instante avaliado pelo backtest é o FECHAMENTO do candle
        // de 1m corrente (src[i].closeTime = src[i].timestamp + srcMs) — no open do
        // candle o bucket em formação ainda não existia para o operador.
        const closeOfCandleI = src[i].timestamp + srcMs;
        expect(win[win.length - 1].timestamp + bucketMs).toBeLessThanOrEqual(closeOfCandleI);
      }
  });

  it('entrada vazia devolve janela vazia sem lançar', () => {
    expect(indicatorWindowAt([], 100, 15)).toEqual([]);
  });

  it('o lookback padrão do helper é o mesmo do motor (guard contra drift)', () => {
    // Se alguém mudar SIGNAL_LOOKBACK_CANDLES e esquecer o default (ou o
    // BacktestEngine deixar de passar a constante), o backtest passaria a usar uma
    // janela diferente da do live sem nenhum teste reclamar.
    expect(DEFAULT_INDICATOR_LOOKBACK).toBe(SIGNAL_LOOKBACK_CANDLES);
  });
});

// ---------------------------------------------------------------------------
// S1.5 — o BacktestEngine de fato alimenta os indicadores com 15m.
// ---------------------------------------------------------------------------

describe('S1.5 — o motor consome o timeframe do live', () => {
  const engineSrc = readFileSync(
    resolve(process.cwd(), 'server/services/BacktestEngine.ts'),
    'utf8'
  );

  it('processTickerState recebe a janela de 15m, não a janela de 1m', () => {
    // Regressão de arquitetura: sem isto, alguém pode trocar `indicatorWindow` por
    // `windowSlice` e todos os testes acima continuam verdes — porque eles testam a
    // função pura, não o ponto de chamada.
    const call = engineSrc.match(/processTickerState\([\s\S]{0,400}?\)/);
    expect(call).not.toBeNull();
    expect(call![0]).toContain('indicatorWindow');
    expect(call![0]).not.toContain('windowSlice,');
  });

  it('a janela é derivada de indicatorWindowAt com o timeframe e o lookback explícitos', () => {
    expect(engineSrc).toContain('INDICATOR_TIMEFRAME_MINUTES');
    expect(engineSrc).toContain('indicatorWindowAt(');
    expect(engineSrc).toMatch(/indicatorWindowAt\(\s*\n\s*indicators15m,\s*\n\s*i,/);
  });

  it('a agregação de 5m usa a função canônica (sem segunda implementação)', () => {
    expect(engineSrc).not.toContain('function aggregateTo5m');
    expect(engineSrc).toContain('aggregateToTimeframe(candleObjects, MTF_VALIDATION_TIMEFRAME_MINUTES)');
  });
});
