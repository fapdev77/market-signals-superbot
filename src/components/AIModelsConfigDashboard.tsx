import React, { useState } from 'react';
import { 
  Server, 
  Settings2, 
  Plus, 
  Trash2, 
  Edit3, 
  ShieldAlert, 
  CheckCircle2, 
  Key, 
  Network, 
  ArrowUp, 
  ArrowDown,
  Cpu,
  Brain,
  Save,
  X,
  Zap,
  RefreshCw,
  Copy,
  Sliders,
  MessageSquareCode,
  Sparkles,
  Check,
  AlertCircle,
  Play
} from 'lucide-react';
import { AIModelConfig, AIProvider } from '../types';

const GEMINI_MODEL_SUGGESTIONS = [
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Ultrarrápido & Econômico)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Última Geração - Alta Performance)' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Análise Institucional Rígida)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Raciocínio Quant Profundo)' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp (Experimental High-Speed)' }
];

const PRESET_PROFILES = [
  {
    name: '🎯 Conservador (Risco Mínimo)',
    description: 'Temperatura baixa (0.1). Exige confluência máxima de CVD e Fibonacci.',
    temp: 0.1,
    topP: 0.90,
    modelId: 'gemini-1.5-pro-latest',
    prompt: 'Atue como um gestor de risco ultra-conservador. Só confirme o sinal se o CVD e o Volume Profile estiverem perfeitamente alinhados com a direção do trade. Em dúvida ou divergência, REJEITE a operação.'
  },
  {
    name: '⚡ Scalper High-Speed',
    description: 'Temperatura moderada (0.2). Foco em velocidade e reações rápidas de Book.',
    temp: 0.2,
    topP: 0.95,
    modelId: 'gemini-1.5-flash-latest',
    prompt: 'Atue como um trader scalper de alta frequência. Avalie rompimentos rápidos de POC e desequilíbrios no Order Flow.'
  },
  {
    name: '🧠 Institucional Quant',
    description: 'Temperatura 0.15. Foco em busca de liquidez e armadilhas de varejo.',
    temp: 0.15,
    topP: 0.92,
    modelId: 'gemini-2.5-flash',
    prompt: 'Atue como um analista quantitativo de liquidez. Identifique varreduras de stop (Stop Hunts) em níveis chave de suporte e resistência antes de confirmar entradas.'
  }
];

