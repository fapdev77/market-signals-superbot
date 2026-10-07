import { describe, it, expect } from 'vitest';
import { detectFVG, FVG_DEFAULT_MAX_AGE_CANDLES } from '../server/binanceService';
import type { KlineCandle } from '../src/types';

/**
 * A-02 (FASE 1) — um FVG não pode ser pontuado para sempre.
 *
 * Antes o `detectFVG` varria toda a janela de 60 velas e o primeiro gap
 * encontrado (mesmo de 15h) recebia os mesmos 10 pontos de um gap recém-formado.
 * O contrato agora: a janela é explícita (`maxAgeCandles`) e a idade do gap é
 * reportada (`ageCandles`) para auditoria.
 */

function candle(index: number, high: number, low: number): KlineCandle {
  return {
    timestamp: index * 900000,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    volume: 100,
    takerBuyVolume: 50
  };
}

/** 20 velas planas (high 100 / low 99) — nenhum FVG por padrão. */
function flatSeries(length = 20): KlineCandle[] {
  return Array.from({ length }, (_, i) => candle(i, 100, 99));
}

describe('A-02 — FVG respeita a janela de validade', () => {
  it('detecta um FVG recente e reporta a idade em velas', () => {
    const klines = flatSeries();
    // gap altista na última vela: c1.high (17) < c3.low (19)
    klines[17] = candle(17, 95, 94);
    klines[19] = candle(19, 101, 97);

    const result = detectFVG(klines, 5);
    expect(result.hasSinglePrintFVG).toBe(true);
    expect(result.fvgZone?.type).toBe('BULLISH');
    expect(result.ageCandles).toBe(0);
  });

  it('ignora um FVG antigo quando a janela é pequena', () => {
    const klines = flatSeries();
    // gap altista na vela 5 (idade = 19 - 5 = 14 velas)
    klines[3] = candle(3, 95, 94);
    klines[5] = candle(5, 101, 97);

    expect(detectFVG(klines, 3).hasSinglePrintFVG).toBe(false);
  });

  it('reconhece o mesmo FVG antigo quando a janela é ampla (a janela é o único corte)', () => {
    const klines = flatSeries();
    klines[3] = candle(3, 95, 94);
    klines[5] = candle(5, 101, 97);

    const result = detectFVG(klines, 20);
    expect(result.hasSinglePrintFVG).toBe(true);
    expect(result.ageCandles).toBe(14);
  });

  it('a idade cresce conforme o gap envelhece', () => {
    const klines = flatSeries(30);
    klines[0] = candle(0, 95, 94);
    klines[2] = candle(2, 101, 97);

    const result = detectFVG(klines, 60);
    expect(result.ageCandles).toBe(27); // 29 - 2
  });

  it('tem uma janela default explícita (não busca a série inteira)', () => {
    expect(FVG_DEFAULT_MAX_AGE_CANDLES).toBeGreaterThan(0);
    expect(FVG_DEFAULT_MAX_AGE_CANDLES).toBeLessThan(60);

    const klines = flatSeries(60);
    // gap na primeira vela: muito além do default
    klines[0] = candle(0, 95, 94);
    klines[2] = candle(2, 101, 97);

    expect(detectFVG(klines).hasSinglePrintFVG).toBe(false);
  });

  it('série curta continua segura', () => {
    expect(detectFVG([], 12).hasSinglePrintFVG).toBe(false);
    expect(detectFVG(flatSeries(2), 12).hasSinglePrintFVG).toBe(false);
  });
});
