/**
 * Binance Futures API & WebSocket Smoke Test (Fase 6.1.1)
 *
 * Validações OBRIGATÓRIAS (falha em qualquer uma => saída diferente de 0):
 *  REST  /fapi/v1/time           (falha se a diferença de relógio passar de 2 s)
 *  REST  /fapi/v1/exchangeInfo   (serverTime apenas informativo, sem checagem de relógio)
 *  REST  /fapi/v1/tradingSchedule
 *  REST  /fapi/v1/fundingInfo
 *  REST  /fapi/v1/fundingRate?symbol=BTCUSDT&limit=5
 *  REST  /fapi/v1/premiumIndex?symbol=BTCUSDT
 *  REST  /fapi/v1/openInterestHist?symbol=BTCUSDT&period=5m&limit=5
 *  REST  /fapi/v1/depth?symbol=BTCUSDT&limit=20
 *  REST  /fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=5
 *  WS    /market  !ticker@arr       (exige ao menos uma mensagem)
 *  WS    /public  btcusdt@bookTicker (exige ao menos uma mensagem)
 *  WS    /market  !forceOrder@arr   (conectar já conta como ok; o stream pode ficar calado)
 *
 * Todas as chamadas REST passam pelo rate limiter (`requestJsonLimited`).
 * O peso usado (`x-mbx-used-weight-1m`) é impresso ao final.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { buildFuturesWsUrl } from '../server/utils/wsUrl.js';
import { requestJsonLimited, type HttpResponse } from '../server/utils/httpClient.js';

const FAPI = 'https://fapi.binance.com';
const MAX_CLOCK_DRIFT_MS = 2000;

export interface WsLike {
  on(event: 'open' | 'message' | 'error' | 'close', cb: (...args: any[]) => void): void;
  close(): void;
}

export interface SmokeDeps {
  fetchJson: <T = any>(url: string, options?: any) => Promise<HttpResponse<T>>;
  wsFactory: (url: string) => WsLike;
  now: () => number;
  log?: (line: string) => void;
  wsDurationMs?: number;
}

export interface SmokeCheck {
  name: string;
  mandatory: boolean;
  success: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

export interface SmokeResult {
  checks: SmokeCheck[];
  allPass: boolean;
  exitCode: number;
  usedWeight1m: number | null;
}

interface RestSpec {
  name: string;
  query: string;
  mandatory: boolean;
  validate?: (data: any, now: number) => string | null;
  info?: (data: any, now: number) => string;
}

function isRecord(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const REST_SPECS: RestSpec[] = [
  {
    name: 'REST /fapi/v1/time',
    query: '/fapi/v1/time',
    mandatory: true,
    validate: (d, now) =>
      typeof d?.serverTime === 'number'
        ? Math.abs(now - d.serverTime) > MAX_CLOCK_DRIFT_MS
          ? `deriva de relógio acima de ${MAX_CLOCK_DRIFT_MS}ms`
          : null
        : 'serverTime ausente',
    info: (d, now) => `serverTime=${d?.serverTime} (diff=${typeof d?.serverTime === 'number' ? now - d.serverTime : 'n/d'}ms)`
  },
  {
    name: 'REST /fapi/v1/exchangeInfo',
    query: '/fapi/v1/exchangeInfo',
    mandatory: true,
    validate: (d) => (isRecord(d) && Array.isArray(d.symbols) ? null : 'symbols ausente'),
    info: (d) => `serverTime=${d?.serverTime} (informativo, sem checagem de relógio); ${d?.symbols?.length ?? 0} símbolos`
  },
  {
    name: 'REST /fapi/v1/tradingSchedule',
    query: '/fapi/v1/tradingSchedule',
    mandatory: true,
    validate: (d) => (isRecord(d) && isRecord(d.marketSchedules) ? null : 'marketSchedules ausente'),
    info: (d) => `mercados: ${Object.keys(d?.marketSchedules || {}).join(', ') || 'nenhum'}`
  },
  {
    name: 'REST /fapi/v1/fundingInfo',
    query: '/fapi/v1/fundingInfo',
    mandatory: true,
    validate: (d) => (Array.isArray(d) ? null : 'resposta não é lista'),
    info: (d) => `${d?.length ?? 0} contratos`
  },
  {
    name: 'REST /fapi/v1/fundingRate?symbol=BTCUSDT',
    query: '/fapi/v1/fundingRate?symbol=BTCUSDT&limit=5',
    mandatory: true,
    validate: (d) => (Array.isArray(d) ? null : 'resposta não é lista'),
    info: (d) => `${d?.length ?? 0} registros`
  },
  {
    name: 'REST /fapi/v1/premiumIndex?symbol=BTCUSDT',
    query: '/fapi/v1/premiumIndex?symbol=BTCUSDT',
    mandatory: true,
    validate: (d) => (isRecord(d) && d.markPrice != null ? null : 'markPrice ausente'),
    info: (d) => `markPrice=${d?.markPrice} lastFundingRate=${d?.lastFundingRate}`
  },
  {
    name: 'REST /futures/data/openInterestHist?symbol=BTCUSDT',
    query: '/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=5',
    mandatory: true,
    validate: (d) => (Array.isArray(d) ? null : 'resposta não é lista'),
    info: (d) => `${d?.length ?? 0} pontos`
  },
  {
    name: 'REST /fapi/v1/depth?symbol=BTCUSDT',
    query: '/fapi/v1/depth?symbol=BTCUSDT&limit=20',
    mandatory: true,
    validate: (d) => (isRecord(d) && Array.isArray(d.bids) && Array.isArray(d.asks) ? null : 'bids/asks ausentes'),
    info: (d) => `${d?.bids?.length ?? 0} bids / ${d?.asks?.length ?? 0} asks`
  },
  {
    name: 'REST /fapi/v1/klines?symbol=BTCUSDT&interval=1m',
    query: '/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=5',
    mandatory: true,
    validate: (d) => (Array.isArray(d) ? null : 'resposta não é lista'),
    info: (d) => `${d?.length ?? 0} candles`
  }
];

function describe(data: any): string {
  if (Array.isArray(data)) return `${data.length} itens`;
  if (isRecord(data)) return `${Object.keys(data).length} campos`;
  return String(data);
}

function formatCheck(c: SmokeCheck): string {
  const status = c.success ? '✅ PASSOU' : '❌ FALHOU';
  const suffix = c.error ? `erro: ${c.error}` : c.details || '';
  return `${status} - ${c.name} (${c.durationMs}ms) ${suffix}`;
}

export async function runSmoke(deps: SmokeDeps): Promise<SmokeResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const now = deps.now;

  const checks: SmokeCheck[] = [];
  let usedWeight1m: number | null = null;

  const record = (c: SmokeCheck) => {
    checks.push(c);
    log(formatCheck(c));
  };

  const readWeight = (headers: Record<string, any> | undefined) => {
    const raw = headers?.['x-mbx-used-weight-1m'];
    if (raw != null) {
      const n = parseInt(String(raw), 10);
      if (!Number.isNaN(n)) usedWeight1m = Math.max(usedWeight1m ?? 0, n);
    }
  };

  for (const spec of REST_SPECS) {
    const url = FAPI + spec.query;
    const t0 = now();
    try {
      const res = await deps.fetchJson(url);
      readWeight(res.headers);
      const error = spec.validate ? spec.validate(res.data, now()) : null;
      record({
        name: spec.name,
        mandatory: spec.mandatory,
        success: !error,
        durationMs: now() - t0,
        details: spec.info ? spec.info(res.data, now()) : describe(res.data),
        error: error ?? undefined
      });
    } catch (err: any) {
      record({
        name: spec.name,
        mandatory: spec.mandatory,
        success: false,
        durationMs: now() - t0,
        error: err?.message || String(err)
      });
    }
  }

  const wsProbe = (name: string, url: string, requireMessage: boolean, mandatory: boolean) =>
    new Promise<void>((resolve) => {
      const t0 = now();
      const duration = deps.wsDurationMs ?? 8000;
      let opened = false;
      let messages = 0;
      let errored: string | undefined;
      let settled = false;

      const ws = deps.wsFactory(url);

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch (_) {}
        const success = !errored && (requireMessage ? messages > 0 : opened);
        record({
          name,
          mandatory,
          success,
          durationMs: now() - t0,
          details: `${messages} mensagens${opened ? ' (conectado)' : ' (não conectou)'}`,
          error: errored || (success ? undefined : requireMessage ? 'nenhuma mensagem recebida' : 'conexão não estabelecida')
        });
        resolve();
      };

      ws.on('open', () => {
        opened = true;
      });
      ws.on('message', () => {
        messages++;
      });
      ws.on('error', (err: any) => {
        errored = err?.message || String(err);
      });

      setTimeout(finish, duration);
    });

  await wsProbe(
    'WS /market !ticker@arr',
    buildFuturesWsUrl('market', ['!ticker@arr']),
    true,
    true
  );
  await wsProbe(
    'WS /public btcusdt@bookTicker',
    buildFuturesWsUrl('public', ['btcusdt@bookTicker']),
    true,
    true
  );
  await wsProbe(
    'WS /market !forceOrder@arr',
    buildFuturesWsUrl('market', ['!forceOrder@arr']),
    false,
    true
  );

  const allPass = checks.filter((c) => c.mandatory).every((c) => c.success);
  return { checks, allPass, exitCode: allPass ? 0 : 1, usedWeight1m };
}

function realWsFactory(url: string): WsLike {
  return new WebSocket(url) as unknown as WsLike;
}

async function main() {
  console.log('======================================================');
  console.log('🚀 [BINANCE SMOKE TEST] REST FAPI + WebSocket');
  console.log('======================================================\n');

  const result = await runSmoke({
    fetchJson: (url, options) => requestJsonLimited(url, options),
    wsFactory: realWsFactory,
    now: () => Date.now()
  });

  console.log('\n======================================================');
  console.log('📊 RESUMO DO SMOKE TEST');
  console.log('======================================================');
  console.log(`Peso usado (x-mbx-used-weight-1m): ${result.usedWeight1m ?? 'n/d'}`);
  console.log(`Resultado: ${result.allPass ? '✅ TUDO OK' : '❌ FALHAS OBRIGATÓRIAS'}`);
  console.log('======================================================\n');

  if (!result.allPass) {
    console.error('❌ Smoke test terminou com falhas obrigatórias. Código de saída 1.');
  }
  process.exit(result.exitCode);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath && invokedPath === modulePath) {
  main().catch((err) => {
    console.error('Fatal smoke test error:', err);
    process.exit(1);
  });
}
