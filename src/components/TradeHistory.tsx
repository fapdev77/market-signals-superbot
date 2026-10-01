import React, { useState, useMemo } from 'react';
import { 
  TradeSignal, 
  TickerData 
} from '../types';
import { 
  ExecutedTrade, 
  signalToExecutedTrade, 
  filterTradesByTimeframe, 
  calculateCumulativePnLSeries, 
  calculateTradingInsights,
  CumulativePnLPoint
} from '../utils/tradeMetrics';
import { TradingInsights } from './TradingInsights';
import { 
  formatPrice, 
  formatPercent, 
  formatDateTime, 
  formatTimeAgo, 
  formatUsd 
} from '../utils/formatters';
import { 
  History, 
  LineChart as LineChartIcon, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Search, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileCode,
  Zap,
  Target,
  BarChart2,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ReferenceLine, 
  CartesianGrid 
} from 'recharts';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

export type TimeframeFilter = 'today' | '7d' | '15d' | '30d' | 'all';
export type StatusFilter = 'ALL' | 'WINS' | 'LOSSES' | 'BREAKEVEN' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED' | 'ACTIVE';
export type DirectionFilter = 'ALL' | 'LONG' | 'SHORT';
export type SortField = 'date' | 'pnl' | 'rr' | 'confluence' | 'duration' | 'symbol';

