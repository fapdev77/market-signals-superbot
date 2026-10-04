/**
 * 8.0 / J-01, J-02 — Contabilidade de POSIÇÃO do backtest (pura e testável).
 *
 * O motor antigo somava `wins + losses` a cada candle de resolução, então uma
 * posição com parcial no TP1 e runner no TP2 virava DOIS "trades" para UM
 * preenchimento ("fechados > preenchidos", J-01). Aqui a unidade é a POSIÇÃO:
 * as pernas (legs) são acumuladas e só no fechamento total a posição vira
 * win/loss.
 *
 * Também decompõe o R do resultado (J-02). O slippage é embutido nos preços de
 * execução de SAÍDA pelo `positionResolution`; esta camada RECUPERA o preço-limite
 * sem slippage (invertendo `slipFill`, que é uniforme para stop e alvo) para separar
 * `rGross` de `rSlippage`, valendo a identidade exata:
 *
 *     rNet = rGross − rFees − rSlippage − rFunding
 *
 * CRÍTICO-2 (auditoria 2026-10-04): a recuperação só é exata se `entryPrice` for o
 * preço-LIMITE de entrada. O motor aplicava slippage também na entrada, o que
 * contaminava `grossPctNoSlip` (rotulado "antes do slippage") e escondia a perna de
 * entrada de `rSlippage` — a identidade fechava por compensação. O slippage é
 * aplicado uma vez por perna: entrada no preço-limite, saída com `slipFill`, igual ao
 * live.
 *
 * Tudo em aritmética decimal (`server/utils/decimal.ts`).
 */

import { dAdd, dSub, dMul, dDiv, dRound } from '../utils/decimal.js';

export type PositionDirection = 'LONG' | 'SHORT';
export type ExitLegKind = 'FULL' | 'PARTIAL' | 'RUNNER';

export interface AccountingExitLeg {
  leg: ExitLegKind;
  price: number;
  size: number; // fração da posição original (0..1)
}

export interface PositionAccounting {
  /** Eventos de saída (pernas) acumulados — 1 posição com TP1+TP2 fecha com 2. */
  legs: number;
  /** Bruto % ANTES do slippage (soma das pernas no preço-limite). */
  grossPctNoSlip: number;
  /** Bruto % COM o slippage simulado (o que o resolver devolve). */
  grossPctWithSlip: number;
  /** Taxas % (roundtrip × tamanho da perna). */
  feesPct: number;
  /** Funding % acumulado da posição. */
  fundingPct: number;
  /** Valor (moeda) de PnL líquido acumulado para a posição. */
  profitValue: number;
  /** Tamanho total fechado (soma dos tamanhos das pernas). */
  closedSize: number;
  /** Houve alguma perna PARCIAL? */
  hadPartial: boolean;
  /** Kinds das pernas na ordem em que fecharam. */
  legKinds: ExitLegKind[];
  /** Alguma resolução fechou a posição inteira? */
  isClosed: boolean;
}

export function createPositionAccounting(): PositionAccounting {
  return {
    legs: 0,
    grossPctNoSlip: 0,
    grossPctWithSlip: 0,
    feesPct: 0,
    fundingPct: 0,
    profitValue: 0,
    closedSize: 0,
    hadPartial: false,
    legKinds: [],
    isClosed: false
  };
}

/** PnL % de uma perna num dado preço de execução (mesma fórmula do resolver). */
export function legGrossPct(
  fillPrice: number,
  entryPrice: number,
  size: number,
  direction: PositionDirection
): number {
  const diff = direction === 'LONG' ? dSub(fillPrice, entryPrice) : dSub(entryPrice, fillPrice);
  return dMul(dDiv(dMul(diff, 100), entryPrice), size);
}

/**
 * Recupera o preço-limite (stop/alvo) sem slippage a partir do preço executado.
 * `slipFill` é uniforme — LONG vende a `price·(1−s/100)`, SHORT compra a
 * `price·(1+s/100)` — então a inversão não depende de a perna ser stop ou alvo.
 */
