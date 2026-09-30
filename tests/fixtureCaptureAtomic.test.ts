import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureFixtures, type CaptureDeps } from '../scripts/capture-binance-fixtures.js';

const SERVER_TIME = 1_774_900_000_000;

function symbol(name: string, contractType: string, underlyingType: string) {
  return {
    symbol: name,
    contractType,
    status: 'TRADING',
    baseAsset: name.replace('USDT', ''),
    quoteAsset: 'USDT',
    underlyingType,
    filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.01' }]
  };
}

function fixtureData(url: string): any {
  if (url.includes('/fapi/v1/time')) return { serverTime: SERVER_TIME };
  if (url.includes('/exchangeInfo')) {
    return {
      timezone: 'UTC',
      serverTime: SERVER_TIME,
      symbols: [
        symbol('BTCUSDT', 'PERPETUAL', 'COIN'),
        symbol('ETHUSDT', 'PERPETUAL', 'COIN'),
        symbol('PAXGUSDT', 'PERPETUAL', 'COMMODITY'),
        symbol('AAPLUSDT', 'TRADIFI_PERPETUAL', 'EQUITY')
      ]
    };
  }
  if (url.includes('/tradingSchedule')) return { marketSchedules: { EQUITY: { sessions: [] } } };
  if (url.includes('/fundingInfo')) return [{ symbol: 'BTCUSDT' }];
  if (url.includes('/premiumIndex')) return { symbol: 'BTCUSDT', markPrice: '100' };
  if (url.includes('/fundingRate')) return [{ symbol: 'BTCUSDT', fundingRate: '0.0001' }];
  if (url.includes('/openInterestHist')) return [{ symbol: 'BTCUSDT', sumOpenInterest: '1' }];
  if (url.includes('/ticker/24hr')) return [{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }];
  return {};
}

function makeDeps(fixturesDir: string, failMatch?: string): CaptureDeps {
  return {
    fixturesDir,
    now: () => SERVER_TIME,
    log: () => {},
    fetchJson: async (url: string) => {
      if (failMatch && url.includes(failMatch)) throw new Error('HTTP status 503');
      return { status: 200, data: fixtureData(url), headers: {} };
    }
  };
}

describe('6.1.2 / CA-1.2 e CA-1.3 — captura atômica de fixtures', () => {
  it('CA-1.2: grava todas as fixtures com _meta e exchangeInfo com filters', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-'));
    try {
      const result = await captureFixtures(makeDeps(dir));
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.captured).toEqual(
        expect.arrayContaining([
          'exchangeInfo.json',
          'tradingSchedule.json',
          'fundingInfo.json',
          'premiumIndex.json',
          'fundingRate.json',
          'openInterestHist.json',
          'ticker24hr.json'
        ])
      );

      const exchangeInfo = JSON.parse(fs.readFileSync(path.join(dir, 'exchangeInfo.json'), 'utf8'));
      expect(exchangeInfo._meta.capturedAt).toBeTruthy();
      expect(exchangeInfo._meta.serverTimeFromTimeEndpoint).toBe(SERVER_TIME);
      expect(exchangeInfo.symbols.every((s: any) => Array.isArray(s.filters))).toBe(true);
      expect(exchangeInfo.symbols.some((s: any) => s.contractType === 'TRADIFI_PERPETUAL')).toBe(true);

      const ticker = JSON.parse(fs.readFileSync(path.join(dir, 'ticker24hr.json'), 'utf8'));
      expect(ticker._meta.capturedAt).toBeTruthy();
      expect(ticker.symbols).toContain('BTCUSDT');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CA-1.3: falha numa captura mantém as fixtures antigas intactas e sai != 0', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-'));
    try {
      const old = '{"legacy":true}';
      fs.writeFileSync(path.join(dir, 'exchangeInfo.json'), old);

      const result = await captureFixtures(makeDeps(dir, '/openInterestHist'));
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);

      // Fixture antiga intacta.
      expect(fs.readFileSync(path.join(dir, 'exchangeInfo.json'), 'utf8')).toBe(old);
      // Nenhum arquivo novo foi criado.
      expect(fs.existsSync(path.join(dir, 'tradingSchedule.json'))).toBe(false);
      // Diretório temporário foi limpo.
      expect(fs.existsSync(path.join(dir, '.capture-tmp'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falha sem diretório pré-existente não cria arquivos parciais', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-'));
    const dir = path.join(base, 'binance');
    try {
      const result = await captureFixtures(makeDeps(dir, '/tradingSchedule'));
      expect(result.exitCode).toBe(1);
      expect(fs.existsSync(dir)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
