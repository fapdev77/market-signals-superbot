import React from 'react';
import { TickerData, DetectedChartPattern } from '../types';
import { formatPrice } from '../utils/formatters';
import { getPatternVisualBadgeTheme } from '../utils/aiPatternScanner';
import { 
  X, 
  Sparkles, 
  Target, 
  ShieldCheck, 
  Zap, 
  Flag, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  CheckCircle2, 
  ArrowRight,
  Gauge,
  Layers,
  BarChart3
} from 'lucide-react';

interface PatternInspectorModalProps {
  ticker: TickerData | null;
  pattern: DetectedChartPattern | null;
  onClose: () => void;
  onSelectTicker?: (ticker: TickerData) => void;
}

export const PatternInspectorModal: React.FC<PatternInspectorModalProps> = ({
  ticker,
  pattern,
  onClose,
  onSelectTicker
}) => {
  if (!ticker || !pattern) return null;

  const theme = getPatternVisualBadgeTheme(pattern);
  const isBullish = pattern.bias === 'BULLISH';
  const price = ticker.price || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div 
        className="bg-[#0D0D0D] border border-cyan-500/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl shadow-cyan-950/40 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}>
              {pattern.type.includes('FLAG') ? (
                <Flag className="w-5 h-5 text-current" />
              ) : pattern.type.includes('WEDGE') || pattern.type.includes('TRIANGLE') ? (
                <Zap className="w-5 h-5 text-current" />
              ) : isBullish ? (
                <TrendingUp className="w-5 h-5 text-current" />
              ) : (
                <TrendingDown className="w-5 h-5 text-current" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider">
                  Scanner de Padrões IA
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}>
                  {pattern.bias === 'BULLISH' ? '▲ ALTA' : '▼ BAIXA'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-500/30">
                  {pattern.stage.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-lg font-black text-white flex items-center gap-1.5">
                {pattern.name} • <span className="text-orange-400">{ticker.symbol}</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Diagnóstico Algorítmico
              </span>
              <span className="text-cyan-400 font-extrabold">
                Confiança: {pattern.confidence}%
              </span>
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed">
              {pattern.summary}
            </p>
            {/* Progress bar of AI confidence */}
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  pattern.confidence >= 80 ? 'bg-cyan-400' : 'bg-orange-400'
                }`}
                style={{ width: `${pattern.confidence}%` }}
              />
            </div>
          </div>

          {/* Key Targets & Price Action Geometry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-white/5">
              <span className="text-[10px] text-neutral-500 block uppercase">Preço Atual</span>
              <span className="font-extrabold text-white text-sm">
                {formatPrice(price, { currency: true })}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-white/5">
              <span className="text-[10px] text-cyan-400 block uppercase">Gatilho Rompimento</span>
              <span className="font-extrabold text-cyan-300 text-sm">
                {formatPrice(pattern.breakoutTriggerPrice, { currency: true })}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 block uppercase flex items-center gap-1">
                <Target className="w-3 h-3" />
                Alvo Técnico
              </span>
              <span className="font-extrabold text-emerald-300 text-sm">
                {formatPrice(pattern.measuredMoveTarget, { currency: true })}
              </span>
              <span className="text-[9px] text-emerald-500 block">
                {isBullish ? '+' : '-'}{pattern.targetGainPct}% ganho
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20">
              <span className="text-[10px] text-rose-400 block uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Stop Invalidação
              </span>
              <span className="font-extrabold text-rose-300 text-sm">
                {formatPrice(pattern.suggestedStopLoss, { currency: true })}
              </span>
              <span className="text-[9px] text-neutral-400 block">
                R:R de 1 : {pattern.riskRewardRatio}
              </span>
            </div>
          </div>

          {/* Technical Confluence Checklist */}
          <div className="space-y-2 p-3.5 rounded-xl bg-neutral-900/40 border border-white/5">
            <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              Confluências Técnicas Confirmadas
            </span>
            <div className="space-y-1.5">
              {pattern.technicalRationale.map((rat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{rat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Levels & Market Microstructure Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-[#080808] border border-white/5 space-y-1">
              <span className="text-[10px] text-neutral-500 block uppercase">Níveis de Estrutura</span>
              <p className="text-neutral-300 text-xs font-mono">{pattern.keyLevelsConfluence}</p>
            </div>

            <div className="p-3 rounded-lg bg-[#080808] border border-white/5 space-y-1">
              <span className="text-[10px] text-neutral-500 block uppercase">Delta Order Flow & Timeframe</span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Delta CVD:</span>
                <strong className={ticker.cvdDirection === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                  {ticker.cvdDirection === 'BUY' ? 'COMPRADOR' : ticker.cvdDirection === 'SELL' ? 'VENDEDOR' : 'NEUTRO'}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Tempo Gráfico:</span>
                <strong className="text-white">{pattern.timeframe}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-neutral-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            Padrão monitorado continuamente em tempo real pela esteira quantitativa.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition"
            >
              Fechar
            </button>

            {onSelectTicker && (
              <button
                type="button"
                onClick={() => {
                  onSelectTicker(ticker);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-95 cursor-pointer"
              >
                <span>Ver no Gráfico & IA</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