export function unSlippedLevel(
  fillPrice: number,
  slippagePct: number,
  direction: PositionDirection
): number {
  const factor =
    direction === 'LONG'
      ? dSub(1, dDiv(slippagePct, 100))
      : dAdd(1, dDiv(slippagePct, 100));
  return dDiv(fillPrice, factor);
}

export interface ApplyResolutionInput {
  direction: PositionDirection;
  entryPrice: number;
  exitLegs: AccountingExitLeg[];
  /** True quando esta resolução fecha a posição inteira (stop final ou TP2). */
  hasClosedFull: boolean;
  slippagePct: number;
  /** Taxa roundtrip (ida+volta) em %, aplicada por fração da posição fechada. */
  roundtripFeePct: number;
  /** Funding % desta resolução (já calculado pelo motor). */
  fundingPct: number;
  /** Valor (moeda) de PnL líquido aplicado ao saldo nesta resolução. */
  profitValue: number;
}

/**
 * Acumula UMA resolução (candle) na posição. Retorna `true` se esta resolução
 * fechou a posição inteira — o motor só então contabiliza win/loss e R.
 */
export function applyResolution(
  acc: PositionAccounting,
  input: ApplyResolutionInput
): boolean {
  for (const leg of input.exitLegs) {
    acc.legs += 1;
    acc.legKinds.push(leg.leg);
    acc.closedSize = dAdd(acc.closedSize, leg.size);
    if (leg.leg === 'PARTIAL') acc.hadPartial = true;

    const level = unSlippedLevel(leg.price, input.slippagePct, input.direction);
    acc.grossPctNoSlip = dAdd(
      acc.grossPctNoSlip,
      legGrossPct(level, input.entryPrice, leg.size, input.direction)
    );
    acc.grossPctWithSlip = dAdd(
      acc.grossPctWithSlip,
      legGrossPct(leg.price, input.entryPrice, leg.size, input.direction)
    );
    acc.feesPct = dAdd(acc.feesPct, dMul(input.roundtripFeePct, leg.size));
  }

  acc.fundingPct = dAdd(acc.fundingPct, input.fundingPct);
  acc.profitValue = dAdd(acc.profitValue, input.profitValue);

  if (input.hasClosedFull) acc.isClosed = true;
  return input.hasClosedFull === true;
}

/** Custo de slippage % da posição (bruto sem slippage − bruto com slippage). */
export function positionSlippagePct(acc: PositionAccounting): number {
  return dSub(acc.grossPctNoSlip, acc.grossPctWithSlip);
}

/** PnL % líquido da posição: bruto − slippage − taxas − funding. */
export function positionNetPct(acc: PositionAccounting): number {
  return dSub(
    dSub(dSub(acc.grossPctNoSlip, positionSlippagePct(acc)), acc.feesPct),
    acc.fundingPct
  );
}

export interface RDecomposition {
  rGross: number;
  rFees: number;
  rSlippage: number;
  rFunding: number;
  rNet: number;
}

/**
 * Decompõe o resultado da posição em R. Invariante (CA-0.2):
 * `rNet = rGross − rFees − rSlippage − rFunding`.
 */
export function rDecomposition(acc: PositionAccounting, riskPct: number): RDecomposition {
  if (!(riskPct > 0)) {
    return { rGross: 0, rFees: 0, rSlippage: 0, rFunding: 0, rNet: 0 };
  }
  return {
    rGross: dRound(dDiv(acc.grossPctNoSlip, riskPct), 4),
    rFees: dRound(dDiv(acc.feesPct, riskPct), 4),
    rSlippage: dRound(dDiv(positionSlippagePct(acc), riskPct), 4),
    rFunding: dRound(dDiv(acc.fundingPct, riskPct), 4),
    rNet: dRound(dDiv(positionNetPct(acc), riskPct), 4)
  };
}

/** Custo total (taxas + slippage + funding) em R, positivo = custo. */
export function positionCostR(acc: PositionAccounting, riskPct: number): number {
  if (!(riskPct > 0)) return 0;
  const costPct = dAdd(dAdd(acc.feesPct, positionSlippagePct(acc)), acc.fundingPct);
  return dRound(dDiv(costPct, riskPct), 4);
}
