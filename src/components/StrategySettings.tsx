import React, { useState, useEffect } from 'react';
import { IndicatorWeights, StrategyCategory, StrategyKey, StrategyConfigItem, TradeSignal, TickerData } from '../types';
import { StrategyAutoTuner } from './StrategyAutoTuner';
import { 
  ALL_STRATEGY_KEYS, 
  STRATEGY_PRESETS, 
  getDefaultStrategyConfigs, 
  configToWeights 
} from '../constants/strategyPresets';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  Zap, 
  Activity, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  X,
  Layers,
  ArrowRight,
  Check,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Tooltip } from './Tooltip';

interface StrategySettingsProps {
  weights: IndicatorWeights;
  onSaveWeights: (newWeights: IndicatorWeights, scope?: 'ALL_FUTURE' | 'RESET_AND_RESCAN' | 'RESET_ALL_AND_RESCAN') => void;
  signals?: TradeSignal[];
  tickers?: TickerData[];
}

const PRESET_METRICS: Record<StrategyKey, {
  label: string;
  category: StrategyCategory;
  timeframe: string;
  targetRR: string;
  stopLossEst: string;
  description: string;
  icon: string;
}> = {
  scalp: {
    label: 'Scalp & Micro',
    category: 'SCALP',
    timeframe: '5m',
    targetRR: '1.5x',
    stopLossEst: '0.6% ~ 1.2%',
    description: 'Foco em agilidade, desbalanço de CVD, micro-absorções e Order Blocks curtos (5m). Ideal para operações rápidas de minutos.',
    icon: '⚡'
  },
  daytrade: {
    label: 'Day Trade (POIs)',
    category: 'DAY_TRADE',
    timeframe: '15m',
    targetRR: '2.0x',
    stopLossEst: '1.2% ~ 2.2%',
    description: 'Mais filtrado que scalp, foco em POIs fortes (Points of Interest), Fair Value Gaps e confluência de volume em 15m.',
    icon: '🎯'
  },
  intraday: {
    label: 'Intraday Flex',
    category: 'INTRADAY',
    timeframe: '30m',
    targetRR: '2.5x',
    stopLossEst: '1.8% ~ 3.2%',
    description: 'Equilíbrio padrão do robô. Combina POC diária de 24h, Funding Rate e Golden Pocket de Fibonacci em 30m.',
    icon: '⚖️'
  },
  swing: {
    label: 'Swing Trade',
    category: 'SWING',
    timeframe: '1h',
    targetRR: '3.5x',
    stopLossEst: '3.0% ~ 5.5%',
    description: 'Operações de médio prazo. Busca capturar reversões e expansões maiores alinhadas à POC semanal e Fibo macro.',
    icon: '🌊'
  },
  position: {
    label: 'Position Macro',
    category: 'POSITION',
    timeframe: '4h',
    targetRR: '5.0x',
    stopLossEst: '5.0% ~ 8.0%',
    description: 'Estratégia institucional de longo prazo. Foco extremo em suporte/resistência macro e grandes desbalanços de Open Interest.',
    icon: '🏛️'
  },
  custom: {
    label: 'Personalizado',
    category: 'CUSTOM',
    timeframe: 'Manual',
    targetRR: 'Manual',
    stopLossEst: 'Variável',
    description: 'Ajuste manual e fino de cada um dos 7 indicadores quantitativos e do Perfil de Volume TPO.',
    icon: '🛠️'
  }
};

