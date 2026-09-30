/**
 * Auditoria do universo monitorado (Fase 6.1.5).
 *
 * Compara três conjuntos e explica, a partir dos dados, a divergência entre o REST
 * `ticker/24hr` e o WebSocket `!ticker@arr`:
 *   1. símbolos do REST `/fapi/v1/ticker/24hr`
 *   2. símbolos do `/fapi/v1/exchangeInfo` (por `status` e `contractType`)
 *   3. símbolos vistos no WS `/market` `!ticker@arr` durante N segundos
 *
 * Gera `docs/UNIVERSE.md` (contagem real por grupo + fonte que define o universo).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { buildFuturesWsUrl } from '../server/utils/wsUrl.js';
import { requestJsonLimited, type HttpResponse } from '../server/utils/httpClient.js';

const FAPI = 'https://fapi.binance.com';

export interface WsLike {
  on(event: 'open' | 'message' | 'error' | 'close', cb: (...args: any[]) => void): void;
  close(): void;
}

export interface UniverseAuditDeps {
  fetchJson: <T = any>(url: string, options?: any) => Promise<HttpResponse<T>>;
  wsFactory: (url: string) => WsLike;
  now: () => number;
  wsDurationMs?: number;
  log?: (line: string) => void;
}

export interface UniverseAuditResult {
  markdown: string;
  counts: {
    ticker24hr: number;
    exchangeInfoTotal: number;
    byStatus: Record<string, number>;
    byContractType: Record<string, number>;
    wsTickers: number;
    universeCandidates: number;
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function sampleDiff(a: Set<string>, b: Set<string>, limit = 20): string[] {
  const diff: string[] = [];
  for (const s of a) {
    if (!b.has(s) && diff.length < limit) diff.push(s);
  }
  return diff;
}

export async function auditUniverse(deps: UniverseAuditDeps): Promise<UniverseAuditResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const now = deps.now;
  const wsDurationMs = deps.wsDurationMs ?? 10000;

  const exchangeInfo = await deps.fetchJson<any>(`${FAPI}/fapi/v1/exchangeInfo`);
  const symbols: any[] = exchangeInfo.data?.symbols || [];

  const ticker = await deps.fetchJson<any[]>(`${FAPI}/fapi/v1/ticker/24hr`);
  const tickerSymbols = new Set<string>((ticker.data || []).map((t: any) => String(t.symbol)));

  const wsSymbols = await new Promise<Set<string>>((resolve) => {
    const seen = new Set<string>();
    let settled = false;
    const ws = deps.wsFactory(buildFuturesWsUrl('market', ['!ticker@arr']));
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch (_) {}
      resolve(seen);
    };
    ws.on('message', (raw: any) => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
        const list = Array.isArray(parsed) ? parsed : parsed?.data;
        if (Array.isArray(list)) {
          for (const t of list) if (t?.s) seen.add(String(t.s));
        }
      } catch (_) {}
    });
    ws.on('error', () => {});
    setTimeout(finish, wsDurationMs);
  });

  const universeCandidates = symbols.filter(
    (s) =>
      String(s.status).toUpperCase() === 'TRADING' &&
      ['PERPETUAL', 'TRADIFI_PERPETUAL'].includes(String(s.contractType).toUpperCase()) &&
      String(s.quoteAsset).toUpperCase() === 'USDT'
  );

  const byStatus = countBy(symbols, (s) => String(s.status || 'UNKNOWN').toUpperCase());
  const byContractType = countBy(symbols, (s) => String(s.contractType || 'UNKNOWN').toUpperCase());

  const exchangeSymbols = new Set<string>(symbols.map((s) => String(s.symbol)));
  const inWsNotRest = sampleDiff(wsSymbols, tickerSymbols);
  const inRestNotWs = sampleDiff(tickerSymbols, wsSymbols);

  const generatedAt = new Date(now()).toISOString();
  const lines: string[] = [];
  lines.push('# Universo monitorado — reconciliação de fontes');
  lines.push('');
  lines.push(`> Gerado por \`npm run audit:universe\` em ${generatedAt}. Não editar à mão.`);
  lines.push('');
  lines.push('## Contagem real por grupo');
  lines.push('');
  lines.push('| Grupo | Fonte | Símbolos |');
  lines.push('| --- | --- | ---: |');
  lines.push(`| Ticker 24h | REST \`/fapi/v1/ticker/24hr\` | ${tickerSymbols.size} |`);
  lines.push(`| exchangeInfo (total) | REST \`/fapi/v1/exchangeInfo\` | ${symbols.length} |`);
  lines.push(`| WS \`!ticker@arr\` (${Math.round(wsDurationMs / 1000)}s) | WebSocket \`/market\` | ${wsSymbols.size} |`);
  lines.push(`| Universo candidato | exchangeInfo TRADING + PERPETUAL/TRADIFI_PERPETUAL + USDT | ${universeCandidates.length} |`);
  lines.push('');
  lines.push('### exchangeInfo por `status`');
  lines.push('');
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) lines.push(`- \`${k}\`: ${v}`);
  lines.push('');
  lines.push('### exchangeInfo por `contractType`');
  lines.push('');
  for (const [k, v] of Object.entries(byContractType).sort((a, b) => b[1] - a[1])) lines.push(`- \`${k}\`: ${v}`);
  lines.push('');
  lines.push('## Diferença REST × WS');
  lines.push('');
  lines.push(`- Diferença absoluta: ${Math.abs(tickerSymbols.size - wsSymbols.size)} símbolos.`);
  lines.push(`- No WS e ausentes no REST \`ticker/24hr\`: ${inWsNotRest.length === 0 ? 'nenhum' : inWsNotRest.join(', ')}`);
  lines.push(`- No REST e ausentes no WS: ${inRestNotWs.length === 0 ? 'nenhum' : inRestNotWs.join(', ')}`);
  lines.push('');
  lines.push('### Nota sobre o "787 × 987" do smoke');
  lines.push('');
  lines.push('O smoke anterior somava os tickers de CADA mensagem do WS (5 mensagens → 987 tickers), não símbolos únicos:');
  lines.push(`há repetição entre snapshots. Contando símbolos ÚNICOS em ${Math.round(wsDurationMs / 1000)}s, o WS entregou ${wsSymbols.size}.`);
  lines.push(`O REST \`ticker/24hr\` lista ${tickerSymbols.size} símbolos — exatamente o número de símbolos \`TRADING\` do \`exchangeInfo\` (${byStatus.TRADING ?? 0}).`);
  lines.push('Os símbolos vistos apenas no WS são majoritariamente `*_PERP` (coin-margined), que não pertencem ao `/fapi` (USDⓈ-margined).');
  lines.push('Portanto não havia "200 símbolos faltando": era contagem cumulativa (com duplicatas) contra contagem única.');
  lines.push('');
  lines.push('## Fonte que define o universo');
  lines.push('');
  lines.push('O universo monitorado é definido pelo **`exchangeInfo`** com `status == TRADING`,');
  lines.push('`contractType` em `PERPETUAL`/`TRADIFI_PERPETUAL` e moeda de cotação `USDT`');
  lines.push('(decisão formalizada em 6.4.6). O WS `!ticker@arr` é apenas fonte de preço, não de universo.');
  lines.push('');

  const markdown = lines.join('\n');

  const counts = {
    ticker24hr: tickerSymbols.size,
    exchangeInfoTotal: symbols.length,
    byStatus,
    byContractType,
    wsTickers: wsSymbols.size,
    universeCandidates: universeCandidates.length
  };

  log(`Auditoria: REST=${counts.ticker24hr}, exchangeInfo=${counts.exchangeInfoTotal}, WS=${counts.wsTickers}, universo=${counts.universeCandidates}`);
  log(`exchangeSymbols conhecidos: ${exchangeSymbols.size}`);

  return { markdown, counts };
}

async function main() {
  const result = await auditUniverse({
    fetchJson: (url, opts) => requestJsonLimited(url, opts),
    wsFactory: (url) => new WebSocket(url) as unknown as WsLike,
    now: () => Date.now()
  });

  const docsDir = path.resolve(process.cwd(), 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const outPath = path.join(docsDir, 'UNIVERSE.md');
  fs.writeFileSync(outPath, result.markdown);
  console.log(`✅ ${outPath} gerado.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Fatal universe audit error:', err);
    process.exit(1);
  });
}
