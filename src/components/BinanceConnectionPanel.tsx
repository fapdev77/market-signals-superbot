import React, { useState, useEffect } from 'react';
import { Wifi, Activity, RefreshCw, Terminal, Server, Globe } from 'lucide-react';
import { WSClientStatus, WSLogEntry } from '../hooks/useBinanceWebSocket';

interface BinanceLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  type: 'WEBSOCKET' | 'REST_API';
  message: string;
  details?: any;
}

interface WSStatus {
  connected: boolean;
  connecting: boolean;
  url: string;
  lastConnectedAt: number | null;
  lastTickAt: number | null;
  messagesReceived: number;
  reconnectCount: number;
  lastError: string | null;
}

interface BinanceConnectionPanelProps {
  clientWsStatus?: WSClientStatus;
  clientWsLogs?: WSLogEntry[];
  onClose?: () => void;
}

export const BinanceConnectionPanel: React.FC<BinanceConnectionPanelProps> = ({
  clientWsStatus,
  clientWsLogs = [],
  onClose
}) => {
  const [serverLogs, setServerLogs] = useState<BinanceLog[]>([]);
  const [serverStatus, setServerStatus] = useState<WSStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENT_WS' | 'SERVER_WS' | 'REST_API'>('ALL');

  const fetchLogsAndStatus = async () => {
    try {
      const [resStatus, resLogs] = await Promise.all([
        fetch('/api/binance/status'),
        fetch('/api/binance/logs')
      ]);

      if (resStatus.ok) {
        const dataStatus = await resStatus.json();
        setServerStatus(dataStatus.websocket);
      }

      if (resLogs.ok) {
        const dataLogs = await resLogs.json();
        setServerLogs(dataLogs);
      }
    } catch (err) {
      console.error('Error fetching Binance status & logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndStatus();
    const interval = setInterval(fetchLogsAndStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Merge client browser WS logs with server REST/WS logs
  const combinedLogs = [
    ...clientWsLogs.map(l => ({
      timestamp: l.timestamp,
      level: l.level,
      type: 'CLIENT_WS' as const,
      message: l.message
    })),
    ...serverLogs.map(l => ({
      timestamp: l.timestamp,
      level: l.level,
      type: l.type === 'WEBSOCKET' ? ('SERVER_WS' as const) : ('REST_API' as const),
      message: l.message,
      details: l.details
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredLogs = combinedLogs.filter(
    l => filterType === 'ALL' || l.type === filterType
  );

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-lg p-4 font-mono shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              Status de Conexão & Logs do WebSocket Binance
              <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                LIVE DUAL STREAM
              </span>
            </h2>
            <p className="text-[10px] text-neutral-400">
              Conexão direta do navegador via WebSocket em tempo real e servidores de retaguarda REST/WS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogsAndStatus}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-xs font-bold transition flex items-center gap-1 border border-white/10"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold transition"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Client Browser WebSocket Card */}
        <div className="bg-[#050505] p-3 rounded border border-orange-500/30 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-orange-400" />
              WebSocket Cliente (Navegador)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                clientWsStatus?.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : clientWsStatus?.connecting
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  clientWsStatus?.connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              {clientWsStatus?.connected ? 'STREAM ATIVO' : clientWsStatus?.connecting ? 'CONECTANDO...' : 'DESCONECTADO'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="col-span-2">
              <span className="text-neutral-500 block">Stream URL:</span>
              <span className="text-neutral-300 font-bold truncate block">{clientWsStatus?.url || 'wss://fstream.binance.com/ws/!ticker@arr'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Pacotes Recebidos:</span>
              <span className="text-orange-400 font-bold">{clientWsStatus?.messagesReceived || 0} msgs</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Último Tick WS:</span>
              <span className="text-neutral-300 font-bold">
                {clientWsStatus?.lastTickTime ? `${Math.round((Date.now() - clientWsStatus.lastTickTime) / 1000)}s atrás` : 'Aguardando...'}
              </span>
            </div>
          </div>

          {clientWsStatus?.lastError && (
            <div className="p-1.5 bg-rose-950/30 border border-rose-500/30 rounded text-[10px] text-rose-400 truncate">
              Aviso: {clientWsStatus.lastError}
            </div>
          )}
        </div>

        {/* Server WebSocket Stream */}
        <div className="bg-[#050505] p-3 rounded border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-orange-400" />
              WebSocket Servidor Backend
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                serverStatus?.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {serverStatus?.connected ? 'CONECTADO' : 'STANDBY'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="col-span-2">
              <span className="text-neutral-500 block">Stream Backend URL:</span>
              <span className="text-neutral-300 font-bold truncate block">{serverStatus?.url || 'wss://fstream.binance.com'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Mensagens Servidor:</span>
              <span className="text-orange-400 font-bold">{serverStatus?.messagesReceived || 0} msgs</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Reconexões:</span>
              <span className="text-neutral-300 font-bold">{serverStatus?.reconnectCount || 0}</span>
            </div>
          </div>
        </div>

        {/* REST API Card */}
        <div className="bg-[#050505] p-3 rounded border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
              <Server className="h-4 w-4 text-orange-400" />
              Servidores REST API (Contingência)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              OPERACIONAL
            </span>
          </div>

          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white/5 p-1.5 rounded">
              <span className="text-neutral-400">Endpoint Principal:</span>
              <span className="text-emerald-400 font-bold truncate max-w-[140px]">data-api.binance.vision</span>
            </div>
            <p className="text-[9px] text-neutral-500 leading-tight">
              Os dados REST sincronizam velas Klines de 15m, Open Interest e Funding Rates institucionais.
            </p>
          </div>
        </div>
      </div>

      {/* Logs Console Box */}
      <div className="bg-[#050505] p-3 rounded border border-white/10 space-y-2">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-extrabold text-white uppercase">Console de Logs Unificado WebSocket & API</h3>
          </div>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-neutral-500">Filtrar:</span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded ${filterType === 'ALL' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('CLIENT_WS')}
              className={`px-2 py-0.5 rounded ${filterType === 'CLIENT_WS' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
            >
              WS Navegador
            </button>
            <button
              onClick={() => setFilterType('SERVER_WS')}
              className={`px-2 py-0.5 rounded ${filterType === 'SERVER_WS' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
            >
              WS Backend
            </button>
            <button
              onClick={() => setFilterType('REST_API')}
              className={`px-2 py-0.5 rounded ${filterType === 'REST_API' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
            >
              REST API
            </button>
          </div>
        </div>

        <div className="h-64 bg-[#080808] p-2.5 rounded border border-white/5 overflow-y-auto space-y-1.5 text-[11px] font-mono">
          {filteredLogs.length === 0 ? (
            <div className="text-neutral-500 text-center py-10">Aguardando novos eventos de conexão...</div>
          ) : (
            filteredLogs.map((log, idx) => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString();
              return (
                <div key={idx} className="flex items-start gap-2 hover:bg-white/5 p-1 rounded transition text-neutral-300">
                  <span className="text-neutral-500 text-[9px] shrink-0">{timeStr}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] font-bold shrink-0 ${
                      log.type === 'CLIENT_WS'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : log.type === 'SERVER_WS'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {log.type === 'CLIENT_WS' ? 'WS CLIENTE' : log.type === 'SERVER_WS' ? 'WS BACKEND' : 'REST API'}
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 ${
                      log.level === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : log.level === 'ERROR'
                        ? 'bg-rose-500/20 text-rose-400'
                        : log.level === 'WARN'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="flex-1 break-all text-[10px]">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
