/**
 * 7.2.2 — `npm run compare:entry` — Experimento PAREADO da confirmação de entrada.
 *
 * Roda o MESMO cenário (símbolo, período, perfil, pesos, semente e `asOf`) duas
 * vezes pelo `BacktestEngine`, mudando apenas a flag `entryConfirmation`:
 *   - braço A (controle): `entryConfirmation: false` — preenchimento no open do candle seguinte;
 *   - braço B (com confirmação): `entryConfirmation: true` — ciclo PENDING_ENTRY pelas
 *     funções puras do live (`evaluatePendingEntry` + `confirmEntry`).
 *
 * Produz `docs/evidence/entry-confirmation-comparison-<data>.md` com as métricas por
 * braço, o IC bootstrap da diferença de expectativa por sinal emitido e o veredito da
 * regra pré-registrada (7.2.3). O relatório é DETERMINÍSTICO quando `asOf` e `seed` são
 * fixados (CA-2.3): o `generatedAt` do cabeçalho é o próprio `asOf`, não o relógio.
 *
 * Uso:
 *   npm run compare:entry                              # BTCUSDT, 30d, seed 42
 *   npm run compare:entry -- --symbol ETHUSDT --days 14 --seed 7
 *   npm run compare:entry -- --as-of 1759000000000     # fixa a janela (reprodutível)
 */

import fs from 'node:fs';
import path from 'node:path';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { getIndicatorWeights, getEngineVersion } from '../server/db.js';
import { buildEntryComparisonReport, type EntryComparisonReport } from '../server/services/entryConfirmationComparison.js';
import type { BacktestConfig, BacktestResult, IndicatorWeights, TradingProfile } from '../src/types.js';

/** Mesmo alinhamento de janela do `BacktestEngine`. */
const BACKTEST_CANDLE_MS = 15 * 60 * 1000;

export interface EntryComparisonOptions {
  symbol: string;
  days: number;
  profile?: TradingProfile;
  seed: number;
  weights: IndicatorWeights;
  /** Janela fixa. Quando ausente, alinha ao candle (reprodutível dentro da janela). */
  asOf?: number;
  iterations?: number;
  /** Versão do motor registrada no relatório (default: `getEngineVersion()`). */
  engineVersion?: string;
}

export interface EntryComparisonRun {
  report: EntryComparisonReport;
  control: BacktestResult;
  withConfirmation: BacktestResult;
  asOf: number;
}

/**
 * Roda os dois braços e monta o relatório. Puro do ponto de vista de decisão: não
 * gera arquivo nem imprime; o CLI (`main`) trata a persistência.
 */
export async function runEntryComparison(opts: EntryComparisonOptions): Promise<EntryComparisonRun> {
  const asOf = opts.asOf ?? Math.floor(Date.now() / BACKTEST_CANDLE_MS) * BACKTEST_CANDLE_MS;
  const base: BacktestConfig = {
    symbol: opts.symbol,
    days: opts.days,
    profile: opts.profile ?? 'daytrade',
    weights: opts.weights,
    seed: opts.seed,
    asOf
  };

  // Braço A — controle: preserva o comportamento atual.
  const control = await BacktestEngine.runBacktest({ ...base, entryConfirmation: false }, false);
  // Braço B — com confirmação: mesmas funções puras do live.
  const withConfirmation = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);

  const report = buildEntryComparisonReport({
    symbol: opts.symbol,
    days: opts.days,
    seed: opts.seed,
    engineVersion: opts.engineVersion ?? getEngineVersion(),
    control,
    withConfirmation,
    generatedAt: asOf,
    iterations: opts.iterations
  });

  return { report, control, withConfirmation, asOf };
}

export interface ParsedArgs {
  symbol: string;
  days: number;
  seed: number;
  profile?: TradingProfile;
  asOf?: number;
  iterations?: number;
  outDir: string;
}

function numArg(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Parser simples de `--chave valor`. Exportado para teste. */
export function parseCompareEntryArgs(argv: string[]): ParsedArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return {
    symbol: args.symbol || 'BTCUSDT',
    days: numArg(args.days, 30),
    seed: numArg(args.seed, 42),
    profile: (args.profile as TradingProfile) || undefined,
    asOf: args['as-of'] !== undefined ? numArg(args['as-of'], 0) : undefined,
    iterations: args.iterations !== undefined ? numArg(args.iterations, 2000) : undefined,
    outDir: args['out-dir'] || path.join('docs', 'evidence')
  };
}

/** Nome do arquivo com a data UTC do `asOf` (determinístico). */
export function comparisonFileName(asOf: number): string {
  return `entry-confirmation-comparison-${new Date(asOf).toISOString().slice(0, 10)}.md`;
}

async function main(): Promise<void> {
  const parsed = parseCompareEntryArgs(process.argv.slice(2));
  const weights = await getIndicatorWeights();

  const { report, control, withConfirmation, asOf } = await runEntryComparison({
    ...parsed,
    weights
  });

  const outDir = path.join(process.cwd(), parsed.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, comparisonFileName(asOf));
  fs.writeFileSync(outPath, report.markdown, 'utf8');

  console.log(`🅰  controle   — sinais ${control.entryConfirmation?.signalsEmitted ?? 0}, trades ${control.totalTrades}, WR ${control.winRate.toFixed(2)}%, DD ${control.maxDrawdown.toFixed(2)}%`);
  console.log(`🅱  confirmado — sinais ${withConfirmation.entryConfirmation?.signalsEmitted ?? 0}, trades ${withConfirmation.totalTrades}, WR ${withConfirmation.winRate.toFixed(2)}%, DD ${withConfirmation.maxDrawdown.toFixed(2)}%`);
  console.log(`Diferença de expectativa/sinal: ${report.diff.mean.toFixed(4)} R (IC95% [${report.diff.ciLow.toFixed(4)}, ${report.diff.ciHigh.toFixed(4)}])`);
  console.log(`Veredito (7.2.3): ${report.decision.enable ? 'LIGAR a flag' : 'MANTER desligada'}`);
  console.log(`📄 Relatório: ${path.relative(process.cwd(), outPath)}`);
}

const invokedDirectly =
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/compare-entry.ts');

if (invokedDirectly) {
  main().catch(err => {
    console.error('compare:entry falhou:', err);
    process.exit(1);
  });
}