export const AIModelsConfigDashboard: React.FC<{ 
  models: AIModelConfig[];
  onUpdateModels: (m: AIModelConfig[]) => void;
}> = ({ models, onUpdateModels }) => {
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'general' | 'params' | 'prompt' | 'limits'>('general');
  const [testResult, setTestResult] = useState<{ modelId: string; loading: boolean; message: string; success?: boolean; latencyMs?: number } | null>(null);

  const [selectedActiveModelId, setSelectedActiveModelId] = useState<string | null>(null);

  // Get active models sorted by priority
  const activeModels = models.filter(m => m.isActive).sort((a, b) => a.priority - b.priority);
  // Get primary active model to display in quick config banner
  const activeModel = activeModels.find(m => m.id === selectedActiveModelId) || activeModels[0] || null;

  const handleToggleActive = (id: string) => {
    const target = models.find(m => m.id === id);
    const updated = models.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m);
    onUpdateModels(updated);
    if (target && !target.isActive) {
      setSelectedActiveModelId(id);
    }
  };

  const handleToggleFallback = (id: string) => {
    onUpdateModels(models.map(m => m.id === id ? { ...m, isFallback: !m.isFallback } : m));
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover este modelo de IA da configuração?')) {
      onUpdateModels(models.filter(m => m.id !== id));
    }
  };

  const handleDuplicate = (model: AIModelConfig) => {
    const duplicated: AIModelConfig = {
      ...model,
      id: Math.random().toString(36).substring(2, 9),
      name: `${model.name} (Cópia)`,
      priority: models.length + 1,
      isActive: false
    };
    onUpdateModels([...models, duplicated]);
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newModels = [...models];
    if (direction === 'up' && index > 0) {
      const temp = newModels[index - 1];
      newModels[index - 1] = newModels[index];
      newModels[index] = temp;
    } else if (direction === 'down' && index < newModels.length - 1) {
      const temp = newModels[index + 1];
      newModels[index + 1] = newModels[index];
      newModels[index] = temp;
    }
    onUpdateModels(newModels.map((m, i) => ({ ...m, priority: i + 1 })));
  };

  const openAddModal = () => {
    setEditingModel({
      id: Math.random().toString(36).substring(2, 9),
      name: 'Novo Modelo Gemini',
      provider: 'gemini',
      modelId: 'gemini-1.5-flash-latest',
      isActive: true,
      isFallback: false,
      priority: models.length + 1,
      rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
      parameters: { 
        temperature: 0.2, 
        maxTokens: 8192,
        topP: 0.95,
        systemInstruction: 'Atue como um analista trader quantitativo. Exija forte confluência em CVD e na zona de Fibonacci Golden Pocket.'
      }
    });
    setActiveTabModal('general');
    setIsModalOpen(true);
  };

  const openEditModal = (model: AIModelConfig) => {
    setEditingModel({ ...model });
    setActiveTabModal('general');
    setIsModalOpen(true);
  };

  const saveModel = () => {
    if (!editingModel) return;
    
    const isExisting = models.some(m => m.id === editingModel.id);
    let updated: AIModelConfig[];
    if (isExisting) {
      updated = models.map(m => m.id === editingModel.id ? editingModel : m);
    } else {
      updated = [...models, editingModel];
    }
    onUpdateModels(updated);
    setIsModalOpen(false);
  };

  const handleApplyPreset = (preset: typeof PRESET_PROFILES[0]) => {
    if (!activeModel) return;
    const updated = models.map(m => {
      if (m.id === activeModel.id) {
        return {
          ...m,
          modelId: preset.modelId,
          parameters: {
            ...m.parameters,
            temperature: preset.temp,
            topP: preset.topP,
            systemInstruction: preset.prompt
          }
        };
      }
      return m;
    });
    onUpdateModels(updated);
  };

  const handleQuickUpdateActiveModel = (updates: Partial<AIModelConfig['parameters']> & { modelId?: string }) => {
    if (!activeModel) return;
    const updated = models.map(m => {
      if (m.id === activeModel.id) {
        return {
          ...m,
          ...(updates.modelId ? { modelId: updates.modelId } : {}),
          parameters: {
            ...m.parameters,
            ...updates
          }
        };
      }
      return m;
    });
    onUpdateModels(updated);
  };

  const testConnection = async (model: AIModelConfig) => {
    setTestResult({ modelId: model.id, loading: true, message: 'Testando conexão com a API...' });
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: model.modelId, provider: model.provider })
      });
      const data = await res.json();
      setTestResult({
        modelId: model.id,
        loading: false,
        success: data.success,
        message: data.message || 'Teste concluído',
        latencyMs: data.latencyMs
      });
    } catch (err: any) {
      setTestResult({
        modelId: model.id,
        loading: false,
        success: false,
        message: `Falha na conexão: ${err.message || 'Erro de rede'}`
      });
    }
  };

  const providerColors: Record<string, string> = {
    gemini: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    openai: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    openrouter: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    anthropic: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    local: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="space-y-6 max-w-[2400px] mx-auto font-mono pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Cpu className="h-6 w-6 text-orange-400" />
            Configuração e Parâmetros do Motor de IA
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Personalize modelos Gemini, instruções de sistema, temperatura de inferência e regras de contingência (Fallback)
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-orange-500/20"
        >
          <Plus className="h-4 w-4" />
          Adicionar Novo Modelo
        </button>
      </div>

      {/* ACTIVE MOTOR QUICK CONFIG BANNER */}
      {!activeModel ? (
        <div className="bg-[#0A0A0A] border border-rose-500/30 p-5 rounded-2xl shadow-2xl space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/30 text-rose-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">NENHUM MOTOR DE IA ATIVO</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> INATIVO / FALLBACK
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-0.5">Sem Modelo de IA em Operação</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                  Todos os modelos de Inteligência Artificial estão desativados. As análises de sinal e auditorias estratégicas estão operando em modo estático de contingência (Rule Engine sem IA). Ative pelo menos um modelo na lista abaixo para habilitar o Motor de IA.
                </p>
              </div>
            </div>

            {models.length > 0 && (
              <button
                onClick={() => handleToggleActive(models[0].id)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Ativar {models[0].name}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`bg-gradient-to-br from-[#0D121F] via-[#0A0A0A] to-[#0A0A0A] border ${
          activeModel.provider === 'gemini' ? 'border-blue-500/30' :
          activeModel.provider === 'openai' ? 'border-emerald-500/30' :
          activeModel.provider === 'openrouter' ? 'border-indigo-500/30' :
          activeModel.provider === 'anthropic' ? 'border-amber-500/30' :
          'border-purple-500/30'
        } p-5 rounded-2xl shadow-2xl space-y-5 font-mono`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                activeModel.provider === 'gemini' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                activeModel.provider === 'openai' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                activeModel.provider === 'openrouter' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' :
                activeModel.provider === 'anthropic' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                'bg-purple-500/20 border-purple-500/30 text-purple-400'
              }`}>
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase tracking-widest ${
                    activeModel.provider === 'gemini' ? 'text-blue-400' :
                    activeModel.provider === 'openai' ? 'text-emerald-400' :
                    activeModel.provider === 'openrouter' ? 'text-indigo-400' :
                    activeModel.provider === 'anthropic' ? 'text-amber-400' :
                    'text-purple-400'
                  }`}>
                    MOTOR {activeModel.provider.toUpperCase()} ATIVO
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> EM OPERAÇÃO
                  </span>

                  {activeModels.length > 1 && (
                    <div className="flex items-center gap-1.5 ml-1 bg-[#050505] px-2 py-0.5 rounded border border-white/10">
                      <span className="text-[10px] text-neutral-400 font-bold">Alternar Ativo:</span>
                      <select
                        value={activeModel.id}
                        onChange={(e) => setSelectedActiveModelId(e.target.value)}
                        className="bg-black text-xs font-bold text-white border border-white/20 rounded px-2 py-0.5 focus:outline-none focus:border-orange-500 cursor-pointer"
                      >
                        {activeModels.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.provider})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-white mt-0.5">{activeModel.name}</h3>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => testConnection(activeModel)}
                disabled={testResult?.loading}
                className="flex-1 lg:flex-none px-3.5 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {testResult?.loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Play className="h-4 w-4 text-blue-400 fill-blue-400" />
                )}
                Testar Latência API
              </button>
            </div>
          </div>

          {/* Test connection result banner */}
          {testResult && testResult.modelId === activeModel.id && (
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between font-mono animate-fade-in ${
              testResult.loading ? 'bg-blue-950/40 border-blue-500/30 text-blue-300' :
              testResult.success ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' :
              'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : testResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
                <span>{testResult.message}</span>
              </div>
              {testResult.latencyMs !== undefined && (
                <span className="bg-black/50 px-2 py-0.5 rounded font-bold text-[11px] border border-white/10">
                  ⚡ {testResult.latencyMs}ms
                </span>
              )}
            </div>
          )}

          {/* Preset Profiles Selector */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Perfis de Estratégia Pré-configurados (Quick Presets)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESET_PROFILES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3 bg-[#050505] hover:bg-neutral-900 border border-white/10 hover:border-orange-500/50 rounded-xl text-left transition space-y-1 group cursor-pointer"
                >
                  <div className="font-bold text-xs text-white group-hover:text-orange-400 transition flex items-center justify-between">
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">Temp {preset.temp}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Parameters Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-[#050505] p-4 rounded-xl border border-white/5">
            {/* Versão do Modelo */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-orange-400" />
                Versão do Modelo ({activeModel.provider.toUpperCase()})
              </label>
              {activeModel.provider === 'gemini' ? (
                <select
                  value={activeModel.modelId}
                  onChange={(e) => handleQuickUpdateActiveModel({ modelId: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {GEMINI_MODEL_SUGGESTIONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {!GEMINI_MODEL_SUGGESTIONS.some(s => s.id === activeModel.modelId) && (
                    <option value={activeModel.modelId}>{activeModel.modelId}</option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  value={activeModel.modelId}
                  onChange={(e) => handleQuickUpdateActiveModel({ modelId: e.target.value })}
                  placeholder="Identificador do modelo (ex: anthropic/claude-3.5-sonnet)"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-bold font-mono focus:outline-none focus:border-orange-500"
                />
              )}
            </div>

            {/* Slider de Temperatura */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Sliders className="h-3.5 w-3.5 text-orange-400" />
                  Temperatura
                </label>
                <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                  {activeModel.parameters.temperature} ({activeModel.parameters.temperature < 0.2 ? 'Rígido' : activeModel.parameters.temperature < 0.5 ? 'Balanceado' : 'Flexível'})
                </span>
              </div>
              <input 
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={activeModel.parameters.temperature}
                onChange={(e) => handleQuickUpdateActiveModel({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-orange-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Top P */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-orange-400" />
                  Top P (Amostragem)
                </label>
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {activeModel.parameters.topP ?? 0.95}
                </span>
              </div>
              <input 
                type="range"
                min="0.5"
                max="1.0"
                step="0.01"
                value={activeModel.parameters.topP ?? 0.95}
                onChange={(e) => handleQuickUpdateActiveModel({ topP: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquareCode className="h-4 w-4 text-orange-400" />
                Prompt de Sistema / Instruções Personalizadas do Motor IA ({activeModel.name})
              </span>
              <span className="text-[10px] text-neutral-500 normal-case font-normal">
                Enviado diretamente nas consultas de revisão e auditoria do modelo
              </span>
            </label>
            <textarea
              rows={3}
              value={activeModel.parameters.systemInstruction || ''}
              onChange={(e) => handleQuickUpdateActiveModel({ systemInstruction: e.target.value })}
              placeholder="Digite regras específicas de validação para a IA (ex: Exija alinhamento rigoroso entre CVD Delta e suporte de Fibonacci 0.618)..."
              className="w-full bg-[#050505] border border-white/10 rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-orange-500 font-mono leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* Models List Header */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
          <Server className="h-4 w-4 text-orange-400" />
          Lista de Provedores e Modelos de Contingência
        </h3>
        <span className="text-xs text-neutral-400">
          Total de Modelos: <strong className="text-white">{models.length}</strong>
        </span>
      </div>

      {/* Models List */}
      <div className="space-y-3">
        {models.map((model, index) => (
          <div 
            key={model.id} 
            className={`bg-[#0A0A0A] border ${
              model.isActive ? 'border-white/10 hover:border-white/20' : 'border-rose-900/30 opacity-75'
            } p-4 rounded-xl shadow-xl flex flex-col md:flex-row items-start md:items-center gap-4 transition-all`}
          >
            
            {/* Priority & Status Controls */}
            <div className="flex items-center gap-2 md:flex-col md:gap-1">
              <button 
                onClick={() => movePriority(index, 'up')}
                disabled={index === 0}
                className="text-neutral-500 hover:text-white disabled:opacity-20 transition"
                title="Aumentar prioridade"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <div className="bg-[#050505] text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 shadow">
                #{model.priority}
              </div>
              <button 
                onClick={() => movePriority(index, 'down')}
                disabled={index === models.length - 1}
                className="text-neutral-500 hover:text-white disabled:opacity-20 transition"
                title="Diminuir prioridade"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-bold text-sm ${model.isActive ? 'text-white' : 'text-neutral-500'}`}>
                  {model.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${providerColors[model.provider] || 'text-neutral-400 bg-white/5 border-white/10'}`}>
                  {model.provider}
                </span>
                {model.isFallback && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider text-amber-400 bg-amber-500/10 border-amber-500/20 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Fallback Contingência
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-[10px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-neutral-500" />
                  ID: <span className="text-neutral-200 font-semibold">{model.modelId}</span>
                </div>
                {model.apiUrl && (
                  <div className="flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-neutral-500" />
                    Endpoint: <span className="text-neutral-300">{model.apiUrl}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5 text-neutral-500" />
                  Temp: <span className="text-orange-400 font-bold">{model.parameters.temperature}</span> | Tokens: <span className="text-neutral-300">{model.parameters.maxTokens}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-neutral-500" />
                  Limites: <span className="text-emerald-400 font-semibold">{model.rateLimit.maxReqPerMinute} RPM</span>
                </div>
              </div>

              {model.parameters.systemInstruction && (
                <p className="text-[10px] text-neutral-400 line-clamp-1 italic bg-[#050505] px-2.5 py-1 rounded border border-white/5">
                  "{model.parameters.systemInstruction}"
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-white/5">
              <button
                onClick={() => testConnection(model)}
                className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition"
                title="Testar Conexão / Latência"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleToggleActive(model.id)}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  model.isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {model.isActive ? 'Ativo' : 'Inativo'}
              </button>
              <button
                onClick={() => handleToggleFallback(model.id)}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  model.isFallback 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                    : 'bg-neutral-900 text-neutral-500 border-white/5 hover:text-neutral-300'
                }`}
                title="Ativar como motor de contingência (Fallback)"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Fallback
              </button>
              <button
                onClick={() => handleDuplicate(model)}
                className="p-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition"
                title="Duplicar Modelo"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => openEditModal(model)}
                className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition"
                title="Editar Configurações"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition"
                title="Remover Modelo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && editingModel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#050505]">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-orange-400" />
                {models.some(m => m.id === editingModel.id) ? 'Editar Modelo de IA' : 'Adicionar Novo Modelo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Nav Tabs */}
            <div className="flex border-b border-white/10 bg-[#0A0A0A] px-4 font-mono text-xs">
              <button
                onClick={() => setActiveTabModal('general')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTabModal === 'general' ? 'border-orange-500 text-orange-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                1. Identificação & Provedor
              </button>
              <button
                onClick={() => setActiveTabModal('params')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTabModal === 'params' ? 'border-orange-500 text-orange-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                2. Parâmetros de Inferência
              </button>
              <button
                onClick={() => setActiveTabModal('prompt')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTabModal === 'prompt' ? 'border-orange-500 text-orange-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                3. Prompt de Sistema
              </button>
              <button
                onClick={() => setActiveTabModal('limits')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTabModal === 'limits' ? 'border-orange-500 text-orange-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                4. Redes & Limites
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* TAB 1: General */}
              {activeTabModal === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold">Nome do Modelo</label>
                      <input 
                        type="text" 
                        value={editingModel.name}
                        onChange={e => setEditingModel({...editingModel, name: e.target.value})}
                        placeholder="Ex: Gemini 2.5 Flash Principal"
                        className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold">Provedor de Serviço</label>
                      <select
                        value={editingModel.provider}
                        onChange={e => setEditingModel({...editingModel, provider: e.target.value as AIProvider})}
                        className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openrouter">OpenRouter (Multi-modelos)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="local">Local (LM Studio / Ollama)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                      <span>Model ID / Identificador da API</span>
                      {editingModel.provider === 'gemini' && (
                        <span className="text-blue-400 text-[10px]">Sugestões Gemini disponíveis</span>
                      )}
                    </label>
                    <input 
                      type="text" 
                      value={editingModel.modelId}
                      onChange={e => setEditingModel({...editingModel, modelId: e.target.value})}
                      placeholder="Ex: gemini-1.5-flash-latest"
                      className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                    
                    {/* Gemini Quick Suggestion Chips */}
                    {editingModel.provider === 'gemini' && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {GEMINI_MODEL_SUGGESTIONS.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setEditingModel({ ...editingModel, modelId: s.id })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                              editingModel.modelId === s.id ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-white'
                            }`}
                          >
                            {s.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Parameters */}
              {activeTabModal === 'params' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                        <span>Temperatura</span>
                        <span className="text-orange-400 font-bold">{editingModel.parameters.temperature}</span>
                      </label>
                      <input 
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.05"
                        value={editingModel.parameters.temperature}
                        onChange={e => setEditingModel({
                          ...editingModel,
                          parameters: { ...editingModel.parameters, temperature: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full accent-orange-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                      />
                      <p className="text-[10px] text-neutral-500">Valores baixos (0.1) tornam a análise rigorosa e consistente.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                        <span>Top P (Nucleus)</span>
                        <span className="text-cyan-400 font-bold">{editingModel.parameters.topP ?? 0.95}</span>
                      </label>
                      <input 
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={editingModel.parameters.topP ?? 0.95}
                        onChange={e => setEditingModel({
                          ...editingModel,
                          parameters: { ...editingModel.parameters, topP: parseFloat(e.target.value) || 0.95 }
                        })}
                        className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold">Max Tokens (Resposta)</label>
                      <input 
                        type="number" 
                        value={editingModel.parameters.maxTokens}
                        onChange={e => setEditingModel({
                          ...editingModel,
                          parameters: { ...editingModel.parameters, maxTokens: parseInt(e.target.value) || 4096 }
                        })}
                        className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: System Prompt */}
              {activeTabModal === 'prompt' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                    <span>Instruções de Sistema Personalizadas (System Instruction)</span>
                    <span className="text-neutral-500 text-[10px]">Específico para este modelo</span>
                  </label>
                  <textarea 
                    rows={6}
                    value={editingModel.parameters.systemInstruction || ''}
                    onChange={e => setEditingModel({
                      ...editingModel,
                      parameters: { ...editingModel.parameters, systemInstruction: e.target.value }
                    })}
                    placeholder="Instruções para o modelo ao analisar trades e auditorias..."
                    className="w-full bg-[#050505] border border-white/10 rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-orange-500 font-mono leading-relaxed"
                  />
                </div>
              )}

              {/* TAB 4: Network & Limits */}
              {activeTabModal === 'limits' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                      <span>Chave API Customizada (Opcional)</span>
                      <span className="text-neutral-500">Deixe em branco para usar .env</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                      <input 
                        type="password" 
                        value={editingModel.apiKey || ''}
                        onChange={e => setEditingModel({...editingModel, apiKey: e.target.value})}
                        placeholder="sk-..."
                        className="w-full bg-[#050505] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 uppercase font-bold">Base URL (Para Ollama / LM Studio ou OpenRouter)</label>
                    <input 
                      type="text" 
                      value={editingModel.apiUrl || ''}
                      onChange={e => setEditingModel({...editingModel, apiUrl: e.target.value})}
                      placeholder="http://localhost:1234/v1"
                      className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold">RPM Máximo (Req/Min)</label>
                      <input 
                        type="number" 
                        value={editingModel.rateLimit.maxReqPerMinute}
                        onChange={e => setEditingModel({
                          ...editingModel,
                          rateLimit: { ...editingModel.rateLimit, maxReqPerMinute: parseInt(e.target.value) || 60 }
                        })}
                        className="w-full bg-[#050505] border border-emerald-500/30 text-emerald-400 font-bold rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 uppercase font-bold">RPD Máximo (Req/Dia)</label>
                      <input 
                        type="number" 
                        value={editingModel.rateLimit.maxReqPerDay}
                        onChange={e => setEditingModel({
                          ...editingModel,
                          rateLimit: { ...editingModel.rateLimit, maxReqPerDay: parseInt(e.target.value) || 10000 }
                        })}
                        className="w-full bg-[#050505] border border-cyan-500/30 text-cyan-400 font-bold rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingModel.isActive}
                        onChange={e => setEditingModel({...editingModel, isActive: e.target.checked})}
                        className="rounded bg-[#050505] border-white/20 text-emerald-500 focus:ring-emerald-500" 
                      />
                      <span className="text-xs font-bold text-neutral-200">Modelo Ativo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingModel.isFallback}
                        onChange={e => setEditingModel({...editingModel, isFallback: e.target.checked})}
                        className="rounded bg-[#050505] border-white/20 text-amber-500 focus:ring-amber-500" 
                      />
                      <span className="text-xs font-bold text-neutral-200">Usar em Contingência (Fallback)</span>
                    </label>
                  </div>
                </div>
              )}

            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 flex items-center justify-between bg-[#050505]">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button 
                onClick={saveModel}
                className="bg-orange-500 hover:bg-orange-600 text-black px-6 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-orange-500/20"
              >
                <Save className="h-4 w-4" />
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
