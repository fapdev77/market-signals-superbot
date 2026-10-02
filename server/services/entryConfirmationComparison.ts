/**
 * 7.2.2 — Relatório do experimento PAREADO da confirmação de entrada.
 *
 * Puro sobre dois `BacktestResult` (mesmo símbolo, período, semente e engineVersion,
 * mudando só a flag `entryConfirmation`). Produz as métricas por braço, o IC bootstrap
 * da DIFERENÇA de expectativa por sinal emitido (não preenchido conta 0 R) e aplica a
 * regra pré-registrada da 7.2.3.
 *
 * O bootstrap é semeado (mulberry32): mesma semente ⇒ relatório idêntico (CA-2.3).
 */

import type { BacktestResult } from '../../src/types.js';
import {
  evaluateEntryConfirmationDecision,
  type EntryArmMetrics,
  type EntryDecision,
  type ExpectancyDiff
} from './entryDecisionRule.js';

function mulberry32(seed: number): () => number {
  let s = Math.floor(seed) || 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

/** 7.2.2 — IC bootstrap da diferença de médias (b − a), semeado e determinístico. */
export function bootstrapMeanDiffCI(
  a: number[],
  b: number[],
  opts: { iterations?: number; seed?: number; alpha?: number } = {}
): ExpectancyDiff {
  const iterations = Math.max(1, opts.iterations ?? 2000);
  const alpha = opts.alpha ?? 0.05;
  const rand = mulberry32(opts.seed ?? 12345);
  const n = a.length;
  const m = b.length;
  const observed = mean(b) - mean(a);
  if (n === 0 || m === 0) return { mean: observed, ciLow: observed, ciHigh: observed };

  const diffs: number[] = new Array(iterations);
  for (let it = 0; it < iterations; it++) {
    let sa = 0;
    for (let i = 0; i < n; i++) sa += a[Math.floor(rand() * n)];
    let sb = 0;
    for (let i = 0; i < m; i++) sb += b[Math.floor(rand() * m)];
    diffs[it] = sb / m - sa / n;
  }
  diffs.sort((x, y) => x - y);
  const loIdx = Math.max(0, Math.floor((alpha / 2) * iterations));
  const hiIdx = Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations));
  return { mean: observed, ciLow: diffs[loIdx], ciHigh: diffs[hiIdx] };
}

/** 7.2.2 — métricas por braço a partir do resultado do backtest. */
export function computeArmMetrics(result: BacktestResult): EntryArmMetrics {
  const ec = result.entryConfirmation;
  const signalsEmitted = ec?.signalsEmitted ?? result.totalTrades;
  const entriesFilled = ec?.entriesFilled ?? result.totalTrades;
  const rPerSignal = ec?.rPerSignal ?? [];
  const expectancyR = rPerSignal.length > 0 ? mean(rPerSignal) : 0;
  const notFilledShare = signalsEmitted > 0 ? (ec?.entriesNotFilled ?? 0) / signalsEmitted : 0;
  const avgFillMinutes = ec && ec.fillCount > 0 ? ec.fillMinutesSum / ec.fillCount : 0;
  return {
    signalsEmitted,
    entriesFilled,
    closedTrades: result.totalTrades,
    winRate: result.winRate,
    expectancyR,
    maxDrawdownPct: result.maxDrawdown,
    notFilledShare,
    avgFillMinutes
  };
}

export interface EntryComparisonInput {
  symbol: string;
  days: number;
  seed: number;
  engineVersion: string;
  control: BacktestResult;
  withConfirmation: BacktestResult;
  generatedAt?: number;
  iterations?: number;
}

export interface EntryComparisonReport {
  markdown: string;
  decision: EntryDecision;
  diff: ExpectancyDiff;
  controlMetrics: EntryArmMetrics;
  withMetrics: EntryArmMetrics;
}

function armTable(label: string, m: EntryArmMetrics): string {
  return [
    `| ${label} | |`,
    `|---|---|`,
    `| Sinais emitidos | ${m.signalsEmitted} |`,
    `| Preenchidos | ${m.entriesFilled} |`,
    `| Taxa de preenchimento | ${m.signalsEmitted > 0 ? ((m.entriesFilled / m.signalsEmitted) * 100).toFixed(1) : '0.0'}% |`,
    `| Fechados | ${m.closedTrades} |`,
    `| Win rate | ${m.winRate.toFixed(2)}% |`,
    `| Expectativa líquida (R/sinal emitido) | ${m.expectancyR.toFixed(4)} |`,
    `| Drawdown máximo | ${m.maxDrawdownPct.toFixed(2)}% |`,
    `| Tempo médio até o preenchimento | ${m.avgFillMinutes.toFixed(1)} min |`,
    `| ENTRY_NOT_FILLED | ${(m.notFilledShare * 100).toFixed(1)}% |`
  ].join('\n');
}

/** 7.2.2 / CA-2.3, CA-2.4 — monta o markdown determinístico + aplica a regra da 7.2.3. */
export function buildEntryComparisonReport(input: EntryComparisonInput): EntryComparisonReport {
  const controlMetrics = computeArmMetrics(input.control);
  const withMetrics = computeArmMetrics(input.withConfirmation);

  const controlR = input.control.entryConfirmation?.rPerSignal ?? [];
  const withR = input.withConfirmation.entryConfirmation?.rPerSignal ?? [];
  const diff = bootstrapMeanDiffCI(controlR, withR, { seed: input.seed, iterations: input.iterations });

  const decision = evaluateEntryConfirmationDecision({
    control: controlMetrics,
    withConfirmation: withMetrics,
    expectancyDiff: diff
  });

  const generatedAt = input.generatedAt ?? Date.now();
  const limitation = input.withConfirmation.entryConfirmation?.limitation;

  const markdown = [
    `# Comparativo da confirmação de entrada (7.2)`,
    ``,
    `- **Símbolo:** ${input.symbol}`,
    `- **Período:** ${input.days} dias`,
    `- **Semente:** ${input.seed}`,
    `- **engineVersion:** ${input.engineVersion}`,
    `- **Gerado em:** ${new Date(generatedAt).toISOString()}`,
    ``,
    `Experimento pareado: mesmo período, símbolos, semente e engineVersion; muda só`,
    `\`ENTRY_CONFIRMATION_ENABLED\`. R por SINAL EMITIDO (não preenchido conta 0 R).`,
    ``,
    `## Braço A — controle (sem confirmação)`,
    ``,
    armTable('Controle', controlMetrics),
    ``,
    `## Braço B — com confirmação (PENDING_ENTRY)`,
    ``,
    armTable('Com confirmação', withMetrics),
    ``,
    `## Diferença de expectativa por sinal emitido (B − A)`,
    ``,
    `- Média: **${diff.mean.toFixed(4)} R**`,
    `- IC 95% bootstrap: [${diff.ciLow.toFixed(4)}, ${diff.ciHigh.toFixed(4)}]`,
    ``,
    `## Regra de decisão pré-registrada (7.2.3)`,
    ``,
    ...decision.reasons.map(r => `- ${r}`),
    ``,
    `**Veredito: ${decision.enable ? 'LIGAR a flag' : 'MANTER a flag DESLIGADA'}**`,
    ``,
    ...(limitation ? [`> Limitação declarada: ${limitation}`, ``] : [])
  ].join('\n');

  return { markdown, decision, diff, controlMetrics, withMetrics };
}
