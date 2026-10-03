/**
 * 8.2.1 / CA-2.1..CA-2.4 — Comparativo PAREADO da confirmação de entrada.
 *
 * Corrige o experimento da 7.2.2: em vez de tratar os dois braços como amostras
 * independentes de tamanhos diferentes, pareia os sinais pela chave determinística
 * (`EntryConfirmationStats.signalKeys`, mesma vela/direção/zona) e faz o bootstrap
 * reamostrando PARES. Um sinal presente em só um braço entra com R = 0 no outro,
 * de modo que o conjunto pareado é idêntico nos dois braços (CA-2.1).
 *
 * Determinístico para a mesma semente (CA-2.2).
 */

import type { BacktestResult, EntryConfirmationStats } from '../../src/types.js';
import { mean } from './entryConfirmationComparison.js';
import {
  evaluateEntryConfirmationDecisionV2,
  type EntryDecisionV2,
  type OwnerAcceptance,
  type PairedArmMetrics,
  type PairedDiff
} from './entryDecisionRuleV2.js';

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

/** R por chave de sinal. Sem `signalKeys`, cai no índice (compatibilidade com séries antigas). */
export function signalKeyMap(ec?: EntryConfirmationStats): Map<string, number> {
  const map = new Map<string, number>();
  const r = ec?.rPerSignal ?? [];
  const keys = ec?.signalKeys;
  for (let i = 0; i < r.length; i++) {
    map.set(keys?.[i] ?? `idx:${i}`, r[i]);
  }
  return map;
}

export interface PairedSeries {
  keys: string[];
  controlR: number[];
  withR: number[];
}

/** União determinística das chaves (ordem: controle, depois extras da confirmação). */
export function buildPairedSeries(
  control: BacktestResult,
  withConfirmation: BacktestResult
): PairedSeries {
  const controlMap = signalKeyMap(control.entryConfirmation);
  const withMap = signalKeyMap(withConfirmation.entryConfirmation);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const k of controlMap.keys()) {
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  for (const k of withMap.keys()) {
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return {
    keys,
    controlR: keys.map(k => controlMap.get(k) ?? 0),
    withR: keys.map(k => withMap.get(k) ?? 0)
  };
}

/** 8.2.2 — bootstrap PAREADO: reamostra pares (i) e tira a média de (with − control). */
export function bootstrapPairedDiffCI(
  controlR: number[],
  withR: number[],
  opts: { iterations?: number; seed?: number; alpha?: number } = {}
): PairedDiff {
  const n = Math.min(controlR.length, withR.length);
  const iterations = Math.max(1, opts.iterations ?? 2000);
  const alpha = opts.alpha ?? 0.05;
  const rand = mulberry32(opts.seed ?? 12345);
  const diffsPerPair: number[] = new Array(n);
  for (let i = 0; i < n; i++) diffsPerPair[i] = withR[i] - controlR[i];
  const observed = n > 0 ? mean(diffsPerPair) : 0;
  if (n === 0) return { mean: 0, ciLow: 0, ciHigh: 0, pairs: 0 };

  const samples: number[] = new Array(iterations);
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += diffsPerPair[Math.floor(rand() * n)];
    samples[it] = sum / n;
  }
  samples.sort((x, y) => x - y);
  const loIdx = Math.max(0, Math.floor((alpha / 2) * iterations));
  const hiIdx = Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations));
  return { mean: observed, ciLow: samples[loIdx], ciHigh: samples[hiIdx], pairs: n };
}

/**
 * Métricas pareadas de um braço. `signalsEmitted` é o tamanho do conjunto PAREADO
 * (igual nos dois braços, CA-2.1); a expectativa usa o R pareado (0 nas ausências).
 */
export function computePairedArmMetrics(
  result: BacktestResult,
  series: PairedSeries,
  side: 'control' | 'with'
): PairedArmMetrics {
  const ec = result.entryConfirmation;
  const rSeries = side === 'control' ? series.controlR : series.withR;
  const entriesFilled = result.positionsFilled ?? ec?.entriesFilled ?? 0;
  const positionsClosed = result.positionsClosed ?? result.totalTrades;
  const ownSignals = ec?.signalsEmitted ?? series.keys.length;
  const ownNotFilled = ec?.entriesNotFilled ?? Math.max(0, ownSignals - entriesFilled);
  return {
    signalsEmitted: series.keys.length,
    entriesFilled,
    positionsClosed,
    winRate: result.winRate,
    expectancyR: mean(rSeries),
    maxDrawdownPct: result.maxDrawdown,
    notFilledShare: ownSignals > 0 ? ownNotFilled / ownSignals : 0
  };
}

