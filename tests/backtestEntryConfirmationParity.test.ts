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

  /**
   * ACHADO N6 — o braço B PREENCHE.
   *
   * As asserções da CA-2.1/CA-2.2 acima são todas `toBeLessThanOrEqual`, e
   * `entriesFilled === 0` satisfaz todas: elas provam que o motor não INVENTA
   * preenchimento, nunca que ele CONSEGUE preencher. Por isso o N6 passou por 742
   * testes verdes — o braço com confirmação preenchia 0 de 76 sinais e o teste
   * ficava feliz.
   *
   * Causa-raiz do N6: o `klines5m` do R4 era montado a partir do recorte pós-sinal
   * (`slice(startIndex + 1, i + 1)`), que a janela de espera
   * (`entryWaitCandlesFor('DAY_TRADE')` = 3 velas de 1m) limita a MENOS de 5 velas.
   * `aggregateToTimeframe` só emite bucket COMPLETO de 5 e devolve `[]`; `confirmEntry`
   * R4 é fail-closed sem vela de 5m => `confirmed: false` sempre => fill 0 sempre.
   *
   * A segunda asserção (de fonte) fixa a FORMA da correção, porque a primeira — o
   * comportamento — só falharia de novo se alguém voltar a derivar a série de 5m do
   * recorte curto. É o mesmo espírito do guard CA-2.2 logo abaixo, que já lê o
   * fonte para garantir que as regras puras do live não sejam reimplementadas.
   *
   * Nota: NÃO se afirma `waitCandles >= MTF_VALIDATION_TIMEFRAME_MINUTES`. A correção
   * não muda a janela de espera — muda de onde a série de 5m vem. Afirmar a constante
   * faria o teste falhar mesmo com o código correto.
   */
  it('N6 — o braço com confirmação preenche, e o R4 não depende do recorte pós-sinal', async () => {
    const withConf = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);
    const ec = withConf.entryConfirmation!;
    expect(ec.signalsEmitted).toBeGreaterThan(0);
    // O sinal que fica de fora por expirar conta 0 R (D4), mas ALGUM tem de preencher:
    // um braço que nunca preenche não é uma estratégia, é um bug fail-closed.
    expect(ec.entriesFilled).toBeGreaterThan(0);
    expect(ec.entriesFilled + ec.entriesNotFilled + ec.entriesInvalidated).toBeGreaterThan(0);

    const src = fs.readFileSync(
      path.join(process.cwd(), 'server', 'services', 'BacktestEngine.ts'),
      'utf8'
    );
    // O R4 precisa da vela de 5m REAL (no live, `server.ts` busca a 5m da exchange).
    // Derivá-la do recorte pós-sinal é o N6: o recorte nunca tem 5 velas completas.
    expect(src).not.toMatch(
      /klines5m:\s*aggregateToTimeframe\(\s*candles1m\s*,/
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
