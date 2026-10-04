/**
 * CRITICAL-2 (auditoria 2026-10-04) — slippage contado em dois lugares e recuperado errado.
 *
 * O motor do backtest aplicava slippage na ENTRADA (`candle.open × (1 ± s)`) e o resolver
 * aplicava de novo na SAÍDA (`slipFill`). A contabilidade (`backtestAccounting`) só
 * desfazia o da SAÍDA (`unSlippedLevel`), de modo que:
 *
 *   - `grossPctNoSlip` — documentado como "bruto ANTES do slippage" — vinha
 *     contaminado pelo slippage de entrada;
 *   - `rGross` era menor que o bruto real;
 *   - `rSlippage` reportava só a perna de saída, escondendo a de entrada.
 *
 * A identidade `rNet = rGross − rFees − rSlippage − rFunding` fechava por compensação
 * (o erro do bruto e o erro do slippage se cancelavam), o que é exatamente por que o
 * defeito sobreviveu: as Métricas de rótulo errado pareciam consistentes.
 *
 * O live (`positionResolution.slipFill`) aplica slippage SÓ na saída. Este guard fixa
 * as duas pernas: o comportamento da contabilidade sobre um nível limpo e a forma do
 * motor (entrada sem slippage).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPositionAccounting,
  applyResolution,
  positionSlippagePct,
  positionNetPct,
  legGrossPct
} from '../server/services/backtestAccounting.js';
import { resolvePosition } from '../server/services/positionResolution.js';

const SLIP = 0.02; // % — mesma ordem do default de mercado
const FEE = 0.08; // % roundtrip

describe('CRITICAL-2 — o slippage é contado uma vez por perna', () => {
  it('grossPctNoSlip é o bruto verdadeiro quando a entrada NÃO tem slippage embutido', () => {
    const acc = createPositionAccounting();
    // Alvo 102 numa entrada limpa de 100 => bruto real = +2%.
    applyResolution(acc, {
      direction: 'LONG',
      entryPrice: 100,
      exitLegs: [{ leg: 'FULL', price: 102 * (1 - SLIP / 100), size: 1 }],
      hasClosedFull: true,
      slippagePct: SLIP,
      roundtripFeePct: FEE,
      fundingPct: 0,
      profitValue: 0
    });

    expect(acc.grossPctNoSlip).toBeCloseTo(2, 6);
    // E o custo de slippage é o da SAÍDA, isolado.
    expect(positionSlippagePct(acc)).toBeCloseTo(acc.grossPctNoSlip - acc.grossPctWithSlip, 8);
    expect(positionSlippagePct(acc)).toBeCloseTo(0.0204, 6);
    // Identidade: líquido = bruto real − slippage − taxas.
    expect(positionNetPct(acc)).toBeCloseTo(acc.grossPctNoSlip - positionSlippagePct(acc) - FEE, 6);
  });

  it('o backtest e o live cobram o MESMO custo de slippage no MESMO cenário', () => {
    // Cenário idêntico, passado ao resolver puro (live) e à contabilidade (backtest).
    const entry = 100;
    const target = 102;
    const fill = target * (1 - SLIP / 100);

    const live = resolvePosition({
      position: {
        entryPrice: entry,
        stopLoss: 95,
        target1: target,
        target2: target,
        direction: 'LONG',
        entryTime: 0
      } as never,
      high: target,
      low: 99,
      slippagePct: SLIP,
      roundtripFeePct: FEE,
      fundingPct: 0
    });

    const acc = createPositionAccounting();
    applyResolution(acc, {
      direction: 'LONG',
      entryPrice: entry,
      exitLegs: [{ leg: 'FULL', price: fill, size: 1 }],
      hasClosedFull: true,
      slippagePct: SLIP,
      roundtripFeePct: FEE,
      fundingPct: 0,
      profitValue: 0
    });

    // Mesma ponta, mesmo custo: a diferença de líquido é só arredondamento decimal.
    expect(positionNetPct(acc)).toBeCloseTo(live.netPnlPct, 6);
    expect(acc.grossPctWithSlip).toBeCloseTo(legGrossPct(fill, entry, 1, 'LONG'), 8);
  });

  it('BacktestEngine aplica slippage na SAÍDA e não na ENTRADA', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'server', 'services', 'BacktestEngine.ts'),
      'utf8'
    );
    // Nenhuma linha de atribuição do preço de entrada pode multiplicar por (1 ± slip).
    const entryAssignments = src.match(/entryPrice\s*=[^;]*;?/g) ?? [];
    expect(entryAssignments.length).toBeGreaterThan(0);
    for (const line of entryAssignments) {
      expect(line).not.toMatch(/slip/i);
    }
  });
});