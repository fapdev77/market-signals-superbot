import React from 'react';
// SDD Fase 9 / S4 — texto de divulgacao do modelo de custo.
import { TRADE_COST_DISCLOSURE } from '../utils/tradeCosts';
import { 
  Trophy, 
  TrendingUp, 
  Clock, 
  Percent, 
  Scale, 
  ShieldCheck, 
  Flame, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers,
  Activity,
  Zap,
  BarChart3,
  Award,
  AlertTriangle
} from 'lucide-react';
import { TradingInsightsSummary } from '../utils/tradeMetrics';
import { formatPercent, formatPrice } from '../utils/formatters';
import { Tooltip } from './Tooltip';

interface TradingInsightsProps {
  insights: TradingInsightsSummary;
  timeframeLabel?: string;
}

export const TradingInsights: React.FC<TradingInsightsProps> = ({
  insights,
  timeframeLabel = 'Últimos 7 dias'
}) => {
  const isPositivePnl = insights.totalPnlPct >= 0;
  const winRateColor = insights.winRate >= 65 
    ? 'text-emerald-400' 
    : insights.winRate >= 50 
      ? 'text-cyan-400' 
      : insights.winRate > 0 
        ? 'text-amber-400' 
        : 'text-neutral-400';

  return (
    <div className="bg-[#0b0f17] border border-white/10 rounded-2xl p-5 space-y-6 shadow-xl">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Trading Insights & Performance Quantitativa
            </h3>
          </div>
          <p className="text-xs text-neutral-400">
            Estatísticas consolidadas de execução algorítmica <span className="text-neutral-600">·</span> <span className="text-cyan-400/90 font-medium">{timeframeLabel}</span> <span className="text-neutral-600">·</span> {insights.totalTrades} sinais capturados ({insights.closedTrades} encerrados)
          </p>
          {/*
            SDD Fase 9 / S4 — sem este aviso, uma ESTIMATIVA e lida como medicao.
            Os numeros abaixo vem dos alvos e do stop do sinal, com taxas e slippage
            do motor, mas SEM caminho de preco. O numero autoritativo de resultado e
            o do evidence ledger, e e ele que o operador deve usar para decidir.
          */}
          <p className="text-[11px] text-amber-500/80 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {TRADE_COST_DISCLOSURE}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/5 font-mono">
            <span className="text-neutral-400">Total PnL:</span>
            <span className={`font-bold ${isPositivePnl ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(insights.totalPnlPct)}
            </span>
            <span className="text-neutral-500 text-[11px]">
              (${insights.totalPnlUsd >= 0 ? `+${insights.totalPnlUsd.toFixed(2)}` : insights.totalPnlUsd.toFixed(2)})
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/5 font-mono">
            <span className="text-neutral-400">Profit Factor:</span>
            <span className={`font-bold ${insights.profitFactor >= 1.5 ? 'text-emerald-400' : insights.profitFactor >= 1 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {insights.profitFactor.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>

      {/* 3 Core Primary Requirements Metrics (Win Rate, Avg Risk-Reward Ratio, Avg Trade Duration) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Win Rate */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Taxa de Acerto (Win Rate)
            </span>
            <Tooltip content="Porcentagem de trades encerrados em lucro (Take Profit 1/2 ou Breakeven com lucro parcial)">
              <span className="text-[11px] font-mono text-neutral-500 cursor-help">
                {insights.wins}W / {insights.losses}L
              </span>
            </Tooltip>
          </div>

          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-black font-mono tracking-tight ${winRateColor}`}>
              {insights.winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-neutral-400">
              {insights.breakevens > 0 && `(inclui ${insights.breakevens} BE)`}
            </span>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, insights.winRate))}%` }} 
              />
              <div 
                className="h-full bg-rose-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, 100 - insights.winRate))}%` }} 
              />
            </div>
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span className="text-emerald-400/90">{insights.wins} vitórias ({insights.winRate.toFixed(1)}%)</span>
              <span className="text-rose-400/90">{insights.losses} stops ({(100 - insights.winRate).toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* 2. Average Risk-Reward Ratio */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-cyan-400" />
              Risco:Retorno Médio (Avg R:R)
            </span>
            <Tooltip content="Relação média entre o retorno planejado (Take Profit) e o risco máximo alocado (Stop Loss)">
              <span className="text-[11px] font-mono text-neutral-500 cursor-help">
                Exp: {insights.expectancyR >= 0 ? `+${insights.expectancyR.toFixed(2)}` : insights.expectancyR.toFixed(2)} R
              </span>
            </Tooltip>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              1:{insights.avgRiskRewardRatio.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-cyan-400/90">
              {insights.avgRiskRewardRatio >= 2.0 ? 'Excelente Assimetria' : 'Equilibrado'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 border-t border-white/5 pt-2 font-mono">
            <span>Expectativa Matemática:</span>
            <span className={`font-bold ${insights.expectancyR > 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {insights.expectancyR > 0 ? `+${insights.expectancyR.toFixed(2)}` : insights.expectancyR.toFixed(2)} R / trade
            </span>
          </div>
        </div>

        {/* 3. Average Trade Duration */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Duração Média por Trade
            </span>
            <Tooltip content="Tempo médio transcorrido desde a validação da entrada até o encerramento do sinal (Target/Stop/TTL)">
              <span className="text-[11px] font-mono text-neutral-500 cursor-help">
                TTL Médio
              </span>
            </Tooltip>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {insights.avgTradeDurationFormatted}
            </span>
            <span className="text-xs text-neutral-400">
              tempo médio de retenção
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 border-t border-white/5 pt-2 font-mono">
            <span>Max Drawdown no Período:</span>
            <span className="text-rose-400 font-bold">
              -{insights.maxDrawdownPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Detailed Breakdown (Long vs Short, Best/Worst, Category distribution) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Longs Win Rate */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Sinais de LONG</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">
              {insights.longsCount} operações
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-white">
              {insights.longsWinRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-neutral-400">win rate</div>
          </div>
        </div>

        {/* Shorts Win Rate */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-rose-400 font-medium">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Sinais de SHORT</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">
              {insights.shortsCount} operações
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-white">
              {insights.shortsWinRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-neutral-400">win rate</div>
          </div>
        </div>

        {/* Best Trade */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Maior Ganho</span>
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              {insights.bestTrade ? `${insights.bestTrade.symbol} (${insights.bestTrade.direction})` : '--'}
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-emerald-400">
              {insights.bestTrade ? `+${insights.bestTrade.pnlPct.toFixed(2)}%` : '0.00%'}
            </div>
            <div className="text-[10px] text-neutral-500">melhor trade</div>
          </div>
        </div>

        {/* Worst Trade */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Maior Stop</span>
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              {insights.worstTrade ? `${insights.worstTrade.symbol} (${insights.worstTrade.direction})` : '--'}
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-rose-400">
              {insights.worstTrade ? `${insights.worstTrade.pnlPct.toFixed(2)}%` : '0.00%'}
            </div>
            <div className="text-[10px] text-neutral-500">stop controlado</div>
          </div>
        </div>
      </div>

      {/* Category breakdown tags if available */}
      {Object.keys(insights.byCategory).length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mb-2">
            <Layers className="w-3.5 h-3.5 text-neutral-500" />
            <span>Performance por Categoria de Estratégia:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(insights.byCategory).map(([cat, data]) => (
              <div 
                key={cat}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono"
              >
                <span className="font-semibold text-neutral-300">{cat}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-400">{data.count} trades</span>
                <span className="text-neutral-600">·</span>
                <span className={data.winRate >= 60 ? 'text-emerald-400' : 'text-cyan-400'}>
                  {data.winRate.toFixed(0)}% win
                </span>
                <span className="text-neutral-600">·</span>
                <span className={data.pnlPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {formatPercent(data.pnlPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
