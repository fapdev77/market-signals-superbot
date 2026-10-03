/**
 * 8.1 — Diagnóstico do edge (J-03). Módulo PURO e determinístico.
 *
 * Recebe o resultado de backtest de cada símbolo e produz, por símbolo e por
 * faixa, a decomposição de custos da 8.0 (bruto/taxas/slippage/funding/líquido),
 * o IC bootstrap da expectativa líquida e o veredito pré-registrado (8.1.4).
 *
 * Determinístico para a mesma entrada + semente (CA-1.1). O veredito vem de uma
 * função pura testada nos limites 59% contra 60% (CA-1.2).
 */

import type { BacktestResult, BacktestTrade } from '../../src/types.js';

export interface ExpectancySummary {
  n: number;
  /** Média de R das pernas (posições fechadas). */
  grossR: number;
  feesR: number;
  slippageR: number;
  fundingR: number;
  netR: number;
  /** Custo médio (taxas+slippage+funding) em R por posição. */
  costAvgR: number;
  winRate: number;
  ciLow: number;
  ciHigh: number;
}

export interface StopBandDiagnosis extends ExpectancySummary {
  label: string;
  minPct: number;
  maxPct: number;
}

export interface MaxStopTradeoff {
  maxStopPct: number;
  n: number;
  netR: number;
}

export interface SymbolDiagnosis {
  symbol: string;
  summary: ExpectancySummary;
  byScoreBand: Array<ExpectancySummary & { label: string }>;
  byRegime: Array<ExpectancySummary & { label: string }>;
  bySession: Array<ExpectancySummary & { label: string }>;
  byStopBand: StopBandDiagnosis[];
  /** Distância do stop em % do preço: média e percentis. */
  stopDistancePct: { mean: number; p50: number; p90: number };
  maxStopTradeoff: MaxStopTradeoff[];
  factorCoverage: { openInterest: number; funding: number; longShort: number };
  reducedFactorSet: boolean;
}

export interface EdgeVerdict {
  apt: boolean;
  qualified: number;
  total: number;
  share: number;
  threshold: number;
  minN: number;
  reasons: string[];
}

export interface EdgeDiagnosisInput {
  symbol: string;
  result: BacktestResult;
  factorCoverage?: { openInterest: number; funding: number; longShort: number };
  reducedFactorSet?: boolean;
}

export interface EdgeDiagnosisReport {
  markdown: string;
  verdict: EdgeVerdict;
  symbols: SymbolDiagnosis[];
  generatedAt: number;
  seed: number;
}

const DEFAULT_ITERATIONS = 2000;
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_MIN_N = 30;
/** Teto de MAX_STOP avaliado no tradeoff (8.1.2). */
export const MAX_STOP_CANDIDATES = [0.5, 1, 1.5, 2, 3];

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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

/**
 * IC 95% bootstrap da média. Reamostra com reposição e semente determinística,
 * de modo que a mesma entrada produz exatamente o mesmo intervalo (CA-1.1).
 */
export function bootstrapMeanCI(
  values: number[],
  opts: { iterations?: number; seed?: number; alpha?: number } = {}
): { mean: number; ciLow: number; ciHigh: number; n: number } {
  const n = values.length;
  const observed = mean(values);
  if (n === 0) return { mean: 0, ciLow: 0, ciHigh: 0, n: 0 };
  const iterations = Math.max(1, opts.iterations ?? DEFAULT_ITERATIONS);
  const alpha = opts.alpha ?? 0.05;
  const rand = mulberry32(opts.seed ?? 12345);
  const samples: number[] = new Array(iterations);
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(rand() * n)];
    samples[it] = sum / n;
  }
  samples.sort((a, b) => a - b);
  const loIdx = Math.max(0, Math.floor((alpha / 2) * iterations));
  const hiIdx = Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations));
  return { mean: observed, ciLow: samples[loIdx], ciHigh: samples[hiIdx], n };
}

/** Sessão TradFi aproximada pela hora UTC da entrada (8.1.2). */
export function sessionOf(timestamp: number): 'ASIA' | 'LONDON' | 'NY' | 'OTHER' {
  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 7) return 'ASIA';
  if (hour >= 7 && hour < 13) return 'LONDON';
  if (hour >= 13 && hour < 21) return 'NY';
  return 'OTHER';
}

/** Faixa de score de confluência (8.1.2). */
export function scoreBand(score: number): string {
  if (score < 60) return '<60';
  if (score < 70) return '60-69';
  if (score < 80) return '70-79';
  return '80+';
}

