import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Activity, 
  RefreshCw, 
  Terminal, 
  Server, 
  Globe, 
  Cpu, 
  Brain, 
  Trash2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  HelpCircle,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { WSClientStatus, WSLogEntry } from '../hooks/useBinanceWebSocket';

export interface AILogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  type: 'TEST_CONNECTION' | 'SIGNAL_REVIEW' | 'MARKET_AUDIT' | 'CHAT_AGENT' | 'MODEL_CONFIG';
  provider: 'gemini' | 'local' | 'openai' | 'openrouter' | 'anthropic' | 'system';
  modelId: string;
  message: string;
  durationMs?: number;
  details?: {
    promptSnippet?: string;
    preview?: string;
    apiUrl?: string;
    apiKeyPresent?: boolean;
    errorStack?: string;
    diagnosticSteps?: string[];
    [key: string]: any;
  };
}

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
  const [activeTab, setActiveTab] = useState<'ai' | 'binance' | 'unified'>('ai');
  const [serverLogs, setServerLogs] = useState<BinanceLog[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [serverStatus, setServerStatus] = useState<WSStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for AI logs
  const [aiTypeFilter, setAiTypeFilter] = useState<string>('ALL');
  const [aiLevelFilter, setAiLevelFilter] = useState<string>('ALL');
  const [aiProviderFilter, setAiProviderFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filters for Binance logs
  const [binanceTypeFilter, setBinanceTypeFilter] = useState<'ALL' | 'CLIENT_WS' | 'SERVER_WS' | 'REST_API'>('ALL');

  // Expanded log rows state
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  const fetchLogsAndStatus = async () => {
    try {
      const [resStatus, resBinanceLogs, resAiLogs] = await Promise.all([
        fetch('/api/binance/status').catch(() => null),
        fetch('/api/binance/logs').catch(() => null),
        fetch('/api/ai/logs').catch(() => null)
      ]);

      if (resStatus && resStatus.ok) {
        const dataStatus = await resStatus.json();
        setServerStatus(dataStatus.websocket);
      }

      if (resBinanceLogs && resBinanceLogs.ok) {
        const dataLogs = await resBinanceLogs.json();
        setServerLogs(dataLogs);
      }

      if (resAiLogs && resAiLogs.ok) {
        const dataAi = await resAiLogs.json();
        setAiLogs(dataAi);
      }
    } catch (err) {
      console.error('Erro ao buscar logs e status:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearAiLogs = async () => {
    if (confirm('Deseja limpar todos os logs de execução e diagnóstico do Motor de IA?')) {
      try {
        await fetch('/api/ai/logs', { method: 'DELETE' });
        setAiLogs([]);
      } catch (e) {
        console.error('Erro ao limpar logs de IA:', e);
      }
    }
  };

  useEffect(() => {
    fetchLogsAndStatus();
    const interval = setInterval(fetchLogsAndStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter AI Logs
  const filteredAiLogs = aiLogs.filter(log => {
    if (aiTypeFilter !== 'ALL' && log.type !== aiTypeFilter) return false;
    if (aiLevelFilter !== 'ALL' && log.level !== aiLevelFilter) return false;
    if (aiProviderFilter !== 'ALL' && log.provider !== aiProviderFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchModel = log.modelId.toLowerCase().includes(q);
      const matchProv = log.provider.toLowerCase().includes(q);
      const matchSteps = log.details?.diagnosticSteps?.some(s => s.toLowerCase().includes(q));
      if (!matchMsg && !matchModel && !matchProv && !matchSteps) return false;
    }
    return true;
  });

  // Calculate AI Stats
  const totalAiRequests = aiLogs.length;
  const successAiRequests = aiLogs.filter(l => l.level === 'SUCCESS').length;
  const errorAiRequests = aiLogs.filter(l => l.level === 'ERROR').length;
  const successRate = totalAiRequests > 0 ? Math.round((successAiRequests / totalAiRequests) * 100) : 100;
  const avgLatency = Math.round(
    aiLogs.filter(l => l.durationMs).reduce((acc, l) => acc + (l.durationMs || 0), 0) /
    (aiLogs.filter(l => l.durationMs).length || 1)
  );

  // Check if any Ollama Cloud Run warning exists
  const hasOllamaCloudWarning = aiLogs.some(
    l => l.provider === 'local' && (l.message.includes('localhost') || l.details?.diagnosticSteps?.some(s => s.includes('Ngrok')))
  );

  // Combine Binance logs
  const combinedBinanceLogs = [
    ...clientWsLogs.map(l => ({
      id: `client_${l.timestamp}_${Math.random()}`,
      timestamp: l.timestamp,
      level: l.level,
      type: 'CLIENT_WS' as const,
      message: l.message
    })),
    ...serverLogs.map(l => ({
      id: `server_${l.timestamp}_${Math.random()}`,
      timestamp: l.timestamp,
      level: l.level,
      type: l.type === 'WEBSOCKET' ? ('SERVER_WS' as const) : ('REST_API' as const),
      message: l.message,
      details: l.details
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredBinanceLogs = combinedBinanceLogs.filter(
    l => binanceTypeFilter === 'ALL' || l.type === binanceTypeFilter
  );

  // Unified Feed (Binance + AI)
  const unifiedLogs = [
    ...combinedBinanceLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      category: 'BINANCE' as const,
      subType: l.type,
      level: l.level,
      provider: 'Binance',
      modelOrUrl: 'fstream.binance.com',
      message: l.message,
      details: l.details
    })),
    ...aiLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      category: 'AI_AGENT' as const,
      subType: l.type,
      level: l.level,
      provider: l.provider,
      modelOrUrl: l.modelId,
      message: l.message,
      details: l.details,
      durationMs: l.durationMs
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredUnifiedLogs = unifiedLogs.filter(log => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.provider.toLowerCase().includes(q) ||
        log.modelOrUrl.toLowerCase().includes(q) ||
        log.subType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 font-mono shadow-2xl space-y-4 max-w-[2400px] mx-auto text-neutral-200">
      
      {/* Top Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-purple-500/20 text-orange-400 rounded-lg border border-orange-500/30">
            <Cpu className="h-6 w-6 text-orange-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white uppercase tracking-wider">
                Console Unificado de Logs API & Agentes IA
              </h2>
              <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 uppercase tracking-widest">
                LIVE DIAGNOSTICS
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Monitoramento e diagnósticos de execução para chamadas de IA (Gemini, Ollama, OpenAI) e conexões Binance WS/REST.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'ai' && (
            <button
              onClick={clearAiLogs}
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
              title="Zerar o histórico em memória dos logs de IA"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              Zerar Logs IA
            </button>
          )}

          <button
            onClick={fetchLogsAndStatus}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-orange-400 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'ai'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'bg-neutral-900/50 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <Brain className="h-4 w-4 text-purple-400" />
          <span>Agentes & Motor de IA</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-500/30 font-extrabold">
            {aiLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('binance')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'binance'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-lg'
              : 'bg-neutral-900/50 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <Wifi className="h-4 w-4 text-orange-400" />
          <span>Binance API & WebSocket</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-950 text-orange-300 border border-orange-500/30 font-extrabold">
            {combinedBinanceLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('unified')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'unified'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-lg'
              : 'bg-neutral-900/50 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <Terminal className="h-4 w-4 text-blue-400" />
          <span>Console Unificado (Todos os Logs)</span>
        </button>
      </div>

      {/* TAB 1: AI AGENTS LOGS */}
      {activeTab === 'ai' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* AI Metrics Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#050505] p-3 rounded-lg border border-purple-500/20 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1">
                <Brain className="h-3.5 w-3.5 text-purple-400" /> Total Execuções IA
              </span>
              <div className="text-xl font-extrabold text-white">{totalAiRequests}</div>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-emerald-500/20 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Taxa de Sucesso
              </span>
              <div className="text-xl font-extrabold text-emerald-400">{successRate}%</div>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-rose-500/20 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> Falhas / Erros
              </span>
              <div className="text-xl font-extrabold text-rose-400">{errorAiRequests}</div>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-blue-500/20 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-400" /> Latência Média
              </span>
              <div className="text-xl font-extrabold text-blue-400">⚡ {avgLatency}ms</div>
            </div>
          </div>

          {/* Diagnostic Guide Banner if Ollama Cloud Run Issue is detected */}
          {hasOllamaCloudWarning && (
            <div className="bg-amber-950/40 border border-amber-500/40 p-3.5 rounded-lg text-xs space-y-2 text-amber-200">
              <div className="flex items-center gap-2 font-bold text-amber-400 uppercase text-[11px]">
                <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                Diagnóstico de Modelo Local / Ollama Detectado:
              </div>
              <p className="leading-relaxed">
                A aplicação está rodando em ambiente de Nuvem (Cloud Run). Endereços como <code className="bg-black/60 px-1 py-0.5 rounded text-amber-300">http://localhost:11434</code> apontam para o container da nuvem, onde o Ollama não está instalado.
              </p>
              <div className="bg-black/60 p-2.5 rounded border border-amber-500/20 space-y-1 text-[11px] font-mono">
                <div className="font-bold text-white mb-1">💡 Como conectar o Ollama rodando no seu computador:</div>
                <div>1. No seu computador, abra o terminal e execute: <code className="text-amber-300 font-bold">ngrok http 11434</code></div>
                <div>2. Copie a URL HTTPS gerada pelo Ngrok (ex: <code className="text-emerald-400 font-bold">https://xxxx.ngrok-free.app</code>)</div>
                <div>3. No painel de Configuração de Modelos IA, cole essa URL pública no campo "URL da API".</div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-[#050505] p-3 rounded-lg border border-white/10 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Pesquisar nos logs de IA (mensagens, prompts, modelos)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#080808] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Select filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                
                {/* Event Type Filter */}
                <select
                  value={aiTypeFilter}
                  onChange={e => setAiTypeFilter(e.target.value)}
                  className="bg-[#080808] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">Todos Eventos</option>
                  <option value="TEST_CONNECTION">🧪 Teste de Conexão</option>
                  <option value="SIGNAL_REVIEW">🎯 Revisão de Sinal</option>
                  <option value="MARKET_AUDIT">🔍 Auditoria de Mercado</option>
                  <option value="CHAT_AGENT">💬 Chat Assistant</option>
                  <option value="MODEL_CONFIG">⚙️ Configuração</option>
                </select>

                {/* Level Filter */}
                <select
                  value={aiLevelFilter}
                  onChange={e => setAiLevelFilter(e.target.value)}
                  className="bg-[#080808] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">Todos os Níveis</option>
                  <option value="SUCCESS">✅ Sucesso</option>
                  <option value="ERROR">❌ Erro</option>
                  <option value="WARN">⚠️ Alerta</option>
                  <option value="INFO">ℹ️ Info</option>
                </select>

                {/* Provider Filter */}
                <select
                  value={aiProviderFilter}
                  onChange={e => setAiProviderFilter(e.target.value)}
                  className="bg-[#080808] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">Todos os Provedores</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="local">Ollama / Local</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="anthropic">Anthropic</option>
                </select>

              </div>
            </div>
          </div>

          {/* AI Logs Table / Feed */}
          <div className="bg-[#050505] rounded-lg border border-white/10 overflow-hidden">
            <div className="bg-[#080808] px-3 py-2 border-b border-white/10 flex items-center justify-between text-[11px] font-bold text-neutral-400">
              <span>Histórico de Interações dos Agentes IA ({filteredAiLogs.length})</span>
              <span>Clique no log para ver detalhes & diagnósticos</span>
            </div>

            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {filteredAiLogs.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 space-y-2">
                  <Brain className="h-8 w-8 mx-auto text-neutral-600 opacity-50" />
                  <p>Nenhum log de IA encontrado para os filtros selecionados.</p>
                  <p className="text-[10px]">Execute um teste de conexão ou envie uma pergunta ao assistente de IA.</p>
                </div>
              ) : (
                filteredAiLogs.map(log => {
                  const isExpanded = !!expandedLogIds[log.id];
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();

                  const levelBadgeColor = 
                    log.level === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    log.level === 'ERROR' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                    log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    'bg-neutral-800 text-neutral-400 border-neutral-700';

                  const typeBadge =
                    log.type === 'TEST_CONNECTION' ? '🧪 TESTE CONEXÃO' :
                    log.type === 'SIGNAL_REVIEW' ? '🎯 REVISÃO SINAL' :
                    log.type === 'MARKET_AUDIT' ? '🔍 AUDITORIA IA' :
                    log.type === 'CHAT_AGENT' ? '💬 CHAT AGENT' : '⚙️ CONFIG';

                  return (
                    <div key={log.id} className="p-3 hover:bg-white/[0.02] transition space-y-2">
                      {/* Row Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-neutral-500 text-[10px]">{timeStr}</span>
                          
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${levelBadgeColor}`}>
                            {log.level}
                          </span>

                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                            {typeBadge}
                          </span>

                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {log.provider.toUpperCase()} ({log.modelId})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {log.durationMs !== undefined && (
                            <span className="bg-black/60 px-2 py-0.5 rounded text-[10px] text-amber-300 font-bold border border-white/10">
                              ⚡ {log.durationMs}ms
                            </span>
                          )}

                          <button
                            onClick={() => toggleExpandLog(log.id)}
                            className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-white/10 rounded text-[10px] text-neutral-300 flex items-center gap-1 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            <span>{isExpanded ? 'Ocultar' : 'Diagnóstico'}</span>
                          </button>
                        </div>

                      </div>

                      {/* Log Main Message */}
                      <div className="text-xs text-neutral-200 font-mono leading-relaxed pl-1 border-l-2 border-purple-500/40">
                        {log.message}
                      </div>

                      {/* Expanded Details Box */}
                      {isExpanded && (
                        <div className="mt-2 bg-[#030303] p-3 rounded-lg border border-white/10 space-y-2 text-xs font-mono animate-fade-in">
                          
                          {/* Diagnostic Steps if available */}
                          {log.details?.diagnosticSteps && log.details.diagnosticSteps.length > 0 && (
                            <div className="space-y-1 bg-black/60 p-2.5 rounded border border-white/10">
                              <span className="text-amber-400 font-bold block border-b border-white/10 pb-1 mb-1 text-[11px]">
                                🔍 Etapas de Diagnóstico Interno:
                              </span>
                              {log.details.diagnosticSteps.map((step, idx) => (
                                <div key={idx} className="text-neutral-300 text-[11px] flex items-start gap-1.5">
                                  <span className="text-neutral-500 select-none">•</span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Prompt or Preview snippet */}
                          {log.details?.promptSnippet && (
                            <div>
                              <span className="text-neutral-500 text-[10px] block uppercase font-bold">Trecho do Prompt Enviado:</span>
                              <pre className="bg-black/80 p-2 rounded border border-white/5 text-[10px] text-neutral-300 whitespace-pre-wrap overflow-x-auto max-h-32">
                                {log.details.promptSnippet}
                              </pre>
                            </div>
                          )}

                          {log.details?.preview && (
                            <div>
                              <span className="text-neutral-500 text-[10px] block uppercase font-bold">Resposta do Modelo:</span>
                              <div className="bg-emerald-950/20 p-2 rounded border border-emerald-500/20 text-[11px] text-emerald-300 font-mono">
                                "{log.details.preview}"
                              </div>
                            </div>
                          )}

                          {/* Error Stack */}
                          {log.details?.errorStack && (
                            <div>
                              <span className="text-rose-400 text-[10px] block uppercase font-bold">Stack de Erro:</span>
                              <pre className="bg-rose-950/30 p-2 rounded border border-rose-500/30 text-[10px] text-rose-300 whitespace-pre-wrap overflow-x-auto max-h-32">
                                {log.details.errorStack}
                              </pre>
                            </div>
                          )}

                          {/* Raw JSON Details */}
                          <details className="cursor-pointer">
                            <summary className="text-[10px] text-neutral-500 hover:text-neutral-300 transition">
                              Ver objeto de detalhes completo (JSON)
                            </summary>
                            <pre className="mt-1 bg-black p-2 rounded text-[9px] text-neutral-400 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>

                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: BINANCE API & WEBSOCKET */}
      {activeTab === 'binance' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Status Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            
            {/* Client Browser WebSocket Card */}
            <div className="bg-[#050505] p-3 rounded-lg border border-orange-500/30 space-y-2">
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
            <div className="bg-[#050505] p-3 rounded-lg border border-white/10 space-y-2">
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
            <div className="bg-[#050505] p-3 rounded-lg border border-white/10 space-y-2">
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
                  Sincronização de velas Klines 15m, Open Interest e Funding Rates institucionais da Binance Futures.
                </p>
              </div>
            </div>

          </div>

          {/* Logs Console Box */}
          <div className="bg-[#050505] p-3 rounded-lg border border-white/10 space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-orange-400" />
                <h3 className="text-xs font-extrabold text-white uppercase">Console de Logs Binance WebSocket & REST</h3>
              </div>

              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-neutral-500">Filtrar:</span>
                <button
                  onClick={() => setBinanceTypeFilter('ALL')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${binanceTypeFilter === 'ALL' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setBinanceTypeFilter('CLIENT_WS')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${binanceTypeFilter === 'CLIENT_WS' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                >
                  WS Navegador
                </button>
                <button
                  onClick={() => setBinanceTypeFilter('SERVER_WS')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${binanceTypeFilter === 'SERVER_WS' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                >
                  WS Backend
                </button>
                <button
                  onClick={() => setBinanceTypeFilter('REST_API')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${binanceTypeFilter === 'REST_API' ? 'bg-orange-500 text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                >
                  REST API
                </button>
              </div>
            </div>

            <div className="h-64 bg-[#080808] p-2.5 rounded border border-white/5 overflow-y-auto space-y-1.5 text-[11px] font-mono">
              {filteredBinanceLogs.length === 0 ? (
                <div className="text-neutral-500 text-center py-10">Aguardando novos eventos de conexão Binance...</div>
              ) : (
                filteredBinanceLogs.map((log) => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();
                  return (
                    <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 p-1 rounded transition text-neutral-300">
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
      )}

      {/* TAB 3: UNIFIED CONSOLE */}
      {activeTab === 'unified' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Search bar */}
          <div className="bg-[#050505] p-3 rounded-lg border border-white/10 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Pesquisar em todos os eventos (Binance WS, REST API, Agentes IA)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#080808] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="bg-[#050505] rounded-lg border border-white/10 overflow-hidden">
            <div className="bg-[#080808] px-3 py-2 border-b border-white/10 flex items-center justify-between text-[11px] font-bold text-neutral-400">
              <span>Console Unificado Cronológico ({filteredUnifiedLogs.length} eventos)</span>
              <span>Ordenado por mais recente</span>
            </div>

            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto font-mono text-xs">
              {filteredUnifiedLogs.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  Nenhum registro encontrado.
                </div>
              ) : (
                filteredUnifiedLogs.map(log => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();
                  const isAi = log.category === 'AI_AGENT';

                  return (
                    <div key={log.id} className="p-2.5 hover:bg-white/[0.02] transition flex items-start gap-2.5">
                      <span className="text-neutral-500 text-[10px] shrink-0">{timeStr}</span>
                      
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase shrink-0 ${
                        isAi 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      }`}>
                        {isAi ? '🤖 IA AGENT' : '⚡ BINANCE'}
                      </span>

                      <span className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 ${
                        log.level === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                        log.level === 'ERROR' ? 'bg-rose-500/20 text-rose-400' :
                        log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        {log.level}
                      </span>

                      <span className="text-neutral-400 text-[10px] font-bold shrink-0">
                        [{log.subType}]
                      </span>

                      <span className="flex-1 text-[11px] text-neutral-200 break-all">
                        {log.message}
                      </span>

                      {log.durationMs !== undefined && (
                        <span className="text-[10px] text-amber-400 font-bold shrink-0 bg-black/50 px-1.5 py-0.5 rounded border border-white/10">
                          ⚡ {log.durationMs}ms
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
