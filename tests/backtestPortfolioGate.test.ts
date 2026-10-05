/**
 * P — portfólio no backtest.
 *
 * CRÍTICO-1 corrigiu SIZING, não CONCÚRNCIA: `evaluatePortfolioRisk` simplesmente não
 * existia na simulação. Este arquivo fixa o gate no ponto de emissão.
 *
 * O ponto que este teste não deixa passar é a INVERSÃO DE PARIDADE. O live decide com
 *
 *     evaluatePortfolioRisk(openSignals, getRiskLimits(), { category: targetCategory })
 *
 * isto é, o conjunto que já está ABERTO, e o sinal candidato entra só como `incoming`.
 * Passar `[signal]` — o candidato contado como se estivesse aberto — faz o backtest
 * recusar sinais que o live aceitaria: com `maxConcurrentSignals <= 1`, ou
 * `maxSignalsPerCategory <= 1`, ou `riskPerTradePct >= maxPortfolioRiskPct`, o gate
 * bloqueia sozinho sem que exista qualquer posição aberta. O erro opposite ao que P
 * existe para corrigir, e igualmente distorcedor:troca viés otimista por viés pessimista.
 *
 * O segundo fato que este arquivo fixa é a honestidade do alcance. O motor é
 * single-position (`inPosition` é um booleano) e só emite sinal quando está plano, então
 * o conjunto aberto é VAZIO em todo ponto de emissão. A dimensão de concorrência não
 * consegue limitar aqui, e o resultado tem que dizer isso em vez de deixar o campo
 * `riskGate` suggestir um portfolio simulado que não existe.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { DEFAULT_RISK_LIMITS, getRiskLimits, updateRiskLimits } from '../server/services/RiskManager.js';
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

function config(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return { symbol: 'BTCUSDT', days: 7, profile: 'daytrade', weights, ...overrides };
}

describe('P — gate de risco de portfólio no backtest', () => {
  beforeAll(async () => {
    await seedBacktestKlines(['BTCUSDT'], 10);
  });

  afterEach(() => {
    // `updateRiskLimits` mexe em estado de módulo: restaurar é obrigatório, senão o
    // limite zerado vaza para a próxima suíte que rodar no mesmo worker.
    updateRiskLimits(DEFAULT_RISK_LIMITS);
  });

  it('chama o gate com o conjunto ABERTO, não com o sinal candidato', () => {
    const src = readFileSync('server/services/BacktestEngine.ts', 'utf-8');
    // Comentários saem primeiro: eles contêm parênteses e truncariam a captura.
    const code = src.replace(/\/\/[^\n]*/g, '');
    // Argumentos até o fecha-parênteses; depois de remover comentários nenhum deles
    // contém parênteses, então `[^()]*` é exato e independe da quebra de linha.
    const calls = [...code.matchAll(/evaluatePortfolioRisk\(([^()]*)\)/g)].map((m) => m[1]);
    expect(calls.length, 'o motor tem de chamar evaluatePortfolioRisk').toBeGreaterThan(0);
    for (const args of calls) {
      const firstArg = args.split(',')[0].trim();
      // Contar o candidato como posição aberta é a inversão de paridade.
      expect(firstArg, `1º argumento do gate é o candidato: ${args.trim()}`).not.toBe('[signal]');
      expect(firstArg).not.toContain('signal');
    }
    // E o limite tem de ser o do live (`getRiskLimits()`), não a constante default.
    expect(code).toMatch(/\.\.\.getRiskLimits\(\)\s*,\s*\n\s*riskPerTradePct/);
  }, 20000);

  it('avalia todo sinal emitido e fecha a contagem: allowed + blocked === evaluated', async () => {
    const result = await BacktestEngine.runBacktest(config(), false);
    const gate = result.riskGate!;

    expect(gate.evaluated).toBeGreaterThan(0);
    expect(gate.evaluated).toBe(result.entryConfirmation?.signalsEmitted);
    expect(gate.allowed + gate.blocked).toBe(gate.evaluated);
  }, 60000);

  it('não bloqueia nada com os limites padrão — e isso é o resultado correto', async () => {
    const result = await BacktestEngine.runBacktest(config(), false);
    const gate = result.riskGate!;

    // Com o conjunto aberto vazio, nenhum limite de concorrência/portfolio pode disparar.
    // Um `blocked > 0` aqui significaria que o gate está contando o candidato contra si
    // mesmo, que é exatamente a inversão de paridade.
    expect(gate.blocked).toBe(0);
    expect(gate.allowed).toBe(gate.evaluated);
    expect(gate.reasons).toEqual([]);
  }, 60000);

  it('sobrevive ao cache, que é o caminho padrão (useCache = true)', async () => {
    // O save é incondicional, então o primeiro run (sem cache) persiste e o segundo o
    // recupera. Sem `riskGate` na lista de campos persistidos, o run cacheado devolveria
    // o gate AUSENTE — o painel sumiria sozinho num simples refresh.
    const fresh = await BacktestEngine.runBacktest(config(), false);
    const cached = await BacktestEngine.runBacktest(config(), true);

    expect(cached.riskGate).toBeDefined();
    expect(cached.riskGate).toEqual(fresh.riskGate);
  }, 120000);

  it('preserva a pareabilidade 8.2.1 mesmo quando o gate bloqueia', async () => {
    const loose = await BacktestEngine.runBacktest(config(), false);
    const blocked = await BacktestEngine.runBacktest(
      config({ riskLimits: { maxSignalsPerCategory: 0 } }),
      false
    );

    // O gate roda ANTES de a chave e o R-pendente serem registrados, então bloquear não
    // desalinha `rPerSignal`, `signalKeys` e `signalsEmitted` entre os dois braços.
    expect(blocked.riskGate!.blocked).toBeGreaterThan(0);
    expect(blocked.riskGate!.allowed).toBe(0);
    const ec = blocked.entryConfirmation!;
    expect(ec.rPerSignal.length).toBe(ec.signalsEmitted);
    expect(ec.signalKeys!.length).toBe(ec.signalsEmitted);
    // Nada bloqueado abre posição: os contadores de entrada ficam em zero.
    expect(ec.entriesFilled).toBe(0);
    expect(blocked.totalTrades).toBe(0);
    expect(loose.riskGate!.blocked).toBe(0);
  }, 120000);

  it('lê os limites do runtime (getRiskLimits), como o live', async () => {
    const before = await BacktestEngine.runBacktest(config(), false);
    expect(before.riskGate!.blocked).toBe(0);

    // Mesmo caminho de configuração que `POST /api/system/risk-limits` usa. Se o motor
    // lesse a constante default em vez de `getRiskLimits()`, este run idêntico passaria.
    updateRiskLimits({ maxConcurrentSignals: 0 });
    const after = await BacktestEngine.runBacktest(config(), false);

    expect(after.riskGate!.blocked).toBeGreaterThan(0);
    expect(after.riskGate!.limits.maxConcurrentSignals).toBe(0);
    expect(after.riskGate!.reasons.join(' ')).toMatch(/simult/);
  }, 120000);

  it('reporta os limites com que decidiu, e o override por run', async () => {
    const defaults = await BacktestEngine.runBacktest(config(), false);
    expect(defaults.riskGate!.limits).toEqual(getRiskLimits());

    const override = await BacktestEngine.runBacktest(
      config({ riskLimits: { maxPortfolioRiskPct: 1 } }),
      false
    );
    // O resto dos limites continua vindo do runtime; só o campo sobrescrito muda.
    expect(override.riskGate!.limits.maxPortfolioRiskPct).toBe(1);
    expect(override.riskGate!.limits.maxConcurrentSignals).toBe(getRiskLimits().maxConcurrentSignals);
  }, 120000);

  it('declara que a concorrência não pôde limitar, em vez de sugerir um portfolio simulado', async () => {
    const result = await BacktestEngine.runBacktest(config(), false);
    const gate = result.riskGate!;

    // O motor é single-position: o conjunto aberto é vazio em todo ponto de emissão.
    expect(gate.openAtEvaluation).toBe(0);

    const declaration = (result.assumptions ?? []).find((a) => a.includes('Gate de risco de portfólio'));
    expect(declaration, 'o alcance do gate tem de ser declarado no resultado').toBeDefined();
    expect(declaration).toMatch(/no máximo 1 posição/);
    expect(declaration).toMatch(/não pode limitar/);
  }, 60000);
});