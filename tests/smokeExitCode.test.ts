import { describe, it, expect } from 'vitest';
import { runSmoke, type SmokeDeps, type WsLike } from '../scripts/binance-smoke.js';

const SERVER_TIME = 1_000_000;

function goodData(url: string): any {
  if (url.includes('/fapi/v1/time')) return { serverTime: SERVER_TIME };
  if (url.includes('/exchangeInfo')) return { timezone: 'UTC', serverTime: SERVER_TIME - 90 * 60 * 1000, symbols: [{ symbol: 'BTCUSDT' }] };
  if (url.includes('/tradingSchedule')) return { marketSchedules: { EQUITY: { sessions: [] }, COMMODITY: { sessions: [] } } };
  if (url.includes('/fundingInfo')) return [{ symbol: 'BTCUSDT' }];
  if (url.includes('/fundingRate')) return [{ symbol: 'BTCUSDT', fundingRate: '0.0001' }];
  if (url.includes('/premiumIndex')) return { symbol: 'BTCUSDT', markPrice: '100', lastFundingRate: '0.0001' };
  if (url.includes('/openInterestHist')) return [{ symbol: 'BTCUSDT', sumOpenInterest: '1' }];
  if (url.includes('/depth')) return { bids: [['1', '1']], asks: [['2', '1']] };
  if (url.includes('/klines')) return [[1, '1', '1', '1', '1', '1']];
  return {};
}

interface FakeOpts {
  failMatch?: string;
  silentMarketWs?: boolean;
  wsNeverOpens?: boolean;
}

function makeDeps(opts: FakeOpts = {}, overrides: Partial<SmokeDeps> = {}): SmokeDeps {
  const fetchJson: SmokeDeps['fetchJson'] = async (url: string) => {
    if (opts.failMatch && url.includes(opts.failMatch)) {
      throw new Error('HTTP status 500');
    }
    return { status: 200, data: goodData(url), headers: { 'x-mbx-used-weight-1m': '42' } };
  };

  const wsFactory = (url: string): WsLike => {
    const handlers: Record<string, Array<(...a: any[]) => void>> = {};
    const emit = (ev: string, ...args: any[]) => (handlers[ev] || []).forEach((h) => h(...args));
    const isMarketTicker = url.includes('!ticker');
    setTimeout(() => {
      if (!opts.wsNeverOpens) emit('open');
      if (!(opts.silentMarketWs && isMarketTicker) && !opts.wsNeverOpens) emit('message', '{}');
    }, 0);
    return {
      on: (ev, cb) => {
        (handlers[ev] = handlers[ev] || []).push(cb);
      },
      close: () => {}
    };
  };

  return {
    fetchJson,
    wsFactory,
    now: () => SERVER_TIME,
    log: () => {},
    wsDurationMs: 25,
    ...overrides
  };
}

describe('6.1.1 / CA-1.1 — smoke completo com código de saída', () => {
  it('todas as verificações ok => exitCode 0 e allPass', async () => {
    const result = await runSmoke(makeDeps());
    expect(result.allPass).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.usedWeight1m).toBe(42);
  });

  it('deriva de relógio acima de 2 s => exitCode 1', async () => {
    const result = await runSmoke(makeDeps({}, { now: () => SERVER_TIME + 5000 }));
    expect(result.allPass).toBe(false);
    expect(result.exitCode).toBe(1);
    const timeCheck = result.checks.find((c) => c.name.includes('/time'));
    expect(timeCheck?.success).toBe(false);
  });

  it('falha REST obrigatória (depth) => exitCode 1', async () => {
    const result = await runSmoke(makeDeps({ failMatch: '/depth' }));
    expect(result.exitCode).toBe(1);
    const depth = result.checks.find((c) => c.name.includes('/depth'));
    expect(depth?.success).toBe(false);
    expect(depth?.mandatory).toBe(true);
  });

  it('WS /market sem mensagens => exitCode 1', async () => {
    const result = await runSmoke(makeDeps({ silentMarketWs: true }));
    expect(result.exitCode).toBe(1);
    const wsCheck = result.checks.find((c) => c.name.includes('!ticker'));
    expect(wsCheck?.success).toBe(false);
  });

  it('WS !forceOrder@arr que não conecta => exitCode 1', async () => {
    const result = await runSmoke(makeDeps({ wsNeverOpens: true }));
    expect(result.exitCode).toBe(1);
  });

  it('exchangeInfo com serverTime antigo continua PASSANDO (informativo)', async () => {
    const result = await runSmoke(makeDeps());
    const info = result.checks.find((c) => c.name.includes('exchangeInfo'));
    expect(info?.success).toBe(true);
    expect(info?.details).toMatch(/informativo/);
  });

  it('todas as tarefas obrigatórias são cobertas', async () => {
    const result = await runSmoke(makeDeps());
    const names = result.checks.map((c) => c.name).join('\n');
    for (const required of [
      '/fapi/v1/time',
      '/fapi/v1/exchangeInfo',
      '/fapi/v1/tradingSchedule',
      '/fapi/v1/fundingInfo',
      '/fapi/v1/fundingRate',
      '/fapi/v1/premiumIndex',
      '/futures/data/openInterestHist',
      '/fapi/v1/depth',
      '/fapi/v1/klines',
      '!ticker@arr',
      'bookTicker',
      '!forceOrder@arr'
    ]) {
      expect(names).toContain(required);
    }
  });
});