interface TradeHistoryProps {
  signals: TradeSignal[];
  tickers?: TickerData[];
  onSelectTickerBySymbol?: (symbol: string) => void;
  onSelectSignal?: (signal: TradeSignal) => void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  signals = [],
  tickers = [],
  onSelectTickerBySymbol,
  onSelectSignal
}) => {
  const { showToast } = useToast();
  
  // Timeframe selection for cumulative chart (Default: 7 days)
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('7d');
  
  // Table filters & search
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedTradeDetails, setSelectedTradeDetails] = useState<ExecutedTrade | null>(null);

  // Map of live ticker prices for accurate active signal evaluations
  const tickerPricesMap = useMemo(() => {
    const map = new Map<string, number>();
    tickers.forEach(t => map.set(t.symbol, t.price));
    return map;
  }, [tickers]);

  // Convert all raw signals into ExecutedTrade models
  const allExecutedTrades = useMemo(() => {
    return signals.map(s => signalToExecutedTrade(s, tickerPricesMap.get(s.symbol)));
  }, [signals, tickerPricesMap]);

  // Filtered trades based on the selected timeframe for the chart and insights
  const timeframeTrades = useMemo(() => {
    return filterTradesByTimeframe(allExecutedTrades, selectedTimeframe);
  }, [allExecutedTrades, selectedTimeframe]);

  // Insights computed for the selected timeframe
  const insights = useMemo(() => {
    return calculateTradingInsights(timeframeTrades);
  }, [timeframeTrades]);

  // Cumulative PnL time series points for Recharts
  const chartSeries = useMemo(() => {
    return calculateCumulativePnLSeries(timeframeTrades);
  }, [timeframeTrades]);

  // Filtered trades for the Table view
  const filteredTableTrades = useMemo(() => {
    let result = [...allExecutedTrades];

    // Status filter
    if (statusFilter === 'WINS') {
      result = result.filter(t => t.isWin);
    } else if (statusFilter === 'LOSSES') {
      result = result.filter(t => !t.isWin && t.status !== 'ACTIVE');
    } else if (statusFilter === 'BREAKEVEN') {
      result = result.filter(t => t.isBreakeven);
    } else if (statusFilter !== 'ALL') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Direction filter
    if (directionFilter !== 'ALL') {
      result = result.filter(t => t.direction === directionFilter);
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      result = result.filter(t => (t.strategyCategory || 'INTRADAY') === categoryFilter);
    }

    // Search query filter (Symbol or reason)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.symbol.toLowerCase().includes(q) ||
        t.strategyCategory.toLowerCase().includes(q) ||
        (t.expirationReason && t.expirationReason.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      let diff = 0;
      if (sortField === 'date') {
        diff = a.entryTime - b.entryTime;
      } else if (sortField === 'pnl') {
        diff = a.pnlPct - b.pnlPct;
      } else if (sortField === 'rr') {
        diff = a.riskRewardRatio - b.riskRewardRatio;
      } else if (sortField === 'confluence') {
        diff = a.confluenceScore - b.confluenceScore;
      } else if (sortField === 'duration') {
        diff = a.durationMs - b.durationMs;
      } else if (sortField === 'symbol') {
        diff = a.symbol.localeCompare(b.symbol);
      }
      return sortAsc ? diff : -diff;
    });

    return result;
  }, [allExecutedTrades, statusFilter, directionFilter, categoryFilter, searchQuery, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Export Table as CSV
  const handleExportCSV = () => {
    if (filteredTableTrades.length === 0) {
      showToast('info', 'Sem Dados para Exportar', 'Nenhum trade encontrado nos filtros atuais.');
      return;
    }

    const headers = [
      'ID',
      'Data/Hora Entrada',
      'Data/Hora Saída',
      'Ativo',
      'Direção',
      'Estratégia',
      'Timeframe',
      'Preço Entrada',
      'Preço Saída',
      'Stop Loss',
      'Alvo 1',
      'Alvo 2',
      'R:R',
      'Confluência (%)',
      'Status',
      'PnL (%)',
      'PnL ($)',
      'Resultado R',
      'Duração',
      'Motivo Encerramento'
    ];

    const rows = filteredTableTrades.map(t => [
      t.id,
      formatDateTime(t.entryTime),
      formatDateTime(t.exitTime),
      t.symbol,
      t.direction,
      t.strategyCategory,
      t.timeframe,
      t.entryPrice,
      t.exitPrice,
      t.stopLoss,
      t.target1,
      t.target2,
      t.riskRewardRatio,
      t.confluenceScore,
      t.status,
      t.pnlPct,
      t.pnlUsd,
      t.pnlR,
      t.durationFormatted,
      `"${(t.expirationReason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `superbot_trade_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Relatório CSV Exportado', `${filteredTableTrades.length} registros de trades foram exportados.`);
  };

  // Export Table as JSON
  const handleExportJSON = () => {
    if (filteredTableTrades.length === 0) {
      showToast('info', 'Sem Dados para Exportar', 'Nenhum trade encontrado nos filtros atuais.');
      return;
    }

    const jsonContent = JSON.stringify(filteredTableTrades, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `superbot_trade_history_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Relatório JSON Exportado', `${filteredTableTrades.length} registros exportados em JSON.`);
  };

  const timeframeLabels: Record<TimeframeFilter, string> = {
    today: 'Hoje',
    '7d': 'Últimos 7 dias',
    '15d': 'Últimos 15 dias',
    '30d': 'Últimos 30 dias',
    all: 'Todo o Histórico'
  };

  // Extract unique categories from trades
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    allExecutedTrades.forEach(t => {
      if (t.strategyCategory) set.add(t.strategyCategory);
    });
    return Array.from(set);
  }, [allExecutedTrades]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#080d14] border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                Histórico de Trades & Execuções
                <span className="text-xs font-normal text-neutral-400 font-mono">
                  ({allExecutedTrades.length} sinais registrados)
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Registro detalhado de sinais executados, preços de entrada, saída, PnL realizado e curva de patrimônio cumulativa.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-200 text-xs font-medium transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-200 text-xs font-medium transition active:scale-95"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* Trading Insights Component */}
      <TradingInsights 
        insights={insights} 
        timeframeLabel={timeframeLabels[selectedTimeframe]} 
      />

      {/* Cumulative PnL Line Chart Section */}
      <div className="bg-[#0b0f17] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white tracking-wide">
                Evolução Cumulativa de PnL (%)
              </h3>
            </div>
            <p className="text-xs text-neutral-400">
              Curva de rendimento acumulado dos sinais capturados ao longo do tempo.
            </p>
          </div>

          {/* Timeframe Selector (today, last 7, last 15, last 30, all) */}
          <div className="flex items-center gap-1 p-1 bg-black/50 border border-white/10 rounded-xl">
            {(['today', '7d', '15d', '30d', 'all'] as TimeframeFilter[]).map(tf => {
              const isActive = selectedTimeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {tf === 'today' ? 'Hoje' : tf === '7d' ? '7 Dias' : tf === '15d' ? '15 Dias' : tf === '30d' ? '30 Dias' : 'Tudo'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart View */}
        <div className="h-[280px] w-full pt-2">
          {chartSeries.length <= 1 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-2 border border-dashed border-white/5 rounded-xl">
              <Clock className="w-8 h-8 text-neutral-600 animate-pulse" />
              <p className="text-sm font-medium">Nenhum trade encerrado no período selecionado ({timeframeLabels[selectedTimeframe]}).</p>
              <p className="text-xs text-neutral-600">Altere o filtro de período acima ou aguarde a execução de novos sinais.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                <XAxis 
                  dataKey="dateFormatted" 
                  stroke="#525252" 
                  fontSize={11} 
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />

                <YAxis 
                  stroke="#525252" 
                  fontSize={11} 
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(val) => `${val > 0 ? `+${val}` : val}%`}
                />

                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data: CumulativePnLPoint = payload[0].payload;
                      const isWin = data.tradePnL > 0;
                      return (
                        <div className="bg-[#050810] border border-cyan-500/30 rounded-xl p-3 shadow-2xl space-y-1.5 font-mono text-xs z-50">
                          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5">
                            <span className="font-bold text-white">{data.symbol}</span>
                            <span className="text-neutral-400 text-[10px]">{data.dateFormatted}</span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-neutral-400">Trade PnL:</span>
                            <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatPercent(data.tradePnL)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-neutral-400">PnL Acumulado:</span>
                            <span className={`font-bold ${data.cumulativePnL >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                              {formatPercent(data.cumulativePnL)} (${data.cumulativePnlUsd >= 0 ? `+${data.cumulativePnlUsd}` : data.cumulativePnlUsd})
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-neutral-400">R Acumulado:</span>
                            <span className="font-bold text-neutral-200">
                              {data.cumulativeR >= 0 ? `+${data.cumulativeR} R` : `${data.cumulativeR} R`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />

                <Area 
                  type="monotone" 
                  dataKey="cumulativePnL" 
                  stroke="#06b6d4" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#pnlGradient)" 
                  dot={{ r: 3, fill: '#06b6d4', stroke: '#080d14', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Formatted Executed Signals Table Section */}
      <div className="bg-[#0b0f17] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        {/* Table Filter and Search Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Tabela de Execuções e Performance
            </h3>
            <p className="text-xs text-neutral-400">
              {filteredTableTrades.length} registros exibidos <span className="text-neutral-600">·</span> Clique nas colunas para ordenar
            </p>
          </div>

          {/* Search Box */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por par (ex: BTC, ETH)..."
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition font-mono"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 transition font-mono cursor-pointer"
            >
              <option value="ALL">Todos os Lados</option>
              <option value="LONG">Apenas LONG</option>
              <option value="SHORT">Apenas SHORT</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 transition font-mono cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="WINS">Apenas Vitórias (Lucro)</option>
              <option value="LOSSES">Apenas Stops (Prejuízo)</option>
              <option value="TARGET_REACHED">Alvo 2 Atingido</option>
              <option value="BREAKEVEN">Saída no Breakeven</option>
              <option value="STOPPED_OUT">Stop Loss</option>
              <option value="EXPIRED">TTL Expirado</option>
              <option value="ACTIVE">Em Aberto (Ativos)</option>
            </select>

            {/* Category Filter */}
            {uniqueCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 transition font-mono cursor-pointer"
              >
                <option value="ALL">Todas Estratégias</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-neutral-400 font-mono select-none">
                <th 
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data / Hora</span>
                    {sortField === 'date' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('symbol')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Ativo & Lado</span>
                    {sortField === 'symbol' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th className="py-3 px-4 font-semibold">
                  Estratégia
                </th>

                <th className="py-3 px-4 font-semibold">
                  Preço Entrada
                </th>

                <th className="py-3 px-4 font-semibold">
                  Preço Saída
                </th>

                <th 
                  onClick={() => handleSort('rr')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>R:R</span>
                    {sortField === 'rr' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('duration')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Duração</span>
                    {sortField === 'duration' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('confluence')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Confluência</span>
                    {sortField === 'confluence' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('pnl')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Resultado (PnL)</span>
                    {sortField === 'pnl' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />)}
                  </div>
                </th>

                <th className="py-3 px-4 font-semibold text-center">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5 font-mono">
              {filteredTableTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-500 font-sans">
                    <History className="w-8 h-8 mx-auto mb-2 text-neutral-600 animate-pulse" />
                    <p className="text-sm font-medium text-neutral-400">Nenhum trade encontrado com os filtros selecionados.</p>
                    <p className="text-xs text-neutral-600 mt-1">Limpe os filtros ou busque por outro ativo.</p>
                  </td>
                </tr>
              ) : (
                filteredTableTrades.map((trade) => {
                  const isLong = trade.direction === 'LONG';
                  const isWin = trade.isWin;
                  const isBreakeven = trade.isBreakeven;

                  // Status badge and text formatting
                  let statusLabel = 'EM ABERTO';
                  let statusClass = 'text-amber-400';
                  
                  if (trade.status === 'TARGET_REACHED') {
                    statusLabel = 'ALVO 2 ATINGIDO';
                    statusClass = 'text-emerald-400 font-semibold';
                  } else if (trade.status === 'STOPPED_OUT') {
                    if (isBreakeven) {
                      statusLabel = 'BREAKEVEN (TP1 + BE)';
                      statusClass = 'text-cyan-400 font-semibold';
                    } else {
                      statusLabel = 'STOP LOSS';
                      statusClass = 'text-rose-400 font-semibold';
                    }
                  } else if (trade.status === 'EXPIRED') {
                    statusLabel = 'TTL EXPIRADO';
                    statusClass = 'text-neutral-400';
                  }

                  return (
                    <tr 
                      key={trade.id} 
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Date / Time */}
                      <td className="py-3 px-4 text-neutral-300">
                        <div className="font-medium text-white">{formatDateTime(trade.entryTime, false)}</div>
                        <div className="text-[10px] text-neutral-500">{formatTimeAgo(trade.entryTime)}</div>
                      </td>

                      {/* Symbol & Direction */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{trade.symbol}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {trade.direction}
                          </span>
                        </div>
                      </td>

                      {/* Strategy */}
                      <td className="py-3 px-4 text-neutral-400">
                        <div className="text-white font-medium">{trade.strategyCategory}</div>
                        <div className="text-[10px] text-neutral-500">{trade.timeframe}</div>
                      </td>

                      {/* Entry Price */}
                      <td className="py-3 px-4 font-semibold text-white">
                        {formatPrice(trade.entryPrice, { currency: true })}
                      </td>

                      {/* Exit Price */}
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${
                          trade.status === 'ACTIVE' 
                            ? 'text-neutral-400' 
                            : isWin 
                              ? 'text-emerald-400' 
                              : 'text-rose-400'
                        }`}>
                          {formatPrice(trade.exitPrice, { currency: true })}
                        </span>
                      </td>

                      {/* Planned R:R */}
                      <td className="py-3 px-4 text-neutral-300">
                        1:{trade.riskRewardRatio.toFixed(2)}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 text-neutral-400">
                        {trade.durationFormatted}
                      </td>

                      {/* Confluence */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-cyan-400">{trade.confluenceScore}%</span>
                          {trade.confluenceFactors.length > 0 && (
                            <span className="text-[10px] text-neutral-500">
                              ({trade.confluenceFactors.length} fatores)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Final Result / PnL */}
                      <td className="py-3 px-4 text-right">
                        <div className="space-y-0.5">
                          <div className={`font-bold text-sm ${trade.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPercent(trade.pnlPct)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-neutral-400">
                            <span className={statusClass}>{statusLabel}</span>
                            <span className="text-neutral-600">·</span>
                            <span className={trade.pnlR >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                              {trade.pnlR > 0 ? `+${trade.pnlR.toFixed(2)}` : trade.pnlR.toFixed(2)} R
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onSelectTickerBySymbol && (
                            <Tooltip content={`Abrir Gráfico de ${trade.symbol}`}>
                              <button
                                onClick={() => onSelectTickerBySymbol(trade.symbol)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-cyan-500/20 text-neutral-400 hover:text-cyan-300 border border-white/5 transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}

                          {onSelectSignal && (
                            <Tooltip content="Auditar Detalhes do Sinal">
                              <button
                                onClick={() => onSelectSignal(trade.rawSignal)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-neutral-400 hover:text-white border border-white/5 transition"
                              >
                                <Target className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