export interface PairedComparisonInput {
  symbol: string;
  days: number;
  seed: number;
  engineVersion: string;
  control: BacktestResult;
  withConfirmation: BacktestResult;
  generatedAt?: number;
  iterations?: number;
  ownerAcceptance?: OwnerAcceptance;
}

export interface PairedComparisonReport {
  markdown: string;
  decision: EntryDecisionV2;
  diff: PairedDiff;
  controlMetrics: PairedArmMetrics;
  withMetrics: PairedArmMetrics;
}

function costAvgR(result: BacktestResult): number {
  return result.rDecomposition?.costAvgR ?? 0;
}

function armTable(label: string, m: PairedArmMetrics, costR: number): string {
  return [
    `| ${label} | |`,
    `|---|---|`,
    `| Sinais no conjunto pareado | ${m.signalsEmitted} |`,
    `| Posições preenchidas | ${m.entriesFilled} |`,
    `| Posições fechadas | ${m.positionsClosed} |`,
    `| Win rate (por posição) | ${m.winRate.toFixed(2)}% |`,
    `| Expectativa líquida (R/sinal pareado) | ${m.expectancyR.toFixed(4)} |`,
    `| Drawdown máximo | ${m.maxDrawdownPct.toFixed(2)}% |`,
    `| Custo médio (taxas+slippage+funding) | ${costR.toFixed(4)} R |`,
    `| Não preenchidos (próprios) | ${(m.notFilledShare * 100).toFixed(1)}% |`
  ].join('\n');
}

/** 8.2.2 / CA-2.2, CA-2.4 — markdown determinístico + regra v2. */
export function buildPairedEntryComparisonReport(
  input: PairedComparisonInput
): PairedComparisonReport {
  const series = buildPairedSeries(input.control, input.withConfirmation);
  const controlMetrics = computePairedArmMetrics(input.control, series, 'control');
  const withMetrics = computePairedArmMetrics(input.withConfirmation, series, 'with');
  const diff = bootstrapPairedDiffCI(series.controlR, series.withR, {
    seed: input.seed,
    iterations: input.iterations
  });

  const decision = evaluateEntryConfirmationDecisionV2({
    control: controlMetrics,
    withConfirmation: withMetrics,
    pairedDiff: diff,
    ownerAcceptance: input.ownerAcceptance
  });

  const generatedAt = input.generatedAt ?? Date.now();
  const limitation = input.withConfirmation.entryConfirmation?.limitation;

  const markdown = [
    `# Comparativo PAREADO da confirmação de entrada (8.2)`,
    ``,
    `- **Símbolo:** ${input.symbol}`,
    `- **Período:** ${input.days} dias`,
    `- **Semente:** ${input.seed}`,
    `- **engineVersion:** ${input.engineVersion}`,
    `- **Gerado em:** ${new Date(generatedAt).toISOString()}`,
    ``,
    `Experimento pareado por SINAL (mesma chave): mesmo período, símbolos, semente e`,
    `engineVersion; muda só \`ENTRY_CONFIRMATION_ENABLED\`. Sinal ausente ou não preenchido`,
    `em um braço conta 0 R. O bootstrap reamostra PARES (CA-2.1/CA-2.2).`,
    ``,
    `## Braço A — controle (sem confirmação)`,
    ``,
    armTable('Controle', controlMetrics, costAvgR(input.control)),
    ``,
    `## Braço B — com confirmação (PENDING_ENTRY)`,
    ``,
    armTable('Com confirmação', withMetrics, costAvgR(input.withConfirmation)),
    ``,
    `## Diferença PAREADA de expectativa por sinal (B − A)`,
    ``,
    `- Pares: **${diff.pairs}**`,
    `- Média: **${diff.mean.toFixed(4)} R**`,
    `- IC 95% bootstrap pareado: [${diff.ciLow.toFixed(4)}, ${diff.ciHigh.toFixed(4)}]`,
    ``,
    `## Regra de decisão pré-registrada v2 (8.2.2)`,
    ``,
    ...decision.reasons.map(r => `- ${r}`),
    ``,
    `**Veredito: ${decision.enable ? 'LIGAR a flag' : 'MANTER a flag DESLIGADA'}**`,
    ``,
    ...(limitation ? [`> Limitação declarada: ${limitation}`, ``] : [])
  ].join('\n');

  return { markdown, decision, diff, controlMetrics, withMetrics };
}

