import { describe, it, expect } from 'vitest';
import {
  createPositionAccounting,
  applyResolution,
  positionNetPct,
  positionSlippagePct,
  rDecomposition,
  legGrossPct,
  type PositionAccounting
} from '../server/services/backtestAccounting.js';
import { dAdd, dSub, dMul } from '../server/utils/decimal.js';

/**
 * 8.0.2 / CA-0.2, CA-0.3 — decomposição de R por posição.
 *
 * Identidade exigida: `rNet = rGross − rFees − rSlippage − rFunding`, com o
 * slippage separado do bruto (o resolver embute o slippage nos preços; a
 * contabilidade recupera o preço-limite para isolá-lo).
 */

/** PRNG determinístico para a propriedade (CA-0.2). */
function mulberry32(seed: number): () => number {
  let s = Math.floor(seed) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRandomPosition(rand: () => number): { acc: PositionAccounting; riskPct: number } {
  const direction = rand() > 0.5 ? 'LONG' : 'SHORT';
  const entryPrice = 50 + rand() * 100;
  const riskPct = 1 + rand() * 9; // distância do stop em % (1..10)
  const slip = rand() * 0.2; // 0..0.2%
  const roundtripFee = 0.04 + rand() * 0.1;
  const acc = createPositionAccounting();

  const sign = direction === 'LONG' ? 1 : -1;
  const rounds = rand() > 0.4 ? 2 : 1;
  for (let r = 0; r < rounds; r++) {
    const size = rounds === 2 ? 0.5 : 1;
    const isLast = r === rounds - 1;
    const level = entryPrice * (1 + sign * (r + 1) * (riskPct / 100));
    const price = sign === 1 ? level * (1 - slip / 100) : level * (1 + slip / 100);
    applyResolution(acc, {
      direction,
      entryPrice,
      exitLegs: [{ leg: isLast ? 'RUNNER' : 'PARTIAL', price, size }],
      hasClosedFull: isLast,
      slippagePct: slip,
      roundtripFeePct: roundtripFee,
      fundingPct: rand() * 0.05,
      profitValue: 0
    });
  }
  return { acc, riskPct };
}

describe('8.0.2 / CA-0.3 — exemplo calculado à mão (valores exatos)', () => {
  it('LONG stop: rGross, rFees, rSlippage, rFunding exatos', () => {
    const acc = createPositionAccounting();
    applyResolution(acc, {
      direction: 'LONG',
      entryPrice: 100,
      exitLegs: [{ leg: 'FULL', price: 90 * (1 - 0.0002), size: 1 }],
      hasClosedFull: true,
      slippagePct: 0.02,
      roundtripFeePct: 0.08,
      fundingPct: 0.0123,
      profitValue: 0
    });

    const riskPct = 10; // |100 − 90| / 100 × 100
    const r = rDecomposition(acc, riskPct);

    // bruto sem slippage = −10%; slippage = 0.018%; taxas = 0.08%; funding = 0.0123%
    expect(acc.grossPctNoSlip).toBe(-10);
    expect(positionSlippagePct(acc)).toBe(0.018);
    expect(acc.feesPct).toBe(0.08);
    expect(acc.fundingPct).toBe(0.0123);
    expect(positionNetPct(acc)).toBe(-10.1103);

    expect(r.rGross).toBe(-1);
    expect(r.rFees).toBe(0.008);
    expect(r.rSlippage).toBe(0.0018);
    expect(r.rFunding).toBe(0.0012); // 0.0123/10 arredondado a 4 casas
    expect(r.rNet).toBe(-1.011);

    // Identidade da 8.0.2 (com o arredondamento de cada componente a 4 casas).
    expect(r.rNet).toBeCloseTo(dSub(dSub(dSub(r.rGross, r.rFees), r.rSlippage), r.rFunding), 4);
  });
});

describe('8.0.2 / CA-0.2 — propriedade (sequências aleatórias com semente)', () => {
  it('rNet = rGross − rFees − rSlippage − rFunding e net = grossWithSlip − fees − funding', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = mulberry32(seed);
      const { acc, riskPct } = buildRandomPosition(rand);
      const r = rDecomposition(acc, riskPct);

      // O líquido não depende de como separamos bruto/slippage.
      const netFromComponents = dSub(
        dSub(dSub(acc.grossPctWithSlip, acc.feesPct), acc.fundingPct),
        0
      );
      expect(positionNetPct(acc)).toBeCloseTo(netFromComponents, 8);

      const identity = dSub(dSub(dSub(r.rGross, r.rFees), r.rSlippage), r.rFunding);
      expect(r.rNet).toBeCloseTo(identity, 3);

      // legs ⟺ soma das pernas aplicadas; invariante de tamanho.
      expect(acc.legs).toBeGreaterThanOrEqual(1);
      expect(acc.closedSize).toBeLessThanOrEqual(1.0000001);
    }
  });

  it('legGrossPct reproduz a soma decimal das pernas', () => {
    const acc = createPositionAccounting();
    applyResolution(acc, {
      direction: 'LONG',
      entryPrice: 0.1,
      exitLegs: [
        { leg: 'PARTIAL', price: 0.16 * (1 - 0.001), size: 0.5 },
        { leg: 'RUNNER', price: 0.22 * (1 - 0.001), size: 0.5 }
      ],
      hasClosedFull: true,
      slippagePct: 0.1,
      roundtripFeePct: 0,
      fundingPct: 0,
      profitValue: 0
    });
    const manual = dAdd(
      legGrossPct(0.16 * (1 - 0.001), 0.1, 0.5, 'LONG'),
      legGrossPct(0.22 * (1 - 0.001), 0.1, 0.5, 'LONG')
    );
    expect(acc.grossPctWithSlip).toBeCloseTo(manual, 8);
    expect(dMul(legGrossPct(0.16, 0.1, 0.5, 'LONG'), 1)).toBe(
      legGrossPct(0.16, 0.1, 0.5, 'LONG')
    );
  });
});
