import { describe, it, expect } from 'vitest';
import { mapRawKlineToCandle } from '../server/binanceService';
import { computeCvdMetrics } from '../server/signalEngine';
import { toHistoricalKlineRow } from '../server/services/HistoricalDataService';
import { rowToKlineCandle } from '../server/backtest_db/index';
import type { KlineCandle } from '../src/types';

/**
 * A-06 (FASE 1) — `takerBuyVolume` não pode ser fabricado.
 *
 * Antes: `parseFloat(k[9]) || parseFloat(k[5]) * 0.52`.
 *  - um `0` GENUÍNO caía no `||` e virava "52% de compra taker" inventado;
 *  - o campo ausente também era inventado.
 *
 * Contrato agora: `0` real permanece `0`; campo ausente/inválido é marcado como
 * INDISPONÍVEL (`takerBuyVolumeAvailable: false`) e o CVD não o contabiliza.
 */

function rawKline(takerBuy: string | undefined): unknown[] {
  // [openTime, open, high, low, close, volume, closeTime, quoteVol, trades, takerBuyBase]
  return ['0', '100', '110', '90', '105', '1000', '0', '105000', '10', takerBuy];
}

describe('A-06 — proveniência do takerBuyVolume', () => {
  it('preserva um zero genuíno (não inventa 52%)', () => {
    const candle = mapRawKlineToCandle(rawKline('0'));
    expect(candle.takerBuyVolume).toBe(0);
    expect(candle.takerBuyVolumeAvailable).toBe(true);
  });

  it('usa o valor real quando presente', () => {
    const candle = mapRawKlineToCandle(rawKline('412.75'));
    expect(candle.takerBuyVolume).toBe(412.75);
    expect(candle.takerBuyVolumeAvailable).toBe(true);
  });

  it('marca como indisponível quando o campo está ausente — sem inventar valor', () => {
    const candle = mapRawKlineToCandle(rawKline(undefined));
    expect(candle.takerBuyVolume).toBe(0);
    expect(candle.takerBuyVolumeAvailable).toBe(false);
    // nunca 52% do volume
    expect(candle.takerBuyVolume).not.toBe(candle.volume * 0.52);
  });

  it('marca como indisponível quando o campo é inválido', () => {
    for (const bad of ['', 'abc', 'NaN']) {
      const candle = mapRawKlineToCandle(rawKline(bad));
      expect(candle.takerBuyVolumeAvailable).toBe(false);
    }
  });
});

function candle(index: number, volume: number, takerBuyVolume: number, available = true): KlineCandle {
  return {
    timestamp: index * 900000,
    open: 100,
    high: 105,
    low: 95,
    close: 100,
    volume,
    takerBuyVolume,
    takerBuyVolumeAvailable: available
  };
}

describe('A-06 — CVD não contaminado por candles sem taker volume', () => {
  it('calcula normalmente quando todas as velas têm taker volume', () => {
    const metrics = computeCvdMetrics([
      candle(0, 100, 60),
      candle(1, 100, 70)
    ], 100);

    expect(metrics.available).toBe(true);
    expect(metrics.totalBuyVolume).toBe(130);
    expect(metrics.totalSellVolume).toBe(70);
    expect(metrics.takerBuyRatio).toBeCloseTo(0.65, 5);
    expect(metrics.cvdDirection).toBe('BUY');
  });

  it('ignora velas sem taker volume em vez de tratá-las como venda total', () => {
    const metrics = computeCvdMetrics([
      candle(0, 1000, 0, false),   // indisponível — 1000 de volume NÃO pode virar 100% venda
      candle(1, 100, 60)
    ], 100);

    expect(metrics.available).toBe(true);
    expect(metrics.candlesUsed).toBe(1);
    expect(metrics.totalBuyVolume).toBe(60);
    expect(metrics.totalSellVolume).toBe(40);
    expect(metrics.takerBuyRatio).toBeCloseTo(0.6, 5);
  });

  it('declara indisponível quando nenhuma vela tem taker volume', () => {
    const metrics = computeCvdMetrics([
      candle(0, 1000, 0, false),
      candle(1, 500, 0, false)
    ], 100);

    expect(metrics.available).toBe(false);
    expect(metrics.takerBuyRatio).toBe(0);
    expect(metrics.cvdDirection).toBe('NEUTRAL');
  });

  it('respeita um zero genuíno como venda integral da vela (dado real)', () => {
    const metrics = computeCvdMetrics([candle(0, 100, 0, true)], 100);

    expect(metrics.available).toBe(true);
    expect(metrics.totalBuyVolume).toBe(0);
    expect(metrics.totalSellVolume).toBe(100);
    expect(metrics.cvdDirection).toBe('SELL');
  });
});

