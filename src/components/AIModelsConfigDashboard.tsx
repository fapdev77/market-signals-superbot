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
  X
} from 'lucide-react';
import { AIModelConfig, AIProvider } from '../types';



export const AIModelsConfigDashboard: React.FC<{ models: AIModelConfig[], onUpdateModels: (m: AIModelConfig[]) => void }> = ({ models, onUpdateModels }) => {
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToggleActive = (id: string) => {
    onUpdateModels(models.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  };

  const handleToggleFallback = (id: string) => {
    onUpdateModels(models.map(m => m.id === id ? { ...m, isFallback: !m.isFallback } : m));
  };

  const handleDelete = (id: string) => {
    if(confirm('Tem certeza que deseja remover este modelo?')) {
      onUpdateModels(models.filter(m => m.id !== id));
    }
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
    // Update priorities based on new order
    onUpdateModels(newModels.map((m, i) => ({ ...m, priority: i + 1 })));
  };

  const openAddModal = () => {
    setEditingModel({
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      provider: 'openrouter',
      modelId: '',
      isActive: true,
      isFallback: false,
      priority: models.length + 1,
      rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 1000 },
      parameters: { temperature: 0.2, maxTokens: 4096 }
    });
    setIsModalOpen(true);
  };

  const openEditModal = (model: AIModelConfig) => {
    setEditingModel({ ...model });
    setIsModalOpen(true);
  };

  const saveModel = () => {
    if (!editingModel) return;
    
    const isExisting = models.some(m => m.id === editingModel.id);
    if (isExisting) {
      onUpdateModels(models.map(m => m.id === editingModel.id ? editingModel : m));
    } else {
      onUpdateModels([...models, editingModel]);
    }
    setIsModalOpen(false);
  };

  const providerColors: Record<string, string> = {
    gemini: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    openai: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    openrouter: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    anthropic: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    local: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto font-mono pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-orange-400" />
            Configuração de Modelos LLM
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gerencie múltiplos provedores, rate limits e sistema automático de Fallback
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded font-bold text-xs flex items-center gap-2 transition shadow-md shadow-orange-500/20"
        >
          <Plus className="h-4 w-4" />
          Adicionar Modelo
        </button>
      </div>

      {/* Models List */}
      <div className="space-y-3">
        {models.map((model, index) => (
          <div key={model.id} className={`bg-[#0A0A0A] border \${model.isActive ? 'border-white/10' : 'border-red-900/30'} p-4 rounded-lg shadow-xl flex flex-col md:flex-row items-start md:items-center gap-4 transition-all hover:border-white/20`}>
            
            {/* Priority & Status Controls */}
            <div className="flex items-center gap-2 md:flex-col md:gap-1">
              <button 
                onClick={() => movePriority(index, 'up')}
                disabled={index === 0}
                className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <div className="bg-[#050505] text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded border border-white/5">
                #{model.priority}
              </div>
              <button 
                onClick={() => movePriority(index, 'down')}
                disabled={index === models.length - 1}
                className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className={`font-bold text-sm \${model.isActive ? 'text-white' : 'text-neutral-500'}`}>{model.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider \${providerColors[model.provider] || 'text-neutral-400 bg-white/5 border-white/10'}`}>
                  {model.provider}
                </span>
                {model.isFallback && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider text-amber-400 bg-amber-500/10 border-amber-500/20 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Fallback
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-[10px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-neutral-500" />
                  ID: <span className="text-neutral-300 font-semibold">{model.modelId}</span>
                </div>
                {model.apiUrl && (
                  <div className="flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-neutral-500" />
                    URL: <span className="text-neutral-300">{model.apiUrl}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5 text-neutral-500" />
                  Temp: <span className="text-neutral-300">{model.parameters.temperature}</span> | MaxTok: <span className="text-neutral-300">{model.parameters.maxTokens}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-neutral-500" />
                  Limites: <span className="text-emerald-400 font-semibold">{model.rateLimit.maxReqPerMinute} RPM</span> / <span className="text-cyan-400 font-semibold">{model.rateLimit.maxReqPerDay} RPD</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto mt-4 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-white/5">
              <button
                onClick={() => handleToggleActive(model.id)}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded border transition-all flex items-center justify-center gap-1.5 \${
                  model.isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {model.isActive ? 'Ativo' : 'Inativo'}
              </button>
              <button
                onClick={() => handleToggleFallback(model.id)}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded border transition-all flex items-center justify-center gap-1.5 \${
                  model.isFallback 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
                }`}
                title="Ativar/Desativar como motor de contingência (Fallback)"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Fallback
              </button>
              <button
                onClick={() => openEditModal(model)}
                className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition"
                title="Editar"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && editingModel && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0A0A0A] z-10">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-orange-400" />
                {models.some(m => m.id === editingModel.id) ? 'Editar Modelo' : 'Adicionar Novo Modelo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Nome de Exibição</label>
                  <input 
                    type="text" 
                    value={editingModel.name}
                    onChange={e => setEditingModel({...editingModel, name: e.target.value})}
                    placeholder="Ex: Claude 3.5 Sonnet"
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                {/* Provider */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Provedor</label>
                  <select
                    value={editingModel.provider}
                    onChange={e => setEditingModel({...editingModel, provider: e.target.value as AIProvider})}
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="local">Local (LM Studio / Ollama)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Model ID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Model ID (API)</label>
                  <input 
                    type="text" 
                    value={editingModel.modelId}
                    onChange={e => setEditingModel({...editingModel, modelId: e.target.value})}
                    placeholder="Ex: anthropic/claude-3.5-sonnet"
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                {/* API Key */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                    API Key
                    <span className="text-neutral-600 font-normal">Opcional (se no .env)</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-2.5 top-2 h-4 w-4 text-neutral-500" />
                    <input 
                      type="password" 
                      value={editingModel.apiKey || ''}
                      onChange={e => setEditingModel({...editingModel, apiKey: e.target.value})}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-[#050505] border border-white/10 rounded pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* URL Custom / Local */}
              {(editingModel.provider === 'local' || editingModel.provider === 'openrouter') && (
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold flex items-center justify-between">
                    Base URL (Endpoint customizado)
                    <span className="text-neutral-600 font-normal">Padrão para provedor</span>
                  </label>
                  <input 
                    type="text" 
                    value={editingModel.apiUrl || ''}
                    onChange={e => setEditingModel({...editingModel, apiUrl: e.target.value})}
                    placeholder="http://localhost:1234/v1"
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                {/* Rate Limits */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">RPM Máximo</label>
                  <input 
                    type="number" 
                    value={editingModel.rateLimit.maxReqPerMinute}
                    onChange={e => setEditingModel({...editingModel, rateLimit: { ...editingModel.rateLimit, maxReqPerMinute: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-[#050505] border border-emerald-500/30 text-emerald-400 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Req/Dia Máx</label>
                  <input 
                    type="number" 
                    value={editingModel.rateLimit.maxReqPerDay}
                    onChange={e => setEditingModel({...editingModel, rateLimit: { ...editingModel.rateLimit, maxReqPerDay: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-[#050505] border border-cyan-500/30 text-cyan-400 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {/* Params */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Temperatura</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="2"
                    value={editingModel.parameters.temperature}
                    onChange={e => setEditingModel({...editingModel, parameters: { ...editingModel.parameters, temperature: parseFloat(e.target.value) || 0 }})}
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-bold">Max Tokens</label>
                  <input 
                    type="number" 
                    value={editingModel.parameters.maxTokens}
                    onChange={e => setEditingModel({...editingModel, parameters: { ...editingModel.parameters, maxTokens: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-[#050505] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={editingModel.isActive}
                    onChange={e => setEditingModel({...editingModel, isActive: e.target.checked})}
                    className="form-checkbox text-emerald-500 rounded bg-[#050505] border-white/20 focus:ring-emerald-500 focus:ring-offset-[#0A0A0A]" 
                  />
                  <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition">Modelo Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={editingModel.isFallback}
                    onChange={e => setEditingModel({...editingModel, isFallback: e.target.checked})}
                    className="form-checkbox text-amber-500 rounded bg-[#050505] border-white/20 focus:ring-amber-500 focus:ring-offset-[#0A0A0A]" 
                  />
                  <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition">Permitir Fallback Automático</span>
                </label>
              </div>

            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-[#050505] rounded-b-xl">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button 
                onClick={saveModel}
                className="bg-orange-500 hover:bg-orange-600 text-black px-6 py-2 rounded font-bold text-xs flex items-center gap-2 transition shadow-md shadow-orange-500/20"
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
