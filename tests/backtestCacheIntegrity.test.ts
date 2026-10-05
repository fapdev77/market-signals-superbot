/**
 * M8 (recorrência) — o caminho de cache do backtest.
 *
 * O Lote 2 fechou M8 em três calculadores de `src/utils`, mas o mesmo defeito
 * sobrevivia no caminho de cache do `BacktestEngine`, que é o PADRÃO
 * (`useCache` default = true):
 *
 *     avgWinPct:            parsed.avgWinPct            || 1.8
 *     avgLossPct:           parsed.avgLossPct           || 0.9
 *     avgRiskReward:        parsed.avgRiskReward        || 2.0
 *     avgDurationMinutes:   parsed.avgDurationMinutes   || 25
 *     totalCandlesTested:   parsed.totalCandlesTested   || 5000
 *
 * Pior que um fallback: o blob JSON persistido NUNCA gravou esses campos, então
 * `parsed.avgWinPct` é `undefined` em TODA linha de cache e as cinco constantes
 * eram o único valor que o caminho padrão alguma vez reportou. O run real media
 * 3,41 e o painel mostrava 1,8. E `||` ainda apagaria um `null` legítimo, que
 * depois de M3/M4 significa "não medido".
 *
 * Este arquivo fixa: o run cacheado devolve os mesmos números que o run que os
 * mediu, e uma linha sem esses campos devolve `null`, não uma constante.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { backtestResultsDao } from '../server/backtest_db/index.js';
import type { BacktestConfig, IndicatorWeights } from '../src/types.js';
import { seedBacktestKlines } from './helpers/backtestSeed.js';

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

const config: BacktestConfig = { symbol: 'BTCUSDT', days: 7, profile: 'daytrade', weights };

/** Os cinco campos que o cache inventava, mais as contagens que ele derivava. */
const CACHED_FIELDS = [
  'avgWinPct',
  'avgLossPct',
  'avgRiskReward',
  'avgDurationMinutes',
  'totalCandlesTested',
  'winningTrades',
  'losingTrades'
] as const;

describe('M8 (recorrência) — o caminho de cache não inventa métrica', () => {
  beforeAll(async () => {
    await seedBacktestKlines(['BTCUSDT'], 10);
  });

  it('não contém constante de fallback para métrica no caminho de cache', () => {
    const src = readFileSync('server/services/BacktestEngine.ts', 'utf-8');
    const start = src.indexOf('if (useCache)');
    const end = src.indexOf('// Phase 2.5.4: the analysis window');
    expect(start, 'bloco de cache localizado').toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // Comentários saem antes da varredura: o bloco documenta as constantes removidas,
    // e um comentário não deve disparar o alarme — nem esconder uma constante nova.
    const cacheBlock = src.slice(start, end).replace(/\/\/[^\n]*/g, '');

    // As cinco constantes que este defeito introduziu.
    for (const constant of ['|| 1.8', '|| 0.9', '|| 2.0', '|| 25', '|| 5000']) {
      expect(cacheBlock, `cache ainda tem "${constant}"`).not.toContain(constant);
    }
    // E nenhum outro `|| <número>` pode reintroduzir a família.
    expect(cacheBlock).not.toMatch(/\|\|\s*\d/);
  }, 20000);

  it('o run cacheado devolve os mesmos números que o run que os mediu', async () => {
    const fresh = await BacktestEngine.runBacktest(config, false);
    const cached = await BacktestEngine.runBacktest(config, true);

    expect(fresh.riskGate, 'o teste precisa de um run real para comparar').toBeDefined();
    expect(cached.totalTrades).toBe(fresh.totalTrades);
    for (const field of CACHED_FIELDS) {
      expect(cached[field], `cache alterou ${field}`).toEqual(fresh[field]);
    }
  }, 120000);

  it('preserva `null` (não medido) em vez de trocar pela constante', async () => {
    // Reproduz a linha que a fase anterior escrevia: blob sem os campos de métrica.
    // Nela a resposta honesta é `null` — não medido — e não 1.8/0.9/2.0/25/5000.
    await BacktestEngine.runBacktest(config, false);

    const recent = await backtestResultsDao.listRecent(1, config.symbol);
    expect(recent.length, 'o run anterior persistiu a linha').toBe(1);
    const row = recent[0];

    const parsed = JSON.parse(row.config);
    for (const field of CACHED_FIELDS) delete parsed[field];

    await backtestResultsDao.insert({ ...row, config: JSON.stringify(parsed) });

    const cached = await BacktestEngine.runBacktest(config, true);
    expect(cached.avgWinPct).toBeNull();
    expect(cached.avgLossPct).toBeNull();
    expect(cached.avgRiskReward).toBeNull();
    expect(cached.avgDurationMinutes).toBeNull();
    expect(cached.totalCandlesTested).toBeNull();
    // As contagens são derivadas de `totalTrades`/`winRate`, que SÃO medidos — daí
    // continuarem numerais em vez de `null`.
    expect(typeof cached.winningTrades).toBe('number');
    expect(typeof cached.losingTrades).toBe('number');
  }, 120000);
});
