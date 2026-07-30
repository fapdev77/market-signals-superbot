import React, { useState, useEffect, useRef } from 'react';
import { AIAuditReport, TickerData, IndicatorWeights, AIModelConfig } from '../types';
import { Brain, Cpu, RefreshCw, Send, ShieldAlert, Sparkles, CheckCircle, Sliders, MessageSquare } from 'lucide-react';

interface AIMotorPanelProps {
  tickers: TickerData[];
  currentWeights: IndicatorWeights;
  onApplyWeights: (weights: IndicatorWeights) => void;
  aiModels?: AIModelConfig[];
  aiAnalysisEnabled: boolean;
  onToggleAI: (enabled: boolean) => void;
}

export const AIMotorPanel: React.FC<AIMotorPanelProps> = ({
  tickers = [],
  currentWeights,
  onApplyWeights,
  aiModels = [],
  aiAnalysisEnabled,
  onToggleAI
}) => {
  const activeModels = aiModels.filter(m => m.isActive).sort((a, b) => a.priority - b.priority);
  const [selectedModel, setSelectedModel] = useState<string>(activeModels.length > 0 ? activeModels[0].modelId : 'none');
  const [auditReport, setAuditReport] = useState<AIAuditReport | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (activeModels.length > 0) {
      if (!activeModels.some(m => m.modelId === selectedModel)) {
        setSelectedModel(activeModels[0].modelId);
      }
    } else {
      setSelectedModel('none');
    }
  }, [aiModels]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; modelUsed?: string }>>([
    {
      sender: 'ai',
      text: 'Olá! Sou o Motor de Inteligência Artificial do Market Signals SuperBot. Como posso ajudar com a sua estratégia de trade ou análise dos ativos hoje?'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [selectedSymbolForChat, setSelectedSymbolForChat] = useState<string>('BTCUSDT');

  // Ref for chat auto-scrolling
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, loadingChat]);

  const fetchLatestAudit = async () => {
    try {
      const res = await fetch('/api/ai/audit/latest');
      const data = await res.json();
      if (data && data.marketOverview) setAuditReport(data);
    } catch (err) {
      console.error('Failed to load AI audit:', err);
    }
  };

  useEffect(() => {
    fetchLatestAudit();
  }, []);

  const handleRunAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      const data: AIAuditReport = await res.json();
      setAuditReport(data);
    } catch (err) {
      console.error('Failed to run strategic audit:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!inputQuery.trim()) return;
    const msg = inputQuery;
    setInputQuery('');

    setChatMessages(prev => [...prev, { sender: 'user', text: msg }]);
    setLoadingChat(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, symbol: selectedSymbolForChat, model: selectedModel })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { 
        sender: 'ai', 
        text: data.reply || 'Erro na resposta.',
        modelUsed: data.modelUsed
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'ai', text: 'Falha na comunicação com o Motor de IA.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 font-mono w-full">
      {/* AI Motor Engine Header Card */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/30">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">Motor de Inteligência Artificial — Especificação Técnica</h2>
              <span className="text-[9px] bg-orange-500/20 text-orange-400 font-bold px-1.5 py-0.5 rounded border border-orange-500/30">
                v2.0 ATIVO
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-0.5 max-w-2xl">
              Auditoria estratégica e calibração quantitativa alimentadas por modelos de IA server-side.
            </p>
          </div>
        </div>

        {/* Model Selector and AI Toggle */}
        <div className="bg-[#050505] p-2 rounded border border-white/10 flex items-center gap-3 w-full md:w-auto">
          {/* Toggle IA */}
          <button
            onClick={() => onToggleAI(!aiAnalysisEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold border transition ${
              aiAnalysisEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
             {aiAnalysisEnabled ? <Brain className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
             {aiAnalysisEnabled ? 'IA ATIVA' : 'IA DESABILITADA'}
          </button>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-orange-400" />
            <div className="flex flex-col">
              <span className="text-[9px] text-neutral-500 uppercase font-bold">Modelo:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-[#0A0A0A] border border-white/10 text-neutral-200 text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-orange-500"
              >
                {activeModels.length > 0 ? (
                  activeModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider.toUpperCase()} - {model.modelId})
                    </option>
                  ))
                ) : (
                  <option value="none">Nenhum Modelo Ativo (Rule Engine Fallback)</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Audit Section Card */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 p-4 shadow-xl space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-extrabold text-white uppercase">Auditoria Estratégica do Mercado em Tempo Real</h3>
          </div>

          <button
            onClick={handleRunAudit}
            disabled={loadingAudit}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded text-xs font-bold transition flex items-center gap-1.5 shadow disabled:opacity-50"
          >
            {loadingAudit ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Auditando Mercado...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Executar Auditoria de Mercado
              </>
            )}
          </button>
        </div>

        {auditReport ? (
          <div className="space-y-4">
            {/* Overview Box */}
            <div className="bg-[#050505] p-3 rounded border border-white/5 text-xs text-neutral-300 leading-relaxed">
              <strong className="text-orange-400 block mb-1 text-xs font-bold">Visão Geral do Mercado:</strong>
              {auditReport.marketOverview}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Opportunities */}
              <div className="bg-emerald-950/20 p-3 rounded border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Principais Oportunidades Identificadas
                </div>
                <ul className="space-y-1 text-xs text-neutral-300">
                  {(auditReport.topOpportunities || []).map((op, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{op}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risk Warnings */}
              <div className="bg-rose-950/20 p-3 rounded border border-rose-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Alertas de Risco & Liquidez
                </div>
                <ul className="space-y-1 text-xs text-neutral-300">
                  {(auditReport.riskWarnings || []).map((rw, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{rw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Suggested Weight Tuning */}
            {auditReport.suggestedWeightAdjustments && (
              <div className="bg-[#050505] p-3 rounded border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Ajuste de Pesos Recomendado pela IA</h4>
                  <p className="text-[10px] text-neutral-400">
                    Calibrar pesos quantitativos para o regime atual do mercado.
                  </p>
                </div>
                <button
                  onClick={() => onApplyWeights(auditReport.suggestedWeightAdjustments)}
                  className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Aplicar Sugestão de Pesos
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-500 text-xs font-mono">
            Nenhuma auditoria gerada ainda. Clique no botão acima para acionar o Motor de IA.
          </div>
        )}
      </div>

      {/* Interactive AI Trader Assistant Chat Card */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 p-4 shadow-xl space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-extrabold text-white uppercase">Chat Direto com o SuperBot AI Trader</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 font-bold">Contexto:</span>
            <select
              value={selectedSymbolForChat}
              onChange={(e) => setSelectedSymbolForChat(e.target.value)}
              className="bg-[#050505] border border-white/10 text-neutral-300 text-xs px-2 py-0.5 rounded"
            >
              {(tickers || []).map(t => (
                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat History Box */}
        <div 
          ref={chatContainerRef}
          className="h-72 bg-[#050505] p-3 rounded border border-white/5 overflow-y-auto space-y-2.5 text-xs scroll-smooth"
        >
          {chatMessages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] text-neutral-500 font-bold">
                  {m.sender === 'user' ? 'Você' : 'SuperBot AI Trader'}
                </span>
                {m.modelUsed && m.sender === 'ai' && (
                  <span className="text-[8px] bg-orange-500/10 text-orange-400 font-bold px-1 py-0.2 rounded border border-orange-500/20">
                    {m.modelUsed}
                  </span>
                )}
              </div>
              <div
                className={`max-w-2xl p-2.5 rounded text-xs leading-relaxed whitespace-pre-wrap ${
                  m.sender === 'user'
                    ? 'bg-orange-500 text-black font-bold'
                    : 'bg-[#0A0A0A] text-neutral-200 border border-white/10'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loadingChat && (
            <div className="text-neutral-500 text-xs flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin text-orange-400" /> SuperBot AI digitando...
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Pergunte algo sobre ${selectedSymbolForChat} (ex: "Qual o melhor ponto no Fibo 0.68?")`}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
            className="flex-1 bg-[#050505] border border-white/10 text-neutral-200 placeholder-neutral-500 px-3 py-1.5 rounded text-xs focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleSendChatMessage}
            disabled={loadingChat || !inputQuery.trim()}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded text-xs transition flex items-center gap-1 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
