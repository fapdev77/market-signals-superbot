import React, { useState } from 'react';
import { TradeSignal, TickerData, AIReviewResponse } from '../types';
import { Zap, TrendingUp, TrendingDown, Brain, RefreshCw, ShieldCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SignalsMatrixProps {
  signals: TradeSignal[];
  tickers: TickerData[];
  onRequestAIReview: (ticker: TickerData) => void;
}

export const SignalsMatrix: React.FC<SignalsMatrixProps> = ({
  signals = [],
  tickers = [],
  onRequestAIReview
}) => {
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED'>('ALL');
  const [selectedAIReview, setSelectedAIReview] = useState<AIReviewResponse | null>(null);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  const filteredSignals = (signals || []).filter(s => {
    if (!s) return false;
    if (directionFilter !== 'ALL' && s.direction !== directionFilter) return false;
    if (validationFilter === 'CONFIRMED' && s.validationStatus !== 'CONFIRMED') return false;
    if (validationFilter === 'PENDING' && s.validationStatus !== 'PENDING_VALIDATION') return false;
    if (validationFilter === 'REJECTED' && s.validationStatus !== 'REJECTED_SPIKE') return false;
    return true;
  });

  const handleRunAIReview = (symbol: string) => {
    const ticker = tickers.find(t => t.symbol === symbol);
    if (ticker && onRequestAIReview) {
      onRequestAIReview(ticker);
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Header & Filter Bar */}
      <div className="bg-[#0A0A0A] p-3.5 rounded-lg border border-white/10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-extrabold text-white">Matriz de Sinais & Filtro Anti-Spike (1m & 5m)</h2>
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Validação de sustentação de 1 min + confirmação de tendência de 5 min para eliminar falsos rompimentos.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full xl:w-auto">
          {/* Validation Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/5">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-1">Validação:</span>
            <button
              onClick={() => setValidationFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                validationFilter === 'ALL' ? 'bg-orange-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({signals.length})
            </button>
            <button
              onClick={() => setValidationFilter('CONFIRMED')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                validationFilter === 'CONFIRMED' ? 'bg-emerald-500 text-black font-extrabold' : 'text-emerald-400 hover:text-white'
              }`}
            >
              ✓ Confirmados
            </button>
            <button
              onClick={() => setValidationFilter('PENDING')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                validationFilter === 'PENDING' ? 'bg-amber-500 text-black font-extrabold' : 'text-amber-400 hover:text-white'
              }`}
            >
              ⏳ Em Validação 1m/5m
            </button>
            <button
              onClick={() => setValidationFilter('REJECTED')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                validationFilter === 'REJECTED' ? 'bg-rose-500 text-white font-extrabold' : 'text-rose-400 hover:text-white'
              }`}
            >
              ✕ Spikes Rejeitados
            </button>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/5">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-1">Lado:</span>
            <button
              onClick={() => setDirectionFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                directionFilter === 'ALL' ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Ambos
            </button>
            <button
              onClick={() => setDirectionFilter('LONG')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                directionFilter === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-neutral-400'
              }`}
            >
              LONG
            </button>
            <button
              onClick={() => setDirectionFilter('SHORT')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                directionFilter === 'SHORT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'text-neutral-400'
              }`}
            >
              SHORT
            </button>
          </div>
        </div>
      </div>

      {/* AI Review Modal / Card Header if Active */}
      {selectedAIReview && (
        <div className="bg-[#0A0A0A] border border-orange-500/50 rounded-lg p-4 shadow-2xl relative">
          <button
            onClick={() => setSelectedAIReview(null)}
            className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xs font-bold bg-neutral-900 h-6 w-6 rounded flex items-center justify-center border border-white/10"
          >
            ✕
          </button>

          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-1.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/30">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">
                  Revisão IA — {selectedAIReview.symbol}
                </h3>
                <span className="text-[9px] bg-orange-500/20 text-orange-400 font-bold px-1.5 py-0.5 rounded border border-orange-500/30">
                  {selectedAIReview.modelUsed}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">Auditoria quantitativa do setup de trade</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Decisão IA</span>
              <span className={`text-sm font-black ${
                selectedAIReview.decision === 'CONFIRM' ? 'text-emerald-400' : selectedAIReview.decision === 'ADJUST' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {selectedAIReview.decision === 'CONFIRM' ? '✓ CONFIRMADO' : selectedAIReview.decision === 'ADJUST' ? '⚠ AJUSTADO' : '✗ REJEITADO'}
              </span>
            </div>

            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Entrada Recomendada</span>
              <span className="text-xs font-bold text-orange-400">
                ${(selectedAIReview.entryZone?.[0] ?? 0).toFixed(2)} - ${(selectedAIReview.entryZone?.[1] ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Confiança IA</span>
              <span className="text-sm font-black text-emerald-400">
                {selectedAIReview.confidenceScore}%
              </span>
            </div>
          </div>

          <div className="bg-[#050505] p-3 rounded border border-white/5 text-xs text-neutral-300 leading-relaxed mb-2.5">
            <strong className="text-orange-400 block mb-1">Raciocínio do Trader IA:</strong>
            {selectedAIReview.reasoning}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300 pt-2 border-t border-white/10">
            <span>Stop Loss: <strong className="text-rose-400">${(selectedAIReview.stopLoss ?? 0).toFixed(2)}</strong></span>
            <span>Alvo 1: <strong className="text-emerald-400">${(selectedAIReview.takeProfit1 ?? 0).toFixed(2)}</strong></span>
            <span>Alvo 2: <strong className="text-emerald-400">${(selectedAIReview.takeProfit2 ?? 0).toFixed(2)}</strong></span>
          </div>
        </div>
      )}

      {/* Signals List / Cards */}
      <div className="space-y-3">
        {filteredSignals.length === 0 ? (
          <div className="bg-[#0A0A0A] p-6 rounded-lg border border-white/10 text-center text-neutral-400 text-xs">
            Nenhum sinal ativo no momento. Monitorando confluências de mercado...
          </div>
        ) : (
          filteredSignals.map((s) => {
            const isLong = s.direction === 'LONG';
            const curPrice = s.currentPrice ?? 0;
            const entry0 = s.entryZone?.[0] ?? 0;
            const entry1 = s.entryZone?.[1] ?? 0;
            const stop = s.stopLoss ?? 0;
            const target = s.target1 ?? 0;

            return (
              <div
                key={s.id}
                className={`bg-[#0A0A0A] rounded-lg border p-3 hover:border-neutral-700 transition shadow-md relative overflow-hidden ${
                  s.validationStatus === 'CONFIRMED'
                    ? 'border-emerald-500/30'
                    : s.validationStatus === 'REJECTED_SPIKE'
                    ? 'border-rose-500/30 opacity-75'
                    : 'border-amber-500/30'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                  {/* Left Info Column */}
                  <div className="space-y-1.5 w-full lg:w-1/3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">{s.symbol}</h3>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center gap-1 ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {s.direction} ({s.signalType})
                      </span>

                      <span className="bg-neutral-900 text-orange-400 text-[10px] px-2 py-0.5 rounded border border-white/5 font-extrabold">
                        {s.confluenceScore}% CONFLUÊNCIA
                      </span>
                    </div>

                    {/* Validation Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {s.validationStatus === 'CONFIRMED' && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          VALIDADO (1m Sustentado + 5m Tendência)
                        </span>
                      )}

                      {s.validationStatus === 'PENDING_VALIDATION' && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold flex items-center gap-1 animate-pulse">
                          <Clock className="h-3 w-3" />
                          EM VALIDAÇÃO (Aguardando 1m/5m)
                        </span>
                      )}

                      {s.validationStatus === 'REJECTED_SPIKE' && (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          SPIKE REJEITADO (Falso Rompimento)
                        </span>
                      )}
                    </div>

                    {s.validationStage && (
                      <p className="text-[9px] text-neutral-400 italic">
                        ↳ {s.validationStage}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1 pt-1">
                      {(s.confluenceFactors || []).map((f, idx) => (
                        <span key={idx} className="text-[9px] bg-[#050505] text-neutral-300 px-1.5 py-0.5 rounded border border-white/5">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Middle Order Parameters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-1/2 bg-[#050505] p-2 rounded border border-white/5 text-[10px]">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Preço Atual</span>
                      <span className="font-extrabold text-white">${curPrice.toFixed(curPrice < 1 ? 4 : 2)}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Zona de Entrada</span>
                      <span className="font-bold text-orange-400">
                        ${entry0.toFixed(entry0 < 1 ? 4 : 2)} - ${entry1.toFixed(entry1 < 1 ? 4 : 2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-rose-400 uppercase block font-bold">Stop Loss</span>
                      <span className="font-extrabold text-rose-400">${stop.toFixed(stop < 1 ? 4 : 2)}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-emerald-400 uppercase block font-bold">Alvo 1 (1:{s.riskRewardRatio || '2.0'})</span>
                      <span className="font-extrabold text-emerald-400">${target.toFixed(target < 1 ? 4 : 2)}</span>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="w-full lg:w-auto flex items-center justify-end">
                    <button
                      onClick={() => handleRunAIReview(s.symbol)}
                      disabled={loadingSymbol === s.symbol}
                      className="w-full lg:w-auto px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingSymbol === s.symbol ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Auditando...
                        </>
                      ) : (
                        <>
                          <Brain className="h-3.5 w-3.5" />
                          Auditar com IA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
