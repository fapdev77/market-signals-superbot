import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Gauge, 
  Zap, 
  Compass, 
  Sparkles, 
  Layers, 
  ChevronDown, 
  Radio, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  Clock,
  BookOpen
} from 'lucide-react';
import { TickerData } from '../types';
import { formatPrice, formatPercent, formatCompactNumber, formatTimestamp } from '../utils/formatters';
import { Tooltip } from './Tooltip';
import { ADXIndicatorDocModal } from './ADXIndicatorDocModal';

export interface TrendStrengthIndicatorProps {
  ticker: TickerData | null;
  tickers?: TickerData[];
  onSelectTicker?: (ticker: TickerData) => void;
  onOpenChart?: (ticker: TickerData) => void;
  onRequestAIReview?: (ticker: TickerData) => void;
  isWsConnected?: boolean;
  className?: string;
}

export interface MomentumFactorScore {
  name: string;
  category: string;
  score: number; // 0 to 100
  weight: number; // %
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  valueDisplay: string;
  detail: string;
}

export interface TrendAnalysisResult {
  score: number; // 0 to 100
  directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signedScore: number; // -100 (Extrema Baixa) a +100 (Extrema Alta)
  adxEstimated: number; // 10.0 to 65.0
  bars: 1 | 2 | 3 | 4 | 5;
  regimeLabel: string;
  regimeDescription: string;
  regimeColor: string;
  regimeBg: string;
  factors: MomentumFactorScore[];
  rangePositionPct: number; // 0 to 100%
  institutionalVerdict: string;
}

/**
 * Computes deep multi-vector trend strength and real-time momentum metrics
 * directly from live Binance WebSocket ticker data.
 */
