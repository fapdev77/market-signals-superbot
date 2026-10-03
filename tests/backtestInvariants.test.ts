import { describe, it, expect, beforeAll } from 'vitest';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import type { BacktestConfig, BacktestResult, BacktestTrade, IndicatorWeights } from '../src/types.js';
import { seedBacktestKlines, alignedNow } from './helpers/backtestSeed.js';
import { dSub, dAdd } from '../server/utils/decimal.js';

/**
 * 8.0.3 / CA-0.4 — invariantes das métricas por POSIÇÃO, no motor real:
 *  - positionsClosed ≤ positionsFilled ≤ signalsEmitted;
 *  - totalTrades === positionsClosed;
 *  - soma das pernas dos trades === result.legs;
 *  - identidade da decomposição de R;
 *  - nenhum relatório mostra "fechados" > "preenchidos" (CA-0.4).
 */

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

function assertInvariants(result: BacktestResult) {
  const signals = result.entryConfirmation?.signalsEmitted ?? 0;
  const filled = result.positionsFilled ?? 0;
  const closed = result.positionsClosed ?? 0;
  const legs = result.legs ?? 0;

  expect(closed).toBeLessThanOrEqual(filled);
  expect(filled).toBeLessThanOrEqual(signals);
  expect(result.totalTrades).toBe(closed);
  expect(result.winningTrades + result.losingTrades).toBe(closed);
  expect(legs).toBeGreaterThanOrEqual(closed);
  expect(result.openPositionsAtEnd === 0 || result.openPositionsAtEnd === 1).toBe(true);
  expect(typeof result.winRatePerLeg).toBe('number');

  const trades = (result.trades || []) as BacktestTrade[];
  expect(trades.length).toBe(closed);

  let legSum = 0;
  for (const t of trades) {
    expect(t.legs === 1 || t.legs === 2).toBe(true);
    legSum += t.legs ?? 0;
    expect(typeof t.rGross).toBe('number');
    // Identidade da 8.0.2 (arredondada a 4 casas).
    const identity = dSub(dSub(dSub(t.rGross!, t.rFees!), t.rSlippage!), t.rFunding!);
    expect(t.rNet!).toBeCloseTo(identity, 3);
  }
  expect(legSum).toBe(legs);

  const decomp = result.rDecomposition;
  expect(decomp).toBeDefined();
  expect(decomp!.positions).toBe(closed);
  const decompIdentity = dSub(
    dSub(dSub(decomp!.rGross, decomp!.rFees), decomp!.rSlippage),
    decomp!.rFunding
  );
  // Componentes individuais são `dRound(..., 4)`; a identidade agregada pode
  // acumular ~2e-4 de deriva de arredondamento, então comparamos a 3 casas.
  expect(decomp!.rNet).toBeCloseTo(decompIdentity, 3);
  // Custo médio = taxas + slippage + funding médios (mesma tolerância).
  expect(decomp!.costAvgR).toBeCloseTo(
    dAdd(dAdd(decomp!.rFees, decomp!.rSlippage), decomp!.rFunding),
    3
  );
}

describe('8.0.3 — invariantes das métricas por posição', () => {
  beforeAll(async () => {
    await seedBacktestKlines(['BTCUSDT'], 12);
  });

  const base: BacktestConfig = {
    symbol: 'BTCUSDT',
    days: 7,
    profile: 'daytrade',
    weights,
    seed: 42,
    asOf: alignedNow()
  };

  it('CA-0.4 — braço de controle: fechados ≤ preenchidos e invariantes valem', async () => {
    const result = await BacktestEngine.runBacktest({ ...base, entryConfirmation: false }, false);
    assertInvariants(result);
    expect(result.positionsFilled!).toBeGreaterThan(0);
  }, 60000);

  it('CA-0.4 — braço com confirmação: fechados ≤ preenchidos e invariantes valem', async () => {
    const result = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);
    assertInvariants(result);
  }, 60000);

  it('determinismo das novas métricas com a mesma semente', async () => {
    const a = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);
    const b = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);
    expect(a.positionsClosed).toBe(b.positionsClosed);
    expect(a.legs).toBe(b.legs);
    expect(a.rDecomposition).toEqual(b.rDecomposition);
  }, 60000);
});
