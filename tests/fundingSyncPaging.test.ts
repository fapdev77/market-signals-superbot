/**
 * 6.3.1 / CA-3.1 — `FundingSyncService` sincroniza `/fapi/v1/fundingRate`
 * incrementalmente: pagina por `startTime` (até 1000 registros por chamada)
 * até esgotar a janela. Com mais de 1000 registros, TODOS são buscados e
 * gravados (via `insertBatch`).
 *
 * 6.3.1 / CA-3.4 — cada chamada passa pelo orçamento do limiter
 * (`maxPagesPerMinute`); ao esgotar o orçamento, para sem estourar o peso e
 * informa o ponto de retomada (`nextStartTime`).
 */
import { describe, it, expect } from 'vitest';

import { syncFundingForSymbol, type FundingSyncDeps } from '../server/services/FundingSyncService.js';

const HOUR8 = 8 * 60 * 60 * 1000;

function makeApiRows(count: number, startFundingTime: number): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  for (let i = 0; i < count; i++) {
    const fundingTime = startFundingTime + i * HOUR8;
    rows.push({
      symbol: 'BTCUSDT',
      fundingTime,
      fundingRate: '0.00010000',
      markPrice: '50000.00000000',
      rateType: 'Regular'
    });
  }
  return rows;
}

/** API simulada: devolve até `pageSize` registros com fundingTime > params.startTime. */
function makeFakeApi(allRows: Array<Record<string, any>>, pageSize: number) {
  const calls: Array<{ symbol: string; startTime: number; limit: number }> = [];
  const fetchPage = async (params: { symbol: string; startTime: number; limit: number }) => {
    calls.push({ ...params });
    const rows = allRows
      .filter(r => r.fundingTime > params.startTime)
      .slice(0, params.limit);
    return { rows };
  };
  return { fetchPage, calls };
}

function makeDeps(overrides: Partial<FundingSyncDeps> = {}): FundingSyncDeps & { inserted: any[] } {
  const inserted: any[] = [];
  return {
    fetchPage: async (): Promise<{ rows: Array<Record<string, any>> }> => ({ rows: [] }),
    insertBatch: async (rows: Parameters<FundingSyncDeps['insertBatch']>[0]) => {
      inserted.push(...rows);
    },
    maxPagesPerMinute: 100,
    now: () => 1_000_000,
    log: () => {},
    ...overrides,
    inserted
  } as any;
}

describe('6.3.1 / CA-3.1 — paginação incremental do fundingRate', () => {
  it('>1000 registros: pagina até esgotar e grava todos', async () => {
    const allRows = makeApiRows(2500, 1_700_000_000_000);
    const api = makeFakeApi(allRows, 1000);
    const deps = makeDeps({ fetchPage: api.fetchPage });

    const result = await syncFundingForSymbol('BTCUSDT', {
      startTime: 1_700_000_000_000 - 1,
      endTime: 1_700_000_000_000 + 2500 * HOUR8
    }, deps);

    expect(deps.inserted.length).toBe(2500);
    expect(api.calls.length).toBe(3); // 1000 + 1000 + 500 (< pageSize ⇒ fim)
    expect(result.status).toBe('COMPLETE');

    // Cada chamada avança: startTime da página seguinte > último fundingTime da anterior.
    expect(api.calls[1].startTime).toBeGreaterThan(api.calls[0].startTime);
    expect(api.calls[2].startTime).toBeGreaterThan(api.calls[1].startTime);

    // Sem duplicatas e em ordem.
    const times = deps.inserted.map(r => r.fundingTime);
    expect(new Set(times).size).toBe(2500);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('respeita o orçamento de páginas por minuto (limiter) e informa ponto de retomada', async () => {
    const allRows = makeApiRows(2500, 1_700_000_000_000);
    const api = makeFakeApi(allRows, 1000);
    const deps = makeDeps({ fetchPage: api.fetchPage, maxPagesPerMinute: 2 });

    const result = await syncFundingForSymbol('BTCUSDT', {
      startTime: 1_700_000_000_000 - 1,
      endTime: 1_700_000_000_000 + 2500 * HOUR8
    }, deps);

    expect(api.calls.length).toBe(2);
    expect(deps.inserted.length).toBe(2000);
    expect(result.status).toBe('BUDGET_EXHAUSTED');
    expect(result.nextStartTime).toBe(allRows[1999].fundingTime);
  });

  it('janela sem dados: nenhuma gravação, status COMPLETE', async () => {
    const api = makeFakeApi([], 1000);
    const deps = makeDeps({ fetchPage: api.fetchPage });

    const result = await syncFundingForSymbol('BTCUSDT', {
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_000_000 + HOUR8
    }, deps);

    expect(api.calls.length).toBe(1);
    expect(deps.inserted.length).toBe(0);
    expect(result.status).toBe('COMPLETE');
  });
});
