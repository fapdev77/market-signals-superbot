import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Wifi, 
  Zap, 
  BrainCircuit, 
  Database, 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  ShieldCheck, 
  ArrowUpRight,
  TrendingDown,
  Gauge
} from 'lucide-react';
import { AIModelConfig, BotState } from '../types';
import { WSClientStatus } from '../hooks/useBinanceWebSocket';
import { Tooltip } from './Tooltip';
import { apiClient, FeedHealthPayload } from '../services/apiClient';

interface FeedHealthItem {
  id: string;
  name: string;
  category: 'MARKET_DATA' | 'ORDER_FLOW' | 'AI_REASONING' | 'STORAGE';
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  protocol: string;
  details: string;
  /**
   * FASE 0 (C-05): último SUCESSO real registrado no servidor para o feed
   * correspondente (`null` = sem registro ⇒ "n/d").
   *
   * `latencyMs`/`uptimePct`/`jitterMs`/`throughput`/`lastHeartbeat` foram
   * REMOVIDOS: nada no servidor mede esses valores (nenhum `recordFeedSuccess`
   * recebe latência), e mantê-los só gerava um painel permanentemente "n/d" e
   * strings fixas como "Agora mesmo"/"Zero Latency Sync" fingindo medição.
   */
  lastSuccessAt: number | null;
}

/** FASE 0 (C-05): tempo relativo SEM inventar presença — sem registro é "n/d". */
function formatAgo(ts: number | null, now: number = Date.now()): string {
  if (!ts || !Number.isFinite(ts)) return 'n/d';
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  return `há ${Math.round(minutes / 60)}h`;
}

/** Card → feed real registrado no servidor (R-13). Fonte única do mapeamento. */
const FEED_BY_WIDGET: Record<string, string> = {
  binance_futures_ws: 'ws',
  order_flow_aggregator: 'ticker',
  ai_reasoning_pipeline: 'tradingSchedule',
  sqlite_persistence: 'klines'
};

