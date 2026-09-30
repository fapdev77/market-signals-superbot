/**
 * Captura de fixtures reais da Binance Futures (Fase 6.1.2).
 *
 * Garantias:
 *  - Cada arquivo inclui `_meta: { capturedAt, endpoint, query, serverTimeFromTimeEndpoint }`.
 *  - `exchangeInfo` é gravado como subconjunto: todos os `TRADIFI_PERPETUAL` + 3 perpétuos cripto,
 *    preservando `filters`.
 *  - Escrita ATÔMICA: os arquivos vão para um diretório temporário e só substituem o conjunto
 *    atual quando TODAS as capturas passam. Qualquer falha encerra com código != 0 e deixa as
 *    fixtures existentes intactas.
 *
 * Todas as chamadas passam pelo rate limiter (`requestJsonLimited`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestJsonLimited, type HttpResponse } from '../server/utils/httpClient.js';

const FAPI = 'https://fapi.binance.com';
const CRYPTO_SAMPLE = ['BTCUSDT', 'ETHUSDT', 'PAXGUSDT'];

export interface FixtureMeta {
  capturedAt: string;
  endpoint: string;
  query: string;
  serverTimeFromTimeEndpoint: number;
}

export interface CaptureDeps {
  fixturesDir: string;
  fetchJson: <T = any>(url: string, options?: any) => Promise<HttpResponse<T>>;
  now: () => number;
  log?: (line: string) => void;
}

export interface CaptureResult {
  ok: boolean;
  exitCode: number;
  captured: string[];
  errors: string[];
}

function withMeta<T>(meta: FixtureMeta, body: Record<string, any>): Record<string, any> {
  return { _meta: meta, ...body };
}

export async function captureFixtures(deps: CaptureDeps): Promise<CaptureResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const captured: string[] = [];
  const errors: string[] = [];

  const tmpDir = path.join(deps.fixturesDir, '.capture-tmp');

  const get = async <T = any>(endpoint: string, query = ''): Promise<T> => {
    const url = FAPI + endpoint + (query ? `?${query}` : '');
    try {
      const res = await deps.fetchJson<T>(url);
      return res.data;
    } catch (err: any) {
      throw new Error(`${endpoint}${query ? `?${query}` : ''}: ${err?.message || String(err)}`);
    }
  };

  try {
    const time = await get<{ serverTime: number }>('/fapi/v1/time');
    const serverTimeFromTimeEndpoint = time.serverTime;

    const meta = (endpoint: string, query = ''): FixtureMeta => ({
      capturedAt: new Date(deps.now()).toISOString(),
      endpoint,
      query,
      serverTimeFromTimeEndpoint
    });

    const exchangeInfo = await get<any>('/fapi/v1/exchangeInfo');
    const allSymbols: any[] = exchangeInfo.symbols || [];
    const tradfiSymbols = allSymbols.filter((s) => s.contractType === 'TRADIFI_PERPETUAL');
    if (tradfiSymbols.length === 0) {
      throw new Error('exchangeInfo sem símbolos TRADIFI_PERPETUAL; não é possível capturar amostras TradFi.');
    }
    const cryptoSample = allSymbols.filter((s) => CRYPTO_SAMPLE.includes(s.symbol));
    const exchangeInfoSubset = withMeta(meta('/fapi/v1/exchangeInfo'), {
      timezone: exchangeInfo.timezone,
      serverTime: exchangeInfo.serverTime,
      symbols: [...cryptoSample, ...tradfiSymbols]
    });

    const tradfiSymbol: string = tradfiSymbols[0].symbol;

    const tradingSchedule = await get<any>('/fapi/v1/tradingSchedule');
    const tradingSchedulePayload = withMeta(meta('/fapi/v1/tradingSchedule'), {
      marketSchedules: tradingSchedule.marketSchedules
    });

    const fundingInfo = await get<any[]>('/fapi/v1/fundingInfo');
    const fundingInfoPayload = withMeta(meta('/fapi/v1/fundingInfo'), { data: fundingInfo });

    const premiumCrypto = await get<any>('/fapi/v1/premiumIndex', 'symbol=BTCUSDT');
    const premiumTradfi = await get<any>('/fapi/v1/premiumIndex', `symbol=${tradfiSymbol}`);
    const premiumIndexPayload = withMeta(meta('/fapi/v1/premiumIndex', `symbol=BTCUSDT,${tradfiSymbol}`), {
      samples: { BTCUSDT: premiumCrypto, [tradfiSymbol]: premiumTradfi }
    });

    const fundingRateCrypto = await get<any[]>('/fapi/v1/fundingRate', 'symbol=BTCUSDT&limit=100');
    const fundingRateTradfi = await get<any[]>('/fapi/v1/fundingRate', `symbol=${tradfiSymbol}&limit=100`);
    const fundingRatePayload = withMeta(meta('/fapi/v1/fundingRate', `symbol=BTCUSDT,${tradfiSymbol}&limit=100`), {
      samples: { BTCUSDT: fundingRateCrypto, [tradfiSymbol]: fundingRateTradfi }
    });

    const oi5m = await get<any[]>('/futures/data/openInterestHist', 'symbol=BTCUSDT&period=5m&limit=500');
    const oi1h = await get<any[]>('/futures/data/openInterestHist', 'symbol=BTCUSDT&period=1h&limit=500');
    const openInterestPayload = withMeta(meta('/futures/data/openInterestHist', 'symbol=BTCUSDT&period=5m,1h'), {
      samples: { '5m': oi5m, '1h': oi1h }
    });

    const ticker24hr = await get<any[]>('/fapi/v1/ticker/24hr');
    const tickerPayload = withMeta(meta('/fapi/v1/ticker/24hr'), {
      symbols: ticker24hr.map((t) => t.symbol)
    });

    const files: Record<string, Record<string, any>> = {
      'exchangeInfo.json': exchangeInfoSubset,
      'tradingSchedule.json': tradingSchedulePayload,
      'fundingInfo.json': fundingInfoPayload,
      'premiumIndex.json': premiumIndexPayload,
      'fundingRate.json': fundingRatePayload,
      'openInterestHist.json': openInterestPayload,
      'ticker24hr.json': tickerPayload
    };

    // Escrita em diretório temporário primeiro.
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    for (const [name, payload] of Object.entries(files)) {
      fs.writeFileSync(path.join(tmpDir, name), JSON.stringify(payload, null, 2) + '\n');
    }

    // Só substitui o conjunto atual depois que tudo passou.
    fs.mkdirSync(deps.fixturesDir, { recursive: true });
    for (const name of Object.keys(files)) {
      fs.renameSync(path.join(tmpDir, name), path.join(deps.fixturesDir, name));
      captured.push(name);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });

    log(`✅ Captura concluída: ${captured.join(', ')}`);
    return { ok: true, exitCode: 0, captured, errors };
  } catch (err: any) {
    const message = err?.message || String(err);
    errors.push(message);
    // Falha: descarta o temporário e não toca nas fixtures existentes.
    fs.rmSync(tmpDir, { recursive: true, force: true });
    log(`❌ Captura falhou: ${message} (fixtures existentes mantidas)`);
    return { ok: false, exitCode: 1, captured, errors };
  }
}

function realFetchJson<T = any>(url: string, options?: any): Promise<HttpResponse<T>> {
  return requestJsonLimited<T>(url, options);
}

async function main() {
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/binance');
  const result = await captureFixtures({ fixturesDir, fetchJson: realFetchJson, now: () => Date.now() });
  if (!result.ok) {
    console.error('❌ Nenhuma fixture foi alterada.');
  }
  process.exit(result.exitCode);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Fatal fixture capture error:', err);
    process.exit(1);
  });
}
