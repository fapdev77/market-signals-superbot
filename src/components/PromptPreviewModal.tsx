import React, { useState, useEffect } from 'react';
import { TickerData, TradeSignal, AIModelConfig, AIReviewResponse } from '../types';
import { DEFAULT_AI_PERSONAS } from '../constants/aiPersonas';
import { 
  Brain, 
  Cpu, 
  UserCheck, 
  Send, 
  X, 
  Copy, 
  Check, 
  Edit3, 
  RotateCcw, 
  Sparkles, 
  Info, 
  AlertCircle,
  FileText,
  Zap,
  SlidersHorizontal
} from 'lucide-react';

export interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: TickerData;
  signal?: TradeSignal | null;
  activeModels: AIModelConfig[];
  selectedModel: string;
  onChangeModel: (modelId: string) => void;
  selectedPersona: string;
  onChangePersona: (personaId: string) => void;
  onReviewComplete: (review: AIReviewResponse) => void;
}

const QUICK_CONTEXT_TAGS = [
  { label: 'Notícia / FOMC / CPI nas próximas horas', text: 'Considerar alta volatilidade iminente devido a anúncio macro/econômico nas próximas horas.' },
  { label: 'Parede de Liquidez no Livro de Ordens', text: 'Identificada grande parede de ordens passivas de absorção no book de ofertas próximo da zona de entrada.' },
  { label: 'Volume Fraco / Feriado', text: 'Mercado com volume institucional abaixo da média devido a fim de semana/feriado bancário.' },
  { label: 'Aguardar Fechamento de Vela 4H', text: 'Priorizar entradas apenas com confirmação de fechamento no gráfico de 4 horas.' },
  { label: 'Risco Elevado de Caça de Stop', text: 'Atenção redobrada para pavios e violinadas de caça de liquidez em níveis óbvios.' }
];

