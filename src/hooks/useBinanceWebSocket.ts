import { useState, useEffect, useRef, useCallback } from 'react';
import { TickerData } from '../types';
import { getStoredAuthToken } from '../services/apiClient';

/**
 * 6.8.1/CA-8.1 — O navegador NÃO conecta mais direto à Binance (wss://fstream).
 * O hook consome o stream autenticado do servidor (`/api/stream/tickers`, SSE)
 * via fetch + ReadableStream, enviando `Authorization: Bearer` no HEADER —
 * o token nunca vai em URL. Assim os gates do servidor (qualidade de dados,
 * TradFi, kill-switch) valem também para o que a UI mostra.
 */

export interface WSClientStatus {
  connected: boolean;
  connecting: boolean;
  url: string;
  messagesReceived: number;
  lastTickTime: number | null;
  lastError: string | null;
  mode: 'SERVER_STREAM';
}

export interface WSLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  source: 'SERVER_STREAM';
  message: string;
}

/** Endpoint SSE do próprio servidor (mesma origem; auth por header). */
export const SERVER_STREAM_URL = '/api/stream/tickers';

/** Backoff de reconexão: 2s, 4s, 8s, … teto de 30s. */
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

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
    url: SERVER_STREAM_URL,
    messagesReceived: 0,
    lastTickTime: null,
    lastError: null,
    mode: 'SERVER_STREAM'
  });

  const [logs, setLogs] = useState<WSLogEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);

  const addLog = useCallback((level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string) => {
    const entry: WSLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: 'SERVER_STREAM',
      message
    };
    setLogs(prev => [entry, ...prev.slice(0, 49)]);
  }, []);

  const applyTickers = useCallback((incoming: TickerData[]) => {
    if (!onTickersUpdateRef.current) return;
    const bySymbol = new Map(incoming.map(t => [t.symbol, t]));
    onTickersUpdateRef.current(
      tickersRef.current.map(t => {
        const item = bySymbol.get(t.symbol);
        if (item && typeof item.price === 'number' && item.price > 0) {
          return { ...t, ...item };
        }
        return t;
      })
    );
  }, []);

  const connectStream = useCallback(() => {
    if (abortRef.current) return; // já conectando/conectado

    const token = getStoredAuthToken();
    if (!token) {
      setStatus(prev => ({ ...prev, connected: false, connecting: false, lastError: 'Sem token de autenticação.' }));
      addLog('WARN', 'Stream do servidor aguardando token de acesso (Authorization: Bearer).');
      // Sem token ainda: tenta de novo mais tarde (o usuário pode logar a qualquer momento).
      reconnectTimeoutRef.current = setTimeout(connectStream, RECONNECT_MAX_MS);
      return;
    }

    setStatus(prev => ({ ...prev, connecting: true, lastError: null }));
    addLog('INFO', `Abrindo stream de preços do servidor: ${SERVER_STREAM_URL}`);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch(SERVER_STREAM_URL, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
          // Same-origin: cookies/vite dev funcionam; o token segue no header.
          credentials: 'same-origin'
        });

        if (response.status === 401) {
          setStatus(prev => ({ ...prev, connected: false, connecting: false, lastError: 'Não autorizado (401).' }));
          addLog('ERROR', 'Stream rejeitado: token ausente ou inválido (401).');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('superbot:unauthorized'));
          }
          return; // sem retry automático: exige ação do usuário (inserir token)
        }

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        setStatus(prev => ({ ...prev, connected: true, connecting: false, lastError: null }));
        attemptRef.current = 0;
        addLog('SUCCESS', 'Stream de preços do servidor estabelecido.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Parser SSE: blocos separados por linha vazia; linhas "event:" e "data:".
        const handleBlock = (block: string) => {
          let eventName = '';
          let data = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (eventName !== 'tickers' || !data) return;
          try {
            const parsed = JSON.parse(data);
            const list: TickerData[] = Array.isArray(parsed) ? parsed : parsed.tickers;
            if (Array.isArray(list)) {
              setStatus(prev => ({
                ...prev,
                messagesReceived: prev.messagesReceived + 1,
                lastTickTime: Date.now()
              }));
              applyTickers(list);
            }
          } catch (err) {
            addLog('WARN', `Erro ao processar pacote do stream: ${err?.message || err}`);
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep;
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (block.trim()) handleBlock(block);
          }
        }

        // Servidor encerrou o stream — reconectar com backoff.
        addLog('WARN', 'Stream encerrado pelo servidor. Reconectando...');
      } catch (err) {
        if (err?.name === 'AbortError') return; // desmontagem deliberada
        const errorMsg = err?.message || 'Falha de rede no stream do servidor';
        setStatus(prev => ({ ...prev, connected: false, connecting: false, lastError: errorMsg }));
        addLog('ERROR', `Erro no stream do servidor: ${errorMsg}`);
      } finally {
        abortRef.current = null;
        if (!disposedRef.current) {
          const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
          attemptRef.current = Math.min(attemptRef.current + 1, 5);
          reconnectTimeoutRef.current = setTimeout(connectStream, delay);
        }
      }
    })();
  }, [addLog, applyTickers]);

  useEffect(() => {
    disposedRef.current = false;
    connectStream();

    return () => {
      disposedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [connectStream]);

  const reconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    attemptRef.current = 0;
    connectStream();
  }, [connectStream]);

  return {
    status,
    logs,
    reconnect
  };
}
