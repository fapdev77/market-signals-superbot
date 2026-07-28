import WebSocket from 'ws';

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

const wsStatus: WSStatus = {
  connected: false,
  connecting: false,
  url: 'wss://fstream.binance.com/ws/!ticker@arr',
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

export function initBinanceWebSocket() {
  if (wsStatus.connecting || (wsInstance && wsInstance.readyState === WebSocket.OPEN)) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  wsStatus.connecting = true;
  const wsUrl = wsStatus.url;

  addBinanceLog('INFO', 'WEBSOCKET', `Iniciando conexão WebSocket com Binance Futures: ${wsUrl}`);

  try {
    wsInstance = new WebSocket(wsUrl);

    wsInstance.on('open', () => {
      wsStatus.connected = true;
      wsStatus.connecting = false;
      wsStatus.lastConnectedAt = Date.now();
      wsStatus.lastError = null;

      addBinanceLog('SUCCESS', 'WEBSOCKET', `Conexão WebSocket estabelecida com sucesso com Binance Futures (${wsUrl})`);
    });

    wsInstance.on('message', (data: WebSocket.Data) => {
      try {
        const json = JSON.parse(data.toString());
        wsStatus.messagesReceived++;
        wsStatus.lastTickAt = Date.now();

        if (Array.isArray(json)) {
          for (const item of json) {
            // item.s = symbol (e.g. BTCUSDT), item.c = last price, item.P = price change percent
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

        // Log periodic ticker metrics every 100 messages to avoid cluttering console
        if (wsStatus.messagesReceived % 100 === 0) {
          addBinanceLog(
            'INFO',
            'WEBSOCKET',
            `Fluxo em tempo real ativo: ${wsStatus.messagesReceived} pacotes recebidos de tickers.`
          );
        }
      } catch (err: any) {
        addBinanceLog('WARN', 'WEBSOCKET', `Erro ao decodificar JSON do WebSocket: ${err.message}`);
      }
    });

    wsInstance.on('error', (err: any) => {
      wsStatus.lastError = err.message || 'Erro de rede desconhecido no WebSocket';
      addBinanceLog('ERROR', 'WEBSOCKET', `Erro na conexão WebSocket: ${wsStatus.lastError}`);
    });

    wsInstance.on('close', (code: number, reason: Buffer) => {
      wsStatus.connected = false;
      wsStatus.connecting = false;
      const reasonStr = reason ? reason.toString() : '';

      addBinanceLog(
        'WARN',
        'WEBSOCKET',
        `Conexão WebSocket encerrada (Código: ${code}, Motivo: "${reasonStr}"). Tentando reconectar em 4 segundos...`
      );

      wsStatus.reconnectCount++;
      reconnectTimer = setTimeout(() => {
        initBinanceWebSocket();
      }, 4000);
    });

  } catch (err: any) {
    wsStatus.connected = false;
    wsStatus.connecting = false;
    wsStatus.lastError = err.message;
    addBinanceLog('ERROR', 'WEBSOCKET', `Falha ao instanciar cliente WebSocket: ${err.message}`);

    reconnectTimer = setTimeout(() => {
      initBinanceWebSocket();
    }, 5000);
  }
}
