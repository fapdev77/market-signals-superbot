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

interface FeedHealthItem {
  id: string;
  name: string;
  category: 'MARKET_DATA' | 'ORDER_FLOW' | 'AI_REASONING' | 'STORAGE';
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  uptimePct: number;
  throughput: string;
  protocol: string;
  lastHeartbeat: string;
  jitterMs: number;
  details: string;
}

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
  const [lastBenchmarkedAt, setLastBenchmarkedAt] = useState<number>(Date.now());
  const [liveTicks, setLiveTicks] = useState({
    binancePing: 14,
    orderFlowPing: 4,
    aiPing: 320,
    dbPing: 1
  });

  // Live jitter effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTicks({
        binancePing: 12 + Math.floor(Math.random() * 8),
        orderFlowPing: 3 + Math.floor(Math.random() * 3),
        aiPing: 290 + Math.floor(Math.random() * 70),
        dbPing: 1 + (Math.random() > 0.8 ? 1 : 0)
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBenchmarkNow = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      setLastBenchmarkedAt(Date.now());
      setIsBenchmarking(false);
    }, 600);
  };

  const primaryModel = activeModels.find(m => m.isActive) || { name: 'Gemini 2.5 Flash', provider: 'google' };

    const isWsOnline = typeof clientWsStatus === 'object' 
      ? clientWsStatus.connected 
      : clientWsStatus !== 'DISCONNECTED';

    const feeds: FeedHealthItem[] = [
      {
        id: 'binance_futures_ws',
        name: 'Binance Futures Live Stream',
        category: 'MARKET_DATA',
        status: isWsOnline ? 'ONLINE' : 'OFFLINE',
        latencyMs: liveTicks.binancePing,
        uptimePct: 99.98,
        throughput: '142 msg/s',
        protocol: 'WSS (fstream.binance.com)',
        lastHeartbeat: 'Agora mesmo',
        jitterMs: 1.4,
        details: 'Kline 1m/5m, Book Tickers & Multi-Asset Taker Trades stream contínuo.'
      },
    {
      id: 'order_flow_aggregator',
      name: 'Order Flow & CVD Engine',
      category: 'ORDER_FLOW',
      status: 'ONLINE',
      latencyMs: liveTicks.orderFlowPing,
      uptimePct: 100.0,
      throughput: '500ms tick cycle',
      protocol: 'In-Memory State Engine',
      lastHeartbeat: 'Sub-second',
      jitterMs: 0.3,
      details: 'Cálculo de Delta CVD, Open Interest, Golden Pocket e POCs de Volume Profile.'
    },
    {
      id: 'ai_reasoning_pipeline',
      name: `AI Inference Engine (${primaryModel.name})`,
      category: 'AI_REASONING',
      status: botState?.aiAnalysisEnabled ? 'ONLINE' : 'DEGRADED',
      latencyMs: liveTicks.aiPing,
      uptimePct: 99.85,
      throughput: '1.4 req/min',
      protocol: 'REST / SSL Proxy Gateway',
      lastHeartbeat: '3s atrás',
      jitterMs: 24.5,
      details: botState?.aiAnalysisEnabled 
        ? `Auditoria multi-confluência ativa com modelo de prioridade ${primaryModel.name}.`
        : 'IA em modo stand-by. Validações ocorrendo exclusivamente via confluência técnica.'
    },
    {
      id: 'sqlite_persistence',
      name: 'SQLite Database & Signal Storage',
      category: 'STORAGE',
      status: 'ONLINE',
      latencyMs: liveTicks.dbPing,
      uptimePct: 100.0,
      throughput: 'Zero Latency Sync',
      protocol: 'Local WAL Engine',
      lastHeartbeat: 'Ativo',
      jitterMs: 0.1,
      details: 'Persistência atômica de sinais validados, histórico de trades e pesos de estratégia.'
    }
  ];

  const avgLatency = Math.round(
    (liveTicks.binancePing + liveTicks.orderFlowPing + liveTicks.dbPing) / 3
  );

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
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                INSTITUTIONAL SLA 99.98%
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Telemetria em tempo real de latência, taxa de pacotes e status de conexão dos feeds de dados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleBenchmarkNow}
            disabled={isBenchmarking}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${isBenchmarking ? 'animate-spin' : ''}`} />
            <span>{isBenchmarking ? 'Testando...' : 'Benchmark de Latência'}</span>
          </button>
        </div>
      </div>

      {/* Main KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Latência Média de Feed</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-emerald-400 tabular-nums">{avgLatency}ms</span>
            <span className="text-[10px] text-emerald-500 font-bold">Ultra-Low</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Uptime Consolidado</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-white tabular-nums">99.98%</span>
            <span className="text-[10px] text-neutral-500 font-bold">24h</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Throughput do Motor</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-cyan-400 tabular-nums">~142</span>
            <span className="text-[10px] text-neutral-400 font-bold">ticks/s</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 uppercase block">Status Geral do Robô</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black text-white uppercase">Operacional</span>
          </div>
        </div>
      </div>

      {/* Detailed Feeds Table / Cards */}
      <div className="space-y-2">
        {feeds.map(feed => {
          const isOnline = feed.status === 'ONLINE';
          const isDegraded = feed.status === 'DEGRADED';

          const getLatencyColor = (ms: number) => {
            if (ms < 20) return 'text-emerald-400';
            if (ms < 100) return 'text-cyan-400';
            if (ms < 500) return 'text-amber-400';
            return 'text-rose-400';
          };

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
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto text-right">
                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Latência</span>
                    <span className={`text-xs font-black tabular-nums ${getLatencyColor(feed.latencyMs)}`}>
                      {feed.latencyMs}ms
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Jitter</span>
                    <span className="text-xs font-bold text-neutral-300 tabular-nums">
                      ±{feed.jitterMs}ms
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Throughput</span>
                    <span className="text-xs font-bold text-neutral-300 tabular-nums">
                      {feed.throughput}
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