export const PromptPreviewModal: React.FC<PromptPreviewModalProps> = ({
  isOpen,
  onClose,
  ticker,
  signal,
  activeModels,
  selectedModel,
  onChangeModel,
  selectedPersona,
  onChangePersona,
  onReviewComplete
}) => {
  const [customNotes, setCustomNotes] = useState<string>('');
  const [promptText, setPromptText] = useState<string>('');
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch or re-generate prompt preview from server whenever inputs change (unless in manual edit mode)
  const fetchPreview = async (notesToUse = customNotes) => {
    if (!ticker) return;
    setLoadingPreview(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/review/preview-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker.symbol,
          personaId: selectedPersona,
          signalId: signal?.id,
          signal: signal || undefined,
          customNotes: notesToUse
        })
      });
      if (!res.ok) {
        throw new Error(`Falha ao gerar preview (${res.status})`);
      }
      const data = await res.json();
      if (data && data.prompt) {
        setPromptText(data.prompt);
        if (!isEditingPrompt) {
          setEditedPrompt(data.prompt);
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar preview do prompt:', err);
      setErrorMsg(err.message || 'Falha ao conectar com o gerador de prompt.');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    } else {
      setIsEditingPrompt(false);
      setCustomNotes('');
    }
  }, [isOpen, ticker?.symbol, selectedPersona, signal?.id]);

  // When custom notes change and user is not in manual edit mode, debounce preview update
  useEffect(() => {
    if (!isOpen || isEditingPrompt) return;
    const timeout = setTimeout(() => {
      fetchPreview(customNotes);
    }, 350);
    return () => clearTimeout(timeout);
  }, [customNotes]);

  const handleCopyPrompt = () => {
    const textToCopy = isEditingPrompt ? editedPrompt : promptText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTag = (text: string) => {
    setCustomNotes(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      if (trimmed.includes(text)) return trimmed;
      return `${trimmed}\n- ${text}`;
    });
  };

  const handleResetPrompt = () => {
    setIsEditingPrompt(false);
    fetchPreview(customNotes);
  };

  const executeReview = async (useDirectDefault: boolean = false) => {
    setLoadingSubmit(true);
    setErrorMsg(null);
    try {
      const model = selectedModel || activeModels.find(m => m.isActive)?.id || undefined;
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker.symbol,
          signalId: signal?.id,
          signal: signal || undefined,
          model,
          personaId: selectedPersona,
          customNotes: (useDirectDefault || isEditingPrompt) ? undefined : customNotes,
          customPromptOverride: (!useDirectDefault && isEditingPrompt) ? editedPrompt : undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      const review: AIReviewResponse = await res.json();
      onReviewComplete(review);
      onClose();
    } catch (err: any) {
      console.error('Falha ao executar auditoria com prompt:', err);
      setErrorMsg(err.message || 'Falha ao processar a auditoria com a IA.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (!isOpen) return null;

  const currentPromptContent = isEditingPrompt ? editedPrompt : promptText;
  const estimatedTokens = Math.ceil(currentPromptContent.length / 4);
  const enabledModels = activeModels.filter(m => m.isActive);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in font-mono">
      <div className="bg-[#0A0A0A] border border-orange-500/40 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto border-t-2 border-t-orange-500">
        
        {/* Header */}
        <div className="p-4 bg-[#050505] border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Auditoria de IA & Conferência de Prompt</h3>
                <span className="text-[10px] bg-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-500/30">
                  PRÉ-DISPARO
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Revise os dados, adicione notas ou edite o prompt antes do disparo, ou execute diretamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="px-2.5 py-1 bg-neutral-900 border border-white/10 rounded-lg text-xs font-bold text-white flex items-center gap-2">
              <span className="text-neutral-400">{ticker.symbol}</span>
              <span className={signal?.direction === 'SHORT' ? 'text-rose-400' : 'text-emerald-400'}>
                {signal?.direction || 'SINAL'}
              </span>
              {signal?.confluenceScore && (
                <span className="text-orange-400 font-extrabold">({signal.confluenceScore}%)</span>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={loadingSubmit}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Choice Action Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 via-neutral-900 to-cyan-500/10 p-3 px-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <SlidersHorizontal className="h-4 w-4 text-orange-400 shrink-0" />
            <span>
              Você pode <strong className="text-white">personalizar as notas e o prompt</strong> abaixo ou <strong className="text-orange-400">disparar direto</strong> com os dados de mercado atuais.
            </span>
          </div>
          <button
            type="button"
            onClick={() => executeReview(true)}
            disabled={loadingSubmit}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-orange-300 border border-orange-500/40 hover:border-orange-500/80 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1.5 shrink-0 shadow cursor-pointer disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5 text-orange-400" />
            <span>⚡ Disparar Direto (Padrão)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Controls: Model & Persona Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#050505] p-3.5 rounded-xl border border-white/10">
            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 uppercase">
                <Cpu className="h-3.5 w-3.5 text-orange-400" />
                <span>Modelo de IA Destino:</span>
              </label>
              <select
                value={selectedModel}
                onChange={(e) => onChangeModel(e.target.value)}
                disabled={loadingSubmit}
                className="w-full bg-black border border-white/10 text-white rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                {enabledModels.length > 0 ? (
                  enabledModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider.toUpperCase()} - {m.modelId})
                    </option>
                  ))
                ) : (
                  <option value="">Gemini 2.5 Flash (Padrão)</option>
                )}
              </select>
            </div>

            {/* Persona Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 uppercase">
                <UserCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span>Persona Operacional (Viés Técnico):</span>
              </label>
              <select
                value={selectedPersona}
                onChange={(e) => onChangePersona(e.target.value)}
                disabled={loadingSubmit}
                className="w-full bg-black border border-cyan-500/30 text-cyan-300 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {DEFAULT_AI_PERSONAS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Risco: {p.riskTolerance} • Min R:R {p.minRRRatio}:1)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Notes from Trader */}
          <div className="bg-[#050505] p-3.5 rounded-xl border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 uppercase">
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span>Notas do Trader & Informações Adicionais (Contexto Extra)</span>
              </label>
              <span className="text-[10px] text-neutral-500">
                Injetado dinamicamente antes das instruções
              </span>
            </div>

            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              disabled={isEditingPrompt || loadingSubmit}
              placeholder="Digite aqui informações complementares que a IA deve avaliar (ex: 'Notícia de CPI às 14:30; grande cluster de liquidez passiva em 69.500; preferir stop protegido')..."
              rows={3}
              className="w-full bg-black border border-white/10 text-neutral-200 placeholder-neutral-600 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />

            {/* Quick Context Insertion Tags */}
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400 block font-bold uppercase">
                Atalhos Rápidos de Contexto (Clique para inserir):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CONTEXT_TAGS.map((tag, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={isEditingPrompt || loadingSubmit}
                    onClick={() => handleAddTag(tag.text)}
                    className="px-2 py-1 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-neutral-300 hover:text-emerald-300 border border-white/10 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <span>+</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Prompt Preview Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-neutral-200 uppercase flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                  <span>Prompt Completo para Envio</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  ~{estimatedTokens.toLocaleString()} tokens ({currentPromptContent.length} chars)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isEditingPrompt ? (
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded border border-white/10 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3 text-amber-400" />
                    Restaurar Padrão
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingPrompt(true)}
                    className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-cyan-300 rounded border border-cyan-500/30 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" />
                    Editar Texto Livremente
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded border border-white/10 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-neutral-400" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            {isEditingPrompt ? (
              <div className="relative">
                <div className="absolute top-2 right-2 text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40 uppercase font-black">
                  Modo de Edição Livre Ativo
                </div>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={14}
                  className="w-full bg-black border border-cyan-500/40 text-neutral-200 font-mono text-[11px] leading-relaxed rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            ) : (
              <div className="relative bg-black rounded-xl border border-white/10 p-3.5 max-h-72 overflow-y-auto">
                {loadingPreview && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs text-orange-400 gap-2">
                    <span className="animate-spin">⚙</span> Atualizando preview...
                  </div>
                )}
                <pre className="text-neutral-300 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {promptText || 'Carregando preview do prompt...'}
                </pre>
              </div>
            )}
          </div>

          {/* Error Message if Any */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#050505] border-t border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 self-start sm:self-center">
            <Info className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span>O retorno será validado pelas travas matemáticas de Stop Loss e Take Profit do servidor.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loadingSubmit}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => executeReview(false)}
              disabled={loadingSubmit || loadingPreview}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-extrabold rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              {loadingSubmit ? (
                <>
                  <span className="animate-spin">⚙</span>
                  <span>Executando Auditoria...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Confirmar & Executar Auditoria IA</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// Backwards compatibility alias
export const AIReviewPromptModal = PromptPreviewModal;
