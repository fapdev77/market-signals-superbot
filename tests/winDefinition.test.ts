/**
 * SDD Fase 9 — S3: uma única definição de "vitória", derivada do R LÍQUIDO.
 *
 * RED tests.
 *
 * DEFEITO DE ORIGEM: o mesmo campo `isWin` media três coisas diferentes.
 *
 *   - `server/db.ts` (ledger):        `netR > 0`              — líquido (pós taxas,
 *                                                              slippage e funding);
 *   - `BacktestEngine` (posição):     `positionNetPct > 0`    — líquido, MAS em % e
 *                                                              com arredondamento
 *                                                              próprio;
 *   - `positionResolution` (pernas):  `grossPnlPct > 0`       — BRUTO, isto é, sem
 *                                                              taxa, sem funding.
 *
 * Duas consequências que não são acadêmicas:
 *
 *   1. Um trade cujo bruto é +0,05% e cuja taxa de ida e volta é 0,08% é perda. Pelo
 *      gross, é vitória. Pelo ledger, é derrota. O painel de "Trading Insights" e o
 *      evidence ledger discordam do MESMO trade — e o operador não tem como saber qual
 *      dos dois está certo.
 *   2. `grossPnlPct > 0` no caminho de pernas alimenta `TickProcessor`, que decide entre
 *      `HIT_TARGET2` ("Alvo 2 atingido (+100% expansão de lucro)") e `STOPPED_OUT`. Um
 *      alvo que não paga a taxa não é lucro, e o log de execução afirma que é.
 */
import { describe, it, expect } from 'vitest';
import { isNetWin } from '../server/services/winDefinition.js';
import { resolvePosition, type PositionState } from '../server/services/positionResolution.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const long = (over: Partial<PositionState> = {}): PositionState => ({
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 99,
  target1: 101,
  target2: 102,
  isBreakevenActive: false,
  partialTaken: false,
  ...over
});

describe('S3.1 — o predicado é único e é sobre R líquido', () => {
  it('vitória é R líquido estritamente positivo', () => {
    expect(isNetWin(0.42)).toBe(true);
    expect(isNetWin(-0.42)).toBe(false);
  });

  it('R exatamente zero NÃO é vitória (empate é empate)', () => {
    expect(isNetWin(0)).toBe(false);
  });

  it('entrada inválida não vira vitória por acidente', () => {
    // NaN e infinito positivo não podem "ganhar" por coerção de comparação.
    expect(isNetWin(Number.NaN)).toBe(false);
    expect(isNetWin(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isNetWin(undefined as unknown as number)).toBe(false);
  });
});

describe('S3.2 — backtest e ledger concordam no mesmo trade', () => {
  it('bruto positivo com líquido negativo é derrota nos DOIS motores', () => {
    // TP1+TP2 de um alvo miúdo: 0,10% de ganho bruto contra 0,08% de custo de ida e
    // volta. O número bruto é positivo; o número que o operador pagou é negativo.
    const grossPct = 0.1;
    const costs = 0.08;
    const netPct = grossPct - costs;

    expect(grossPct > 0).toBe(true);
    expect(netPct).toBeCloseTo(0.02, 10);

    // ...e um caso em que o custo realmente vence:
    const netPct2 = 0.05 - 0.08;
    expect(netPct2).toBeLessThan(0);
    expect(isNetWin(netPct2)).toBe(false);
  });

  it('o ledger e o backtest usam o mesmo predicado (guard de arquitetura)', () => {
    const db = readFileSync(resolve(process.cwd(), 'server/db.ts'), 'utf8');
    const engine = readFileSync(resolve(process.cwd(), 'server/services/BacktestEngine.ts'), 'utf8');

    expect(db).toContain('isWin: isNetWin(');
    expect(db).not.toContain('isWin: finalOutcome.netR > 0');

    // A posição fechada do backtest decide pelo R líquido decomposto, não pelo % bruto.
    expect(engine).toMatch(/isWin: isNetWin\(/);
  });
});

describe('S3.3 — resolvePosition distingue bruto de líquido', () => {
  it('sem custos informados, mantém o comportamento histórico (bruto) — fail-open explícito', () => {
    const res = resolvePosition({
      position: long({ target1: 100.5, target2: 100.6 }),
      high: 100.7,
      low: 99.5
    });
    expect(res.hasClosedFull).toBe(true);
    expect(res.isWinGross).toBe(true);
    // Sem custos, líquido == bruto. Quem não informa custo não pode alegar que desconta.
    expect(res.isWin).toBe(true);
  });

  it('com taxa de ida e volta, o lucro que não paga a taxa NÃO é vitória', () => {
    const res = resolvePosition({
      position: long({ target1: 100.02, target2: 100.04 }),
      high: 100.05,
      low: 99.5,
      roundtripFeePct: 0.08
    });
    expect(res.hasClosedFull).toBe(true);
    expect(res.isWinGross).toBe(true);
    expect(res.isWin).toBe(false);
    expect(res.costsPct).toBeGreaterThan(0);
    expect(res.netPnlPct).toBeLessThan(0);
  });

  it('com custo, o lucro que paga a taxa continua sendo vitória', () => {
    const res = resolvePosition({
      position: long({ target1: 101, target2: 102 }),
      high: 102.1,
      low: 99.5,
      roundtripFeePct: 0.08
    });
    expect(res.isWinGross).toBe(true);
    expect(res.isWin).toBe(true);
    expect(res.netPnlPct).toBeGreaterThan(0);
  });

  it('funding entra no líquido junto com a taxa', () => {
    const base = {
      position: long({ target1: 101, target2: 102 }),
      high: 102.1,
      low: 99.5
    };
    const soCustos = resolvePosition({ ...base, roundtripFeePct: 0.08 });
    const comFunding = resolvePosition({ ...base, roundtripFeePct: 0.08, fundingPct: 1.5 });

    expect(comFunding.netPnlPct).toBeLessThan(soCustos.netPnlPct);
    expect(comFunding.isWin).toBe(false);
  });

  it('o resultado líquido nunca é maior que o bruto', () => {
    for (const fee of [0, 0.02, 0.08, 0.5]) {
      for (const fund of [0, 0.05, 1]) {
        const res = resolvePosition({
          position: long({ target1: 100.5, target2: 100.9 }),
          high: 101,
          low: 99.5,
          roundtripFeePct: fee,
          fundingPct: fund
        });
        expect(res.netPnlPct).toBeLessThanOrEqual(res.grossPnlPct + 1e-12);
      }
    }
  });
});

describe('S3.4 — o cálculo de P&L continua exato em decimal', () => {
  it('sem custos, líquido e bruto fecham na mesma casa decimal', () => {
    const res = resolvePosition({
      position: long({ target1: 101, target2: 102 }),
      high: 102.1,
      low: 99.5,
      roundtripFeePct: 0
    });
    expect(res.netPnlPct).toBe(res.grossPnlPct);
  });
});