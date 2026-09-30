/**
 * Binance Futures API & WebSocket Smoke Test
 *
 * Validates:
 * 1. REST /fapi/v1/time (checks timestamp & latency)
 * 2. REST /fapi/v1/ticker/24hr (validates perpetual 24hr stats)
 * 3. REST /fapi/v1/exchangeInfo (validates futures symbol contracts)
 * 4. WebSocket wss://fstream.binance.com/market/stream?streams=!ticker@arr (counts messages for 10-20s)
 */

import WebSocket from 'ws';
import { buildFuturesWsUrl } from '../server/utils/wsUrl.js';

interface SmokeResult {
  step: string;
  success: boolean;
  durationMs: number;
  details?: any;
  error?: string;
}

const results: SmokeResult[] = [];

async function runRestTest(step: string, url: string): Promise<boolean> {
  const start = Date.now();
  console.log(`[SMOKE] Testando REST: ${url}...`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MarketSignalsSuperBot/1.0'
      }
    });
    clearTimeout(timeout);
    const duration = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ [SMOKE] ${step} falhou com HTTP ${res.status}: ${text.slice(0, 150)}`);
      results.push({ step, success: false, durationMs: duration, error: `HTTP ${res.status}: ${text.slice(0, 100)}` });
      return false;
    }

    const data = await res.json();
    const summary = Array.isArray(data)
      ? `${data.length} itens recebidos`
      : data.serverTime
      ? `serverTime: ${data.serverTime} (diff: ${Math.abs(Date.now() - data.serverTime)}ms)`
      : 'Resposta JSON válida';

    console.log(`✅ [SMOKE] ${step} aprovado em ${duration}ms (${summary})`);
    results.push({ step, success: true, durationMs: duration, details: summary });
    return true;
  } catch (err: any) {
    const duration = Date.now() - start;
    console.error(`❌ [SMOKE] ${step} erro: ${err.message}`);
    results.push({ step, success: false, durationMs: duration, error: err.message });
    return false;
  }
}

async function runWsTest(durationSeconds: number = 10): Promise<boolean> {
  const step = 'WebSocket /market (!ticker@arr)';
  const wsUrl = buildFuturesWsUrl('market', ['!ticker@arr']);
  console.log(`[SMOKE] Conectando WebSocket: ${wsUrl} por ${durationSeconds}s...`);

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    let messageCount = 0;
    let tickerCount = 0;
    let ws: WebSocket | null = null;
    let timeout: NodeJS.Timeout | null = null;

    try {
      ws = new WebSocket(wsUrl);

      timeout = setTimeout(() => {
        const duration = Date.now() - start;
        if (ws) {
          try {
            ws.close();
          } catch (_) {}
        }
        if (messageCount > 0) {
          console.log(`✅ [SMOKE] ${step} aprovado: ${messageCount} pacotes (${tickerCount} tickers) recebidos em ${duration}ms`);
          results.push({
            step,
            success: true,
            durationMs: duration,
            details: `${messageCount} pacotes, ${tickerCount} tickers atualizados`
          });
          resolve(true);
        } else {
          console.error(`❌ [SMOKE] ${step} falhou: nenhuma mensagem recebida em ${durationSeconds}s`);
          results.push({
            step,
            success: false,
            durationMs: duration,
            error: 'Nenhuma mensagem recebida no período de teste'
          });
          resolve(false);
        }
      }, durationSeconds * 1000);

      ws.on('open', () => {
        console.log(`ℹ️ [SMOKE] WebSocket conectado com sucesso em ${Date.now() - start}ms`);
      });

      ws.on('message', (data: WebSocket.Data) => {
        messageCount++;
        try {
          const raw = JSON.parse(data.toString());
          const list = raw.data ? raw.data : raw;
          if (Array.isArray(list)) {
            tickerCount += list.length;
          }
        } catch (_) {}
      });

      ws.on('error', (err: any) => {
        console.error(`⚠️ [SMOKE] WebSocket erro: ${err.message}`);
      });

    } catch (err: any) {
      if (timeout) clearTimeout(timeout);
      const duration = Date.now() - start;
      console.error(`❌ [SMOKE] ${step} falha ao criar socket: ${err.message}`);
      results.push({ step, success: false, durationMs: duration, error: err.message });
      resolve(false);
    }
  });
}

async function main() {
  console.log('======================================================');
  console.log('🚀 [BINANCE SMOKE TEST] Validando endpoints FAPI e WebSocket');
  console.log('======================================================\n');

  await runRestTest('REST Server Time', 'https://fapi.binance.com/fapi/v1/time');
  await runRestTest('REST 24hr Ticker', 'https://fapi.binance.com/fapi/v1/ticker/24hr');
  await runRestTest('REST Exchange Info', 'https://fapi.binance.com/fapi/v1/exchangeInfo');
  await runWsTest(8); // 8 seconds test run

  console.log('\n======================================================');
  console.log('📊 RESUMO DO SMOKE TEST:');
  console.log('======================================================');
  let allPass = true;
  for (const r of results) {
    const status = r.success ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`${status} - ${r.step} (${r.durationMs}ms) ${r.details || r.error || ''}`);
    if (!r.success) allPass = false;
  }
  console.log('======================================================\n');

  if (!allPass) {
    console.warn('⚠️ Nota: Se o ambiente de execução possuir restrição de rede/sandbox para a API pública da Binance, execute este comando no servidor de destino com `npm run smoke:binance`.');
  }
}

main().catch((err) => {
  console.error('Fatal smoke test error:', err);
});
