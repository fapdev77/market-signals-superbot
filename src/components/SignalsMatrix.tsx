import React, { useState } from 'react';
import { TradeSignal, TickerData, AIReviewResponse } from '../types';
import { formatPrice, formatPriceRange, calculateTradeMetrics } from '../utils/formatters';
import { Zap, TrendingUp, TrendingDown, Brain, RefreshCw, ShieldCheck, Clock, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';

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
        <div className="flex items-center gap-2 text-xs w-full xl:w-auto overflow-x-auto scrollbar-none pb-1 xl:pb-0">
          {/* Validation Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/5 shrink-0">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-1">Validação:</span>
            <button
              onClick={() => setValidationFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 ${
                validationFilter === 'ALL' ? 'bg-orange-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({signals.length})
            </button>
            <button
              onClick={() => setValidationFilter('CONFIRMED')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 ${
                validationFilter === 'CONFIRMED' ? 'bg-emerald-500 text-black font-extrabold' : 'text-emerald-400 hover:text-white'
              }`}
            >
              ✓ Confirmados
            </button>
            <button
              onClick={() => setValidationFilter('PENDING')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 ${
                validationFilter === 'PENDING' ? 'bg-amber-500 text-black font-extrabold' : 'text-amber-400 hover:text-white'
              }`}
            >
              ⏳ Em Validação
            </button>
            <button
              onClick={() => setValidationFilter('REJECTED')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 ${
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
                {formatPriceRange(selectedAIReview.entryZone?.[0], selectedAIReview.entryZone?.[1])}
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

          {(() => {
            const aiMetrics = calculateTradeMetrics({
              entry: selectedAIReview.entryZone,
              stopLoss: selectedAIReview.stopLoss,
              target1: selectedAIReview.takeProfit1,
              target2: selectedAIReview.takeProfit2,
              direction: selectedAIReview.recommendedDirection,
              currentPrice: 0
            });
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-300 pt-2 border-t border-white/10 bg-[#050505] p-2.5 rounded border border-white/5">
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Stop Loss (% Risco)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-rose-400">{formatPrice(selectedAIReview.stopLoss, { currency: true })}</strong>
                    <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded">-{aiMetrics.riskPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Alvo 1 (% Gain)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-emerald-400">{formatPrice(selectedAIReview.takeProfit1, { currency: true })}</strong>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+{aiMetrics.target1GainPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Alvo 2 (% Gain)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-emerald-400">{formatPrice(selectedAIReview.takeProfit2, { currency: true })}</strong>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+{aiMetrics.target2GainPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Ratio Risco : Retorno</span>
                  <strong className="text-orange-400 text-[11px]">1 : {aiMetrics.rrRatio1.toFixed(2)} (DT) / 1 : {aiMetrics.rrRatio2.toFixed(2)} (Swing)</strong>
                </div>
              </div>
            );
          })()}
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

                    {s.backtestWinRate && (
                      <span className={`px-2 py-0.5 border rounded text-[9px] font-bold flex items-center gap-1 w-max ${
                        s.backtestWinRate >= 60 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        <Activity className="h-3 w-3" />
                        Backtest WinRate: {s.backtestWinRate.toFixed(1)}%
                      </span>
                    )}
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
                  {(() => {
                    const metrics = calculateTradeMetrics({
                      entry: s.entryZone,
                      stopLoss: s.stopLoss,
                      target1: s.target1,
                      target2: s.target2,
                      direction: s.direction,
                      currentPrice: curPrice
                    });
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-1/2 bg-[#050505] p-2.5 rounded border border-white/5 text-[10px]">
                        <div>
                          <span className="text-[9px] text-neutral-500 uppercase block font-bold">Preço Atual / Zona</span>
                          <span className="font-extrabold text-white block">{formatPrice(curPrice, { currency: true })}</span>
                          <span className="text-[9px] font-bold text-orange-400">
                            {formatPriceRange(entry0, entry1)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-rose-400 uppercase block font-bold">Stop Loss (% Risco)</span>
                          <span className="font-extrabold text-rose-400 block">{formatPrice(stop, { currency: true })}</span>
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20 inline-block mt-0.5">
                            -{metrics.riskPct.toFixed(2)}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-emerald-400 uppercase block font-bold">Alvo 1 (R:R 1:{metrics.rrRatio1.toFixed(1)})</span>
                          <span className="font-extrabold text-emerald-400 block">{formatPrice(target, { currency: true })}</span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 inline-block mt-0.5">
                            +{metrics.target1GainPct.toFixed(2)}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-emerald-400 uppercase block font-bold">Alvo 2 (R:R 1:{metrics.rrRatio2.toFixed(1)})</span>
                          <span className="font-extrabold text-emerald-400 block">{formatPrice(s.target2, { currency: true })}</span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 inline-block mt-0.5">
                            +{metrics.target2GainPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

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
