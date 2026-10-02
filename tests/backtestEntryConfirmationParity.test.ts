import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { IndicatorWeights, BacktestConfig, BacktestTrade } from '../src/types.js';
import { seedBacktestKlines, alignedNow } from './helpers/backtestSeed.js';

const sampleWeights: IndicatorWeights = {
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

/** 7.2.1 / CA-2.1, CA-2.2 — paridade e uso do código puro do live no backtest. */
describe('7.2 — confirmação de entrada no backtest (paridade e código compartilhado)', () => {
  beforeAll(async () => {
    await seedBacktestKlines(['BTCUSDT'], 10);
  });

  const base: BacktestConfig = {
    symbol: 'BTCUSDT',
    days: 7,
    profile: 'daytrade',
    weights: sampleWeights,
    seed: 42,
    asOf: alignedNow()
  };

  function tradeSignature(trades: BacktestTrade[] | undefined): string[] {
    return (trades || []).map(t =>
      [t.direction, t.entryPrice, t.exitPrice, t.pnlPct, t.exitTime].join('|')
    );
  }

  it('CA-2.1 — flag ausente e flag false produzem exatamente o mesmo backtest', async () => {
    const plain = await BacktestEngine.runBacktest(base, false);
    const control = await BacktestEngine.runBacktest({ ...base, entryConfirmation: false }, false);

    expect(control.totalTrades).toBe(plain.totalTrades);
    expect(control.winRate).toBe(plain.winRate);
    expect(control.netProfit).toBe(plain.netProfit);
    expect(control.maxDrawdown).toBe(plain.maxDrawdown);
    expect(control.profitFactor).toBe(plain.profitFactor);
    expect(tradeSignature(control.trades)).toEqual(tradeSignature(plain.trades));
    // O braço de controle preenche no open do candle seguinte: nunca expira (D4).
    expect(plain.entryConfirmation?.entriesNotFilled).toBe(0);
    // Regression 7.2: cada sinal abre UMA posição (partial + runner ≤ 2 trades).
    // Sem isto, uma posição presa re-resolvia a cada candle e inflava os trades.
    const signals = plain.entryConfirmation?.signalsEmitted ?? 0;
    expect(plain.totalTrades).toBeLessThanOrEqual(2 * signals);
  }, 60000);

  it('CA-2.1/CA-2.2 — o braço com confirmação roda o ciclo PENDING_ENTRY e declara a limitação', async () => {
    const withConf = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);

    const ec = withConf.entryConfirmation;
    expect(ec).toBeDefined();
    expect(ec!.enabled).toBe(true);
    expect(ec!.signalsEmitted).toBeGreaterThan(0);
    // R por sinal emitido existe para TODO sinal (não preenchido entra como 0).
    expect(ec!.rPerSignal.length).toBe(ec!.signalsEmitted);
    // Nem todo sinal de confirmação preenche (o ciclo pode expirar/invalidar).
    expect(ec!.entriesFilled).toBeLessThanOrEqual(ec!.signalsEmitted);
    expect(ec!.entriesFilled + ec!.entriesNotFilled + ec!.entriesInvalidated).toBeLessThanOrEqual(ec!.signalsEmitted);
    expect(ec!.limitation).toBeTruthy();
    // Todo sinal emitido termina resolvido por expiração, invalidação ou preenchimento
    // (alguns pendentes podem ainda estar em aberto no fim da janela).
    expect(ec!.entriesFilled + ec!.entriesNotFilled + ec!.entriesInvalidated).toBeLessThanOrEqual(
      ec!.signalsEmitted
    );
  }, 60000);

  it('CA-2.2 — o motor importa as funções puras do live, sem reimplementá-las', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'server', 'services', 'BacktestEngine.ts'),
      'utf8'
    );
    expect(src).toMatch(/from\s+'\.\/pendingEntryLifecycle\.js'/);
    expect(src).toMatch(/from\s+'\.\/entryConfirmation\.js'/);
    expect(src).toContain('evaluatePendingEntry(');
    expect(src).toContain('confirmEntry(');
    // Não redefine as regras puras dentro do backtest.
    expect(src).not.toMatch(/function\s+confirmEntry\s*\(/);
    expect(src).not.toMatch(/function\s+evaluatePendingEntry\s*\(/);
  });
});