export interface UniversePairedInput {
  symbols: string[];
  days: number;
  seed: number;
  engineVersion: string;
  runs: Array<{ symbol: string; control: BacktestResult; withConfirmation: BacktestResult }>;
  generatedAt?: number;
  iterations?: number;
  ownerAcceptance?: OwnerAcceptance;
  /** Origem declarada dos candles (ex.: "LIVE (klines reais da Binance)"). */
  dataOrigin?: string;
}

export interface UniversePairedReport {
  markdown: string;
  decision: EntryDecisionV2;
  diff: PairedDiff;
  controlMetrics: PairedArmMetrics;
  withMetrics: PairedArmMetrics;
  perSymbol: Array<{
    symbol: string;
    pairs: number;
    control: PairedArmMetrics;
    with: PairedArmMetrics;
    diff: PairedDiff;
  }>;
}

function poolWinRate(
  runs: Array<{ control: BacktestResult; withConfirmation: BacktestResult }>,
  side: 'control' | 'with'
): number {
  let wins = 0;
  let closed = 0;
  for (const r of runs) {
    const res = side === 'control' ? r.control : r.withConfirmation;
    wins += res.winningTrades ?? 0;
    closed += res.positionsClosed ?? res.totalTrades ?? 0;
  }
  return closed > 0 ? (wins / closed) * 100 : 0;
}

/**
 * 8.2.3 — comparativo PAREADO sobre um UNIVERSO de símbolos (não só BTCUSDT).
 *
 * Cada símbolo roda o par controle/confirmação; as séries pareadas são prefixadas
 * pela chave do símbolo e concatenadas, e o bootstrap reamostra os pares do universo
 * inteiro. A regra v2 (8.2.2) decide sobre o agregado, exatamente como no braço único.
 */
