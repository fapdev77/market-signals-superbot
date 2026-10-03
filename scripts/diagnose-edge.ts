/**
 * 8.1 — `npm run diagnose:edge` — Diagnóstico do edge (J-03).
 *
 * Roda o backtest de um universo configurável (padrão: 10 símbolos de maior
 * volume em TRADING + lista TradFi monitorada) e produz, por símbolo e por faixa,
 * a decomposição de custos (8.0), o IC bootstrap da expectativa líquida e o
 * veredito pré-registrado (8.1.4) — tudo determinístico para a mesma semente.
 *
 * Uso:
 *   npm run diagnose:edge
 *   npm run diagnose:edge -- --days 21 --seed 7
 *   npm run diagnose:edge -- --symbols BTCUSDT,ETHUSDT --out-dir docs/evidence
 */

import fs from 'node:fs';
import path from 'node:path';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { getIndicatorWeights, getEngineVersion } from '../server/db.js';
import { DEFAULT_SYMBOLS, getConfiguredTradfiMonitoredSymbols } from '../server/binanceService.js';
import {
  buildEdgeDiagnosisReport,
  edgeDiagnosisFileName,
  type EdgeDiagnosisInput
} from '../server/services/EdgeDiagnosisService.js';
import type { BacktestConfig, TradingProfile } from '../src/types.js';

const BACKTEST_CANDLE_MS = 15 * 60 * 1000;

export interface DiagnoseEdgeOptions {
  symbols: string[];
  days: number;
  seed: number;
  profile?: TradingProfile;
  iterations?: number;
  asOf?: number;
  weights: Awaited<ReturnType<typeof getIndicatorWeights>>;
  engineVersion?: string;
}

/** Universo padrão: os símbolos de maior volume + TradFi monitorado (8.1.1). */
export function defaultUniverse(topN = 10): string[] {
  const crypto = DEFAULT_SYMBOLS.slice(0, topN);
  return Array.from(new Set([...crypto, ...getConfiguredTradfiMonitoredSymbols()]));
}

export interface ParsedArgs {
  symbols: string[];
  days: number;
  seed: number;
  profile?: TradingProfile;
  iterations?: number;
  asOf?: number;
  outDir: string;
  register: boolean;
}

function numArg(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Parser simples de `--chave valor`. Exportado para teste. */
export function parseDiagnoseEdgeArgs(argv: string[]): ParsedArgs {
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
  const symbolList = (args.symbols || process.env.EDGE_DIAGNOSIS_SYMBOLS || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return {
    symbols: symbolList.length > 0 ? symbolList : defaultUniverse(),
    days: numArg(args.days, 30),
    seed: numArg(args.seed, 42),
    profile: (args.profile as TradingProfile) || undefined,
    iterations: args.iterations !== undefined ? numArg(args.iterations, 2000) : undefined,
    asOf: args['as-of'] !== undefined ? numArg(args['as-of'], 0) : undefined,
    outDir: args['out-dir'] || path.join('docs', 'evidence'),
    register: args.register === 'true'
  };
}

/** Roda o diagnóstico (sem gerar arquivo). Exportado para teste/reuso. */
export async function runEdgeDiagnosis(opts: DiagnoseEdgeOptions) {
  const asOf = opts.asOf ?? Math.floor(Date.now() / BACKTEST_CANDLE_MS) * BACKTEST_CANDLE_MS;
  const inputs: EdgeDiagnosisInput[] = [];
  for (const symbol of opts.symbols) {
    const config: BacktestConfig = {
      symbol,
      days: opts.days,
      profile: opts.profile ?? 'daytrade',
      weights: opts.weights,
      seed: opts.seed,
      asOf
    };
    const result = await BacktestEngine.runBacktest(config, false);
    inputs.push({
      symbol,
      result,
      factorCoverage: result.factorCoverage,
      reducedFactorSet: result.reducedFactorSet
    });
  }

  const report = buildEdgeDiagnosisReport(inputs, {
    engineVersion: opts.engineVersion ?? getEngineVersion(),
    days: opts.days,
    seed: opts.seed,
    iterations: opts.iterations,
    universe: opts.symbols,
    generatedAt: asOf
  });

  return { report, asOf };
}

async function main(): Promise<void> {
  const parsed = parseDiagnoseEdgeArgs(process.argv.slice(2));
  const weights = await getIndicatorWeights();

  console.log(`🔎 Diagnóstico do edge — ${parsed.symbols.length} símbolos, ${parsed.days} dias, seed ${parsed.seed}`);
  const { report, asOf } = await runEdgeDiagnosis({ ...parsed, weights });

  const outDir = path.join(process.cwd(), parsed.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, edgeDiagnosisFileName(asOf));
  fs.writeFileSync(outPath, report.markdown, 'utf8');

  for (const s of report.symbols) {
    console.log(
      `   ${s.symbol.padEnd(10)} n=${String(s.summary.n).padStart(4)} líq=${s.summary.netR.toFixed(4)} R IC95% [${s.summary.ciLow.toFixed(4)}, ${s.summary.ciHigh.toFixed(4)}]`
    );
  }
  console.log(`Veredito (8.1.4): ${report.verdict.apt ? 'APTO' : 'NÃO APTO'} — ${report.verdict.qualified}/${report.verdict.total} símbolos elegíveis`);
  console.log(`📄 Relatório: ${path.relative(process.cwd(), outPath)}`);
}

const invokedDirectly =
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/diagnose-edge.ts');

if (invokedDirectly) {
  main().catch(err => {
    console.error('diagnose:edge falhou:', err);
    process.exit(1);
  });
}
