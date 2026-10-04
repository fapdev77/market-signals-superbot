/**
***8.2 — `npm run compare:entry` — Expermmento PAREADO da confmrmação de entrada.
 *
 * Roda o MESMO cenário (símbolo, período, perfil, pesos, semente e `asOf`) duas
 * vezes pelo `BacktestEngine`, mudando apenas a flag `entryConfirmation`, e pareia
 * os sinais pela chave determinística (mesma vela/direção/zona). O bootstrap
 * reamostra PARES (8.2.1) e a regra v2 (8.2.2) decide.
 *
 * Sem `--register` apenas escreve o comparativo. Com `--register`, escreve também
 * o documento de decisão GERADO (sem digitação manual, 8.2.4) e o registro do
 * veredito `docs/evidence/entry-confirmation-verdict.json` — que o teste de CI
 * `flagMatchesDecision.test.ts` confronta com `ENTRY_CONFIRMATION_ENABLED`.
 *
 * Uso:
 *   npm run compare:entry                                  # BTCUSDT, 30d, seed 42
 *   npm run compare:entry -- --symbol ETHUSDT --days 14
 *   npm run compare:entry -- --register                    # recalcula e registra
 *   npm run compare:entry -- --universe --register \
 *     --accept-negative-expectancy --reason "edge pareado confirmado; aceito para observacao"
 */

import fs from 'node:fs';
import path from 'node:path';
import { BacktestEngine } from '../server/services/BacktestEngine.js';
import { getIndicatorWeights, getEngineVersion } from '../server/db.js';
import {
  buildPairedEntryComparisonReport,
  buildUniversePairedEntryComparisonReport,
  renderEntryDecisionDoc,
  type PairedComparisonReport
} from '../server/services/entryComparisonPaired.js';
import { DEFAULT_SYMBOLS } from '../server/binanceService.js';
import type { BacktestConfig, BacktestResult, IndicatorWeights, TradingProfile } from '../src/types.js';
import type { OwnerAcceptance } from '../server/services/entryDecisionRuleV2.js';

/** 8.2.3 — universo padrão do comparativo (mais de um símbolo, não só BTCUSDT). */
export const DEFAULT_COMPARE_SYMBOLS = DEFAULT_SYMBOLS.slice(0, 5);

/** Origem declarada dos candles. Sobrescrevível por `COMPARE_DATA_ORIGIN`. */
export function declaredDataOrigin(): string {
  return (
    process.env.COMPARE_DATA_ORIGIN ||
    'LIVE — klines reais da Binance (origin=LIVE; ALLOW_SYNTHETIC_DATA=false)'
  );
}

/** Mesmo alinhamento de janela do `BacktestEngine`. */
const BACKTEST_CANDLE_MS = 15 * 60 * 1000;

export interface EntryComparisonOptions {
  symbol: string;
  days: number;
  profile?: TradingProfile;
  seed: number;
  weights: IndicatorWeights;
  asOf?: number;
  iterations?: number;
  engineVersion?: string;
  /** Opcional: roda o universo inteiro e agrega (8.2.3). */
  symbols?: string[];
  /**
   * E1 (achado N1) — aceite explicito do dono para o criterio (d) da regra v2.
   * Sem isto a valvula existe no codigo e nao existe na operacao: ninguem consegue
   * registra-la, logo o caminho "expectativa negativa, mas o dono assumiu" e um
   * estado inalcancavel. `undefined` = nenhum aceite.
   */
  ownerAcceptance?: OwnerAcceptance;
}

export interface UniverseEntryComparisonRun {
  report: ReturnType<typeof buildUniversePairedEntryComparisonReport>;
  runs: Array<{ symbol: string; control: BacktestResult; withConfirmation: BacktestResult }>;
  asOf: number;
}

export interface EntryComparisonRun {
  report: PairedComparisonReport;
  control: BacktestResult;
  withConfirmation: BacktestResult;
  asOf: number;
}

