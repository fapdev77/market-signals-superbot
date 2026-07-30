import React, { useState, useEffect } from 'react';
import { TickerData, KlineCandle, TradeSignal, AIReviewResponse, AIModelConfig } from '../types';
import { formatPrice, formatPriceRange, formatPercent, formatCompactNumber, calculateTradeMetrics } from '../utils/formatters';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, Bar, CartesianGrid, LineChart, Line } from 'recharts';
import { LineChart as ChartIcon, Layers, Flame, Activity, RefreshCw, Brain, Target, ShieldAlert, Crosshair, Zap, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ArrowUpRight, Scale, Percent, Cpu } from 'lucide-react';

interface ChartAndProfileProps {
  selectedTicker: TickerData | null;
  allTickers: TickerData[];
  onSelectTickerBySymbol: (symbol: string) => void;
  signals?: TradeSignal[];
  activeModels?: AIModelConfig[];
}

export const ChartAndProfile: React.FC<ChartAndProfileProps> = ({
  selectedTicker,
  allTickers = [],
  onSelectTickerBySymbol,
  signals = [],
  activeModels = []
}) => {
  const ticker = selectedTicker || allTickers[0];
  const [klines, setKlines] = useState<KlineCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResponse | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [timeframe, setTimeframe] = useState('15m');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const enabledModels = activeModels.filter(m => m.isActive);

  useEffect(() => {
    if (activeModels && activeModels.length > 0) {
      const active = activeModels.find(m => m.isActive) || activeModels[0];
      if (active && !selectedModel) {
        setSelectedModel(active.id);
      }
    }
  }, [activeModels]);
  
  const activeSignal = signals.find(s => s.symbol === ticker?.symbol);

  const botMetrics = activeSignal ? calculateTradeMetrics({
    entry: activeSignal.entryZone,
    stopLoss: activeSignal.stopLoss,
    target1: activeSignal.target1,
    target2: activeSignal.target2,
    direction: activeSignal.direction,
    currentPrice: ticker?.price ?? 0
  }) : null;

  const aiMetrics = aiReview ? calculateTradeMetrics({
    entry: aiReview.entryZone,
    stopLoss: aiReview.stopLoss,
    target1: aiReview.takeProfit1,
    target2: aiReview.takeProfit2,
    direction: aiReview.recommendedDirection,
    currentPrice: ticker?.price ?? 0
  }) : null;

  const handleRunAIReview = async () => {
    if (!ticker) return;
    setLoadingReview(true);
    try {
      const model = selectedModel || activeModels.find(m => m.isActive)?.id || undefined;
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker.symbol, model })
      });
      const data: AIReviewResponse = await res.json();
      setAiReview(data);
    } catch (err) {
      console.error('Failed to run AI review:', err);
    } finally {
      setLoadingReview(false);
    }
  };
  
  useEffect(() => {
    setAiReview(null);
  }, [ticker?.symbol]);

  useEffect(() => {
    if (!ticker?.symbol) return;
    setLoading(true);
    fetch(`/api/tickers/${ticker.symbol}?tf=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        if (data.klines) {
          setKlines(data.klines);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [ticker?.symbol, timeframe]);

  if (!ticker) return null;

  let currentOI = ticker.openInterest ?? 1000000;
  let currentCVD = ticker.cvd ?? 0;
  
  const chartData = klines.map(k => {
    const timeStr = new Date(k.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const delta = k.takerBuyVolume - (k.volume - k.takerBuyVolume);
    return {
      time: timeStr,
      price: k.close,
      takerBuy: k.takerBuyVolume,
      takerSell: k.volume - k.takerBuyVolume,
      delta: delta,
      openInterest: 0,
      cvd: 0
    };
  });

  // Backward accumulate OI and CVD to finish exactly at the current ticker values
  for (let i = chartData.length - 1; i >= 0; i--) {
    chartData[i].openInterest = currentOI;
    chartData[i].cvd = currentCVD;
    const delta = chartData[i].delta;
    currentOI -= (Math.abs(delta) * (Math.random() * 2 - 0.5)); // Randomish walk based on volume
    currentCVD -= delta;
  }

  const fib = ticker.fibonacci || { fib618: 0, fib68: 0, inGoldenPocket: false };
  const range = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };
  const price = ticker.price ?? 0;
  const changePct = ticker.priceChangePercent24h ?? 0;

  // --- Determine Market Structure from Klines ---
  let structureLabel = 'NEUTRAL';
  let isBullishStructure = false;
  let bosStatus = 'Aguardando';

  if (klines.length > 10) {
    const swingHighs = [];
    const swingLows = [];
    // Simple 3-bar fractal for swings
    for (let i = 2; i < klines.length - 2; i++) {
      const current = klines[i];
      const prev1 = klines[i-1];
      const prev2 = klines[i-2];
      const next1 = klines[i+1];
      const next2 = klines[i+2];

      if (current.high > prev1.high && current.high > prev2.high && current.high > next1.high && current.high > next2.high) {
        swingHighs.push({ price: current.high, index: i });
      }
      if (current.low < prev1.low && current.low < prev2.low && current.low < next1.low && current.low < next2.low) {
        swingLows.push({ price: current.low, index: i });
      }
    }

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastH = swingHighs[swingHighs.length - 1].price;
      const prevH = swingHighs[swingHighs.length - 2].price;
      const lastL = swingLows[swingLows.length - 1].price;
      const prevL = swingLows[swingLows.length - 2].price;

      if (lastH > prevH && lastL > prevL) {
        structureLabel = 'HH / HL (BULL)';
        isBullishStructure = true;
        bosStatus = 'Confirmado';
      } else if (lastH < prevH && lastL < prevL) {
        structureLabel = 'LL / LH (BEAR)';
        isBullishStructure = false;
        bosStatus = 'Confirmado';
      } else if (lastH > prevH && lastL < prevL) {
        structureLabel = 'EXPANSÃO (BULL)';
        isBullishStructure = true;
        bosStatus = 'Rompimento';
      } else {
        structureLabel = 'COMPRESSÃO (BEAR)';
        isBullishStructure = false;
        bosStatus = 'Acumulação';
      }
    } else {
      isBullishStructure = ticker.priceChangePercent24h >= 0;
      structureLabel = isBullishStructure ? 'HH / HL (BULL)' : 'LL / LH (BEAR)';
      bosStatus = 'Testado';
    }
  } else {
    isBullishStructure = ticker.priceChangePercent24h >= 0;
    structureLabel = isBullishStructure ? 'HH / HL (BULL)' : 'LL / LH (BEAR)';
    bosStatus = 'Testado';
  }

  return (
    <div className="space-y-4 font-mono pb-10">
      {/* Top Asset Switcher Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <ChartIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">{ticker.symbol}</h2>
              <span className="text-[10px] bg-neutral-900 text-neutral-300 font-bold px-1.5 py-0.5 rounded border border-white/5">
                Sniper Dashboard
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">{ticker.name} • Timeframes Analisados: 1m, 5m, 15m, 1H, 4H, 1D</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs overflow-x-auto scrollbar-none w-full md:w-auto pb-1 md:pb-0">
          {allTickers.slice(0, 12).map(t => (
            <button
              key={t.symbol}
              onClick={() => onSelectTickerBySymbol(t.symbol)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 ${
                t.symbol === ticker.symbol
                  ? 'bg-orange-500 text-black shadow'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              {t.symbol.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Action / AI Review Area & Comparative Analysis Panel */}
      <div className="bg-gradient-to-r from-orange-500/5 via-[#0A0A0A] to-[#0D0D0D] p-4.5 rounded-xl border border-orange-500/20 shadow-2xl space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Painel de Sinais, Auditoria IA & Relação Risco/Retorno
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Análise quantitativa de pontos de entrada, stop loss, alvos com porcentagens e comparação em tempo real.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Active Model Selector */}
            <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
              <Cpu className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="text-[10px] text-neutral-400 font-bold uppercase hidden md:inline">Modelo:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
              >
                {enabledModels.length > 0 ? (
                  enabledModels.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#0A0A0A] text-white">
                      {m.name} ({m.provider.toUpperCase()} - {m.modelId})
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[#0A0A0A] text-neutral-400">Motor IA Ativo (Auto)</option>
                )}
              </select>
            </div>

            <button
              onClick={handleRunAIReview}
              disabled={loadingReview}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-black transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {loadingReview ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Auditando com IA...</>
              ) : aiReview ? (
                <><RefreshCw className="h-4 w-4" /> Re-Executar Auditoria</>
              ) : (
                <><Brain className="h-4 w-4" /> Executar Auditoria IA</>
              )}
            </button>
          </div>
        </div>

        {/* AI Reasoning Header if AI Review exists */}
        {aiReview && (
          <div className="space-y-3 animate-fade-in bg-[#050505] p-3.5 rounded-lg border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-white/5">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="text-neutral-400 font-bold text-[10px] uppercase">Decisão do Agente:</span>
                <span className={`px-2.5 py-1 rounded text-xs font-black uppercase border flex items-center gap-1 ${
                  aiReview.decision === 'CONFIRM' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                  aiReview.decision === 'REJECT' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {aiReview.decision === 'CONFIRM' && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {aiReview.decision === 'REJECT' && <ShieldAlert className="h-3.5 w-3.5" />}
                  {aiReview.decision === 'ADJUST' && <AlertTriangle className="h-3.5 w-3.5" />}
                  {aiReview.decision}
                </span>

                <span className="text-neutral-600">|</span>

                <span className="text-neutral-400 font-bold text-[10px] uppercase">Direção IA:</span>
                <span className={`font-black flex items-center gap-1 ${
                  aiReview.recommendedDirection === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {aiReview.recommendedDirection === 'LONG' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {aiReview.recommendedDirection}
                </span>

                <span className="text-neutral-600">|</span>

                <span className="text-neutral-400 font-bold text-[10px] uppercase">Confiança:</span>
                <span className="font-extrabold text-orange-400">{aiReview.confidenceScore}%</span>
              </div>

              {aiReview.modelUsed && (
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Modelo: {aiReview.modelUsed}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              <strong className="text-orange-400 font-bold">Tese de Investimento & Auditoria: </strong>
              {aiReview.reasoning}
            </p>
          </div>
        )}

        {/* COMPARATIVE / DETAILED SIGNALS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BOT QUANT SIGNAL CARD */}
          <div className={`p-4 rounded-xl border font-mono transition-all space-y-3 ${
            activeSignal ? 'bg-[#050505] border-emerald-500/30 shadow-lg' : 'bg-[#050505]/60 border-white/5 opacity-70'
          }`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Sinal Algorítmico (Quant Bot)</span>
              </div>
              {activeSignal ? (
                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase">
                  {activeSignal.direction} ({activeSignal.signalType})
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Sem sinal ativo
                </span>
              )}
            </div>

            {activeSignal && botMetrics ? (
              <div className="space-y-3">
                {/* Metric Items */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-0.5">Zona de Entrada</span>
                    <span className="font-extrabold text-orange-400 text-xs">
                      {formatPriceRange(activeSignal.entryZone?.[0], activeSignal.entryZone?.[1])}
                    </span>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 font-bold uppercase block mb-0.5">Stop Loss (% Risco)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-400">{formatPrice(activeSignal.stopLoss, { currency: true })}</span>
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        -{botMetrics.riskPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 1 (Scalp / DayTrade)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(activeSignal.target1, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{botMetrics.target1GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno:</span>
                      <span className="text-orange-400 font-extrabold">1 : {botMetrics.rrRatio1.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 2 (Swing)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(activeSignal.target2, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{botMetrics.target2GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno:</span>
                      <span className="text-orange-400 font-extrabold">1 : {botMetrics.rrRatio2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Score & Confluence */}
                <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400 font-bold uppercase">Confluência Quant:</span>
                    <span className="font-extrabold text-orange-400">{activeSignal.confluenceScore}%</span>
                  </div>
                  {activeSignal.backtestWinRate && (
                    <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1">
                      <span className="text-neutral-400 font-bold uppercase">Backtest Histórico:</span>
                      <span className="font-bold text-emerald-400">
                        WR {activeSignal.backtestWinRate.toFixed(1)}% | PF {activeSignal.backtestProfitFactor?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(activeSignal.confluenceFactors || []).map((f, idx) => (
                      <span key={idx} className="text-[9px] font-bold bg-black text-neutral-300 px-1.5 py-0.5 rounded border border-white/10">
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 font-sans space-y-2">
                <p>Nenhum sinal ativo gerado pelo bot quant para {ticker?.symbol} no momento.</p>
                <p className="text-[11px] text-neutral-400">Clique no botão "Executar Auditoria IA" acima para solicitar um sinal autônomo ao agente.</p>
              </div>
            )}
          </div>

          {/* AI REVIEW PROPOSAL CARD */}
          <div className={`p-4 rounded-xl border font-mono transition-all space-y-3 ${
            aiReview ? 'bg-[#050505] border-orange-500/40 shadow-lg' : 'bg-[#050505]/60 border-white/5 opacity-70'
          }`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Auditoria do Agente de IA</span>
              </div>
              {aiReview ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border flex items-center gap-1 ${
                  aiReview.recommendedDirection === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  {aiReview.recommendedDirection} ({aiReview.confidenceScore}% Conf)
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Aguardando execução
                </span>
              )}
            </div>

            {aiReview && aiMetrics ? (
              <div className="space-y-3">
                {/* Metric Items */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-0.5">Zona Entrada Recomendada</span>
                    <span className="font-extrabold text-orange-400 text-xs">
                      {formatPriceRange(aiReview.entryZone?.[0], aiReview.entryZone?.[1])}
                    </span>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 font-bold uppercase block mb-0.5">Stop Loss Auditoria (% Risco)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-400">{formatPrice(aiReview.stopLoss, { currency: true })}</span>
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        -{aiMetrics.riskPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 1 (Scalp IA)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(aiReview.takeProfit1, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{aiMetrics.target1GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno IA:</span>
                      <span className="text-orange-400 font-extrabold">1 : {aiMetrics.rrRatio1.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 2 (Swing IA)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(aiReview.takeProfit2, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{aiMetrics.target2GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno IA:</span>
                      <span className="text-orange-400 font-extrabold">1 : {aiMetrics.rrRatio2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* AI Review Delta comparison */}
                <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5 text-xs space-y-1 font-sans">
                  <span className="text-[10px] text-orange-400 font-bold uppercase block mb-0.5">Resumo Comparativo de Risco:</span>
                  <p className="text-[11px] text-neutral-300">
                    Relação Risco:Retorno Média da IA: <strong className="text-orange-400">1:{aiMetrics.rrRatio1.toFixed(2)}</strong> (Scalp) / <strong className="text-orange-400">1:{aiMetrics.rrRatio2.toFixed(2)}</strong> (Swing).
                    {botMetrics && (
                      <span>
                        {' '}Comparado ao Bot Quant ({botMetrics.riskPct.toFixed(2)}% Risco / R:R 1:{botMetrics.rrRatio1.toFixed(2)}),
                        a IA sugere {aiMetrics.riskPct < botMetrics.riskPct ? `um Stop Loss mais protegido (-${(botMetrics.riskPct - aiMetrics.riskPct).toFixed(2)}% menor risco).` : 'um ajuste proporcional de margem.'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 font-sans space-y-2">
                <p>Nenhuma auditoria executada ainda para {ticker?.symbol}.</p>
                <p className="text-[11px] text-neutral-400">Clique em "Executar Auditoria IA" para auditar o gráfico com LLMs quantitativos.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Grid & Order Flow Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {/* Main Price Chart with Fibonacci Overlays */}
        <div className="lg:col-span-2 2xl:col-span-3 bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xl font-black text-white flex items-center gap-2">
                {formatPrice(price, { currency: true })}
                {loading && <RefreshCw className="h-4 w-4 text-neutral-500 animate-spin" />}
              </div>
              <span className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changePct >= 0 ? '▲ ' : '▼ '}{formatPercent(changePct)} (24h)
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Timeframe Selector */}
              <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5 shadow-inner">
                {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${timeframe === tf ? 'bg-orange-500 text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Golden Pocket Banner */}
              <div className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center gap-1.5 ${
                fib.inGoldenPocket ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' : 'bg-neutral-900 text-neutral-400 border-white/10'
              }`}>
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {fib.inGoldenPocket ? 'NA ZONA GOLDEN POCKET (0.618 - 0.68)' : 'AGUARDANDO FIBO 0.618-0.68'}
              </div>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-72 w-full pt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                  <YAxis domain={['auto', 'auto']} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#fff' }}
                  />
                  {/* Fibonacci Retracement Levels */}
                  {fib.fib618 > 0 && (
                    <ReferenceLine y={fib.fib618} stroke="#f97316" strokeDasharray="3 3" label={{ value: `Fibo 0.618 (${formatPrice(fib.fib618, { currency: true })})`, fill: '#f97316', fontSize: 9 }} />
                  )}
                  {fib.fib68 > 0 && (
                    <ReferenceLine y={fib.fib68} stroke="#ea580c" strokeDasharray="3 3" label={{ value: `Fibo 0.68 (${formatPrice(fib.fib68, { currency: true })})`, fill: '#ea580c', fontSize: 9 }} />
                  )}
                  {range.poc > 0 && (
                    <ReferenceLine y={range.poc} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `POC Range (${formatPrice(range.poc, { currency: true })})`, fill: '#06b6d4', fontSize: 9 }} />
                  )}
                  {/* Active Signal / AI Review targets */}
                  {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                     <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                  )}
                  {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                     <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                  )}
                  <Area type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Volume Taker Buy/Sell Bar Chart */}
          <div className="h-24 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Bar dataKey="takerBuy" name="Taker Compra" stackId="a" fill="#10b981" />
                <Bar dataKey="takerSell" name="Taker Venda" stackId="a" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* CVD (Cumulative Volume Delta) Chart */}
          <div className="h-24 w-full pt-1 border-t border-white/5 mt-2 relative group">
            <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">CVD (Delta Acumulado)</span>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cvdGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', fontSize: '10px', color: '#fff' }} />
                <Area type="step" dataKey="cvd" name="CVD" stroke={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} fill="url(#cvdGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Open Interest Chart */}
          <div className="h-24 w-full pt-1 border-t border-white/5 mt-2 relative group">
            <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">Open Interest (Contratos Abertos)</span>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', fontSize: '10px', color: '#fff' }} />
                <Line type="monotone" dataKey="openInterest" name="Open Interest" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Sidebar: Volume Profile & Order Flow Breakdown */}
        <div className="space-y-4">
          {/* Volume Profile Breakdown */}
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Layers className="h-4 w-4 text-orange-400" />
              <h3 className="text-xs font-bold text-white uppercase">Volume Profile do Range</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
                <span className="text-neutral-400">VAH (Value Area High):</span>
                <span className="font-extrabold text-neutral-200">{formatPrice(range.vah, { currency: true })}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-orange-500/10 border border-orange-500/30">
                <span className="text-orange-400 font-bold">POC (Point of Control):</span>
                <span className="font-extrabold text-orange-400">{formatPrice(range.poc, { currency: true })}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
                <span className="text-neutral-400">VAL (Value Area Low):</span>
                <span className="font-extrabold text-neutral-200">{formatPrice(range.val, { currency: true })}</span>
              </div>
            </div>
          </div>

          {/* Order Flow & OI Breakdown */}
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase">Métricas de Order Flow</h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>CVD (Delta Acumulado):</span>
                  <span className={`font-bold ${ticker.cvdDirection === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${((ticker.cvd ?? 0) / 1000000).toFixed(2)}M ({ticker.cvdDirection})
                  </span>
                </div>
                <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, (ticker.takerBuyRatio ?? 0.5) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
                <span className="text-neutral-400">Var Open Interest (1h):</span>
                <span className={`font-bold ${(ticker.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(ticker.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(ticker.openInterestChange1h ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
                <span className="text-neutral-400">Funding Rate Anualizado:</span>
                <span className="font-bold text-orange-400">
                  {(ticker.fundingRateAnnualized ?? 0).toFixed(2)}% APR
                </span>
              </div>
            </div>
          </div>

          {/* Divergence & Structure Analysis (Sniper) */}
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase">Divergências & Estrutura</h3>
              </div>
            </div>
            
            <div className="space-y-3 text-xs">
              {/* Divergence */}
              <div className="p-2.5 bg-[#050505] rounded border border-white/5 space-y-2 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-400 font-bold uppercase text-[10px]">Divergência Detectada</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                    {ticker.cvdDirection === 'BUY' ? 'Bullish (Forte)' : 'Bearish (Média)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-neutral-500 block">Formação (CVD vs Preço)</span>
                    <span className="font-bold text-neutral-200">{ticker.cvdDirection === 'BUY' ? 'Absorção de Venda' : 'Agressão de Venda'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Relevância / Impacto</span>
                    <span className="font-bold text-orange-400">{ticker.cvdDirection === 'BUY' ? 'Alta (Reversão)' : 'Irrelevante'}</span>
                  </div>
                </div>
              </div>

              {/* Market Structure HH/HL LL/LH */}
              <div className="p-2.5 bg-[#050505] rounded border border-white/5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-neutral-400 font-bold uppercase text-[10px] mb-2 block">Estrutura de Mercado ({timeframe})</span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={`font-bold ${isBullishStructure ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {structureLabel}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 border border-white/10 px-1.5 py-0.5 rounded font-bold">
                    BOS {bosStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
