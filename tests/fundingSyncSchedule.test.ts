import { describe, it, expect, beforeEach } from 'vitest';
import {
  runDailyFundingSync,
  hasDailySyncRunToday,
  getFundingSyncLastRunAt,
  capFundingSymbols,
  maxFundingSymbolsPerRun,
  __resetDailyFundingSyncForTests
} from '../server/services/FundingCoverageTrigger.js';

/** 8.3.2 / CA-3.3 — sincronização diária de funding com relógio falso. */

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0); // 2026-10-02T12:00:00Z
const emptyDeps = {
  fetchPage: async () => ({ rows: [] }),
  insertBatch: async () => {}
};

describe('8.3.2 / CA-3.3 — agendamento diário de funding', () => {
  beforeEach(() => {
    __resetDailyFundingSyncForTests();
  });

  it('roda uma vez por dia e atualiza fundingSyncLastRunAt', async () => {
    expect(getFundingSyncLastRunAt()).toBeNull();
    expect(hasDailySyncRunToday(T0)).toBe(false);

    await runDailyFundingSync(['BTCUSDT'], { now: () => T0, deps: emptyDeps });

    expect(getFundingSyncLastRunAt()).toBe(T0);
    expect(hasDailySyncRunToday(T0)).toBe(true);
    // Um dia depois já não conta como "rodou hoje".
    expect(hasDailySyncRunToday(T0 + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('aplica o teto de símbolos por execução', async () => {
    expect(maxFundingSymbolsPerRun()).toBeGreaterThanOrEqual(1);
    expect(capFundingSymbols(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], 2)).toEqual([
      'BTCUSDT',
      'ETHUSDT'
    ]);

    const results = await runDailyFundingSync(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], {
      now: () => T0,
      deps: emptyDeps,
      budgetPerMinute: 60
    });
    // Só 2 símbolos processados com o default de 10? Não: default 10 ⇒ os 3 passam.
    expect(results.length).toBe(3);
  });

  it('retorna status por símbolo sem tocar a rede (deps injetadas)', async () => {
    const results = await runDailyFundingSync(['BTCUSDT'], { now: () => T0, deps: emptyDeps });
    expect(results[0].symbol).toBe('BTCUSDT');
    expect(['SYNCED', 'UPTODATE']).toContain(results[0].status);
  });
});