/**
 * A-06 (FASE 1) — o CAMINHO DE BACKTEST precisa aplicar a mesma regra do live.
 *
 * Antes dois lugares fabricavam taker volume metade-a-metade:
 *  - ingest: `parseFloat(k[9]) || parseFloat(k[5]) * 0.5` (HistoricalDataService);
 *  - mapeamento: `takerBuyBaseVolume || volume * 0.50` (BacktestEngine).
 * O live já era honesto, então live e backtest decidiam sobre dados diferentes —
 * exatamente o que a paridade A-05 promete fechar.
 */
describe('A-06 (backtest) — histórico sem taker volume fabricado', () => {
  const RAW_MEASURED = [
    '1700000000000', // openTime
    '100',           // open
    '110',           // high
    '90',            // low
    '105',           // close
    '1000',          // volume
    '1700000059999', // closeTime
    '105000',        // quoteAssetVolume
    '10',            // trades
    '400',           // takerBuyBaseVolume
    '42000'          // takerBuyQuoteVolume
  ];

  const RAW_MISSING_TAKER = [...RAW_MEASURED.slice(0, 9), undefined, undefined];

  it('ingest: preserva o taker buy MEDIDO da exchange', () => {
    const row = toHistoricalKlineRow('BTCUSDT', RAW_MEASURED);

    expect(row.takerBuyBaseVolume).toBe(400);
    expect(row.takerBuyQuoteVolume).toBe(42000);
    expect(row.takerBuyVolumeAvailable).toBe(true);
    expect(row.volume).toBe(1000);
  });

  it('ingest: um zero genuíno permanece zero medido (nunca 50% do volume)', () => {
    const row = toHistoricalKlineRow('BTCUSDT', [...RAW_MEASURED.slice(0, 9), '0', '0']);

    expect(row.takerBuyBaseVolume).toBe(0);
    expect(row.takerBuyVolumeAvailable).toBe(true);
  });

  it('ingest: campo ausente vira ausência DECLARADA, não metade do volume', () => {
    const row = toHistoricalKlineRow('BTCUSDT', RAW_MISSING_TAKER);

    expect(row.takerBuyBaseVolume).toBe(0);
    expect(row.takerBuyVolumeAvailable).toBe(false);
    // a fabricação antiga
    expect(row.takerBuyBaseVolume).not.toBe(row.volume * 0.5);
  });

  it('backtest: a linha vira vela com a proveniência preservada', () => {
    const measured = rowToKlineCandle(toHistoricalKlineRow('BTCUSDT', RAW_MEASURED));
    expect(measured.takerBuyVolume).toBe(400);
    expect(measured.takerBuyVolumeAvailable).toBe(true);

    const missing = rowToKlineCandle({
      ...toHistoricalKlineRow('BTCUSDT', RAW_MISSING_TAKER),
      takerBuyVolumeAvailable: false
    });
    expect(missing.takerBuyVolume).toBe(0);
    expect(missing.takerBuyVolumeAvailable).toBe(false);
    // sem a proveniência, a vela viraria "venda integral de 1000" para o CVD
    expect(computeCvdMetrics([missing], 100).available).toBe(false);
  });

  it('backtest: fixtures antigas sem o campo seguem tratadas como medidas', () => {
    const legacy = rowToKlineCandle({
      symbol: 'BTCUSDT',
      interval: '1m',
      openTime: 0,
      closeTime: 59999,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
      quoteAssetVolume: 105000,
      trades: 10,
      takerBuyBaseVolume: 400,
      takerBuyQuoteVolume: 42000
    });

    expect(legacy.takerBuyVolume).toBe(400);
    expect(legacy.takerBuyVolumeAvailable).toBe(true);
  });
});