/** Roda os dois braços e monta o relatório pareado (sem gerar arquivo). */
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

  const control = await BacktestEngine.runBacktest({ ...base, entryConfirmation: false }, false);
  const withConfirmation = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);

  const report = buildPairedEntryComparisonReport({
    symbol: opts.symbol,
    days: opts.days,
    seed: opts.seed,
    engineVersion: opts.engineVersion ?? getEngineVersion(),
    control,
    withConfirmation,
    generatedAt: asOf,
    iterations: opts.iterations,
    ownerAcceptance: opts.ownerAcceptance
  });

  return { report, control, withConfirmation, asOf };
}

/**
 * 8.2.3 — roda o UNIVERSO inteiro (cada símbolo: par controle/confirmação) e
 * agrega os pares para uma única decisão v2. Determinístico para a mesma semente.
 */
export async function runUniverseEntryComparison(
  opts: EntryComparisonOptions & { symbols: string[] }
): Promise<UniverseEntryComparisonRun> {
  const asOf = opts.asOf ?? Math.floor(Date.now() / BACKTEST_CANDLE_MS) * BACKTEST_CANDLE_MS;
  const runs: UniverseEntryComparisonRun['runs'] = [];
  for (const symbol of opts.symbols) {
    const base: BacktestConfig = {
      symbol,
      days: opts.days,
      profile: opts.profile ?? 'daytrade',
      weights: opts.weights,
      seed: opts.seed,
      asOf
    };
    const control = await BacktestEngine.runBacktest({ ...base, entryConfirmation: false }, false);
    const withConfirmation = await BacktestEngine.runBacktest({ ...base, entryConfirmation: true }, false);
    runs.push({ symbol, control, withConfirmation });
  }

  const report = buildUniversePairedEntryComparisonReport({
    symbols: opts.symbols,
    days: opts.days,
    seed: opts.seed,
    engineVersion: opts.engineVersion ?? getEngineVersion(),
    runs,
    generatedAt: asOf,
    iterations: opts.iterations,
    dataOrigin: declaredDataOrigin(),
    ownerAcceptance: opts.ownerAcceptance
  });

  return { report, runs, asOf };
}

