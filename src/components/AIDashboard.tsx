import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, 
  WholeWord, 
  Timer, 
  CheckCircle, 
  DollarSign, 
  Package, 
  BarChart2, 
  Tag, 
  ListOrdered,
  RefreshCw,
  Trash2,
  Eye,
  X,
  Cpu,
  Server,
  Zap,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { AILogEntry, AIModelConfig } from '../types';

export const AIDashboard: React.FC = () => {
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [configuredModels, setConfiguredModels] = useState<AIModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>('Todos');
  const [providerFilter, setProviderFilter] = useState<string>('Todos');
  const [selectedLog, setSelectedLog] = useState<AILogEntry | null>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Fetch AI Telemetry Logs and Configured Models
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [resLogs, resModels] = await Promise.all([
        fetch('/api/ai/logs'),
        fetch('/api/settings/ai-models')
      ]);

      if (resLogs.ok) {
        const dataLogs: AILogEntry[] = await resLogs.json();
        setLogs(dataLogs);
      }

      if (resModels.ok) {
        const dataModels: AIModelConfig[] = await resModels.json();
        setConfiguredModels(dataModels);
      }
    } catch (err) {
      console.error('Erro ao carregar telemetria de IA:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = async () => {
    if (!window.confirm('Deseja realmente zerar todo o histórico de logs e estatísticas de IA?')) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/ai/logs', { method: 'DELETE' });
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Filter logs based on date range and provider
  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter((log) => {
      // Filter by Provider
      if (providerFilter !== 'Todos' && log.provider !== providerFilter.toLowerCase()) {
        return false;
      }

      // Filter by Date Range
      if (timeRange === 'Hoje') {
        const logDate = new Date(log.timestamp);
        return (
          logDate.getDate() === now.getDate() &&
          logDate.getMonth() === now.getMonth() &&
          logDate.getFullYear() === now.getFullYear()
        );
      }
      if (timeRange === '7 dias') {
        const diffMs = now.getTime() - new Date(log.timestamp).getTime();
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      }
      if (timeRange === '30 dias') {
        const diffMs = now.getTime() - new Date(log.timestamp).getTime();
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      }

      return true;
    });
  }, [logs, timeRange, providerFilter]);

  // General Metrics
  const metrics = useMemo(() => {
    const apiLogs = filteredLogs.filter(l => l.type !== 'MODEL_CONFIG' || l.provider !== 'system');
    const totalCalls = apiLogs.length;
    const successCalls = apiLogs.filter(l => l.level === 'SUCCESS').length;
    const failedCalls = apiLogs.filter(l => l.level === 'ERROR').length;

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalDurationMs = 0;
    let durationCount = 0;
    let totalCost = 0;

    for (const l of apiLogs) {
      const p = l.promptTokens || (l.details?.promptTokens as number) || 0;
      const c = l.completionTokens || (l.details?.completionTokens as number) || 0;
      const t = l.totalTokens || (l.details?.totalTokens as number) || (p + c);

      promptTokens += p;
      completionTokens += c;
      totalTokens += t;

      if (l.durationMs) {
        totalDurationMs += l.durationMs;
        durationCount += 1;
      }

      if (l.costEstimate) {
        totalCost += l.costEstimate;
      }
    }

    const avgTimeMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const avgTokensPerCall = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
    const successRate = totalCalls > 0 ? Number(((successCalls / totalCalls) * 100).toFixed(1)) : 100;

    return {
      totalCalls,
      successCalls,
      failedCalls,
      totalTokens,
      promptTokens,
      completionTokens,
      avgTimeMs,
      avgTokensPerCall,
      successRate,
      totalCost
    };
  }, [filteredLogs]);

  // Stats per Configured Model (Merges Configured Models + Logged Models)
  const modelStatsList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      provider: string;
      modelId: string;
      apiUrl?: string;
      isActive: boolean;
      isFallback: boolean;
      priority: number;
      calls: number;
      successes: number;
      failures: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      totalDurationMs: number;
      cost: number;
      lastCalled?: string;
      lastStatus?: string;
    }>();

    // 1. Seed configured models
    for (const m of configuredModels) {
      const key = m.id || m.modelId;
      map.set(key, {
        id: m.id,
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
        apiUrl: m.apiUrl,
        isActive: m.isActive,
        isFallback: m.isFallback,
        priority: m.priority,
        calls: 0,
        successes: 0,
        failures: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalDurationMs: 0,
        cost: 0
      });
    }

    // 2. Aggregate logs
    for (const log of filteredLogs) {
      if (log.type === 'MODEL_CONFIG' && log.provider === 'system') continue;

      let targetKey = Array.from(map.keys()).find(k => {
        const item = map.get(k);
        return item && (item.modelId === log.modelId || item.id === log.modelId || item.name === log.modelName);
      });

      if (!targetKey) {
        targetKey = log.modelId || log.modelName || 'unregistered';
        map.set(targetKey, {
          id: targetKey,
          name: log.modelName || log.modelId || 'Modelo Genérico',
          provider: log.provider,
          modelId: log.modelId,
          apiUrl: log.details?.apiUrl || log.details?.baseUrl,
          isActive: false,
          isFallback: false,
          priority: 99,
          calls: 0,
          successes: 0,
          failures: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalDurationMs: 0,
          cost: 0
        });
      }

      const item = map.get(targetKey)!;
      item.calls += 1;
      if (log.level === 'SUCCESS') item.successes += 1;
      if (log.level === 'ERROR') item.failures += 1;

      const pTok = log.promptTokens || (log.details?.promptTokens as number) || 0;
      const cTok = log.completionTokens || (log.details?.completionTokens as number) || 0;
      const tTok = log.totalTokens || (log.details?.totalTokens as number) || (pTok + cTok);

      item.promptTokens += pTok;
      item.completionTokens += cTok;
      item.totalTokens += tTok;
      if (log.durationMs) item.totalDurationMs += log.durationMs;
      if (log.costEstimate) item.cost += log.costEstimate;

      if (!item.lastCalled || new Date(log.timestamp) > new Date(item.lastCalled)) {
        item.lastCalled = log.timestamp;
        item.lastStatus = log.level;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (b.calls !== a.calls) return b.calls - a.calls;
      return a.priority - b.priority;
    });
  }, [configuredModels, filteredLogs]);

  // Chart Data: Daily Usage
  const dailyUsageData = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const log of filteredLogs) {
      if (log.type === 'MODEL_CONFIG' && log.provider === 'system') continue;      const dateStr = new Date(log.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const p = log.promptTokens || (log.details?.promptTokens as number) || 0;
      const c = log.completionTokens || (log.details?.completionTokens as number) || 0;
      const t = log.totalTokens || (log.details?.totalTokens as number) || (p + c);

      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + t);
    }

    const result = Array.from(dayMap.entries()).map(([date, tokens]) => ({ date, tokens }));
    if (result.length === 0) {
      const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return [{ date: today, tokens: 0 }];
    }
    return result.slice(-14); // Last 14 days
  }, [filteredLogs]);

  // Usage per Operation Type
  const typeUsageData = useMemo(() => {
    const typeMap = new Map<string, { calls: number; tokens: number; totalTime: number }>();

    for (const log of filteredLogs) {
      let label = 'Outros';
      if (log.type === 'SIGNAL_REVIEW') label = 'Revisão de Sinal (SMC)';
      else if (log.type === 'MARKET_AUDIT') label = 'Auditoria de Mercado';
      else if (log.type === 'CHAT_AGENT') label = 'Assistente / Mentor IA';
      else if (log.type === 'TEST_CONNECTION') label = 'Teste de Conexão / Ping';
      else if (log.type === 'MODEL_CONFIG') label = 'Configurações de Sistema';

      const p = log.promptTokens || (log.details?.promptTokens as number) || 0;
      const c = log.completionTokens || (log.details?.completionTokens as number) || 0;
      const t = log.totalTokens || (log.details?.totalTokens as number) || (p + c);

      const existing = typeMap.get(label) || { calls: 0, tokens: 0, totalTime: 0 };
      existing.calls += 1;
      existing.tokens += t;
      if (log.durationMs) existing.totalTime += log.durationMs;

      typeMap.set(label, existing);
    }

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      calls: data.calls,
      tokens: data.tokens,
      avgTime: data.calls > 0 ? Math.round(data.totalTime / data.calls) : 0
    }));
  }, [filteredLogs]);

  return (
    <div className="space-y-4 max-w-[2400px] mx-auto font-mono pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-white/10 shadow-lg">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-cyan-400" />
            Consumo da IA & Telemetria em Tempo Real
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Monitoramento de tokens, latência e chamadas de modelos locais (Ollama) e em nuvem
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provedor Filter */}
          <select 
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-[#050505] border border-white/10 text-neutral-200 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="Todos">Todos os Provedores</option>
            <option value="local">Ollama / Local</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>

          {/* Time Range Filter */}
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-[#050505] border border-white/10 text-neutral-200 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="Todos">Todas as Datas</option>
            <option value="Hoje">Hoje</option>
            <option value="7 dias">Últimos 7 dias</option>
            <option value="30 dias">Últimos 30 dias</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-white/10 disabled:opacity-50"
            title="Atualizar Telemetria"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            Atualizar
          </button>

          {/* Clear Logs Button */}
          <button
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-30"
            title="Zerar Logs de Telemetria"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar Logs
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        
        {/* Total Chamadas */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <PhoneCall className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Total Chamadas</p>
            <p className="text-base font-extrabold text-white">{metrics.totalCalls}</p>
            <p className="text-[9px] text-neutral-400">{metrics.successCalls} sucesso · {metrics.failedCalls} falhas</p>
          </div>
        </div>

        {/* Tokens */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <WholeWord className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Tokens</p>
            <p className="text-base font-extrabold text-white">
              {metrics.totalTokens >= 1000000 
                ? `${(metrics.totalTokens / 1000000).toFixed(2)}M` 
                : `${(metrics.totalTokens / 1000).toFixed(1)}k`}
            </p>
            <p className="text-[9px] text-neutral-400">
              {(metrics.promptTokens / 1000).toFixed(0)}k prompt · {(metrics.completionTokens / 1000).toFixed(0)}k compl
            </p>
          </div>
        </div>

        {/* Tempo Médio */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
            <Timer className="h-4 w-4 text-pink-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Tempo Médio</p>
            <p className="text-base font-extrabold text-white">{metrics.avgTimeMs}ms</p>
            <p className="text-[9px] text-neutral-400">{metrics.avgTokensPerCall} tok/chamada</p>
          </div>
        </div>

        {/* Taxa de Sucesso */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Sucesso</p>
            <p className="text-base font-extrabold text-emerald-400">{metrics.successRate}%</p>
            <p className="text-[9px] text-neutral-400">{metrics.failedCalls} falhas em {metrics.totalCalls}</p>
          </div>
        </div>

        {/* Custo Total */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Custo Estimado</p>
            <p className="text-base font-extrabold text-amber-300">
              ${metrics.totalCost.toFixed(4)}
            </p>
            <p className="text-[9px] text-neutral-400">Local (Ollama) = $0.0000</p>
          </div>
        </div>

        {/* Modelos Ativos */}
        <div className="bg-[#0A0A0A] p-3.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Modelos Registrados</p>
            <p className="text-base font-extrabold text-white">{modelStatsList.length} modelo(s)</p>
            <p className="text-[9px] text-neutral-400">
              {configuredModels.filter(m => m.isActive).length} ativos · {configuredModels.filter(m => m.isFallback).length} fallback
            </p>
          </div>
        </div>

      </div>

      {/* Consumo por Modelo (Tabela Principal) */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-xl overflow-hidden">
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-bold text-neutral-200">Estatísticas por Modelo de IA</h3>
          </div>
          <span className="text-[10px] text-neutral-400 bg-white/5 px-2 py-0.5 rounded font-mono">
            {modelStatsList.length} Modelo(s) Cadastrado(s)
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5">
              <tr>
                <th className="px-4 py-2.5 font-bold">Modelo & Provedor</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold text-right">Chamadas</th>
                <th className="px-4 py-2.5 font-bold text-right">Tokens (Prompt/Compl)</th>
                <th className="px-4 py-2.5 font-bold text-right">Méd/Chamada</th>
                <th className="px-4 py-2.5 font-bold text-right">Tempo Médio</th>
                <th className="px-4 py-2.5 font-bold text-right">Custo Estimado</th>
                <th className="px-4 py-2.5 font-bold text-right">Última Atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {modelStatsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-neutral-500 text-xs">
                    Nenhum modelo cadastrado ou chamado até o momento.
                  </td>
                </tr>
              ) : (
                modelStatsList.map((m) => {
                  const avgPerCall = m.calls > 0 ? Math.round(m.totalTokens / m.calls) : 0;
                  const avgTime = m.calls > 0 ? Math.round(m.totalDurationMs / m.calls) : 0;

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-bold text-neutral-200">
                        <div className="flex items-center gap-2">
                          {m.provider === 'local' ? (
                            <span className="p-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-extrabold uppercase">
                              OLLAMA
                            </span>
                          ) : m.provider === 'gemini' ? (
                            <span className="p-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-extrabold uppercase">
                              GEMINI
                            </span>
                          ) : m.provider === 'openrouter' ? (
                            <span className="p-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-extrabold uppercase">
                              OPENROUTER
                            </span>
                          ) : (
                            <span className="p-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-extrabold uppercase">
                              {m.provider}
                            </span>
                          )}
                          <div>
                            <div className="text-white font-extrabold text-xs">{m.name}</div>
                            <div className="text-[10px] text-neutral-500 font-normal">
                              ID: {m.modelId} {m.apiUrl ? `· ${m.apiUrl}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.isActive ? (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              ATIVO
                            </span>
                          ) : (
                            <span className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              INATIVO
                            </span>
                          )}
                          {m.isFallback && (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              FALLBACK
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-bold">{m.calls}</span>
                        {m.calls > 0 && (
                          <span className="text-[10px] text-neutral-500 block">
                            {m.successes} ok · {m.failures} erro
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-300">
                        <span className="font-bold">
                          {m.totalTokens >= 1000 ? `${(m.totalTokens / 1000).toFixed(1)}k` : m.totalTokens}
                        </span>
                        {m.calls > 0 && (
                          <span className="text-[10px] text-neutral-500 block">
                            {(m.promptTokens / 1000).toFixed(1)}k / {(m.completionTokens / 1000).toFixed(1)}k
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-400 font-bold">{avgPerCall}</td>

                      <td className="px-4 py-3 text-right text-neutral-400 font-bold">
                        {avgTime > 0 ? `${avgTime}ms` : '—'}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-emerald-400">
                        {m.provider === 'local' ? '$0.0000 (Local)' : `$${m.cost.toFixed(4)}`}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-400 text-[10px]">
                        {m.lastCalled ? (
                          <div>
                            <div>{new Date(m.lastCalled).toLocaleTimeString('pt-BR')}</div>
                            <div className={m.lastStatus === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {m.lastStatus}
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-600">Sem chamadas</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Daily Usage Chart & Usage per Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Consumo Diário Chart */}
        <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-neutral-200">Consumo Diário de Tokens</h3>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsageData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#ffffff0a' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Tokens']}
                />
                <Bar dataKey="tokens" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumo por Tipo */}
        <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 border-b border-white/10 flex items-center gap-2">
              <Tag className="h-4 w-4 text-pink-400" />
              <h3 className="text-xs font-bold text-neutral-200">Consumo por Tipo de Operação</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-2 font-bold">Tipo</th>
                    <th className="px-4 py-2 font-bold text-right">Chamadas</th>
                    <th className="px-4 py-2 font-bold text-right">Tokens</th>
                    <th className="px-4 py-2 font-bold text-right">Tempo Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {typeUsageData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-neutral-500 text-xs">
                        Nenhum registro por tipo encontrado.
                      </td>
                    </tr>
                  ) : (
                    typeUsageData.map((t, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-2.5 font-bold text-neutral-200">{t.type}</td>
                        <td className="px-4 py-2.5 text-right text-neutral-400 font-bold">{t.calls}</td>
                        <td className="px-4 py-2.5 text-right text-neutral-400 font-bold">
                          {t.tokens >= 1000 ? `${(t.tokens / 1000).toFixed(1)}k` : t.tokens}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-400">{t.avgTime}ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Últimas Chamadas e Audit Telemetry Log Table */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-xl overflow-hidden">
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-neutral-200">Histórico de Chamadas e Auditoria</h3>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            Mostrando {filteredLogs.length} registros
          </span>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5 sticky top-0 bg-[#050505] z-10">
              <tr>
                <th className="px-4 py-2.5 font-bold">Data/Hora</th>
                <th className="px-4 py-2.5 font-bold">Modelo & Provedor</th>
                <th className="px-4 py-2.5 font-bold">Tipo</th>
                <th className="px-4 py-2.5 font-bold">Mensagem</th>
                <th className="px-4 py-2.5 font-bold text-right">Tokens</th>
                <th className="px-4 py-2.5 font-bold text-right">Tempo</th>
                <th className="px-4 py-2.5 font-bold text-right">Status</th>
                <th className="px-4 py-2.5 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-neutral-500 text-xs">
                    Nenhum log de chamada encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((call) => {
                  const dateStr = new Date(call.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const p = call.promptTokens || (call.details?.promptTokens as number) || 0;
                  const c = call.completionTokens || (call.details?.completionTokens as number) || 0;
                  const tok = call.totalTokens || (call.details?.totalTokens as number) || (p + c);

                  return (
                    <tr key={call.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap text-[11px] font-mono">{dateStr}</td>
                      
                      <td className="px-4 py-2.5 font-bold whitespace-nowrap">
                        <span className="text-neutral-200">{call.modelName || call.modelId}</span>
                        <span className="text-[10px] text-neutral-500 uppercase block font-normal">
                          {call.provider}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-neutral-400 text-[11px] whitespace-nowrap font-semibold">
                        {call.type}
                      </td>

                      <td className="px-4 py-2.5 text-neutral-300 max-w-xs truncate" title={call.message}>
                        {call.message}
                      </td>

                      <td className="px-4 py-2.5 text-right text-neutral-400 font-mono font-bold">
                        {tok > 0 ? tok : '—'}
                      </td>

                      <td className="px-4 py-2.5 text-right text-neutral-400 font-mono font-bold">
                        {call.durationMs ? `${call.durationMs}ms` : '—'}
                      </td>

                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {call.level === 'SUCCESS' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            SUCESSO
                          </span>
                        ) : call.level === 'ERROR' ? (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            ERRO
                          </span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {call.level}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setSelectedLog(call)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/20 rounded text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                        >
                          <Eye className="h-3 w-3" />
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#050505]">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Detalhes do Log de Telemetria #{selectedLog.id.slice(-6)}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#050505] p-2.5 rounded border border-white/5">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Provedor / Modelo</span>
                  <span className="text-white font-bold">{selectedLog.provider} / {selectedLog.modelId}</span>
                </div>
                <div className="bg-[#050505] p-2.5 rounded border border-white/5">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Tipo de Operação</span>
                  <span className="text-cyan-400 font-bold">{selectedLog.type}</span>
                </div>
                <div className="bg-[#050505] p-2.5 rounded border border-white/5">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Duração / Latência</span>
                  <span className="text-amber-400 font-bold">{selectedLog.durationMs ? `${selectedLog.durationMs}ms` : '—'}</span>
                </div>
                <div className="bg-[#050505] p-2.5 rounded border border-white/5">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Status</span>
                  <span className={selectedLog.level === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedLog.level}
                  </span>
                </div>
              </div>

              {/* Message */}
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Mensagem Principal</span>
                <div className="p-3 bg-[#050505] border border-white/5 rounded text-neutral-200">
                  {selectedLog.message}
                </div>
              </div>

              {/* Diagnostic Steps if Present */}
              {selectedLog.details?.diagnosticSteps && selectedLog.details.diagnosticSteps.length > 0 && (
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Etapas de Diagnóstico e Rede</span>
                  <div className="p-3 bg-black/60 border border-white/5 rounded space-y-1 text-[11px] text-neutral-300">
                    {selectedLog.details.diagnosticSteps.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-cyan-500 font-bold">›</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Snippet or Full Prompt */}
              {(selectedLog.details?.fullPrompt || selectedLog.details?.promptSnippet) && (
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Prompt Enviado à IA</span>
                  <pre className="p-3 bg-black border border-white/5 rounded text-neutral-300 text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedLog.details.fullPrompt || selectedLog.details.promptSnippet}
                  </pre>
                </div>
              )}

              {/* Output Snippet or Full Response */}
              {(selectedLog.details?.fullResponse || selectedLog.details?.outputSnippet) && (
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Resposta Retornada</span>
                  <pre className="p-3 bg-black border border-emerald-500/20 text-emerald-300 text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedLog.details.fullResponse || selectedLog.details.outputSnippet}
                  </pre>
                </div>
              )}

              {/* Error Stack */}
              {selectedLog.details?.errorStack && (
                <div>
                  <span className="text-[10px] text-red-400 uppercase font-bold block mb-1">Stack trace do Erro</span>
                  <pre className="p-3 bg-red-950/20 border border-red-500/30 text-red-300 text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {selectedLog.details.errorStack}
                  </pre>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-[#050505] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
