import { describe, it, expect } from 'vitest';
import { auditUniverse, type UniverseAuditDeps, type WsLike } from '../scripts/audit-universe.js';

function makeDeps(): UniverseAuditDeps {
  return {
    now: () => 0,
    wsDurationMs: 20,
    log: () => {},
    fetchJson: async (url: string): Promise<any> => {
      if (url.includes('/exchangeInfo')) {
        return {
          status: 200,
          headers: {},
          data: {
            symbols: [
              { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
              { symbol: 'ETHUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
              { symbol: 'OLDUSDT', status: 'SETTLING', contractType: 'PERPETUAL', quoteAsset: 'USDT' }
            ]
          }
        };
      }
      if (url.includes('/ticker/24hr')) {
        return {
          status: 200,
          headers: {},
          data: [{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }, { symbol: 'RESTONLYUSDT' }]
        };
      }
      return { status: 200, headers: {}, data: {} };
    },
    wsFactory: (_url: string): WsLike => {
      const handlers: Record<string, Array<(...a: any[]) => void>> = {};
      const emit = (ev: string, ...args: any[]) => (handlers[ev] || []).forEach((h) => h(...args));
      setTimeout(() => {
        emit('message', JSON.stringify({ data: [{ s: 'BTCUSDT' }, { s: 'WSONLYUSDT' }] }));
      }, 0);
      return {
        on: (ev, cb) => {
          (handlers[ev] = handlers[ev] || []).push(cb);
        },
        close: () => {}
      };
    }
  };
}

describe('6.1.5 / CA-1.5 — auditoria do universo', () => {
  it('conta os grupos e explica a diferença REST × WS a partir dos dados', async () => {
    const result = await auditUniverse(makeDeps());

    expect(result.counts.ticker24hr).toBe(3);
    expect(result.counts.exchangeInfoTotal).toBe(3);
    expect(result.counts.byStatus.TRADING).toBe(2);
    expect(result.counts.wsTickers).toBe(2);
    expect(result.counts.universeCandidates).toBe(2);

    expect(result.markdown).toContain('WSONLYUSDT');
    expect(result.markdown).toContain('RESTONLYUSDT');
    expect(result.markdown).toContain('define o universo');
  });
});