export function buildUniversePairedEntryComparisonReport(
  input: UniversePairedInput
): UniversePairedReport {
  const controlR: number[] = [];
  const withR: number[] = [];
  const perSymbol: UniversePairedReport['perSymbol'] = [];

  let controlFilled = 0;
  let withFilled = 0;
  let controlClosed = 0;
  let withClosed = 0;
  let controlOwnSignals = 0;
  let withOwnSignals = 0;
  let controlOwnNotFilled = 0;
  let withOwnNotFilled = 0;
  let controlMaxDd = 0;
  let withMaxDd = 0;

  for (const run of input.runs) {
    const series = buildPairedSeries(run.control, run.withConfirmation);
    for (let i = 0; i < series.keys.length; i++) {
      controlR.push(series.controlR[i]);
      withR.push(series.withR[i]);
    }
    const c = computePairedArmMetrics(run.control, series, 'control');
    const w = computePairedArmMetrics(run.withConfirmation, series, 'with');
    const symbolDiff = bootstrapPairedDiffCI(series.controlR, series.withR, {
      seed: input.seed,
      iterations: input.iterations
    });
    perSymbol.push({ symbol: run.symbol, pairs: symbolDiff.pairs, control: c, with: w, diff: symbolDiff });

    controlFilled += c.entriesFilled;
    withFilled += w.entriesFilled;
    controlClosed += c.positionsClosed;
    withClosed += w.positionsClosed;
    controlMaxDd = Math.max(controlMaxDd, c.maxDrawdownPct);
    withMaxDd = Math.max(withMaxDd, w.maxDrawdownPct);

    const cOwnSignals = run.control.entryConfirmation?.signalsEmitted ?? series.keys.length;
    const wOwnSignals = run.withConfirmation.entryConfirmation?.signalsEmitted ?? series.keys.length;
    controlOwnSignals += cOwnSignals;
    withOwnSignals += wOwnSignals;
    controlOwnNotFilled += run.control.entryConfirmation?.entriesNotFilled ?? 0;
    withOwnNotFilled += run.withConfirmation.entryConfirmation?.entriesNotFilled ?? 0;
  }

  const pairs = Math.min(controlR.length, withR.length);
  const diff = bootstrapPairedDiffCI(controlR, withR, {
    seed: input.seed,
    iterations: input.iterations
  });

  const controlMetrics: PairedArmMetrics = {
    signalsEmitted: pairs,
    entriesFilled: controlFilled,
    positionsClosed: controlClosed,
    winRate: poolWinRate(input.runs, 'control'),
    expectancyR: pairs > 0 ? mean(controlR) : 0,
    maxDrawdownPct: controlMaxDd,
    notFilledShare: controlOwnSignals > 0 ? controlOwnNotFilled / controlOwnSignals : 0
  };
  const withMetrics: PairedArmMetrics = {
    signalsEmitted: pairs,
    entriesFilled: withFilled,
    positionsClosed: withClosed,
    winRate: poolWinRate(input.runs, 'with'),
    expectancyR: pairs > 0 ? mean(withR) : 0,
    maxDrawdownPct: withMaxDd,
    notFilledShare: withOwnSignals > 0 ? withOwnNotFilled / withOwnSignals : 0
  };

  const decision = evaluateEntryConfirmationDecisionV2({
    control: controlMetrics,
    withConfirmation: withMetrics,
    pairedDiff: diff,
    ownerAcceptance: input.ownerAcceptance
  });

  const generatedAt = input.generatedAt ?? Date.now();
  const limitation = input.runs.find(r => r.withConfirmation.entryConfirmation?.limitation)
    ?.withConfirmation.entryConfirmation?.limitation;
  const dataOrigin = input.dataOrigin ?? 'não declarada';

  const symbolRows = perSymbol.map(s =>
    `| ${s.symbol} | ${s.pairs} | ${s.control.entriesFilled}/${s.with.entriesFilled} | ${s.control.expectancyR.toFixed(4)} | ${s.with.expectancyR.toFixed(4)} | ${s.diff.mean.toFixed(4)} | [${s.diff.ciLow.toFixed(4)}, ${s.diff.ciHigh.toFixed(4)}] | ${s.control.maxDrawdownPct.toFixed(2)}% | ${s.with.maxDrawdownPct.toFixed(2)}% |`
  );

  const markdown = [
    `# Comparativo PAREADO da confirmação de entrada (8.2) — universo`,
    ``,
    `- **Símbolos (${input.symbols.length}):** ${input.symbols.join(', ')}`,
    `- **Período:** ${input.days} dias`,
    `- **Semente:** ${input.seed}`,
    `- **engineVersion:** ${input.engineVersion}`,
    `- **Origem dos dados:** ${dataOrigin}`,
    `- **Gerado em:** ${new Date(generatedAt).toISOString()}`,
    ``,
    `Experimento pareado por SINAL (mesma chave, prefixada pelo símbolo): mesmo período,`,
    `semente e engineVersion; muda só \`ENTRY_CONFIRMATION_ENABLED\`. Sinal ausente ou não`,
    `preenchido em um braço conta 0 R. O bootstrap reamostra PARES (CA-2.1/CA-2.2).`,
    ``,
    `## Por símbolo`,
    ``,
    `| Símbolo | Pares | Preenchidos A/B | Exp. A (R) | Exp. B (R) | Δ R | IC95% Δ | DD A | DD B |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...symbolRows,
    ``,
    `## Braço A — controle (sem confirmação), agregado`,
    ``,
    armTable('Controle', controlMetrics, mean(input.runs.map(r => r.control.rDecomposition?.costAvgR ?? 0))),
    ``,
    `## Braço B — com confirmação (PENDING_ENTRY), agregado`,
    ``,
    armTable('Com confirmação', withMetrics, mean(input.runs.map(r => r.withConfirmation.rDecomposition?.costAvgR ?? 0))),
    ``,
    `## Diferença PAREADA de expectativa por sinal (B − A), agregado`,
    ``,
    `- Pares: **${diff.pairs}**`,
    `- Média: **${diff.mean.toFixed(4)} R**`,
    `- IC 95% bootstrap pareado: [${diff.ciLow.toFixed(4)}, ${diff.ciHigh.toFixed(4)}]`,
    ``,
    `## Regra de decisão pré-registrada v2 (8.2.2)`,
    ``,
    ...decision.reasons.map(r => `- ${r}`),
    ``,
    `**Veredito: ${decision.enable ? 'LIGAR a flag' : 'MANTER a flag DESLIGADA'}**`,
    ``,
    ...(limitation ? [`> Limitação declarada: ${limitation}`, ``] : [])
  ].join('\n');

  return { markdown, decision, diff, controlMetrics, withMetrics, perSymbol };
}