export function analyzeRealtimeMomentum(t: TickerData | null): TrendAnalysisResult {
  if (!t) {
    return {
      score: 0,
      directionalBias: 'NEUTRAL',
      signedScore: 0,
      adxEstimated: 15,
      bars: 1,
      regimeLabel: 'Aguardando Feed',
      regimeDescription: 'Sem dados ativos para processar o momentum.',
      regimeColor: 'text-neutral-400',
      regimeBg: 'bg-neutral-900 border-white/10',
      factors: [],
      rangePositionPct: 50,
      institutionalVerdict: 'Conectando ao stream em tempo real da Binance...'
    };
  }

  const changePct = t.priceChangePercent24h ?? 0;
  const absChange = Math.abs(changePct);

  // 1. Initial Directional bias determination
  let isBullish = changePct > 0.2;
  let isBearish = changePct < -0.2;

  if (t.signalType && t.signalType !== 'NEUTRAL') {
    if (t.signalType.includes('LONG')) isBullish = true;
    if (t.signalType.includes('SHORT')) isBearish = true;
  } else if (t.cvdDirection === 'BUY') {
    isBullish = true;
  } else if (t.cvdDirection === 'SELL') {
    isBearish = true;
  }

  // 2. Range Position (0% at 24h Low, 100% at 24h High)
  let rangePosPct = 50;
  if (t.high24h && t.low24h && t.high24h > t.low24h && t.price) {
    rangePosPct = Math.max(0, Math.min(100, ((t.price - t.low24h) / (t.high24h - t.low24h)) * 100));
  }

  // Factor 1: Price Velocity (Rate of Change)
  // Max score 100 if absChange >= 6.0%
  const velocityScore = Math.min(100, Math.round(absChange * 16));
  const velocityBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
    changePct > 0.5 ? 'BULLISH' : changePct < -0.5 ? 'BEARISH' : 'NEUTRAL';

  // Factor 2: Moving Average 24h Deviation (Mean Reversion vs Trend Extension)
  let maDevPct = t.ma24hDeviationPct;
  if (maDevPct === undefined && t.ma24h && t.price) {
    maDevPct = ((t.price - t.ma24h) / t.ma24h) * 100;
  }
  const effectiveMaDev = maDevPct ?? (changePct * 0.6);
  const absMaDev = Math.abs(effectiveMaDev);
  const maScore = Math.min(100, Math.round(absMaDev * 20));
  const maBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
    effectiveMaDev > 0.3 ? 'BULLISH' : effectiveMaDev < -0.3 ? 'BEARISH' : 'NEUTRAL';

  // Factor 3: Range Expansion & Price Location
  // When bullish, high range pos = high trend score. When bearish, low range pos = high bearish trend score.
  let rangeExpansionScore = 50;
  let rangeBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (rangePosPct >= 65) {
    rangeExpansionScore = Math.min(100, Math.round(((rangePosPct - 50) / 50) * 100));
    rangeBias = 'BULLISH';
  } else if (rangePosPct <= 35) {
    rangeExpansionScore = Math.min(100, Math.round(((50 - rangePosPct) / 50) * 100));
    rangeBias = 'BEARISH';
  } else {
    rangeExpansionScore = Math.max(10, Math.round(Math.abs(rangePosPct - 50) * 2));
    rangeBias = 'NEUTRAL';
  }

  // Factor 4: Order Flow Aggression & CVD Delta
  let cvdScore = 50;
  let cvdBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const takerRatio = t.takerBuyRatio ?? 0.5;
  const takerPct = takerRatio * 100;

  if (takerPct >= 53 || t.cvdDirection === 'BUY') {
    cvdScore = Math.min(100, Math.round(50 + (takerPct - 50) * 4));
    cvdBias = 'BULLISH';
  } else if (takerPct <= 47 || t.cvdDirection === 'SELL') {
    cvdScore = Math.min(100, Math.round(50 + (50 - takerPct) * 4));
    cvdBias = 'BEARISH';
  } else {
    cvdScore = 30;
    cvdBias = 'NEUTRAL';
  }

  // Factor 5: Open Interest Institutional Flow (1h & 24h)
  const oiChange1h = t.openInterestChange1h ?? 0;
  const oiChange24h = t.openInterestChange24h ?? 0;
  let oiScore = 40;
  let oiBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  
  if (oiChange1h > 0.8 || oiChange24h > 2.5) {
    // New capital entering
    oiScore = Math.min(100, Math.round(60 + Math.abs(oiChange1h) * 15));
    // If price is rising + OI rising => Bullish continuation
    // If price is falling + OI rising => Bearish aggressive shorting
    oiBias = isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';
  } else if (oiChange1h < -0.8 || oiChange24h < -2.5) {
    // Capital leaving (short covering or long flush)
    oiScore = Math.max(20, Math.round(50 - Math.abs(oiChange1h) * 10));
    oiBias = 'NEUTRAL';
  } else {
    oiScore = 40;
    oiBias = 'NEUTRAL';
  }

  // Factor 6: Confluence & Market Structure
  const confluenceScore = t.confluenceScore ?? 50;
  let structureBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (t.keyLevels?.structureBreak === 'BULLISH' || (t.signalType && t.signalType.includes('LONG'))) {
    structureBias = 'BULLISH';
  } else if (t.keyLevels?.structureBreak === 'BEARISH' || (t.signalType && t.signalType.includes('SHORT'))) {
    structureBias = 'BEARISH';
  }

  // Weighted Total Trend Strength Score (0 to 100)
  // Weights: Velocity 25%, Range 20%, CVD 20%, OI 15%, MA Dev 10%, Confluence 10%
  const totalRawScore = 
    velocityScore * 0.25 +
    rangeExpansionScore * 0.20 +
    cvdScore * 0.20 +
    oiScore * 0.15 +
    maScore * 0.10 +
    confluenceScore * 0.10;

  const score = Math.max(5, Math.min(100, Math.round(totalRawScore)));

  // Directional conviction based on factor votes
  let bullishVotes = 0;
  let bearishVotes = 0;
  [velocityBias, maBias, rangeBias, cvdBias, oiBias, structureBias].forEach(bias => {
    if (bias === 'BULLISH') bullishVotes++;
    if (bias === 'BEARISH') bearishVotes++;
  });

  let directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (bullishVotes >= 3 && bullishVotes > bearishVotes) {
    directionalBias = 'BULLISH';
  } else if (bearishVotes >= 3 && bearishVotes > bullishVotes) {
    directionalBias = 'BEARISH';
  } else if (isBullish && bullishVotes >= 2) {
    directionalBias = 'BULLISH';
  } else if (isBearish && bearishVotes >= 2) {
    directionalBias = 'BEARISH';
  }

  // Signed Momentum: -100 to +100
  let signedScore = 0;
  if (directionalBias === 'BULLISH') {
    signedScore = score;
  } else if (directionalBias === 'BEARISH') {
    signedScore = -score;
  } else {
    signedScore = Math.round((rangePosPct - 50) * (score / 100));
  }

  // ADX Equivalent: 10.0 to 65.0
  const adxEstimated = parseFloat((12 + (score / 100) * 48).toFixed(1));

  // Determine 1 to 5 bars & Regime
  let bars: 1 | 2 | 3 | 4 | 5 = 1;
  let regimeLabel = 'Consolidação / Sem Tendência';
  let regimeDescription = 'Preço oscilando em equilíbrio de liquidez sem momentum direcional sustentado.';
  let regimeColor = 'text-neutral-400';
  let regimeBg = 'bg-neutral-900 border-white/10';

  if (score >= 82 || adxEstimated >= 50) {
    bars = 5;
    if (directionalBias === 'BULLISH') {
      regimeLabel = 'Alta Parabólica (Risco Clímax)';
      regimeDescription = 'Forte aceleração de alta com compradores agressivos a mercado. Monitore zonas de exaustão.';
      regimeColor = 'text-emerald-400';
      regimeBg = 'bg-emerald-950/40 border-emerald-500/30';
    } else if (directionalBias === 'BEARISH') {
      regimeLabel = 'Capitulação / Queda Agressiva';
      regimeDescription = 'Vendedores batendo no bid com alto volume. Risco elevado de cascata ou clímax vendedor.';
      regimeColor = 'text-rose-400';
      regimeBg = 'bg-rose-950/40 border-rose-500/30';
    } else {
      regimeLabel = 'Alta Volatilidade Indecisa';
      regimeDescription = 'Expansão de volatilidade bilateral sem direção única consolidada.';
      regimeColor = 'text-amber-400';
      regimeBg = 'bg-amber-950/40 border-amber-500/30';
    }
  } else if (score >= 65 || adxEstimated >= 40) {
    bars = 4;
    if (directionalBias === 'BULLISH') {
      regimeLabel = 'Tendência de Alta Forte';
      regimeDescription = 'Momentum consistente com influxo institucional e sustentação no terço superior do range.';
      regimeColor = 'text-emerald-400';
      regimeBg = 'bg-emerald-950/30 border-emerald-500/25';
    } else if (directionalBias === 'BEARISH') {
      regimeLabel = 'Tendência de Baixa Forte';
      regimeDescription = 'Pressão vendedora sustentada com máximas descendentes e quebra de suportes.';
      regimeColor = 'text-rose-400';
      regimeBg = 'bg-rose-950/30 border-rose-500/25';
    } else {
      regimeLabel = 'Expansão Direcional Forte';
      regimeDescription = 'Força de rompimento em desenvolvimento com order flow ativo.';
      regimeColor = 'text-cyan-400';
      regimeBg = 'bg-cyan-950/30 border-cyan-500/25';
    }
  } else if (score >= 45 || adxEstimated >= 28) {
    bars = 3;
    if (directionalBias === 'BULLISH') {
      regimeLabel = 'Tendência de Alta Moderada';
      regimeDescription = 'Compradores no controle, mas momentum requer confirmação de rompimento de níveis chave.';
      regimeColor = 'text-teal-400';
      regimeBg = 'bg-teal-950/30 border-teal-500/20';
    } else if (directionalBias === 'BEARISH') {
      regimeLabel = 'Tendência de Baixa Moderada';
      regimeDescription = 'Vendedores no controle, operando abaixo da média móvel 24h.';
      regimeColor = 'text-amber-400';
      regimeBg = 'bg-amber-950/30 border-amber-500/20';
    } else {
      regimeLabel = 'Tendência Neutra em Construção';
      regimeDescription = 'Mercado tentando estabelecer direcional a partir de faixa de consolidação.';
      regimeColor = 'text-neutral-300';
      regimeBg = 'bg-neutral-900 border-white/10';
    }
  } else if (score >= 28 || adxEstimated >= 20) {
    bars = 2;
    if (directionalBias === 'NEUTRAL') {
      regimeLabel = 'Mercado Lateral / Consolidação';
      regimeDescription = 'Oscilação em faixa lateral com equilíbrio entre forças compradoras e vendedoras.';
    } else {
      regimeLabel = 'Tendência Incipiente / Fraca';
      regimeDescription = 'Primeiros sinais de movimento direcional ou pullback dentro de canal mais amplo.';
    }
    regimeColor = 'text-neutral-400';
    regimeBg = 'bg-neutral-900 border-white/10';
  } else {
    bars = 1;
    regimeLabel = 'Mercado Lateral / Range-Bound';
    regimeDescription = 'Preço estritamente comprimido em faixa de liquidez sem dominância institucional.';
    regimeColor = 'text-neutral-500';
    regimeBg = 'bg-neutral-950 border-white/5';
  }

  // Construct structured factors list for UI display
  const factors: MomentumFactorScore[] = [
    {
      name: 'Velocidade de Preço (ROC)',
      category: 'Momentum',
      score: velocityScore,
      weight: 25,
      bias: velocityBias,
      valueDisplay: formatPercent(changePct, true),
      detail: `${absChange >= 3 ? 'Aceleração agressiva' : absChange >= 1 ? 'Variação normal' : 'Oscilação estreita'}`
    },
    {
      name: 'Posição no Range 24h',
      category: 'Estrutura',
      score: rangeExpansionScore,
      weight: 20,
      bias: rangeBias,
      valueDisplay: `${rangePosPct.toFixed(1)}% do Range`,
      detail: rangePosPct >= 70 ? 'Perto da Máxima 24h' : rangePosPct <= 30 ? 'Perto da Mínima 24h' : 'Equilíbrio central'
    },
    {
      name: 'Agressão CVD & Taker Ratio',
      category: 'Order Flow',
      score: cvdScore,
      weight: 20,
      bias: cvdBias,
      valueDisplay: `${takerPct.toFixed(1)}% Taker Buy`,
      detail: cvdBias === 'BULLISH' ? 'Agressão compradora líquida' : cvdBias === 'BEARISH' ? 'Agressão vendedora líquida' : 'Fluxo pareado'
    },
    {
      name: 'Influxo de Open Interest',
      category: 'Derivativos',
      score: oiScore,
      weight: 15,
      bias: oiBias,
      valueDisplay: `${formatPercent(oiChange1h, true)} (1h)`,
      detail: oiChange1h > 0.5 ? 'Expansão de contratos' : oiChange1h < -0.5 ? 'Desalavancagem / Saída' : 'Volume estável'
    },
    {
      name: 'Desvio da Média Móvel (MA24h)',
      category: 'Tendência',
      score: maScore,
      weight: 10,
      bias: maBias,
      valueDisplay: `${formatPercent(effectiveMaDev, true)}`,
      detail: effectiveMaDev > 0 ? 'Acima da MA24h' : 'Abaixo da MA24h'
    },
    {
      name: 'Confluência Técnica Geral',
      category: 'Algorítmico',
      score: confluenceScore,
      weight: 10,
      bias: structureBias,
      valueDisplay: `${confluenceScore}/100 pts`,
      detail: t.signalType !== 'NEUTRAL' ? `Sinal: ${t.signalType}` : 'Sem viés unilateral'
    }
  ];

  // Algorithmic institutional verdict sentence
  let institutionalVerdict = '';
  if (directionalBias === 'BULLISH') {
    institutionalVerdict = `Momentum comprador ${score >= 65 ? 'consistente e sustentado' : 'em desenvolvimento'}. Preço situado a ${rangePosPct.toFixed(0)}% do range 24h com ${takerPct.toFixed(0)}% de taker buyers e ADX estimado em ${adxEstimated}. Favorece operações alinhadas à tendência de alta.`;
  } else if (directionalBias === 'BEARISH') {
    institutionalVerdict = `Pressão vendedora ${score >= 65 ? 'intensa e dominante' : 'moderada'}. Preço operando no terço inferior (${rangePosPct.toFixed(0)}% do range 24h) com desvio de ${formatPercent(effectiveMaDev)} da MA24h. Risco elevado para posições compradas contra a tendência.`;
  } else {
    institutionalVerdict = `Mercado em consolidação com ADX em ${adxEstimated} (abaixo do limiar de 25). Order flow equilibrado entre compradores e vendedores. Ideal para estratégias de range ou aguardar rompimento de volatilidade.`;
  }

  return {
    score,
    directionalBias,
    signedScore,
    adxEstimated,
    bars,
    regimeLabel,
    regimeDescription,
    regimeColor,
    regimeBg,
    factors,
    rangePositionPct: rangePosPct,
    institutionalVerdict
  };
}

