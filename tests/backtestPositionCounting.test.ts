import { describe, it, expect } from 'vitest';
import {
  createPositionAccounting,
  applyResolution
} from '../server/services/backtestAccounting.js';

/**
 * 8.0.1 / CA-0.1 — unidade é a POSIÇÃO, não o candle de resolução.
 *
 * Cenário de fixture: 1 posição, parcial no TP1 e runner no TP2.
 * Deve devolver `positionsClosed = 1` e `legs = 2` — antes o motor contava 2
 * "trades" (fechados > preenchidos, J-01).
 */

const slip = 0.02; // 0.02%
const roundtripFee = 0.08; // 0.04% por lado

function registerFixturePosition() {
  const acc = createPositionAccounting();
  const entryPrice = 100;

  // Perna 1 — parcial de 50% no TP1 (110), com slippage.
  const t1Fill = 110 * (1 - slip / 100);
  const closedOnTp1 = applyResolution(acc, {
    direction: 'LONG',
    entryPrice,
    exitLegs: [{ leg: 'PARTIAL', price: t1Fill, size: 0.5 }],
    hasClosedFull: false,
    slippagePct: slip,
    roundtripFeePct: roundtripFee,
    fundingPct: 0,
    profitValue: 0
  });

  // Perna 2 — runner de 50% no TP2 (120), fechando a posição.
  const t2Fill = 120 * (1 - slip / 100);
  const closedOnTp2 = applyResolution(acc, {
    direction: 'LONG',
    entryPrice,
    exitLegs: [{ leg: 'RUNNER', price: t2Fill, size: 0.5 }],
    hasClosedFull: true,
    slippagePct: slip,
    roundtripFeePct: roundtripFee,
    fundingPct: 0,
    profitValue: 0
  });

  return { acc, closedOnTp1, closedOnTp2 };
}

describe('8.0.1 / CA-0.1 — contagem por posição (legs vs fechados)', () => {
  it('1 posição com parcial no TP1 e runner no TP2 → positionsClosed = 1 e legs = 2', () => {
    const { acc, closedOnTp1, closedOnTp2 } = registerFixturePosition();

    expect(closedOnTp1).toBe(false); // parcial NÃO fecha a posição
    expect(closedOnTp2).toBe(true); // runner fecha

    expect(acc.legs).toBe(2);
    expect(acc.legKinds).toEqual(['PARTIAL', 'RUNNER']);
    expect(acc.hadPartial).toBe(true);
    expect(acc.closedSize).toBeCloseTo(1, 8);

    const positionsClosed = acc.isClosed ? 1 : 0;
    expect(positionsClosed).toBe(1);
    // O bug J-01: leg-count (2) tratado como número de trades. Agora são unidades
    // separadas — 1 posição, 2 pernas.
    expect(acc.legs).toBeGreaterThan(positionsClosed);
  });

  it('uma única saída FULL conta 1 perna e 1 posição fechada', () => {
    const acc = createPositionAccounting();
    const closed = applyResolution(acc, {
      direction: 'SHORT',
      entryPrice: 100,
      exitLegs: [{ leg: 'FULL', price: 110 * (1 + slip / 100), size: 1 }],
      hasClosedFull: true,
      slippagePct: slip,
      roundtripFeePct: roundtripFee,
      fundingPct: 0,
      profitValue: 0
    });
    expect(closed).toBe(true);
    expect(acc.legs).toBe(1);
    expect(acc.legKinds).toEqual(['FULL']);
    expect(acc.hadPartial).toBe(false);
  });
});
