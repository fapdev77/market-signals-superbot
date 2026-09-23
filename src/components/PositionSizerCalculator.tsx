import React, { useState, useMemo, useEffect } from 'react';
import { TradeSignal, TickerData } from '../types';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  Target, 
  Sliders, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

interface PositionSizerCalculatorProps {
  ticker: TickerData;
  activeSignal: TradeSignal | null;
  aiReview?: {
    recommendedDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
    entryZone?: [number, number];
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
  } | null;
}

const STORAGE_KEY = 'superbot_position_sizer_prefs';

export const PositionSizerCalculator: React.FC<PositionSizerCalculatorProps> = ({
  ticker,
  activeSignal,
  aiReview
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const { showToast } = useToast();

  // User input states with localStorage persistence
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.capital === 'number') return parsed.capital;
      }
    } catch {
      // ignore
    }
    return 1000;
  });

  const [leverage, setLeverage] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.leverage === 'number') return parsed.leverage;
      }
    } catch {
      // ignore
    }
    return 10;
  });

  const [riskPercent, setRiskPercent] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.riskPercent === 'number') return parsed.riskPercent;
      }
    } catch {
      // ignore
    }
    return 2; // 2% risk of total account equity
  });

  const [sizingMode, setSizingMode] = useState<'FIXED_MARGIN' | 'RISK_BASED'>('FIXED_MARGIN');
  const [customMargin, setCustomMargin] = useState<number>(200); // USD margin to put in this trade

  // Signal source toggle: prefer AI Review if present, else quant signal, else fallback ticker price
  const [useAISignal, setUseAISignal] = useState<boolean>(false);

  // Update useAISignal if aiReview arrives
  useEffect(() => {
    if (aiReview && (!activeSignal || aiReview.entryZone)) {
      setUseAISignal(true);
    }
  }, [aiReview, activeSignal]);

  // Persist user preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        capital: initialCapital,
        leverage,
        riskPercent
      }));
    } catch {
      // ignore
    }
  }, [initialCapital, leverage, riskPercent]);

  // Resolve current active setup values
  const setup = useMemo(() => {
    const hasAI = Boolean(aiReview && aiReview.entryZone && aiReview.entryZone.length === 2 && aiReview.stopLoss);
    const hasQuant = Boolean(activeSignal && activeSignal.entryZone && activeSignal.stopLoss);

    if (useAISignal && hasAI && aiReview) {
      const entryMin = aiReview.entryZone![0];
      const entryMax = aiReview.entryZone![1];
      const avgEntry = (entryMin + entryMax) / 2 || ticker.price;
      const direction = aiReview.recommendedDirection === 'SHORT' ? 'SHORT' : 'LONG';
      const stopLoss = aiReview.stopLoss!;
      const tp1 = aiReview.takeProfit1 || (direction === 'LONG' ? avgEntry * 1.02 : avgEntry * 0.98);
      const tp2 = aiReview.takeProfit2 || (direction === 'LONG' ? avgEntry * 1.05 : avgEntry * 0.95);

      return {
        source: 'AI_REVIEW' as const,
        direction,
        entryMin,
        entryMax,
        avgEntry,
        stopLoss,
        tp1,
        tp2
      };
    } else if (hasQuant && activeSignal) {
      const entryMin = activeSignal.entryZone[0];
      const entryMax = activeSignal.entryZone[1];
      const avgEntry = (entryMin + entryMax) / 2 || ticker.price;
      const direction = activeSignal.direction;
      const stopLoss = activeSignal.stopLoss;
      const tp1 = activeSignal.target1 || (direction === 'LONG' ? avgEntry * 1.02 : avgEntry * 0.98);
      const tp2 = activeSignal.target2 || (direction === 'LONG' ? avgEntry * 1.05 : avgEntry * 0.95);

      return {
        source: 'QUANT_SIGNAL' as const,
        direction,
        entryMin,
        entryMax,
        avgEntry,
        stopLoss,
        tp1,
        tp2
      };
    }

    // Fallback: estimate from current price & Fibonacci Golden Pocket or default 1.5% stop
    const price = ticker.price || 1;
    const isBull = (ticker.priceChangePercent24h ?? 0) >= 0;
    const direction: 'LONG' | 'SHORT' = isBull ? 'LONG' : 'SHORT';
    const stopLoss = isBull ? price * 0.985 : price * 1.015;
    const tp1 = isBull ? price * 1.025 : price * 0.975;
    const tp2 = isBull ? price * 1.05 : price * 0.95;

    return {
      source: 'MARKET_ESTIMATE' as const,
      direction,
      entryMin: price * (isBull ? 0.998 : 1.002),
      entryMax: price * (isBull ? 1.002 : 0.998),
      avgEntry: price,
      stopLoss,
      tp1,
      tp2
    };
  }, [useAISignal, aiReview, activeSignal, ticker.price, ticker.priceChangePercent24h]);

  // Math Calculations: Position Sizing & PnL Simulation
  const calculations = useMemo(() => {
    const { direction, avgEntry, stopLoss, tp1, tp2 } = setup;
    if (avgEntry <= 0 || stopLoss <= 0) {
      return null;
    }

    // Distance to Stop Loss in % (Asset raw price change)
    const rawStopPct = direction === 'LONG'
      ? ((avgEntry - stopLoss) / avgEntry) * 100
      : ((stopLoss - avgEntry) / avgEntry) * 100;
    
    // Safety check: ensure stop distance is positive and non-zero
    const effectiveStopPct = Math.max(0.1, Math.abs(rawStopPct));

    // Determine Margin / Position Size based on mode
    let margin = 0;
    let positionNotional = 0;
    let maxRiskAmount = 0;

    if (sizingMode === 'RISK_BASED') {
      // Risk is fixed % of initial Capital (e.g. 2% of $1,000 = $20 risk)
      maxRiskAmount = (initialCapital * riskPercent) / 100;
      // If asset moves effectiveStopPct, loss is positionNotional * (effectiveStopPct/100) = maxRiskAmount
      positionNotional = maxRiskAmount / (effectiveStopPct / 100);
      margin = positionNotional / leverage;
    } else {
      // Fixed Margin mode: user specifies $ margin
      margin = Math.max(1, customMargin);
      positionNotional = margin * leverage;
      maxRiskAmount = positionNotional * (effectiveStopPct / 100);
    }

    // Quantity of coins/contracts
    const contracts = positionNotional / avgEntry;

    // ROI on Target 1 (Scalp Target)
    const rawTp1Pct = direction === 'LONG'
      ? ((tp1 - avgEntry) / avgEntry) * 100
      : ((avgEntry - tp1) / avgEntry) * 100;
    const pnlTp1 = positionNotional * (rawTp1Pct / 100);
    const roiTp1 = (pnlTp1 / margin) * 100; // or rawTp1Pct * leverage

    // ROI on Target 2 (Swing Target)
    const rawTp2Pct = direction === 'LONG'
      ? ((tp2 - avgEntry) / avgEntry) * 100
      : ((avgEntry - tp2) / avgEntry) * 100;
    const pnlTp2 = positionNotional * (rawTp2Pct / 100);
    const roiTp2 = (pnlTp2 / margin) * 100;

    // Loss on Stop Loss
    const pnlStop = -maxRiskAmount;
    const roiStop = -(effectiveStopPct * leverage);

    // Risk to Reward Ratio
    const rrRatio1 = rawTp1Pct / effectiveStopPct;
    const rrRatio2 = rawTp2Pct / effectiveStopPct;

    // Estimated Liquidation Price (Approximate Cross/Isolated without maintenance margin deduction)
    // For Long: entry * (1 - 1/leverage)
    // For Short: entry * (1 + 1/leverage)
    const liqDistancePct = (100 / leverage) * 0.95; // 95% buffer approximation
    const liquidationPrice = direction === 'LONG'
      ? avgEntry * (1 - liqDistancePct / 100)
      : avgEntry * (1 + liqDistancePct / 100);

    const isStopSaferThanLiq = direction === 'LONG'
      ? stopLoss > liquidationPrice
      : stopLoss < liquidationPrice;

    return {
      margin,
      positionNotional,
      contracts,
      effectiveStopPct,
      maxRiskAmount,
      rawTp1Pct,
      pnlTp1,
      roiTp1,
      rawTp2Pct,
      pnlTp2,
      roiTp2,
      pnlStop,
      roiStop,
      rrRatio1,
      rrRatio2,
      liquidationPrice,
      isStopSaferThanLiq
    };
  }, [setup, sizingMode, initialCapital, riskPercent, customMargin, leverage]);

  const handleRegisterInRiskDashboard = () => {
    if (!calculations) return;
    try {
      const STORAGE_KEY_POS = 'superbot_portfolio_positions';
      const existingStr = localStorage.getItem(STORAGE_KEY_POS);
      const existing = existingStr ? JSON.parse(existingStr) : [];

      const newPos = {
        id: `calc-pos-${Date.now()}`,
        symbol: ticker.symbol,
        direction: setup.direction,
        entryPrice: setup.avgEntry,
        currentPrice: ticker.price,
        quantity: calculations.contracts,
        notionalUsd: calculations.positionNotional,
        marginUsd: calculations.margin,
        leverage,
        stopLoss: setup.stopLoss,
        takeProfit1: setup.tp1,
        takeProfit2: setup.tp2,
        openedAt: Date.now(),
        notes: `Simulado na Calculadora (${setup.direction} ${leverage}x)`
      };

      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify([newPos, ...existing]));
      showToast('success', 'Posição Registrada no Portfolio', `${ticker.symbol} ${setup.direction} $${calculations.positionNotional.toFixed(0)} adicionado ao Risk Exposure Dashboard.`);
    } catch {
      showToast('error', 'Erro ao Salvar', 'Não foi possível salvar a posição na carteira.');
    }
  };

  return (
    <div className="bg-[#050505] rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all">
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-[#0A0A0A] border-b border-white/10 flex items-center justify-between cursor-pointer select-none hover:bg-neutral-900/40 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                Simulador de Posição & Calculadora de PnL / ROI
              </h4>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${
                setup.direction === 'LONG' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {setup.direction} {leverage}x
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans">
              Simule o tamanho do lote, alavancagem, risco financeiro e projeção de lucros com base nos gatilhos da estratégia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {calculations && (
            <div className="hidden md:flex items-center gap-3 font-mono text-[11px] pr-2">
              <span className="text-neutral-400">
                Margem: <strong className="text-white">${calculations.margin.toFixed(0)}</strong>
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-400">
                Alvo 1: <strong className="text-emerald-400">+{calculations.roiTp1.toFixed(1)}% (${calculations.pnlTp1.toFixed(0)})</strong>
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-400">
                Risco: <strong className="text-rose-400">${calculations.maxRiskAmount.toFixed(0)}</strong>
              </span>
            </div>
          )}
          <button 
            type="button" 
            aria-label="Expandir ou recolher calculadora"
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content Panel */}
      {isExpanded && (
        <div className="p-4 space-y-4 font-sans text-xs">
          {/* Signal Source Selector & Setup Overview */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                Origem das Zonas:
              </span>
              <div className="flex items-center bg-[#000] p-0.5 rounded-lg border border-white/10 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setUseAISignal(false)}
                  className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                    !useAISignal 
                      ? 'bg-neutral-800 text-orange-400 shadow-sm' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Bot Quant {activeSignal ? `(${activeSignal.timeframe})` : ''}</span>
                </button>
                {aiReview && (
                  <button
                    type="button"
                    onClick={() => setUseAISignal(true)}
                    className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                      useAISignal 
                        ? 'bg-orange-500 text-black shadow-sm font-black' 
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auditoria IA</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Setup Prices Display */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="bg-neutral-900 px-2 py-0.5 rounded border border-white/5 text-neutral-300">
                Entrada: <strong className="text-white">{formatPrice(setup.avgEntry, { currency: true })}</strong>
              </span>
              <span className="bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20 text-rose-300">
                Stop: <strong>{formatPrice(setup.stopLoss, { currency: true })}</strong>
              </span>
              <span className="bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-300">
                Alvo 1: <strong>{formatPrice(setup.tp1, { currency: true })}</strong>
              </span>
              <span className="bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-300">
                Alvo 2: <strong>{formatPrice(setup.tp2, { currency: true })}</strong>
              </span>
            </div>
          </div>

          {/* Interactive Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Box 1: Sizing Mode & Capital */}
            <div className="bg-[#090909] p-3 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                  Modo de Dimensionamento
                </span>
                <div className="flex items-center bg-[#000] p-0.5 rounded border border-white/10 text-[9px] font-mono">
                  <button
                    type="button"
                    onClick={() => setSizingMode('FIXED_MARGIN')}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      sizingMode === 'FIXED_MARGIN' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    Margem Fixa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizingMode('RISK_BASED')}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      sizingMode === 'RISK_BASED' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    % de Risco da Conta
                  </button>
                </div>
              </div>

              {sizingMode === 'FIXED_MARGIN' ? (
                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                    <span className="text-neutral-400">Margem Utilizada no Trade:</span>
                    <span className="font-bold text-white bg-neutral-800 px-1.5 py-0.5 rounded">
                      ${customMargin.toFixed(0)} USD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step="10"
                    value={customMargin}
                    onChange={(e) => setCustomMargin(parseFloat(e.target.value))}
                    className="w-full accent-orange-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-1 mt-1.5">
                    {[50, 100, 250, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCustomMargin(preset)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition ${
                          customMargin === preset
                            ? 'bg-orange-500 text-black border-orange-400'
                            : 'bg-neutral-900 text-neutral-400 border-white/5 hover:border-white/20'
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                      <span className="text-neutral-400">Patrimônio Total da Conta:</span>
                      <span className="font-bold text-white">${initialCapital}</span>
                    </div>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(Math.max(10, parseFloat(e.target.value) || 0))}
                      className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                      <span className="text-neutral-400">Risco Máximo por Trade:</span>
                      <span className="font-bold text-rose-400">{riskPercent}% (${((initialCapital * riskPercent) / 100).toFixed(0)})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[0.5, 1.0, 1.5, 2.0, 3.0].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRiskPercent(r)}
                          className={`flex-1 py-0.5 rounded text-[9px] font-mono font-bold border transition ${
                            riskPercent === r
                              ? 'bg-rose-500 text-white border-rose-400'
                              : 'bg-neutral-900 text-neutral-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Box 2: Leverage Slider & Controls */}
            <div className="bg-[#090909] p-3 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                  Alavancagem Futuros
                </span>
                <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                  leverage > 25 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    : leverage > 10 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}>
                  {leverage}x
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                  className="w-full accent-orange-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between gap-1 mt-2">
                  {[2, 5, 10, 20, 25, 50].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition ${
                        leverage === lev
                          ? 'bg-orange-500 text-black border-orange-400'
                          : 'bg-neutral-900 text-neutral-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {calculations && (
                <div className="text-[10px] font-mono text-neutral-400 bg-neutral-950 p-2 rounded border border-white/5 space-y-1">
                  <div className="flex justify-between">
                    <span>Tamanho Nocional:</span>
                    <strong className="text-white">${calculations.positionNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Qtd. Contratos ({ticker.symbol.replace('USDT', '')}):</span>
                    <strong className="text-white">{calculations.contracts.toFixed(ticker.price < 1 ? 2 : 4)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Box 3: Risk Diagnostics & Liquidation Price */}
            <div className="bg-[#090909] p-3 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                  Preço de Liquidação Estimado
                </span>
                <ShieldAlert className={`w-3.5 h-3.5 ${calculations?.isStopSaferThanLiq ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`} />
              </div>

              {calculations && (
                <div className="space-y-2">
                  <div className="bg-neutral-950 p-2 rounded border border-white/5 text-center font-mono">
                    <span className="text-[9px] text-neutral-500 block uppercase">Preço de Ruína / Liquidação:</span>
                    <span className="text-sm font-black text-rose-400">
                      {formatPrice(calculations.liquidationPrice, { currency: true })}
                    </span>
                  </div>

                  <div className={`p-1.5 rounded text-[10px] border font-mono ${
                    calculations.isStopSaferThanLiq 
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}>
                    {calculations.isStopSaferThanLiq ? (
                      <span>✓ Stop Loss ativará antes da liquidação ({calculations.effectiveStopPct.toFixed(2)}% vs {((100 / leverage) * 0.95).toFixed(1)}%).</span>
                    ) : (
                      <span>⚠️ Alavancagem excessiva: liquidação pode ocorrer antes do Stop Loss!</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Outcome Cards (Alvo 1, Alvo 2 e Stop Loss) */}
          {calculations && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Target 1 Card */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-[#050505] p-3 rounded-xl border border-emerald-500/30 shadow-md space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase">
                    <Target className="w-3.5 h-3.5" />
                    Alvo 1 (Scalp)
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    R:R 1 : {calculations.rrRatio1.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-black text-emerald-400">
                      +{calculations.roiTp1.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-neutral-400 block font-sans">Retorno sobre a Margem (ROI)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-white">
                      +${calculations.pnlTp1.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-neutral-400 block">Lucro Projetado</span>
                  </div>
                </div>

                <div className="text-[9px] text-neutral-400 border-t border-white/5 pt-1.5 flex justify-between">
                  <span>Preço Alvo: <strong>{formatPrice(setup.tp1, { currency: true })}</strong></span>
                  <span>Variação Ativo: <strong>+{calculations.rawTp1Pct.toFixed(2)}%</strong></span>
                </div>
              </div>

              {/* Target 2 Card */}
              <div className="bg-gradient-to-br from-cyan-950/40 to-[#050505] p-3 rounded-xl border border-cyan-500/30 shadow-md space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 uppercase">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Alvo 2 (Swing)
                  </span>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                    R:R 1 : {calculations.rrRatio2.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-black text-cyan-400">
                      +{calculations.roiTp2.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-neutral-400 block font-sans">Retorno sobre a Margem (ROI)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-white">
                      +${calculations.pnlTp2.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-neutral-400 block">Lucro Projetado</span>
                  </div>
                </div>

                <div className="text-[9px] text-neutral-400 border-t border-white/5 pt-1.5 flex justify-between">
                  <span>Preço Alvo: <strong>{formatPrice(setup.tp2, { currency: true })}</strong></span>
                  <span>Variação Ativo: <strong>+{calculations.rawTp2Pct.toFixed(2)}%</strong></span>
                </div>
              </div>

              {/* Stop Loss Card */}
              <div className="bg-gradient-to-br from-rose-950/40 to-[#050505] p-3 rounded-xl border border-rose-500/30 shadow-md space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 uppercase">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    Cenário de Stop Loss
                  </span>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                    Risco Máximo
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-black text-rose-400">
                      {calculations.roiStop.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-neutral-400 block font-sans">Perda na Margem</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-rose-400">
                      -${calculations.maxRiskAmount.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-neutral-400 block">Perda Financeira</span>
                  </div>
                </div>

                <div className="text-[9px] text-neutral-400 border-t border-white/5 pt-1.5 flex justify-between">
                  <span>Gatilho Stop: <strong>{formatPrice(setup.stopLoss, { currency: true })}</strong></span>
                  <span>Variação Ativo: <strong>-{calculations.effectiveStopPct.toFixed(2)}%</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action: Register into Risk Exposure Dashboard */}
          {calculations && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
              <div className="text-[11px] text-neutral-300">
                <span className="text-neutral-400">Impacto no Portfolio: </span>
                <strong className={setup.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                  {setup.direction === 'LONG' ? '+' : '-'}${calculations.positionNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </strong>
                <span className="text-[10px] text-neutral-500 ml-1.5">
                  (Margem: ${calculations.margin.toFixed(0)} • {leverage}x)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRegisterInRiskDashboard}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Enviar ao Risk Exposure</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