export const TrendStrengthIndicator: React.FC<TrendStrengthIndicatorProps> = ({
  ticker,
  tickers = [],
  onSelectTicker,
  onOpenChart,
  onRequestAIReview,
  isWsConnected = true,
  className = ''
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Real-time analysis for selected ticker
  const analysis = useMemo(() => {
    return analyzeRealtimeMomentum(ticker);
  }, [ticker]);

  // Filtered tickers list for quick switcher
  const filteredTickers = useMemo(() => {
    if (!searchTerm.trim()) return tickers.slice(0, 15);
    const q = searchTerm.toUpperCase();
    return tickers.filter(t => t.symbol.includes(q) || t.baseAsset.includes(q)).slice(0, 15);
  }, [tickers, searchTerm]);

  if (!ticker) {
    return (
      <div className={`p-6 rounded-2xl bg-[#08080a] border border-white/10 text-center font-mono space-y-3 ${className}`}>
        <Activity className="w-8 h-8 text-orange-400 animate-spin mx-auto opacity-70" />
        <div className="text-sm font-bold text-white">Nenhum Ativo Selecionado</div>
        <p className="text-xs text-neutral-400">
          Selecione um ativo no catálogo ou aguarde a sincronização dos feeds WebSocket da Binance.
        </p>
      </div>
    );
  }

  const {
    score,
    directionalBias,
    adxEstimated,
    bars,
    regimeLabel,
    regimeDescription,
    regimeColor,
    regimeBg,
    factors,
    rangePositionPct,
    institutionalVerdict
  } = analysis;

  const isPriceUp = (ticker.priceChangePercent24h ?? 0) >= 0;

  return (
    <div className={`space-y-4 text-neutral-200 font-sans ${className}`}>
      {/* Header Bar: Ticker Identity, Quick Switcher, Live Telemetry & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0a0a0d] border border-white/10 rounded-xl">
        {/* Ticker Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(prev => !prev)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-orange-500/40 hover:bg-neutral-800 transition text-left"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-mono text-sm font-black text-white">
                <span>{ticker.symbol}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                <span>{ticker.baseAsset}</span>
                <span aria-hidden="true">·</span>
                <span>Binance Futures</span>
              </div>
            </div>
          </button>

          {/* Quick Switch Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#0d0e12] border border-orange-500/30 rounded-xl shadow-2xl p-2 z-50 animate-fadeIn font-mono">
              <div className="p-1 mb-1.5 border-b border-white/10">
                <input
                  type="text"
                  placeholder="Filtrar símbolo (ex: BTC)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-black/60 border border-white/10 rounded text-white focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                {filteredTickers.map(t => {
                  const isCurrent = t.symbol === ticker.symbol;
                  const tUp = (t.priceChangePercent24h ?? 0) >= 0;
                  return (
                    <button
                      key={t.symbol}
                      onClick={() => {
                        onSelectTicker?.(t);
                        setIsDropdownOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition ${
                        isCurrent 
                          ? 'bg-orange-500/20 text-orange-300 font-bold' 
                          : 'hover:bg-white/5 text-neutral-300'
                      }`}
                    >
                      <span className="font-bold">{t.symbol}</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-neutral-400">{formatPrice(t.price, { currency: true })}</span>
                        <span className={tUp ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatPercent(t.priceChangePercent24h, true)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Current Price & Live 24h Change */}
        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-base font-black text-white tabular-nums">
              {formatPrice(ticker.price, { currency: true })}
            </div>
            <div className={`text-xs font-bold flex items-center justify-end gap-1 ${isPriceUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPriceUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{formatPercent(ticker.priceChangePercent24h, true)}</span>
            </div>
          </div>

          {/* WebSocket Pulse */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-white/10 text-[10px] font-mono text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isWsConnected ? 'FEED ATIVO' : 'FEED PAUSADO'}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsDocModalOpen(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-orange-500/40 text-orange-400 transition flex items-center gap-1"
              title="Abrir documentação do indicador Estimated ADX"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guia ADX</span>
            </button>
            {onOpenChart && (
              <button
                onClick={() => onOpenChart(ticker)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-cyan-500/40 text-cyan-400 transition flex items-center gap-1"
                title="Abrir gráfico técnico e perfil de volume"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Gráfico</span>
              </button>
            )}
            {onRequestAIReview && (
              <button
                onClick={() => onRequestAIReview(ticker)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 text-orange-300 transition flex items-center gap-1"
                title="Solicitar análise quântica de IA"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden md:inline">Revisão IA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Analysis Card: Strength Score, Gauge, ADX Meter & Regime */}
      <div className={`p-4 rounded-xl border ${regimeBg} transition-all`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Column 1: Trend Score & ADX */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400">
              <Gauge className="w-4 h-4 text-orange-400" />
              <span>Força de Tendência (0-100)</span>
            </div>
            
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-black font-mono tracking-tight tabular-nums ${regimeColor}`}>
                {score}
              </span>
              <span className="text-xs font-mono text-neutral-400">/ 100 pts</span>
              
              <div className="ml-auto flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(barIndex => {
                  const isActive = barIndex <= bars;
                  let barColor = 'bg-neutral-700';
                  if (isActive) {
                    if (directionalBias === 'BULLISH') barColor = 'bg-emerald-400';
                    else if (directionalBias === 'BEARISH') barColor = 'bg-rose-400';
                    else barColor = 'bg-cyan-400';
                  }
                  return (
                    <div
                      key={barIndex}
                      className={`w-2 rounded-sm transition-all ${
                        barIndex === 1 ? 'h-3' :
                        barIndex === 2 ? 'h-4' :
                        barIndex === 3 ? 'h-5' :
                        barIndex === 4 ? 'h-6' : 'h-7'
                      } ${barColor}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1 border-t border-white/5">
              <span>ADX Estimado:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-neutral-200">
                  ~{adxEstimated} {adxEstimated >= 25 ? '(Tendência Ativa)' : '(Sem Tendência)'}
                </span>
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 text-[10px] font-mono font-bold transition flex items-center gap-1 ml-1"
                  title="Ver documentação e exemplos do ADX"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Guia</span>
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Directional Regime & Verdict */}
          <div className="space-y-1.5 md:border-x md:border-white/10 md:px-4">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span>Regime Técnico Atual</span>
              <span className={`font-bold ${regimeColor}`}>
                {directionalBias === 'BULLISH' ? '▲ ALTA' : directionalBias === 'BEARISH' ? '▼ BAIXA' : '— LATERAL'}
              </span>
            </div>
            
            <div className={`text-base font-black font-mono tracking-wide ${regimeColor}`}>
              {regimeLabel}
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {regimeDescription}
            </p>
          </div>

          {/* Column 3: 24h Range Position Gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Posição no Range 24h</span>
              </span>
              <span className="font-bold text-white tabular-nums">
                {rangePositionPct.toFixed(1)}%
              </span>
            </div>

            {/* Range Track with Low, Current Price & High Markers */}
            <div className="relative pt-1 pb-3">
              <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-300 ${
                    rangePositionPct >= 65 ? 'bg-emerald-500' :
                    rangePositionPct <= 35 ? 'bg-rose-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${rangePositionPct}%` }}
                />
              </div>

              {/* Pin indicator for current price */}
              <div 
                className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${rangePositionPct}%` }}
              >
                <div className="w-1.5 h-3.5 bg-white rounded-full shadow-md shadow-black" />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-1">
                <span>Mín: {formatPrice(ticker.low24h)}</span>
                <span>Máx: {formatPrice(ticker.high24h)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Vector Momentum Breakdown Table / Grid */}
      <div className="bg-[#08080a] border border-white/10 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Vetores de Momentum & Convicção em Tempo Real
            </span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            6 Indicadores Ponderados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {factors.map((f, i) => {
            const isBull = f.bias === 'BULLISH';
            const isBear = f.bias === 'BEARISH';
            const biasColor = isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-neutral-400';
            const biasBg = isBull ? 'bg-emerald-500/10 border-emerald-500/20' : isBear ? 'bg-rose-500/10 border-rose-500/20' : 'bg-neutral-900 border-white/5';

            return (
              <div 
                key={i} 
                className={`p-2.5 rounded-lg border ${biasBg} space-y-1.5 transition hover:border-white/20`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-neutral-300 font-semibold">{f.name}</span>
                  <span className={`font-bold ${biasColor}`}>
                    {f.valueDisplay}
                  </span>
                </div>

                {/* Progress bar showing factor intensity (0-100) */}
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isBull ? 'bg-emerald-400' : isBear ? 'bg-rose-400' : 'bg-neutral-500'
                    }`}
                    style={{ width: `${Math.max(5, f.score)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>{f.detail}</span>
                  <span>Peso: {f.weight}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Algorithmic Diagnostic Box */}
      <div className="p-3 bg-[#0a0a0e] border border-white/10 rounded-xl space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-orange-400 uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5" />
          <span>Diagnóstico de Momentum do Bot</span>
        </div>
        <p className="text-xs text-neutral-300 font-mono leading-relaxed">
          {institutionalVerdict}
        </p>
      </div>

      {/* Live Feed Provenance Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>Fonte: Stream SSE / Binance Ticker</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Latência: &lt; 50ms</span>
        </div>
        <div className="flex items-center gap-1 text-neutral-400">
          <Clock className="w-3 h-3" />
          <span>Último tick: {formatTimestamp(ticker.updatedAt || Date.now())}</span>
        </div>
      </div>

      {/* ADX Indicator Documentation Modal */}
      <ADXIndicatorDocModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
      />
    </div>
  );
};
