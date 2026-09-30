import { useState, useEffect, useRef, useCallback } from 'react';
import { TickerData } from '../types';

export interface WSClientStatus {
  connected: boolean;
  connecting: boolean;
  url: string;
  messagesReceived: number;
  lastTickTime: number | null;
  lastError: string | null;
  mode: 'BROWSER_DIRECT' | 'SERVER_FALLBACK';
}

export interface WSLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  source: 'BROWSER_WS' | 'SERVER_WS';
  message: string;
}

// Phase 5 / M0: Migrated to Binance Futures routed /market endpoint
const WS_URLS = [
  'wss://fstream.binance.com/market/stream?streams=!ticker@arr'
];

export function useBinanceWebSocket(initialTickers: TickerData[], onTickersUpdate?: (updated: TickerData[]) => void) {
  const tickersRef = useRef(initialTickers);
  const onTickersUpdateRef = useRef(onTickersUpdate);

  useEffect(() => {
    tickersRef.current = initialTickers;
  }, [initialTickers]);

  useEffect(() => {
    onTickersUpdateRef.current = onTickersUpdate;
  }, [onTickersUpdate]);

  const [status, setStatus] = useState<WSClientStatus>({
    connected: false,
    connecting: true,
    url: WS_URLS[0],
    messagesReceived: 0,
    lastTickTime: null,
    lastError: null,
    mode: 'BROWSER_DIRECT'
  });

  const [logs, setLogs] = useState<WSLogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string) => {
    const entry: WSLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: 'BROWSER_WS',
      message
    };
    setLogs(prev => [entry, ...prev.slice(0, 49)]);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const currentUrl = WS_URLS[0];
    setStatus(prev => ({
      ...prev,
      connecting: true,
      url: currentUrl,
      lastError: null
    }));

    addLog('INFO', `Abrindo conexão WebSocket Binance Futures (/market): ${currentUrl}`);

    try {
      const ws = new WebSocket(currentUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          lastError: null
        }));
        addLog('SUCCESS', `Conexão WebSocket navegador estabelecida com sucesso com Binance Futures (/market)`);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const data = raw.data ? raw.data : raw;
          if (Array.isArray(data)) {
            setStatus(prev => ({
              ...prev,
              messagesReceived: prev.messagesReceived + 1,
              lastTickTime: Date.now()
            }));

            // Map incoming websocket ticker array to fast symbol lookup
            const wsMap = new Map<string, any>();
            for (const item of data) {
              if (item && item.s) {
                wsMap.set(item.s, item);
              }
            }

            if (wsMap.size > 0) {
              // Update ticker values in real-time
              if (onTickersUpdateRef.current) onTickersUpdateRef.current(
                tickersRef.current.map(t => {
                  const wsItem = wsMap.get(t.symbol);
                  if (wsItem) {
                    const newPrice = parseFloat(wsItem.c || wsItem.lastPrice || t.price);
                    const newChange = parseFloat(wsItem.P || wsItem.priceChangePercent || t.priceChangePercent24h);
                    const newHigh = parseFloat(wsItem.h || wsItem.highPrice || t.high24h);
                    const newLow = parseFloat(wsItem.l || wsItem.lowPrice || t.low24h);
                    const newVol = parseFloat(wsItem.v || wsItem.volume || t.volume24h);

                    return {
                      ...t,
                      price: newPrice > 0 ? newPrice : t.price,
                      priceChangePercent24h: !isNaN(newChange) ? newChange : t.priceChangePercent24h,
                      high24h: newHigh > 0 ? newHigh : t.high24h,
                      low24h: newLow > 0 ? newLow : t.low24h,
                      volume24h: newVol > 0 ? newVol : t.volume24h
                    };
                  }
                  return t;
                })
              );
            }
          }
        } catch (err: any) {
          addLog('WARN', `Erro ao processar pacote JSON do WebSocket: ${err.message}`);
        }
      };

      ws.onerror = (_err: any) => {
        const errorMsg = 'Erro de rede ou bloqueio CORS/WSS no WebSocket';
        setStatus(prev => ({
          ...prev,
          lastError: errorMsg
        }));
        addLog('ERROR', `Erro na conexão WebSocket navegador: ${errorMsg}`);
      };

      ws.onclose = (event) => {
        setStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false
        }));

        addLog('WARN', `Conexão WebSocket encerrada (Código: ${event.code}). Reconectando em 4s...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 4000);
      };

    } catch (err: any) {
      setStatus(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        lastError: err.message
      }));
      addLog('ERROR', `Exceção ao instanciar WebSocket no navegador: ${err.message}`);

      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [addLog]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connectWebSocket();
  }, [connectWebSocket]);

  return {
    status,
    logs,
    reconnect
  };
}
