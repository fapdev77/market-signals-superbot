import React, { useState, useMemo } from 'react';
import { IndicatorWeights, TradeSignal, TickerData, AutoTuneRunResult, AutoTuneCandidate, AutoTuneTargetObjective } from '../types';
import { runStrategyAutoTuning } from '../utils/strategyAutoTuning';
import { Tooltip } from './Tooltip';
import { 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Layers, 
  SlidersHorizontal, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight, 
  Gauge, 
  Scale, 
  Activity, 
  Target,
  Sliders,
  Check
} from 'lucide-react';

interface StrategyAutoTunerProps {
  currentWeights: IndicatorWeights;
  historicalSignals: TradeSignal[];
  tickers: TickerData[];
  onApplyWeights: (newWeights: IndicatorWeights) => void;
}

export const StrategyAutoTuner: React.FC<StrategyAutoTunerProps> = ({
  currentWeights,
  historicalSignals,
  tickers,
  onApplyWeights
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<AutoTuneRunResult | null>(() => {
    // Generate initial optimization state
    return runStrategyAutoTuning(currentWeights, historicalSignals, tickers);
  });
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('opt_max_sharpe');
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);
  const [autoTuneInterval, setAutoTuneInterval] = useState<'OFF' | '1H' | '4H' | '24H'>('OFF');

  const activeCandidate = useMemo(() => {
    if (!optimizationResult) return null;
    return optimizationResult.candidates.find(c => c.id === selectedCandidateId) || optimizationResult.bestCandidate;
  }, [optimizationResult, selectedCandidateId]);

  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setAppliedSuccessfully(false);
    setTimeout(() => {
      const result = runStrategyAutoTuning(currentWeights, historicalSignals, tickers);
      setOptimizationResult(result);
      setSelectedCandidateId(result.bestCandidate.id);
      setIsOptimizing(false);
    }, 650);
  };

  const handleApply = () => {
    if (!activeCandidate) return;
    onApplyWeights(activeCandidate.weights);
    setAppliedSuccessfully(true);
    setTimeout(() => setAppliedSuccessfully(false), 3000);
  };

  const currentMetrics = optimizationResult?.currentMetrics;

  return (
    <div className="bg-[#0A0B0E] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 space-y-6 font-mono text-xs shadow-2xl shadow-cyan-950/20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-cyan-500/40 text-cyan-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                Strategy Auto-Tuning Quantitativo
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                SHARPE OPTIMIZER
              </span>
            </div>
            <p className="text-neutral-400 text-xs">
              Algoritmo genético que calibra os pesos de confluência para maximizar o Sharpe Ratio e minimizar o Drawdown.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Periodic Auto-Tune Toggle */}
          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1.5 rounded-xl border border-white/10 text-[11px]">
            <span className="text-neutral-400 font-bold uppercase hidden sm:inline">Auto-Tuning Periódico:</span>
            <select
              value={autoTuneInterval}
              onChange={(e) => setAutoTuneInterval(e.target.value as any)}
              className="bg-transparent text-cyan-300 font-black focus:outline-none cursor-pointer"
            >
              <option value="OFF" className="bg-[#0A0B0E]">Desativado</option>
              <option value="1H" className="bg-[#0A0B0E]">A cada 1h</option>
              <option value="4H" className="bg-[#0A0B0E]">A cada 4h</option>
              <option value="24H" className="bg-[#0A0B0E]">A cada 24h (Recomendado)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleRunOptimizer}
            disabled={isOptimizing}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Otimizando Espaço de Pesos...' : 'Re-Otimizar Agora'}</span>
          </button>
        </div>
      </div>

      {/* Target Objective Preset Selector */}
      {optimizationResult && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-bold uppercase flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              Objetivo da Otimização:
            </span>
            <span className="text-neutral-500">
              {optimizationResult.analyzedSignalsCount} sinais analisados em {optimizationResult.optimizationDurationMs}ms
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {optimizationResult.candidates.map(cand => {
              const isSelected = cand.id === selectedCandidateId;

              return (
                <div
                  key={cand.id}
                  onClick={() => setSelectedCandidateId(cand.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/30'
                      : 'bg-neutral-900/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-black uppercase ${isSelected ? 'text-cyan-300' : 'text-neutral-300'}`}>
                      {cand.name}
                    </span>
                    {cand.id === optimizationResult.bestCandidate.id && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-black">
                        BEST SHARPE
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between my-1.5">
                    <div className="text-lg font-black text-white tabular-nums">
                      Sharpe {cand.metrics.sharpeRatio}
                    </div>
                    <div className="text-xs font-bold text-emerald-400 tabular-nums">
                      +{cand.improvementVsCurrent.sharpeDeltaPct}%
                    </div>
                  </div>

                  <div className="text-[10px] text-neutral-400 space-y-0.5 pt-1 border-t border-white/5">
                    <div className="flex justify-between">
                      <span>Win Rate:</span>
                      <strong className="text-white">{cand.metrics.winRate}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Drawdown:</span>
                      <strong className="text-rose-400">-{cand.metrics.maxDrawdownPct}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Metrics Comparison & Weights Breakdown */}
      {activeCandidate && currentMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Quantitative Metrics Diff (5 cols) */}
          <div className="lg:col-span-5 bg-neutral-900/50 p-4 rounded-xl border border-white/5 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-cyan-400" />
              Impacto Quantitativo: Atual vs Otimizado
            </h3>

            <div className="space-y-2.5">
              {/* Sharpe Ratio Card */}
              <div className="p-3 rounded-lg bg-black/50 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase block">Sharpe Ratio Anualizado</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-neutral-500 line-through text-sm tabular-nums">{currentMetrics.sharpeRatio}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-500" />
                    <span className="text-lg font-black text-cyan-400 tabular-nums">{activeCandidate.metrics.sharpeRatio}</span>
                  </div>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  +{activeCandidate.improvementVsCurrent.sharpeDeltaPct}%
                </span>
              </div>

              {/* Grid of Other Metrics */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] text-neutral-500 uppercase block">Win Rate</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-neutral-500 line-through text-xs tabular-nums">{currentMetrics.winRate}%</span>
                    <span className="text-white font-black text-sm tabular-nums">{activeCandidate.metrics.winRate}%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] text-neutral-500 uppercase block">Profit Factor</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-neutral-500 line-through text-xs tabular-nums">{currentMetrics.profitFactor}</span>
                    <span className="text-emerald-400 font-black text-sm tabular-nums">{activeCandidate.metrics.profitFactor}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] text-neutral-500 uppercase block">Max Drawdown</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-neutral-500 line-through text-xs tabular-nums">-{currentMetrics.maxDrawdownPct}%</span>
                    <span className="text-emerald-400 font-black text-sm tabular-nums">-{activeCandidate.metrics.maxDrawdownPct}%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] text-neutral-500 uppercase block">R:R Médio Mínimo</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-neutral-500 line-through text-xs tabular-nums">{currentWeights.minRiskRewardRatio}x</span>
                    <span className="text-amber-400 font-black text-sm tabular-nums">{activeCandidate.weights.minRiskRewardRatio}x</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Adjustments List */}
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Principais Reajustes Sugeridos:
              </span>
              {activeCandidate.keyChanges.map((change, i) => (
                <div key={i} className="text-[11px] text-neutral-300 flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold shrink-0">⚡</span>
                  <span>{change}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Weight Distribution Sliders/Bars & Actions (7 cols) */}
          <div className="lg:col-span-7 bg-neutral-900/50 p-4 rounded-xl border border-white/5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Distribuição de Pesos de Indicadores (%)
                </span>
                <span className="text-[10px] text-neutral-400">Total = 100%</span>
              </h3>

              {/* Weight Comparison Rows */}
              <div className="space-y-2">
                {[
                  { label: 'CVD Imbalance (Order Flow)', cur: currentWeights.cvdImbalanceWeight, nxt: activeCandidate.weights.cvdImbalanceWeight, color: 'bg-emerald-400' },
                  { label: 'Open Interest (Aporte Institucional)', cur: currentWeights.openInterestWeight, nxt: activeCandidate.weights.openInterestWeight, color: 'bg-cyan-400' },
                  { label: 'Volume Surge (R-Vol)', cur: currentWeights.volumeSurgeWeight, nxt: activeCandidate.weights.volumeSurgeWeight, color: 'bg-amber-400' },
                  { label: 'Fibonacci Zone / Golden Pocket', cur: currentWeights.fibonacciZoneWeight, nxt: activeCandidate.weights.fibonacciZoneWeight, color: 'bg-indigo-400' },
                  { label: 'Suporte & Resistência', cur: currentWeights.supportResistanceWeight, nxt: activeCandidate.weights.supportResistanceWeight, color: 'bg-purple-400' },
                  { label: 'Range POC (Point of Control)', cur: currentWeights.rangePocWeight, nxt: activeCandidate.weights.rangePocWeight, color: 'bg-blue-400' },
                  { label: 'Funding Rate', cur: currentWeights.fundingRateWeight, nxt: activeCandidate.weights.fundingRateWeight, color: 'bg-rose-400' },
                  { label: 'RSI Divergências', cur: currentWeights.rsiDivergenceWeight, nxt: activeCandidate.weights.rsiDivergenceWeight, color: 'bg-teal-400' }
                ].map(item => (
                  <div key={item.label} className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-neutral-300">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 tabular-nums">Atual: {item.cur}%</span>
                        <ArrowRight className="w-2.5 h-2.5 text-neutral-600" />
                        <strong className="text-cyan-300 tabular-nums font-black">Proposto: {item.nxt}%</strong>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.nxt}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[10px] text-neutral-400">
                Preset selecionado: <strong className="text-white">{activeCandidate.name}</strong>
              </span>

              <button
                type="button"
                onClick={handleApply}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                {appliedSuccessfully ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Pesos Atualizados com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Aplicar Pesos Otimizados na Estratégia</span>
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
