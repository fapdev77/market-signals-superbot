import WebSocket from 'ws';
import { getErrorMessage } from './utils/errors.js';
import { LiquidationEvent, LiquidationSummary } from '../src/types.js';
// R-2: simulação de liquidações isolada em server/demo/.
import { simulateLiquidationSummary } from './demo/syntheticMarket.js';
// R-13: health por feed.
import { recordFeedSuccess, recordFeedFailure } from './services/feedHealth.js';
import { emitOperationalAlert } from './services/operationalAlerts.js';
import { buildFuturesWsUrl, calculateWsBackoff } from './utils/wsUrl.js';

export const WS_SILENCE_MS = 15000; // 15 seconds watchdog limit for active tickers

export interface WSStatus {
  connected: boolean;
  connecting: boolean;
  url: string;
  lastConnectedAt: number | null;
  lastTickAt: number | null;
  messagesReceived: number;
  reconnectCount: number;
  lastError: string | null;
}

export interface BinanceLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  type: 'WEBSOCKET' | 'REST_API';
  message: string;
  details?: any;
}

const MAX_LOGS = 100;
const logsBuffer: BinanceLogEntry[] = [];

export function addBinanceLog(
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS',
  type: 'WEBSOCKET' | 'REST_API',
  message: string,
  details?: any
) {
  const timestamp = new Date().toISOString();
  const entry: BinanceLogEntry = { timestamp, level, type, message, details };
  logsBuffer.unshift(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.pop();
  }
  
  const icon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'SUCCESS' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${icon} [${type}] ${message}`, details ? JSON.stringify(details) : '');
}

export function getBinanceLogs(): BinanceLogEntry[] {
  return [...logsBuffer];
}

let wsInstance: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let watchdogTimer: NodeJS.Timeout | null = null;
let connectionRotationTimer: NodeJS.Timeout | null = null;

let liqWsInstance: WebSocket | null = null;
let liqReconnectTimer: NodeJS.Timeout | null = null;
let liqReconnectAttempts = 0;

// In-memory liquidation events buffer per symbol (rolling 30 mins, max 60 per symbol)
const liquidationBuffer: Record<string, LiquidationEvent[]> = {};

export function recordLiquidationEvent(event: LiquidationEvent) {
  if (!liquidationBuffer[event.symbol]) {
    liquidationBuffer[event.symbol] = [];
  }
  liquidationBuffer[event.symbol].unshift(event);
  const cutoff = Date.now() - 30 * 60 * 1000;
  liquidationBuffer[event.symbol] = liquidationBuffer[event.symbol]
    .filter(e => e.timestamp > cutoff)
    .slice(0, 60);
}

export function getLiquidationsSummary(symbol: string, currentPrice?: number): LiquidationSummary {
  const cleanSymbol = symbol.toUpperCase();
  const events = liquidationBuffer[cleanSymbol] || [];
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recent = events.filter(e => e.timestamp > cutoff);

  let totalBuyLiqUSD = 0; // Short liquidations (forced buys)
  let totalSellLiqUSD = 0; // Long liquidations (forced sells)

  recent.forEach(e => {
    if (e.side === 'BUY') {
      totalBuyLiqUSD += e.usdValue;
    } else {
      totalSellLiqUSD += e.usdValue;
    }
  });

  if (recent.length === 0 && currentPrice && currentPrice > 0 && process.env.ALLOW_SYNTHETIC_DATA === 'true') {
    return simulateLiquidationSummary(cleanSymbol, currentPrice);
  }

  const lastSpike = recent.length > 0 ? recent[0].timestamp : undefined;

  return {
    totalBuyLiqUSD: Math.round(totalBuyLiqUSD),
    totalSellLiqUSD: Math.round(totalSellLiqUSD),
    netLiqUSD: Math.round(totalBuyLiqUSD - totalSellLiqUSD),
    recentEvents: recent.slice(0, 15),
    lastSpikeAt: lastSpike
  };
}

const wsStatus: WSStatus = {
  connected: false,
  connecting: false,
  url: buildFuturesWsUrl('market', ['!ticker@arr']),
  lastConnectedAt: null,
  lastTickAt: null,
  messagesReceived: 0,
  reconnectCount: 0,
  lastError: null
};

// In-memory ticker cache updated via WebSocket stream
const liveWSTickers: Record<string, any> = {};

export function getLiveWSTicker(symbol: string): any | null {
  return liveWSTickers[symbol] || null;
}

export function getLiveWSTickers(): Record<string, any> {
  return liveWSTickers;
}

export function getWebSocketStatus(): WSStatus {
  return { ...wsStatus };
}

export function evaluateWsFeedHealth(params: {
  connected: boolean;
  lastTickAt: number | null;
  now?: number;
}): { isHealthy: boolean; isDegraded: boolean; reason?: string; needsReconnect: boolean } {
  const now = params.now ?? Date.now();
  if (!params.connected) {
    return {
      isHealthy: false,
      isDegraded: true,
      reason: 'WebSocket desconectado',
      needsReconnect: true
    };
  }

  if (!params.lastTickAt) {
    return {
      isHealthy: true,
      isDegraded: false,
      needsReconnect: false
    };
  }

  const silenceDuration = now - params.lastTickAt;
  if (silenceDuration > WS_SILENCE_MS) {
    return {
      isHealthy: false,
      isDegraded: true,
      reason: `Feed WebSocket sem mensagens de ticker há ${Math.round(silenceDuration / 1000)}s (> ${WS_SILENCE_MS / 1000}s).`,
      needsReconnect: true
    };
  }

  return {
    isHealthy: true,
    isDegraded: false,
    needsReconnect: false
  };
}

function cleanupSocket() {
  if (wsInstance) {
    try {
      wsInstance.removeAllListeners();
      wsInstance.terminate();
    } catch (_) {}
    wsInstance = null;
  }
}

function cleanupLiqSocket() {
  if (liqWsInstance) {
    try {
      liqWsInstance.removeAllListeners();
      liqWsInstance.terminate();
    } catch (_) {}
    liqWsInstance = null;
  }
}

export function stopBinanceWebSocket() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  if (connectionRotationTimer) {
    clearTimeout(connectionRotationTimer);
    connectionRotationTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (liqReconnectTimer) {
    clearTimeout(liqReconnectTimer);
    liqReconnectTimer = null;
  }
  cleanupSocket();
  cleanupLiqSocket();
  wsStatus.connected = false;
  wsStatus.connecting = false;
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    const health = evaluateWsFeedHealth({
      connected: wsStatus.connected,
      lastTickAt: wsStatus.lastTickAt
    });

    if (health.needsReconnect && wsStatus.connected) {
      addBinanceLog(
        'WARN',
        'WEBSOCKET',
        `Watchdog de silêncio: ${health.reason} Reiniciando conexão preventiva...`
      );
      recordFeedFailure('ws', health.reason);
      // 6.6: WS_SILENT do catálogo operacional (dedup central evita repetição a cada 5s).
      void emitOperationalAlert('WS_SILENT', 'HIGH', `Watchdog WebSocket: ${health.reason}`, {
        lastTickAt: wsStatus.lastTickAt
      });
      cleanupSocket();
      wsStatus.connected = false;
      wsStatus.connecting = false;
      initBinanceWebSocket();
    }
  }, 5000);
}

export function initBinanceWebSocket() {
  startWatchdog();

  if (wsStatus.connecting || (wsInstance && wsInstance.readyState === WebSocket.OPEN)) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  cleanupSocket();

  wsStatus.connecting = true;
  const wsUrl = buildFuturesWsUrl('market', ['!ticker@arr']);
  wsStatus.url = wsUrl;

  addBinanceLog('INFO', 'WEBSOCKET', `Iniciando conexão WebSocket Binance Futures (/market): ${wsUrl}`);

  try {
    wsInstance = new WebSocket(wsUrl);

    wsInstance.on('open', () => {
      wsStatus.connected = true;
      wsStatus.connecting = false;
      wsStatus.lastConnectedAt = Date.now();
      wsStatus.lastTickAt = Date.now();
      wsStatus.lastError = null;
      // Reset backoff on healthy connection
      wsStatus.reconnectCount = 0;
      recordFeedSuccess('ws');

      addBinanceLog('SUCCESS', 'WEBSOCKET', `Conexão WebSocket estabelecida com sucesso com Binance Futures (${wsUrl})`);

      // 24-hour proactive connection rotation as per Binance documentation
      if (connectionRotationTimer) clearTimeout(connectionRotationTimer);
      connectionRotationTimer = setTimeout(() => {
        addBinanceLog('INFO', 'WEBSOCKET', 'Rotação preventiva da conexão WebSocket (24h de atividade).');
        cleanupSocket();
        wsStatus.connected = false;
        wsStatus.connecting = false;
        initBinanceWebSocket();
      }, 23 * 3600 * 1000);
    });

    wsInstance.on('ping', () => {
      try {
        wsInstance?.pong();
      } catch (_) {}
    });

    wsInstance.on('message', (data: WebSocket.Data) => {
      try {
        const raw = JSON.parse(data.toString());
        // Handle combined stream payload or raw array
        const json = raw.data ? raw.data : raw;
        wsStatus.messagesReceived++;
        wsStatus.lastTickAt = Date.now();

        if (Array.isArray(json)) {
          for (const item of json) {
            if (item && item.s) {
              liveWSTickers[item.s] = {
                symbol: item.s,
                lastPrice: item.c,
                priceChangePercent: item.P,
                highPrice: item.h,
                lowPrice: item.l,
                volume: item.v,
                quoteVolume: item.q,
                updatedAt: Date.now()
              };
            }
          }
        }

        if (wsStatus.messagesReceived % 100 === 0) {
          addBinanceLog(
            'INFO',
            'WEBSOCKET',
            `Fluxo em tempo real ativo: ${wsStatus.messagesReceived} pacotes recebidos de tickers.`
          );
        }
      } catch (err) {
        addBinanceLog('WARN', 'WEBSOCKET', `Erro ao decodificar JSON do WebSocket: ${getErrorMessage(err)}`);
      }
    });

    wsInstance.on('error', (err: any) => {
      wsStatus.lastError = getErrorMessage(err) || 'Erro de rede desconhecido no WebSocket';
      recordFeedFailure('ws', wsStatus.lastError);
      addBinanceLog('ERROR', 'WEBSOCKET', `Erro na conexão WebSocket: ${wsStatus.lastError}`);
    });

    wsInstance.on('close', (code: number, reason: Buffer) => {
      wsStatus.connected = false;
      wsStatus.connecting = false;
      const reasonStr = reason ? reason.toString() : '';

      wsStatus.reconnectCount++;
      const delayMs = calculateWsBackoff(wsStatus.reconnectCount, { baseMs: 1000, maxMs: 60000, jitter: 0.2 });

      addBinanceLog(
        'WARN',
        'WEBSOCKET',
        `Conexão WebSocket encerrada (Código: ${code}, Motivo: "${reasonStr}"). Tentando reconectar em ${Math.round(delayMs / 1000)}s (tentativa ${wsStatus.reconnectCount})...`
      );

      cleanupSocket();

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        initBinanceWebSocket();
      }, delayMs);
    });

  } catch (err) {
    wsStatus.connected = false;
    wsStatus.connecting = false;
    wsStatus.lastError = getErrorMessage(err);
    wsStatus.reconnectCount++;
    const delayMs = calculateWsBackoff(wsStatus.reconnectCount, { baseMs: 2000, maxMs: 60000, jitter: 0.2 });
    addBinanceLog('ERROR', 'WEBSOCKET', `Falha ao instanciar cliente WebSocket: ${getErrorMessage(err)}`);
    cleanupSocket();

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      initBinanceWebSocket();
    }, delayMs);
  }

  // Also initiate background liquidation stream
  try {
    initLiquidationWebSocket();
  } catch (_) {}
}

export function initLiquidationWebSocket() {
  if (liqWsInstance && (liqWsInstance.readyState === WebSocket.OPEN || liqWsInstance.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (liqReconnectTimer) {
    clearTimeout(liqReconnectTimer);
    liqReconnectTimer = null;
  }

  const url = buildFuturesWsUrl('market', ['!forceOrder@arr']);
  try {
    liqWsInstance = new WebSocket(url);

    liqWsInstance.on('open', () => {
      liqReconnectAttempts = 0;
    });

    liqWsInstance.on('message', (data: WebSocket.Data) => {
      try {
        const raw = JSON.parse(data.toString());
        const json = raw.data ? raw.data : raw;
        const o = json.o || json;
        if (o && o.s && o.S && o.p && o.q) {
          const price = parseFloat(o.p);
          const qty = parseFloat(o.q);
          const usdValue = Math.round(price * qty);
          recordLiquidationEvent({
            symbol: o.s,
            side: o.S === 'BUY' ? 'BUY' : 'SELL',
            price,
            qty,
            usdValue,
            timestamp: o.T || Date.now()
          });
        }
      } catch (_) {}
    });

    liqWsInstance.on('error', () => {});

    liqWsInstance.on('close', () => {
      cleanupLiqSocket();
      liqReconnectAttempts++;
      const delayMs = calculateWsBackoff(liqReconnectAttempts, { baseMs: 2000, maxMs: 60000, jitter: 0.2 });
      if (liqReconnectTimer) clearTimeout(liqReconnectTimer);
      liqReconnectTimer = setTimeout(() => {
        initLiquidationWebSocket();
      }, delayMs);
    });
  } catch (_) {}
}