/**
 * CA-2.4 — gera o DOCUMENTO DE DECISÃO a partir do relatório (sem digitação manual).
 * Enquanto a regra v2 não passar, o documento é marcado PROVISÓRIO.
 */
export function renderEntryDecisionDoc(
  report: PairedComparisonReport,
  opts: {
    engineVersion: string;
    generatedAt: string;
    symbol: string;
    days: number;
    seed: number;
    /** Amostra efetiva (ex.: "universo de 5 símbolos reais"). */
    sample?: string;
    /** Origem dos dados (ex.: "LIVE — klines reais da Binance"). */
    dataOrigin?: string;
    /**
     * 8.2.3 — `true` quando o experimento cumpriu o desenho exigido (universo de
     * símbolos reais, regra v2 aplicada). Um veredito DEFINITIVO pode ser "manter
     * desligada": o que o torna definitivo é o desenho ter sido cumprido, não o
     * resultado ser "ligar".
     */
    definitive?: boolean;
  }
): string {
  const c = report.controlMetrics;
  const w = report.withMetrics;
  const provisional = opts.definitive === true ? false : !report.decision.enable;
  return [
    `# Decisão — confirmação de entrada (ciclo PENDING_ENTRY)`,
    ``,
    `> **Status:** ${provisional ? 'PROVISÓRIA' : 'FINAL'} — gerada automaticamente por \`npm run compare:entry -- --register\`.`,
    `> Números derivados do relatório pareado; NÃO editar à mão (regra 8.2.4).`,
    ``,
    `- **engineVersion:** ${opts.engineVersion}`,
    `- **Símbolo:** ${opts.symbol} · **Período:** ${opts.days} dias · **Semente:** ${opts.seed}`,
    ...(opts.dataOrigin ? [`- **Origem dos dados:** ${opts.dataOrigin}`] : []),
    ...(opts.sample ? [`- **Amostra:** ${opts.sample}`] : []),
    `- **Gerado em:** ${opts.generatedAt}`,
    `- **Regra:** 8.2.2 (v2, pareada)`,
    ``,
    `## Números do relatório`,
    ``,
    `| Métrica | Controle | Com confirmação |`,
    `|---|---|---|`,
    `| Posições preenchidas | ${c.entriesFilled} | ${w.entriesFilled} |`,
    `| Posições fechadas | ${c.positionsClosed} | ${w.positionsClosed} |`,
    `| Win rate (posição) | ${c.winRate.toFixed(2)}% | ${w.winRate.toFixed(2)}% |`,
    `| Expectativa líquida (R/sinal pareado) | ${c.expectancyR.toFixed(4)} | ${w.expectancyR.toFixed(4)} |`,
    `| Drawdown máximo | ${c.maxDrawdownPct.toFixed(2)}% | ${w.maxDrawdownPct.toFixed(2)}% |`,
    ``,
    `- **Diferença pareada (B − A):** ${report.diff.mean.toFixed(4)} R — IC 95% [${report.diff.ciLow.toFixed(4)}, ${report.diff.ciHigh.toFixed(4)}]`,
    ``,
    `## Veredito`,
    ``,
    ...report.decision.reasons.map(r => `- ${r}`),
    ``,
    `**${report.decision.enable ? 'LIGAR' : 'MANTER DESLIGADA'} a flag \`ENTRY_CONFIRMATION_ENABLED\`.**`,
    ``,
    `## Congelamento`,
    ``,
    report.decision.enable
      ? 'Criar a tag de congelamento:'
      : 'A tag `engine-freeze-*` só pode ser criada depois de a regra v2 passar (8.2.5).',
    ``,
    '```bash',
    'git tag -a engine-freeze-$(git rev-parse --short HEAD) -m "Congelamento do motor — decisão 8.2 registrada"',
    '```',
    ``
  ].join('\n');
}