/** Distância do stop em % do preço de entrada. */
export function stopDistancePct(trade: BacktestTrade): number {
  if (!(trade.entryPrice > 0)) return 0;
  return (Math.abs(trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100;
}

/** Faixa de distância de stop, na ordem fixa das bandas. */
export function stopBandLabel(pct: number): string {
  if (pct < 0.3) return '<0.3%';
  if (pct < 0.6) return '0.3-0.6%';
  if (pct < 1.0) return '0.6-1.0%';
  if (pct < 2.0) return '1.0-2.0%';
  return '>2.0%';
}

const STOP_BANDS: Array<{ label: string; minPct: number; maxPct: number }> = [
  { label: '<0.3%', minPct: 0, maxPct: 0.3 },
  { label: '0.3-0.6%', minPct: 0.3, maxPct: 0.6 },
  { label: '0.6-1.0%', minPct: 0.6, maxPct: 1.0 },
  { label: '1.0-2.0%', minPct: 1.0, maxPct: 2.0 },
  { label: '>2.0%', minPct: 2.0, maxPct: Number.POSITIVE_INFINITY }
];

/** R decomposto de uma posição, com fallbacks honestos quando os campos faltam. */
function tradeR(trade: BacktestTrade): { gross: number; fees: number; slippage: number; funding: number; net: number } {
  const net = trade.rNet ?? 0;
  return {
    gross: trade.rGross ?? net,
    fees: trade.rFees ?? 0,
    slippage: trade.rSlippage ?? 0,
    funding: trade.rFunding ?? 0,
    net
  };
}

/** Sumariza a expectativa decomposta de um conjunto de posições. */
export function summarizeExpectancy(
  trades: BacktestTrade[],
  opts: { iterations?: number; seed?: number } = {}
): ExpectancySummary {
  const n = trades.length;
  const netSeries: number[] = [];
  let gross = 0;
  let fees = 0;
  let slippage = 0;
  let funding = 0;
  let wins = 0;
  for (const t of trades) {
    const r = tradeR(t);
    gross += r.gross;
    fees += r.fees;
    slippage += r.slippage;
    funding += r.funding;
    netSeries.push(r.net);
    if (t.isWin) wins++;
  }
  const inv = n > 0 ? 1 / n : 0;
  const ci = bootstrapMeanCI(netSeries, opts);
  return {
    n,
    grossR: gross * inv,
    feesR: fees * inv,
    slippageR: slippage * inv,
    fundingR: funding * inv,
    netR: ci.mean,
    costAvgR: (fees + slippage + funding) * inv,
    winRate: n > 0 ? (wins / n) * 100 : 0,
    ciLow: ci.ciLow,
    ciHigh: ci.ciHigh
  };
}

function groupSummary(
  trades: BacktestTrade[],
  keyFn: (t: BacktestTrade) => string,
  order: string[],
  seed: number
): Array<ExpectancySummary & { label: string }> {
  const groups = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const bucket = groups.get(k);
    if (bucket) bucket.push(t);
    else groups.set(k, [t]);
  }
  const labels = order.length > 0 ? order : Array.from(groups.keys());
  const out: Array<ExpectancySummary & { label: string }> = [];
  for (const label of labels) {
    const bucket = groups.get(label);
    if (!bucket || bucket.length === 0) continue;
    out.push({ label, ...summarizeExpectancy(bucket, { seed }) });
  }
  return out;
}

/** 8.1.2 — diagnóstico de um símbolo a partir do resultado do backtest. */
export function computeSymbolDiagnosis(
  input: EdgeDiagnosisInput,
  opts: { seed?: number; iterations?: number } = {}
): SymbolDiagnosis {
  const trades = (input.result.trades ?? []) as BacktestTrade[];
  const seed = opts.seed ?? 12345;
  const iterations = opts.iterations;
  const coverage = input.factorCoverage ?? input.result.factorCoverage ?? {
    openInterest: 0,
    funding: 0,
    longShort: 0
  };
  const reduced =
    input.reducedFactorSet ??
    input.result.reducedFactorSet ??
    Object.values(coverage).some(v => v < 100);

  const summary = summarizeExpectancy(trades, { seed, iterations });

  const byScoreBand = groupSummary(
    trades,
    t => scoreBand(t.confluenceScore ?? 0),
    ['<60', '60-69', '70-79', '80+'],
    seed
  );
  const byRegime = groupSummary(trades, t => t.regime ?? 'RANGE', ['TREND_UP', 'TREND_DOWN', 'RANGE'], seed);
  const bySession = groupSummary(trades, t => sessionOf(t.entryTime), ['ASIA', 'LONDON', 'NY', 'OTHER'], seed);

  const byStopBand: StopBandDiagnosis[] = STOP_BANDS.map(band => {
    const bucket = trades.filter(t => {
      const p = stopDistancePct(t);
      return p >= band.minPct && p < band.maxPct;
    });
    return { ...band, ...summarizeExpectancy(bucket, { seed: 44 }) };
  });

  const stopDistances = trades.map(stopDistancePct);
  const stopDistance = {
    mean: mean(stopDistances),
    p50: percentile(stopDistances, 0.5),
    p90: percentile(stopDistances, 0.9)
  };

  const maxStopTradeoff: MaxStopTradeoff[] = MAX_STOP_CANDIDATES.map(maxStopPct => {
    const bucket = trades.filter(t => stopDistancePct(t) <= maxStopPct);
    return { maxStopPct, n: bucket.length, netR: summarizeExpectancy(bucket).netR };
  });

  return {
    symbol: input.symbol,
    summary,
    byScoreBand,
    byRegime,
    bySession,
    byStopBand,
    stopDistancePct: stopDistance,
    maxStopTradeoff,
    factorCoverage: coverage,
    reducedFactorSet: reduced
  };
}

/**
 * 8.1.4 — veredito pré-registrado (puro). Apto se o limite inferior do IC 95% da
 * expectativa líquida for > 0 em ≥ `threshold` (60%) dos símbolos com n ≥ `minN`.
 */
export function evaluateEdgeVerdict(
  symbols: SymbolDiagnosis[],
  opts: { threshold?: number; minN?: number } = {}
): EdgeVerdict {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const minN = opts.minN ?? DEFAULT_MIN_N;
  const eligible = symbols.filter(s => s.summary.n >= minN);
  const qualified = eligible.filter(s => s.summary.ciLow > 0).length;
  const total = eligible.length;
  const share = total > 0 ? qualified / total : 0;
  const apt = total > 0 && share >= threshold;

  const reasons: string[] = [];
  reasons.push(
    `Símbolos com n ≥ ${minN}: ${total}. Com limite inferior do IC 95% > 0: ${qualified} (${(share * 100).toFixed(1)}%).`
  );
  reasons.push(`Limiar pré-registrado: ${(threshold * 100).toFixed(0)}% dos símbolos elegíveis.`);
  if (total === 0) {
    reasons.push('Nenhum símbolo atingiu o mínimo de posições — amostra insuficiente para o veredito.');
  }
  reasons.push(
    apt
      ? 'VEREDITO: motor APTO para a janela de evidência (regra 8.1.4 satisfeita).'
      : 'VEREDITO: motor NÃO apto. A janela só começa com aceite explícito e registrado do dono (8.1.4).'
  );
  const dominant = dominantCostCause(symbols);
  if (dominant) reasons.push(`Causa dominante indicada: ${dominant}.`);
  return { apt, qualified, total, share, threshold, minN, reasons };
}

/** Identifica a causa dominante da expectativa negativa (custo, stop, sinal). */
function dominantCostCause(symbols: SymbolDiagnosis[]): string | null {
  const pools = symbols.filter(s => s.summary.n > 0);
  if (pools.length === 0) return null;
  const costAvg = mean(pools.map(s => s.summary.costAvgR));
  const grossAvg = mean(pools.map(s => s.summary.grossR));
  // Custo alto contra um bruto não muito maior que ele ⇒ custo domina.
  if (Math.abs(grossAvg) > 0 && Math.abs(costAvg) >= Math.abs(grossAvg) * 0.8) {
    return 'custo (taxas/slippage/funding ≈ magnitude do bruto)';
  }
  if (grossAvg <= 0) {
    return 'sinal (bruto não positivo antes de custos)';
  }
  return 'stop/tamanho de posição (ver distribuição do stop e tradeoff de MAX_STOP)';
}

function pct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

function r(v: number, digits = 4): string {
  return v.toFixed(digits);
}

function summaryRow(label: string, s: ExpectancySummary): string {
  return `| ${label} | ${s.n} | ${r(s.grossR)} | ${r(s.feesR)} | ${r(s.slippageR)} | ${r(s.fundingR)} | ${r(s.netR)} | [${r(s.ciLow)}, ${r(s.ciHigh)}] |`;
}

const SUMMARY_HEADER = [
  '| Grupo | n | Bruto (R) | Taxas (R) | Slippage (R) | Funding (R) | Líquido (R) | IC 95% |',
  '|---|---|---|---|---|---|---|---|'
].join('\n');

/** 8.1.2 / CA-1.2 — markdown determinístico do relatório por símbolo e por faixa. */
export function renderSymbolMarkdown(s: SymbolDiagnosis): string {
  const lines: string[] = [];
  lines.push(`## ${s.symbol}`);
  lines.push('');
  lines.push(`- Posições fechadas: **${s.summary.n}**`);
  lines.push(`- Expectativa líquida: **${r(s.summary.netR)} R** (IC 95% [${r(s.summary.ciLow)}, ${r(s.summary.ciHigh)}])`);
  lines.push(`- Custo médio (taxas+slippage+funding): **${r(s.summary.costAvgR)} R**`);
  lines.push(`- Win rate (posição): ${pct(s.summary.winRate)}`);
  lines.push(
    `- Distância do stop (% do preço): média ${pct(s.stopDistancePct.mean, 3)}, p50 ${pct(s.stopDistancePct.p50, 3)}, p90 ${pct(s.stopDistancePct.p90, 3)}`
  );
  if (s.reducedFactorSet) {
    lines.push(
      `- **reducedFactorSet: true** — cobertura OI ${pct(s.factorCoverage.openInterest)}, funding ${pct(s.factorCoverage.funding)}, long/short ${pct(s.factorCoverage.longShort)}`
    );
  }
  lines.push('');
  lines.push('### Decomposição de custos');
  lines.push('');
  lines.push(SUMMARY_HEADER);
  lines.push(summaryRow('**Símbolo (total)**', s.summary));

  lines.push('');
  lines.push('#### Por faixa de score');
  lines.push('');
  lines.push(SUMMARY_HEADER);
  for (const g of s.byScoreBand) lines.push(summaryRow(g.label, g));

  lines.push('');
  lines.push('#### Por regime');
  lines.push('');
  lines.push(SUMMARY_HEADER);
  for (const g of s.byRegime) lines.push(summaryRow(g.label, g));

  lines.push('');
  lines.push('#### Por sessão TradFi');
  lines.push('');
  lines.push(SUMMARY_HEADER);
  for (const g of s.bySession) lines.push(summaryRow(g.label, g));

  lines.push('');
  lines.push('#### Por faixa de stop');
  lines.push('');
  lines.push(SUMMARY_HEADER);
  for (const g of s.byStopBand) lines.push(summaryRow(g.label, g));

  lines.push('');
  lines.push('#### Tradeoff de MAX_STOP (expectativa líquida dos trades com stop ≤ X)');
  lines.push('');
  lines.push('| MAX_STOP (%) | n | Líquido (R) |');
  lines.push('|---|---|---|');
  for (const t of s.maxStopTradeoff) lines.push(`| ${t.maxStopPct} | ${t.n} | ${r(t.netR)} |`);

  return lines.join('\n');
}

export interface EdgeDiagnosisMeta {
  engineVersion: string;
  days: number;
  seed: number;
  iterations?: number;
  universe: string[];
  generatedAt?: number;
  ownerAcceptance?: { accepted: boolean; reason?: string };
}

/** 8.1.2 / 8.1.4 — relatório completo (markdown + veredito + estrutura). */
export function buildEdgeDiagnosisReport(
  inputs: EdgeDiagnosisInput[],
  meta: EdgeDiagnosisMeta
): EdgeDiagnosisReport {
  const generatedAt = meta.generatedAt ?? Date.now();
  // Semente por símbolo, mas determinística pela ordem de entrada (CA-1.1).
  const symbols = inputs.map((input, i) =>
    computeSymbolDiagnosis(input, { seed: meta.seed + i, iterations: meta.iterations })
  );

  const verdict = evaluateEdgeVerdict(symbols);
  const limitation = inputs.find(i => i.result.reducedFactorSet)?.result.reducedFactorSet ?? false;

  const markdown = [
    `# Diagnóstico do edge (8.1)`,
    '',
    `- **engineVersion:** ${meta.engineVersion}`,
    `- **Período:** ${meta.days} dias`,
    `- **Semente:** ${meta.seed}`,
    `- **Iterações bootstrap:** ${meta.iterations ?? DEFAULT_ITERATIONS}`,
    `- **Gerado em:** ${new Date(generatedAt).toISOString()}`,
    `- **Universo (${meta.universe.length}):** ${meta.universe.join(', ')}`,
    '',
    `> Regra pré-registrada 8.1.4: apto se o limite inferior do IC 95% da expectativa`,
    `> líquida for > 0 em ≥ ${(verdict.threshold * 100).toFixed(0)}% dos símbolos com n ≥ ${verdict.minN}.`,
    '',
    `## Veredito`,
    '',
    ...verdict.reasons.map(x => `- ${x}`),
    '',
    `**${verdict.apt ? 'APTO' : 'NÃO APTO'} para a janela de evidência.**`,
    '',
    ...(limitation
      ? ['> Um ou mais símbolos têm **reducedFactorSet: true** (fator em cobertura parcial — OI/funding/long-short).', '']
      : []),
    '## Detalhe por símbolo',
    '',
    ...symbols.map(renderSymbolMarkdown),
    ''
  ].join('\n');

  return { markdown, verdict, symbols, generatedAt, seed: meta.seed };
}

/** Nome do arquivo com a data UTC (determinístico). */
export function edgeDiagnosisFileName(asOf: number): string {
  return `edge-diagnosis-${new Date(asOf).toISOString().slice(0, 10)}.md`;
}
