/**
 * SDD Fase 9 — E1/E2: o aceite do dono tem que existir no mundo, e a razão do critério
 * (c) tem que descrever o que o código calcula.
 *
 * RED tests.
 *
 * ACHADO N1 (ALTO): `evaluateEntryConfirmationDecisionV2` aceita
 * `OwnerAcceptance { acceptedNegativeExpectancy, reason }`, e o relatório paired repassa o
 * campo até a regra. Mas `scripts/compare-entry.ts` não tem NENHUMA flag que o produza.
 * O critério (d) — "expectativa absoluta ≥ 0 **ou** aceite explícito do dono" — é, para
 * qualquer operador, inalcançável. A válvula existe no código e não existe no mundo.
 *
 * Isso não é o gate estar errado: o gate está certo. O que falta é o interruptor. Sem
 * ele, um operador que decide ligar a flag em modo experimental não tem como registrar o
 * motivo — e o `entry-confirmation-verdict.json` gerado mente sobre a própria regra que
 * ele diz ter aplicado, porque continua mostrando um veredito que ninguém podia ter
 * aceitado.
 *
 * ACHADO N2 (MÉDIO): o código calcula `ddLimit = controle × (1 + 20/100)` — **+20%
 * relativo**. A mensagem impressa diz `controle 58.48% + 20%`, que lido como linguagem
 * natural significa `58,48 + 20 p.p. = 78,48%`. Com controle ≠ 100% os dois números
 * divergem, e essa razão é a evidência que o revisor do documento de decisão lê.
 */
import { describe, it, expect } from 'vitest';
import { parseCompareEntryArgs } from '../scripts/compare-entry.js';
import {
  evaluateEntryConfirmationDecisionV2,
  type PairedArmMetrics,
  type PairedDiff
} from '../server/services/entryDecisionRuleV2.js';

const arm = (over: Partial<PairedArmMetrics> = {}): PairedArmMetrics => ({
  signalsEmitted: 300,
  entriesFilled: 150,
  positionsClosed: 148,
  winRate: 39.1,
  expectancyR: 0.2,
  maxDrawdownPct: 27.3,
  notFilledShare: 2,
  ...over
});

const diff = (over: Partial<PairedDiff> = {}): PairedDiff => ({
  mean: 0.2464,
  ciLow: 0.2073,
  ciHigh: 0.2853,
  pairs: 3321,
  ...over
});

describe('E1 — o aceite do dono é alcançável pela linha de comando', () => {
  it('sem a flag, nenhum aceite é produzido', () => {
    const parsed = parseCompareEntryArgs(['--universe']);
    expect(parsed.ownerAcceptance).toBeUndefined();
  });

  it('a flag sozinha já habilita o aceite', () => {
    const parsed = parseCompareEntryArgs(['--accept-negative-expectancy']);
    expect(parsed.ownerAcceptance).toEqual({ acceptedNegativeExpectancy: true });
  });

  it('a razão é capturada e viaja junto', () => {
    const parsed = parseCompareEntryArgs([
      '--accept-negative-expectancy',
      '--reason',
      'edge pareado confirmado; aceito drawdown para observação'
    ]);
    expect(parsed.ownerAcceptance).toEqual({
      acceptedNegativeExpectancy: true,
      reason: 'edge pareado confirmado; aceito drawdown para observação'
    });
  });

  it('a razão sozinha, sem a flag, NÃO habilita nada (aceite não é implícito)', () => {
    const parsed = parseCompareEntryArgs(['--reason', 'porque sim']);
    expect(parsed.ownerAcceptance).toBeUndefined();
  });

  it('o aceite destrava o critério (d) e a razão fica no registro', () => {
    const negativo = arm({ expectancyR: -0.1659 });
    const semAceite = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 58.48, expectancyR: -0.4123 }),
      withConfirmation: negativo,
      pairedDiff: diff()
    });
    expect(semAceite.enable).toBe(false);

    const comAceite = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 58.48, expectancyR: -0.4123 }),
      withConfirmation: negativo,
      pairedDiff: diff(),
      ownerAcceptance: { acceptedNegativeExpectancy: true, reason: 'edge pareado confirmado' }
    });
    expect(comAceite.enable).toBe(true);
    expect(comAceite.reasons.join(' ')).toContain('edge pareado confirmado');
  });

  it('o aceite não pula os outros três critérios', () => {
    const comAceite = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 58.48 }),
      withConfirmation: arm({ expectancyR: -0.2 }),
      pairedDiff: diff({ ciLow: -0.01 }),
      ownerAcceptance: { acceptedNegativeExpectancy: true }
    });
    expect(comAceite.enable).toBe(false);
    expect(comAceite.reasons.join(' ')).toContain('IC 95%');
  });
});

describe('E2 — a razão do critério (c) descreve o que o código calcula', () => {

  it('controle 58,48% ⇒ limite 70,18% (e NÃO 78,48%)', () => {
    const r = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 58.48 }),
      withConfirmation: arm({ maxDrawdownPct: 70.18, expectancyR: -0.1 }),
      pairedDiff: diff(),
      ownerAcceptance: { acceptedNegativeExpectancy: true }
    });
    const c = r.reasons.find(x => x.startsWith('(c)'))!;
    // 58,48 × 1,20 = 70,176 → 70,18. A soma em pontos percentuais daria 78,48.
    expect(c).toContain('70.18');
    expect(c).not.toContain('78.48');
  });

  it('a razao diz que os 20% sao RELATIVOS ao controle', () => {
    const r = evaluateEntryConfirmationDecisionV2({
      control: arm({ maxDrawdownPct: 58.48 }),
      withConfirmation: arm({ maxDrawdownPct: 90, expectancyR: -0.1 }),
      pairedDiff: diff(),
      ownerAcceptance: { acceptedNegativeExpectancy: true }
    });
    const c = r.reasons.find(x => x.startsWith('(c)'))!;
    expect(c.toLowerCase()).toContain('relativ');
  });
});