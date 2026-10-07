import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { inferKlineIntervalMs, inferKlineIntervalLabel, computeMaOverWindow } from '../server/binanceService';
import type { KlineCandle } from '../src/types';

/**
 * A-04 (FASE 1) — timeframe DECLARADO = timeframe MEDIDO.
 *
 * Antes: o rótulo da divergência vinha de `weights.volumeProfileTimeframe` (default
 * '30m' ⇒ nenhum ramo casava ⇒ rótulo '1h' sobre velas de 15m) e `ma24h` era a
 * média da janela inteira (60 velas de 15m = 15H), embora exibida como "24h".
 *
 * Contrato agora: o intervalo é MEDIDO das velas (`timestamp`), e a média usa uma
 * janela de 24h real — declarando a janela efetiva quando as velas não a cobrem.
 */

const FIFTEEN_MIN = 900000;

function series(length: number, intervalMs: number, startTs = 0, close = 100): KlineCandle[] {
  return Array.from({ length }, (_, i) => ({
    timestamp: startTs + i * intervalMs,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 10,
    takerBuyVolume: 5
  }));
}

describe('A-04 — intervalo medido das velas', () => {
  it('mede o intervalo real (15m, 30m, 1h, 4h)', () => {
    expect(inferKlineIntervalMs(series(30, FIFTEEN_MIN))).toBe(FIFTEEN_MIN);
    expect(inferKlineIntervalMs(series(30, 30 * 60000))).toBe(1800000);
    expect(inferKlineIntervalMs(series(30, 3600000))).toBe(3600000);
    expect(inferKlineIntervalMs(series(30, 14400000))).toBe(14400000);
  });

  it('traduz para o rótulo canônico', () => {
    expect(inferKlineIntervalLabel(series(30, FIFTEEN_MIN))).toBe('15m');
    expect(inferKlineIntervalLabel(series(30, 1800000))).toBe('30m');
    expect(inferKlineIntervalLabel(series(30, 3600000))).toBe('1h');
    expect(inferKlineIntervalLabel(series(30, 14400000))).toBe('4h');
  });

  it('não inventa rótulo sem velas suficientes', () => {
    expect(inferKlineIntervalMs([])).toBeNull();
    expect(inferKlineIntervalMs(series(1, FIFTEEN_MIN))).toBeNull();
    expect(inferKlineIntervalLabel([])).toBeNull();
  });

  it('o motor não deriva mais o rótulo da divergência de volumeProfileTimeframe', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'server/signalEngine.ts'), 'utf8');
    expect(src).not.toMatch(/divTimeframe\s*=\s*'1h'/);
    expect(src).not.toMatch(/weights\.volumeProfileTimeframe\s*===\s*'15m'/);
    expect(src).toMatch(/inferKlineIntervalLabel/);
  });
});

describe('A-04 — média móvel em janela de 24h real', () => {
  it('usa somente as velas dentro das últimas 24h', () => {
    // 100 velas de 15m = 24,75h ⇒ janela de 24h cabe
    const klines = series(100, FIFTEEN_MIN, 0, 100);
    // preço antigo bem diferente, fora da janela, para provar que foi excluído
    klines[0] = { ...klines[0], close: 500 };
    klines[1] = { ...klines[1], close: 500 };

    const result = computeMaOverWindow(klines, 24)!;
    expect(result.complete).toBe(true);
    expect(result.windowHours).toBeCloseTo(24, 1);
    expect(result.candlesUsed).toBeLessThan(100);
    // sem as velas de 500 a média fica perto de 100
    expect(result.average).toBeGreaterThan(95);
    expect(result.average).toBeLessThan(105);
  });

  it('declara janela parcial quando as velas não cobrem 24h (15h de 15m)', () => {
    const klines = series(60, FIFTEEN_MIN);
    const result = computeMaOverWindow(klines, 24)!;

    expect(result.complete).toBe(false);
    expect(result.windowHours).toBeCloseTo(14.75, 1); // 59 * 15min
    expect(result.candlesUsed).toBe(60);
  });

  it('a média é a das velas disponíveis (não do intervalo declarado)', () => {
    const klines = series(4, FIFTEEN_MIN, 0, 100);
    klines[3] = { ...klines[3], close: 200 };

    const result = computeMaOverWindow(klines, 24)!;
    expect(result.average).toBe((100 + 100 + 100 + 200) / 4);
  });

  it('retorna null sem velas utilizáveis', () => {
    expect(computeMaOverWindow([], 24)).toBeNull();
  });
});