interface SystemHealthWidgetProps {
  botState?: BotState;
  clientWsStatus?: WSClientStatus | string;
  activeModels?: AIModelConfig[];
  onReconnectWs?: () => void;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  botState,
  clientWsStatus = 'CONNECTED',
  activeModels = [],
  onReconnectWs
}) => {
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  // FASE 0 (C-05): RTT medido de verdade contra /api/health. O "benchmark"
  // anterior esperava 600ms e gravava `Date.now()` — não media nada.
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [rttTestedAt, setRttTestedAt] = useState<number | null>(null);
  const [serverFeedHealth, setServerFeedHealth] = useState<FeedHealthPayload | null>(null);

  // R-13: estado real dos feeds vem do servidor (GET /api/system/feed-health),
  // que agrega o registro de sucesso/falha de cada fonte de dado.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient.getFeedHealth()
        .then(h => { if (!cancelled) setServerFeedHealth(h); })
        .catch(() => { /* widget mantém a visão estática quando o endpoint falha */ });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const probeRtt = async () => {
    setIsBenchmarking(true);
    const started = performance.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`health ${res.status}`);
      await res.json();
      setRttMs(Math.round(performance.now() - started));
    } catch {
      setRttMs(null);
    } finally {
      setRttTestedAt(Date.now());
      setIsBenchmarking(false);
    }
  };

  // Primeira medição junto com o poll de feed-health (reexecuta a cada 30s).
  useEffect(() => {
    void probeRtt();
  }, []);

  const primaryModel = activeModels.find(m => m.isActive) || { name: 'Gemini 2.5 Flash', provider: 'google' };

    const isWsOnline = typeof clientWsStatus === 'object' 
      ? clientWsStatus.connected 
      : clientWsStatus !== 'DISCONNECTED';

    // R-13: quando o servidor responde, o estado real do feed substitui o estático.
    // Mapeamento: feed id do widget → FeedName do registro do servidor.
    // 7.6.1: o protocolo separa o stream do SERVIDOR para o navegador do estado do
    // WebSocket a MONTANTE (feed-health). Nenhum rótulo cita o host upstream.
    const upstreamWs = serverFeedHealth?.feeds?.ws;
    const upstreamWsLabel = upstreamWs
      ? `upstream Binance: ${upstreamWs.status}`
      : 'upstream Binance: n/d';

    const serverStatus = (widgetId: string): FeedHealthItem['status'] | null => {
      if (!serverFeedHealth?.feeds) return null;
      const entry = serverFeedHealth.feeds[FEED_BY_WIDGET[widgetId]];
      if (!entry) return null;
      if (entry.status === 'OK') return 'ONLINE';
      if (entry.status === 'DEGRADED' || entry.status === 'STALE') return 'DEGRADED';
      return null; // UNKNOWN: sem registro no servidor — mantém o estático
    };

    /** FASE 0 (C-05): último SUCESSO real do feed do card (sem registro ⇒ null). */
    const lastSuccessOf = (widgetId: string): number | null =>
      serverFeedHealth?.feeds?.[FEED_BY_WIDGET[widgetId]]?.lastSuccessAt ?? null;

    const feeds: FeedHealthItem[] = [
      {
        id: 'binance_futures_ws',
        name: 'Binance Futures Live Stream',
        category: 'MARKET_DATA',
        status: serverStatus('binance_futures_ws') ?? (isWsOnline ? 'ONLINE' : 'OFFLINE'),
        protocol: `WS servidor→navegador · ${upstreamWsLabel}`,
        details: 'Kline 1m/5m, Book Tickers & Multi-Asset Taker Trades stream contínuo.',
        lastSuccessAt: lastSuccessOf('binance_futures_ws')
      },
    {
      id: 'order_flow_aggregator',
      name: 'Order Flow & CVD Engine',
      category: 'ORDER_FLOW',
      status: serverStatus('order_flow_aggregator') ?? 'ONLINE',
      protocol: 'In-Memory State Engine',
      details: 'Cálculo de Delta CVD, Open Interest, Golden Pocket e POCs de Volume Profile.',
      lastSuccessAt: lastSuccessOf('order_flow_aggregator')
    },
    {
      id: 'ai_reasoning_pipeline',
      name: `AI Inference Engine (${primaryModel.name})`,
      category: 'AI_REASONING',
      status: serverStatus('ai_reasoning_pipeline') ?? (botState?.aiAnalysisEnabled ? 'ONLINE' : 'DEGRADED'),
      protocol: 'REST / SSL Proxy Gateway',
      details: botState?.aiAnalysisEnabled 
        ? `Auditoria multi-confluência ativa com modelo de prioridade ${primaryModel.name}.`
        : 'IA em modo stand-by. Validações ocorrendo exclusivamente via confluência técnica.',
      lastSuccessAt: lastSuccessOf('ai_reasoning_pipeline')
    },
    {
      id: 'sqlite_persistence',
      name: 'SQLite Database & Signal Storage',
      category: 'STORAGE',
      status: serverStatus('sqlite_persistence') ?? 'ONLINE',
      protocol: 'Local WAL Engine',
      details: 'Persistência atômica de sinais validados, histórico de trades e pesos de estratégia.',
      lastSuccessAt: lastSuccessOf('sqlite_persistence')
    }
  ];

  // FASE 0 (C-05): sem fonte real de latência, o valor é `null` ("n/d").
  // FASE 0 (C-05): só números que EXISTEM — o resumo real do feed-health do
  // servidor e o RTT medido acima. Antes os KPIs derivavam de campos sempre nulos.
  const feedSummary = serverFeedHealth?.summary ?? null;
  const feedsOkLabel = feedSummary ? `${feedSummary.ok}/${feedSummary.totalFeeds}` : 'n/d';
  const feedsAttentionLabel = feedSummary
    ? `${feedSummary.degraded + feedSummary.stale} degrad/stale · ${feedSummary.unknown} sem registro`
    : 'sem resposta do servidor';
  const overallStatus: { label: string; dotClass: string; textClass: string } = !feedSummary
    ? { label: 'sem dados', dotClass: 'bg-neutral-500', textClass: 'text-neutral-400' }
    : feedSummary.unknown === feedSummary.totalFeeds
    ? { label: 'sem dados', dotClass: 'bg-neutral-500', textClass: 'text-neutral-400' }
    : feedSummary.ok === feedSummary.totalFeeds
    ? { label: 'Operacional', dotClass: 'bg-emerald-400 animate-pulse', textClass: 'text-white' }
    : feedSummary.ok > 0
    ? { label: 'Atenção', dotClass: 'bg-amber-400 animate-pulse', textClass: 'text-amber-300' }
    : { label: 'Offline', dotClass: 'bg-rose-400 animate-pulse', textClass: 'text-rose-300' };

  return (
    <div className="bg-[#0A0B0E] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 font-mono text-xs shadow-2xl shadow-cyan-950/20 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                System Health & Latency Feeds
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-500/20 text-neutral-300 border border-neutral-500/30">
                SLA NÃO MEDIDO
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              RTT medido contra o servidor, status e último sucesso de cada feed — só valores com fonte real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => void probeRtt()}
            disabled={isBenchmarking}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${isBenchmarking ? 'animate-spin' : ''}`} />
            <span>{isBenchmarking ? 'Medindo...' : 'Medir RTT agora'}</span>
          </button>
        </div>
      </div>

      {/* Main KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">RTT do Servidor (probe)</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-black tabular-nums ${rttMs === null ? 'text-neutral-400' : 'text-emerald-400'}`}>{rttMs === null ? 'n/d' : `${rttMs}ms`}</span>
            <span className="text-[10px] text-neutral-500 font-bold">{rttTestedAt === null ? 'não medido' : `medido ${formatAgo(rttTestedAt)}`}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Feeds OK (servidor)</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-black tabular-nums ${feedSummary === null ? 'text-neutral-400' : 'text-emerald-400'}`}>{feedsOkLabel}</span>
            <span className="text-[10px] text-neutral-500 font-bold">{feedsAttentionLabel}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Leitura feed-health</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-neutral-400 tabular-nums">{formatAgo(serverFeedHealth?.generatedAt ?? null)}</span>
            <span className="text-[10px] text-neutral-500 font-bold">atualiza 30s</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Status Geral do Robô</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-2 w-2 rounded-full ${overallStatus.dotClass}`} />
            <span className={`text-xs font-black uppercase ${overallStatus.textClass}`}>{overallStatus.label}</span>
          </div>
        </div>
      </div>

      {/* Detailed Feeds Table / Cards */}
      <div className="space-y-2">
        {feeds.map(feed => {
          const isOnline = feed.status === 'ONLINE';
          const isDegraded = feed.status === 'DEGRADED';


          // R-13: erro real do último registro do servidor, quando disponível.
          const serverEntry = serverFeedHealth?.feeds?.[FEED_BY_WIDGET[feed.id]];
          const realError = serverEntry?.lastError || null;

          return (
            <div
              key={feed.id}
              className="p-3 rounded-xl bg-neutral-900/40 border border-white/5 hover:border-white/10 transition space-y-2"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isOnline ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-rose-400'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      isOnline ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-xs">{feed.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/60 border border-white/10 text-neutral-400">
                        {feed.protocol}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">{feed.details}</span>
                    {realError && (
                      <span className="text-[10px] text-rose-300/80 block mt-0.5 truncate max-w-md" title={realError}>
                        ⚠ {realError}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto text-right">
                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Último sucesso</span>
                    <span className="text-xs font-bold text-neutral-300 tabular-nums">
                      {formatAgo(feed.lastSuccessAt)}
                    </span>
                  </div>

                  <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border ${
                    isOnline 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : isDegraded 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {feed.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