export interface ParsedArgs {
  symbol: string;
  /** Lista efetiva de símbolos (universo quando `--universe`, senão `[symbol]`). */
  symbols: string[];
  universe: boolean;
  days: number;
  seed: number;
  profile?: TradingProfile;
  asOf?: number;
  iterations?: number;
  outDir: string;
  register: boolean;
  /** E1 — aceite do dono; so existe se `--accept-negative-expectancy true`. */
  ownerAcceptance?: OwnerAcceptance;
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
  const universe = args.universe === 'true';
  const symbolList = (args.symbols || process.env.COMPARE_SYMBOLS || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const symbol = args.symbol || 'BTCUSDT';
  const symbols = universe
    ? (symbolList.length > 0 ? symbolList : DEFAULT_COMPARE_SYMBOLS)
    : [symbol];
  return {
    symbol,
    symbols,
    universe,
    days: numArg(args.days, 30),
    seed: numArg(args.seed, 42),
    profile: (args.profile as TradingProfile) || undefined,
    asOf: args['as-of'] !== undefined ? numArg(args['as-of'], 0) : undefined,
    iterations: args.iterations !== undefined ? numArg(args.iterations, 5000) : undefined,
    outDir: args['out-dir'] || path.join('docs', 'evidence'),
    register: args.register === 'true',
    // E1: aceite so existe quando a flag e passada. `--reason` sozinho nao
    // habilita nada — aceite implicito seria exatamente o atalho que a regra v2
    // existe para impedir.
    ownerAcceptance:
      args['accept-negative-expectancy'] === 'true'
        ? { acceptedNegativeExpectancy: true, reason: args.reason || undefined }
        : undefined
  };
}

/** Nome do arquivo com a data UTC do `asOf` (determinístico). */
export function comparisonFileName(asOf: number): string {
  return `entry-confirmation-comparison-${new Date(asOf).toISOString().slice(0, 10)}.md`;
}

async function main(): Promise<void> {
  const parsed = parseCompareEntryArgs(process.argv.slice(2));
  const weights = await getIndicatorWeights();
  const outDir = path.join(process.cwd(), parsed.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  // 8.2.3 — `--universe` roda vários símbolos e agrega; sem a flag, mantém o braço único.
  const result = parsed.universe
    ? await runUniverseEntryComparison({ ...parsed, symbols: parsed.symbols, weights })
    : await runEntryComparison({ ...parsed, weights });
  const { report, asOf } = result;

  const outPath = path.join(outDir, comparisonFileName(asOf));
  fs.writeFileSync(outPath, report.markdown, 'utf8');

  if (parsed.universe) {
    const u = result as UniverseEntryComparisonRun;
    for (const r of u.runs) {
      const c = r.control;
      const w = r.withConfirmation;
      console.log(`   ${r.symbol.padEnd(10)} A: ${c.positionsFilled ?? 0} preench. / DD ${c.maxDrawdown.toFixed(2)}%   B: ${w.positionsFilled ?? 0} preench. / DD ${w.maxDrawdown.toFixed(2)}%`);
    }
  } else {
    const s = result as EntryComparisonRun;
    console.log(`🅰  controle   — preenchidos ${s.control.positionsFilled ?? 0}, fechados ${s.control.positionsClosed ?? s.control.totalTrades}, WR ${s.control.winRate.toFixed(2)}%, DD ${s.control.maxDrawdown.toFixed(2)}%`);
    console.log(`🅱  confirmado — preenchidos ${s.withConfirmation.positionsFilled ?? 0}, fechados ${s.withConfirmation.positionsClosed ?? s.withConfirmation.totalTrades}, WR ${s.withConfirmation.winRate.toFixed(2)}%, DD ${s.withConfirmation.maxDrawdown.toFixed(2)}%`);
  }
  console.log(`Diferença PAREADA/sinal: ${report.diff.mean.toFixed(4)} R (IC95% [${report.diff.ciLow.toFixed(4)}, ${report.diff.ciHigh.toFixed(4)}], ${report.diff.pairs} pares)`);
  console.log(`Veredito (8.2.2 v2): ${report.decision.enable ? 'LIGAR a flag' : 'MANTER desligada'}`);
  console.log(`📄 Relatório: ${path.relative(process.cwd(), outPath)}`);

  if (parsed.register) {
    const engineVersion = report.markdown.match(/engineVersion:\*\* (\S+)/)?.[1] ?? getEngineVersion();
    const sample = parsed.universe
      ? `universo de ${parsed.symbols.length} símbolos reais (${parsed.symbols.join(', ')}) — 8.2.3`
      : `${parsed.symbol} (braço único) — 8.2.3 pede universo; usar --universe`;
    // 8.2.3 — veredito DEFINITIVO quando o desenho exigido foi cumprido (universo real),
    // independentemente de a regra v2 ter mandado ligar ou manter desligada.
    const definitive = parsed.universe;
    const docPath = path.join(outDir, 'decision-entry-confirmation.md');
    fs.writeFileSync(
      docPath,
      renderEntryDecisionDoc(report, {
        engineVersion,
        generatedAt: new Date(asOf).toISOString(),
        symbol: parsed.universe ? parsed.symbols.join(', ') : parsed.symbol,
        days: parsed.days,
        seed: parsed.seed,
        sample,
        dataOrigin: declaredDataOrigin(),
        definitive
      }),
      'utf8'
    );
    const verdictPath = path.join(outDir, 'entry-confirmation-verdict.json');
    fs.writeFileSync(
      verdictPath,
      JSON.stringify(
        {
          entryConfirmationEnabled: report.decision.enable,
          provisional: !definitive,
          rule: 'v2',
          generatedAt: new Date(asOf).toISOString().slice(0, 10),
          engineVersion,
          symbols: parsed.symbols,
          symbol: parsed.symbol,
          days: parsed.days,
          seed: parsed.seed,
          dataOrigin: declaredDataOrigin(),
          sample,
          // E1: o veredito so pode dizer "MANTER desligada por negativa" de forma
          // verificavel se tambem declarar se alguem aceitou. Ausente = ninguem aceitou.
          ownerAcceptance: parsed.ownerAcceptance ?? null
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    console.log(`📝 Documento de decisão: ${path.relative(process.cwd(), docPath)}`);
    console.log(`✅ Veredito registrado: ${path.relative(process.cwd(), verdictPath)}`);
  }
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