export const StrategySettings: React.FC<StrategySettingsProps> = ({
  weights,
  onSaveWeights,
  signals = [],
  tickers = []
}) => {
  const [formWeights, setFormWeights] = useState<IndicatorWeights>(weights);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAutoTuner, setShowAutoTuner] = useState(true);
  const [activePreset, setActivePreset] = useState<StrategyKey>(
    weights.activeStrategy || 'intraday'
  );

  // Multi-Strategy Mode state
  const [multiStrategyMode, setMultiStrategyMode] = useState<boolean>(
    weights.multiStrategyMode !== false
  );
  const [enabledStrategies, setEnabledStrategies] = useState<StrategyKey[]>(
    weights.enabledStrategies && weights.enabledStrategies.length > 0
      ? weights.enabledStrategies
      : ALL_STRATEGY_KEYS
  );
  const [strategyConfigs, setStrategyConfigs] = useState<Record<string, StrategyConfigItem>>(
    weights.strategyConfigs || getDefaultStrategyConfigs()
  );

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [chosenScope, setChosenScope] = useState<'ALL_FUTURE' | 'RESET_AND_RESCAN' | 'RESET_ALL_AND_RESCAN'>('ALL_FUTURE');
  const [isApplying, setIsApplying] = useState(false);

  // Track if initial state from backend has been loaded
  const hasInitializedRef = React.useRef(false);

  // Only synchronize on initial mount or when backend weights arrive for the first time
  useEffect(() => {
    if (!hasInitializedRef.current) {
      if (weights.activeStrategy) {
        setActivePreset(weights.activeStrategy);
      }
      if (typeof weights.multiStrategyMode === 'boolean') {
        setMultiStrategyMode(weights.multiStrategyMode);
      }
      if (weights.enabledStrategies && weights.enabledStrategies.length > 0) {
        setEnabledStrategies(weights.enabledStrategies);
      }
      if (weights.strategyConfigs && Object.keys(weights.strategyConfigs).length > 0) {
        setStrategyConfigs(weights.strategyConfigs);
      }
      setFormWeights(weights);
      hasInitializedRef.current = true;
    }
  }, [weights]);

  // Handle toggling strategy in multi-strategy execution pool with immediate persistence
  const handleToggleStrategy = async (key: StrategyKey) => {
    if (key === 'custom') return;

    const exists = enabledStrategies.includes(key);
    if (exists && enabledStrategies.length <= 1) {
      return; // Keep at least one active
    }

    const nextEnabled = exists
      ? enabledStrategies.filter(k => k !== key)
      : [...enabledStrategies, key];

    const currentCfg = strategyConfigs[key] || STRATEGY_PRESETS[key as Exclude<StrategyKey, 'custom'>];
    const nextConfigs: Record<string, StrategyConfigItem> = {
      ...strategyConfigs,
      [key]: {
        ...currentCfg,
        enabled: !exists
      }
    };

    setEnabledStrategies(nextEnabled);
    setStrategyConfigs(nextConfigs);

    // Immediately persist toggle to the engine so polling doesn't revert it
    const updatedPayload: IndicatorWeights = {
      ...formWeights,
      activeStrategy: activePreset,
      strategyLabel: PRESET_METRICS[activePreset]?.label || 'Personalizado',
      multiStrategyMode,
      enabledStrategies: nextEnabled,
      strategyConfigs: nextConfigs
    };

    try {
      await onSaveWeights(updatedPayload, 'ALL_FUTURE');
    } catch (err) {
      console.error('Failed to auto-save strategy toggle:', err);
    }
  };

  // Handle toggling multi-strategy mode with immediate persistence
  const handleToggleMultiMode = async () => {
    const nextMode = !multiStrategyMode;
    setMultiStrategyMode(nextMode);

    const updatedPayload: IndicatorWeights = {
      ...formWeights,
      activeStrategy: activePreset,
      strategyLabel: PRESET_METRICS[activePreset]?.label || 'Personalizado',
      multiStrategyMode: nextMode,
      enabledStrategies,
      strategyConfigs
    };

    try {
      await onSaveWeights(updatedPayload, 'ALL_FUTURE');
    } catch (err) {
      console.error('Failed to auto-save multi-strategy mode:', err);
    }
  };

  // Switch which strategy is actively being inspected/customized in the sliders
  const selectStrategyForEdit = (key: StrategyKey) => {
    setActivePreset(key);
    if (key === 'custom') {
      return;
    }

    const cfg = strategyConfigs[key] || STRATEGY_PRESETS[key as Exclude<StrategyKey, 'custom'>];
    if (cfg) {
      const w = configToWeights(cfg);
      setFormWeights(prev => ({
        ...prev,
        ...w,
        activeStrategy: key,
        strategyLabel: PRESET_METRICS[key]?.label || cfg.label
      }));
    }
  };

  const handleSliderChange = (key: keyof IndicatorWeights, val: number) => {
    setFormWeights(prev => {
      const updated = { ...prev, [key]: val };
      
      // Also update strategyConfigs for the currently edited strategy
      if (activePreset !== 'custom') {
        const currentCfg = strategyConfigs[activePreset] || STRATEGY_PRESETS[activePreset as Exclude<StrategyKey, 'custom'>];
        if (currentCfg) {
          setStrategyConfigs(cfgPrev => ({
            ...cfgPrev,
            [activePreset]: {
              ...currentCfg,
              [key]: val
            }
          }));
        }
      }
      return updated;
    });
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultStrategyConfigs();
    setStrategyConfigs(defaults);
    setEnabledStrategies(ALL_STRATEGY_KEYS);
    setMultiStrategyMode(true);
    selectStrategyForEdit('intraday');
  };

  const handleOpenConfirm = () => {
    setShowConfirmModal(true);
  };

  const handleExecuteSave = async () => {
    setIsApplying(true);
    const updatedPayload: IndicatorWeights = {
      ...formWeights,
      activeStrategy: activePreset,
      strategyLabel: PRESET_METRICS[activePreset]?.label || 'Personalizado',
      multiStrategyMode,
      enabledStrategies,
      strategyConfigs
    };

    try {
      await onSaveWeights(updatedPayload, chosenScope);
      setShowConfirmModal(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } finally {
      setIsApplying(false);
    }
  };

  const currentBackendStrategy = weights.activeStrategy || 'intraday';
  const backendMetric = PRESET_METRICS[currentBackendStrategy] || PRESET_METRICS.intraday;
  const isDirty = activePreset !== currentBackendStrategy || 
                  multiStrategyMode !== (weights.multiStrategyMode !== false) ||
                  enabledStrategies.length !== (weights.enabledStrategies?.length || 5);

  const totalPoints = (formWeights.volumeSurgeWeight || 0) + 
                      (formWeights.openInterestWeight || 0) + 
                      (formWeights.fundingRateWeight || 0) + 
                      (formWeights.cvdImbalanceWeight || 0) + 
                      (formWeights.fibonacciZoneWeight || 0) + 
                      (formWeights.rangePocWeight || 0) + 
                      (formWeights.supportResistanceWeight || 0);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto font-mono">
      {/* Strategy Auto-Tuning Utility (Sharpe Ratio Optimizer) */}
      <StrategyAutoTuner
        currentWeights={formWeights}
        historicalSignals={signals}
        tickers={tickers}
        onApplyWeights={(newWeights) => {
          setFormWeights(prev => ({
            ...prev,
            ...newWeights,
            activeStrategy: 'custom',
            strategyLabel: 'Otimizado (Sharpe Pro)'
          }));
          setActivePreset('custom');
          onSaveWeights({
            ...formWeights,
            ...newWeights,
            activeStrategy: 'custom',
            strategyLabel: 'Otimizado (Sharpe Pro)'
          }, 'ALL_FUTURE');
        }}
      />

      {/* Live Engine Status Banner */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-cyan-500/30 shadow-xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-full w-48 bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/30 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] uppercase font-bold text-neutral-400">Modo de Operação do Motor:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-black uppercase border ${
                  multiStrategyMode 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  {multiStrategyMode 
                    ? `MULTI-ESTRATÉGIA CONCORRENTE (${enabledStrategies.length} ATIVAS EM PARALELO)`
                    : `ESTRATÉGIA ÚNICA: ${backendMetric.label}`}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 mt-1">
                {multiStrategyMode
                  ? 'O robô analisa todas as estratégias habilitadas simultaneamente em cada tick. Um par pode ter sinais simultâneos em Scalp, Day Trade e Swing sem interferência mútua.'
                  : backendMetric.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleMultiMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-xs transition cursor-pointer ${
                multiStrategyMode
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 hover:bg-cyan-500/20'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {multiStrategyMode ? <ToggleRight className="h-4 w-4 text-cyan-400" /> : <ToggleLeft className="h-4 w-4 text-neutral-400" />}
              <span>{multiStrategyMode ? 'Modo Multi-Estratégia ON' : 'Modo Estratégia Única'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Category Concurrency Notice */}
        <div className="flex items-start gap-2.5 text-[11px] text-neutral-400 bg-white/[0.02] p-2.5 rounded border border-white/5">
          <Layers className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="text-neutral-200">Isolamento Completo & Execução Paralela: </strong>
            <span>
              Cada estratégia possui seu próprio timeframe analítico (5m, 15m, 30m, 1h, 4h), Stop Loss adaptativo e relação R:R. 
              As chamadas de klines utilizam cache inteligente para máxima velocidade sem atingir limites de taxa da Binance.
            </span>
          </div>
        </div>
      </div>

      {/* Strategies Grid Panel */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <Sliders className="h-4 w-4 text-orange-400" />
              Estratégias Disponíveis para Execução Concorrente
            </h3>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Ative ou desative as estratégias que o robô deve processar simultaneamente e selecione qualquer uma para ajustar seus pesos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Alterações pendentes de gravação
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/30">
              {enabledStrategies.length} de {ALL_STRATEGY_KEYS.length} ativas
            </span>
          </div>
        </div>

        {/* 5 Strategy Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ALL_STRATEGY_KEYS.map((key) => {
            const meta = PRESET_METRICS[key];
            const isEnabled = enabledStrategies.includes(key);
            const isEditing = activePreset === key;
            const cfg = strategyConfigs[key] || STRATEGY_PRESETS[key as Exclude<StrategyKey, 'custom'>];

            return (
              <div
                key={key}
                className={`p-3 rounded-lg border transition flex flex-col justify-between gap-3 relative ${
                  isEditing
                    ? 'bg-cyan-950/30 border-cyan-400/80 shadow-md shadow-cyan-500/10'
                    : isEnabled
                      ? 'bg-neutral-900/80 border-neutral-700/80 hover:border-neutral-600'
                      : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                }`}
              >
                {/* Header & Toggle Checkbox */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <div>
                      <h4 className="text-xs font-black text-white">{meta.label}</h4>
                      <span className="text-[9px] text-cyan-400 font-bold">{meta.timeframe} • Alvo {cfg?.minRiskRewardRatio ? `${cfg.minRiskRewardRatio}x` : meta.targetRR}</span>
                    </div>
                  </div>

                  {/* Toggle Button for Multi-Strategy Pool */}
                  <Tooltip
                    position="bottom-left"
                    title={isEnabled ? `Desativar ${meta.label}` : `Ativar ${meta.label}`}
                    badge={isEnabled ? 'ATIVADA' : 'DESATIVADA'}
                    content={
                      isEnabled
                        ? 'Esta estratégia está ativada e sendo avaliada para todos os pares a cada tick de mercado. Clique para desativá-la.'
                        : 'Esta estratégia está desativada. O robô não gerará novos sinais para este timeframe. Clique para ativá-la.'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStrategy(key)}
                      className={`h-5 w-5 rounded flex items-center justify-center border transition cursor-pointer ${
                        isEnabled
                          ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                          : 'bg-neutral-800 border-neutral-700 text-transparent hover:border-neutral-500'
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${isEnabled ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </Tooltip>
                </div>

                {/* Body Details */}
                <p className="text-[10px] text-neutral-400 leading-tight">
                  {meta.description}
                </p>

                {/* Footer Status & Edit Trigger */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-[9px]">
                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                    isEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}>
                    {isEnabled ? 'Rodando' : 'Pausada'}
                  </span>

                  <button
                    type="button"
                    onClick={() => selectStrategyForEdit(key)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      isEditing
                        ? 'bg-cyan-500 text-black shadow'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    {isEditing ? 'Editando' : 'Ajustar Pesos'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sliders & Fine Tuning Box for Selected Strategy */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold uppercase">
              Pesos Quantitativos para:
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/30">
              {PRESET_METRICS[activePreset]?.label || activePreset.toUpperCase()} ({formWeights.volumeProfileTimeframe || PRESET_METRICS[activePreset]?.timeframe || '30m'})
            </span>
          </div>
          <span className="text-orange-400 font-extrabold">Pontuação Total: {totalPoints} pts</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CVD Imbalance */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">CVD (Delta Acumulado) Imbalance</span>
              <span className="text-orange-400 font-extrabold">{formWeights.cvdImbalanceWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.cvdImbalanceWeight}
              onChange={(e) => handleSliderChange('cvdImbalanceWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Avalia o fluxo agressor de mercado (compras taker vs vendas taker).</p>
          </div>

          {/* Open Interest */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Acúmulo de Open Interest (OI)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.openInterestWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.openInterestWeight}
              onChange={(e) => handleSliderChange('openInterestWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Entrada de posições institucionais em contratos futuros.</p>
          </div>

          {/* Fibonacci Golden Pocket */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Zona Golden Pocket Fibo (0.618 - 0.68)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.fibonacciZoneWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.fibonacciZoneWeight}
              onChange={(e) => handleSliderChange('fibonacciZoneWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Região técnica chave para retração e melhor relação risco/retorno.</p>
          </div>

          {/* Volume Surge */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Volume Anômalo (Surge vs Média)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.volumeSurgeWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.volumeSurgeWeight}
              onChange={(e) => handleSliderChange('volumeSurgeWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Volume 200% ou mais acima da média móvel de 20 períodos.</p>
          </div>

          {/* Funding Rate */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Funding Rate Extremo</span>
              <span className="text-orange-400 font-extrabold">{formWeights.fundingRateWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.fundingRateWeight}
              onChange={(e) => handleSliderChange('fundingRateWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Desequilíbrio de sentimento entre longs e shorts (potencial de squeeze).</p>
          </div>

          {/* POC do Range */}
          <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Proximidade com POC do Range</span>
              <span className="text-orange-400 font-extrabold">{formWeights.rangePocWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.rangePocWeight}
              onChange={(e) => handleSliderChange('rangePocWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Preço testando o Point of Control de maior aceitação de valor.</p>
          </div>
        </div>

        {/* Relação Risco : Retorno Mínimo */}
        <div className="pt-2 border-t border-white/10 space-y-1 bg-[#050505] p-3 rounded border border-white/5">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-200 font-bold">Relação Risco:Retorno Mínima Requerida ({PRESET_METRICS[activePreset]?.label})</span>
            <span className="text-orange-400 font-extrabold">1 : {formWeights.minRiskRewardRatio.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="6.0"
            step="0.1"
            value={formWeights.minRiskRewardRatio}
            onChange={(e) => handleSliderChange('minRiskRewardRatio', parseFloat(e.target.value))}
            className="w-full accent-orange-500"
          />
          <p className="text-[10px] text-neutral-400">Descarta setups onde o primeiro alvo não atinja esse multiplicador do stop loss.</p>
        </div>

        {/* Volume Profile Configs */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Parâmetros de Perfil de Volume (TPO) para {PRESET_METRICS[activePreset]?.label}
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/30">
              {formWeights.volumeProfileTimeframe || '30m'} • {formWeights.volumeProfileCandles || 48} velas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Timeframe */}
            <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
              <span className="text-xs text-neutral-200 font-bold block">Timeframe do Perfil</span>
              <div className="grid grid-cols-3 gap-1 pt-1">
                {(['5m', '15m', '30m', '1h', '4h', '1d'] as const).map(tf => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => {
                      setFormWeights(prev => ({ ...prev, volumeProfileTimeframe: tf }));
                      if (activePreset !== 'custom') {
                        setStrategyConfigs(prev => ({
                          ...prev,
                          [activePreset]: {
                            ...prev[activePreset],
                            timeframe: tf
                          }
                        }));
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded border transition font-bold ${
                      (formWeights.volumeProfileTimeframe || '30m') === tf
                        ? 'bg-cyan-500 text-black border-cyan-400'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Velas */}
            <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-200 font-bold">Velas no Histórico</span>
                <span className="text-cyan-400 font-extrabold">{formWeights.volumeProfileCandles || 48}</span>
              </div>
              <input
                type="range"
                min="12"
                max="120"
                step="4"
                value={formWeights.volumeProfileCandles || 48}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFormWeights(prev => ({ ...prev, volumeProfileCandles: val }));
                  if (activePreset !== 'custom') {
                    setStrategyConfigs(prev => ({
                      ...prev,
                      [activePreset]: {
                        ...prev[activePreset],
                        candles: val
                      }
                    }));
                  }
                }}
                className="w-full accent-cyan-500"
              />
              <span className="text-[9px] text-neutral-500 block">
                Janela temporal analisada para cálculo de POC e Value Area.
              </span>
            </div>

            {/* Resolução */}
            <div className="space-y-1 bg-[#050505] p-3 rounded border border-white/5">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-200 font-bold">Resolução (Linhas de Preço)</span>
                <span className="text-cyan-400 font-extrabold">{formWeights.volumeProfileRange} bins</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={formWeights.volumeProfileRange}
                onChange={(e) => handleSliderChange('volumeProfileRange', parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <span className="text-[9px] text-neutral-500 block">
                Fatiamento vertical para distribuição de volume acumulado.
              </span>
            </div>
          </div>
        </div>

        {/* Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 rounded text-xs font-bold transition flex items-center gap-1.5 border border-white/5 w-full sm:w-auto justify-center cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrões de Fábrica
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-fade-in">
                <CheckCircle className="h-4 w-4" /> Configurações Atualizadas e Ativas!
              </span>
            )}
            <button
              onClick={handleOpenConfirm}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-orange-500/20 w-full sm:w-auto justify-center cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Salvar e Aplicar ao Motor
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation & Application Scope Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0D0D0D] border border-orange-500/30 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/30">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Aplicar Configuração ao Motor Quantitativo
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    {multiStrategyMode
                      ? `Modo Multi-Estratégia: ${enabledStrategies.length} estratégias ativas em paralelo`
                      : `Modo Único: ${PRESET_METRICS[activePreset]?.label}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-neutral-500 hover:text-white transition p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scope Selection Options */}
            <div className="space-y-2.5">
              <label 
                onClick={() => setChosenScope('ALL_FUTURE')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  chosenScope === 'ALL_FUTURE'
                    ? 'bg-orange-500/10 border-orange-500/40 text-white'
                    : 'bg-neutral-900/60 border-white/5 hover:bg-neutral-900 text-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="apply_scope"
                  checked={chosenScope === 'ALL_FUTURE'}
                  onChange={() => setChosenScope('ALL_FUTURE')}
                  className="mt-1 accent-orange-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">Aplicar para Novos Sinais (Recomendado)</span>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                      PRESERVA ATUAIS
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Mantém todos os sinais ativos existentes em andamento com seus respectivos stops e alvos. Novos sinais detectados a partir de agora utilizarão as estratégias configuradas.
                  </p>
                </div>
              </label>

              <label 
                onClick={() => setChosenScope('RESET_AND_RESCAN')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  chosenScope === 'RESET_AND_RESCAN'
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                    : 'bg-neutral-900/60 border-white/5 hover:bg-neutral-900 text-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="apply_scope"
                  checked={chosenScope === 'RESET_AND_RESCAN'}
                  onChange={() => setChosenScope('RESET_AND_RESCAN')}
                  className="mt-1 accent-cyan-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">Reiniciar e Reanalisar Categoria Atual ({PRESET_METRICS[activePreset]?.label})</span>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-cyan-500/20 text-cyan-400">
                      RESCAN CATEGORIA
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Expira os sinais antigos desta categoria específica e força um novo escaneamento instantâneo em todos os pares da Binance com a estratégia <strong>{PRESET_METRICS[activePreset]?.label}</strong>. Sinais de outras categorias continuam preservados.
                  </p>
                </div>
              </label>

              <label 
                onClick={() => setChosenScope('RESET_ALL_AND_RESCAN')}
                className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition ${
                  chosenScope === 'RESET_ALL_AND_RESCAN'
                    ? 'bg-rose-500/10 border-rose-500/40 text-white'
                    : 'bg-neutral-900/60 border-white/5 hover:bg-neutral-900 text-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="apply_scope"
                  checked={chosenScope === 'RESET_ALL_AND_RESCAN'}
                  onChange={() => setChosenScope('RESET_ALL_AND_RESCAN')}
                  className="mt-1 accent-rose-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">Reiniciar TODAS as Categorias e Fazer Rescan Geral</span>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-rose-500/20 text-rose-400">
                      LIMPEZA TOTAL
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Expira todos os sinais ativos de todas as estratégias e recalcula imediatamente todo o mercado com as novas configurações em paralelo.
                  </p>
                </div>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isApplying}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 rounded-lg text-xs font-bold transition border border-white/5 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleExecuteSave}
                disabled={isApplying}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-black transition flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Aplicando ao Motor...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirmar e Aplicar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
