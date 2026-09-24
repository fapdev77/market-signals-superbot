import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radar, Star, Flame, ArrowUpRight, ArrowDownRight, RefreshCw, Sliders, 
  Search, ShieldAlert, BarChart3, TrendingUp, Zap, Sparkles, Activity, 
  CheckCircle2, Clock, DollarSign, Layers, ExternalLink, Ban, RotateCcw,
  Plus, X, ListFilter, Check, Trash2, ShieldCheck, Info
} from 'lucide-react';
import { ScreenerAsset, ScreenerSettings, ScreenerScanSummary, MarketSector, ScreenerMode, TickerData } from '../types';
import { apiClient } from '../services/apiClient';
import { formatPrice, formatPercent, formatVolume } from '../utils/formatters';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

const SUGGESTED_STABLECOINS = [
  { symbol: 'USDCUSDT', name: 'USD Coin' },
  { symbol: 'USDTUSDC', name: 'USDT / USDC' },
  { symbol: 'USDGUSDT', name: 'Global Dollar' },
  { symbol: 'USDTUSDG', name: 'USDT / USDG' },
  { symbol: 'PYUSDUSDT', name: 'PayPal USD' },
  { symbol: 'FDUSDUSDT', name: 'First Digital USD' },
  { symbol: 'TUSDUSDT', name: 'TrueUSD' },
  { symbol: 'BUSDUSDT', name: 'Binance USD' },
  { symbol: 'USDEUSDT', name: 'Ethena USDe' },
  { symbol: 'DAIUSDT', name: 'MakerDAO DAI' },
  { symbol: 'EURUSDT', name: 'Euro Forex' },
  { symbol: 'AEURUSDT', name: 'Anchored Euro' },
  { symbol: 'USTCUSDT', name: 'TerraClassicUSD' },
  { symbol: 'USDPUSDT', name: 'Pax Dollar' },
  { symbol: 'USDCTUSD', name: 'USDC / TUSD' }
];

interface ScreenerDashboardProps {
  onSelectTicker?: (ticker: TickerData) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ScreenerDashboard: React.FC<ScreenerDashboardProps> = ({
  onSelectTicker,
  onNavigateToTab
}) => {
  const [assets, setAssets] = useState<ScreenerAsset[]>([]);
  const [summary, setSummary] = useState<ScreenerScanSummary | null>(null);
  const [settings, setSettings] = useState<ScreenerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSector, setSelectedSector] = useState<MarketSector>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMonitored, setOnlyMonitored] = useState(false);
  const [hideExcluded, setHideExcluded] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'gain' | 'volume' | 'oi' | 'funding'>('score');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'exclusions'>('general');
  const [isExclusionModalOpen, setIsExclusionModalOpen] = useState(false);
  const [newExcludeInput, setNewExcludeInput] = useState('');
  const [excludeFilterQuery, setExcludeFilterQuery] = useState('');
  const [isExcludingLoading, setIsExcludingLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const { showToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [assetsRes, settingsRes] = await Promise.all([
        apiClient.getScreenerAssets(),
        apiClient.getScreenerSettings()
      ]);
      setAssets(assetsRes.assets || []);
      setSummary(assetsRes.summary || null);
      setSettings(settingsRes);
    } catch (err: any) {
      showToast('error', 'Falha ao carregar Screener', err?.message || 'Erro ao sincronizar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleFavorite = async (symbol: string, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await apiClient.toggleFavorite(symbol, !currentStatus);
      setAssets(prev => prev.map(a => a.symbol === symbol ? { ...a, isFavorite: res.isFavorite } : a));
      showToast(
        'success', 
        res.isFavorite ? '★ Adicionado aos Favoritos' : 'Removido dos Favoritos', 
        `${symbol} agora ${res.isFavorite ? 'será monitorado permanentemente' : 'segue as regras do radar dinâmico'}.`
      );
      // Reload summary to reflect updated counts
      const updated = await apiClient.getScreenerAssets();
      setSummary(updated.summary);
    } catch (err: any) {
      showToast('error', 'Erro ao alterar favorito', err?.message);
    }
  };

  const handleToggleExclude = async (symbol: string, shouldExclude?: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const normalized = symbol.trim().toUpperCase().replace(/[\/\-_]/g, '');
    if (!normalized) return;

    try {
      setIsExcludingLoading(true);
      const res = await apiClient.toggleExcludeSymbol(normalized, shouldExclude);
      const isNowExcluded = res.excludedSymbols.includes(normalized);

      // Update local assets state
      setAssets(prev => prev.map(a => {
        if (a.symbol === normalized) {
          return {
            ...a,
            isExcluded: isNowExcluded,
            sector: isNowExcluded ? 'EXCLUDED' : (a.sector === 'EXCLUDED' ? 'L1_L2' : a.sector),
            isMonitored: isNowExcluded ? false : a.isMonitored,
            monitoringReason: isNowExcluded ? 'NONE' : a.monitoringReason
          };
        }
        return a;
      }));

      // Update local settings
      if (settings) {
        setSettings({ ...settings, excludedSymbols: res.excludedSymbols });
      }
      if (res.summary) {
        setSummary(res.summary);
      }

      showToast(
        isNowExcluded ? 'info' : 'success',
        isNowExcluded ? '🚫 Ativo Excluído do Radar' : '✓ Ativo Reabilitado',
        isNowExcluded
          ? `${normalized} agora está na lista de exclusão e não será monitorado pelo robô.`
          : `${normalized} foi removido da lista de exclusão e reabilitado para análise.`
      );
    } catch (err: any) {
      showToast('error', 'Erro ao atualizar lista de exclusão', err?.message);
    } finally {
      setIsExcludingLoading(false);
    }
  };

  const handleAddCustomExclude = async (symbolToAdd?: string) => {
    const sym = (symbolToAdd || newExcludeInput).trim().toUpperCase().replace(/[\/\-_]/g, '');
    if (!sym) return;
    await handleToggleExclude(sym, true);
    setNewExcludeInput('');
  };

  const handleResetExclusions = async () => {
    try {
      setIsExcludingLoading(true);
      const res = await apiClient.resetExcludedSymbols();
      if (settings) {
        setSettings({ ...settings, excludedSymbols: res.excludedSymbols });
      }
      if (res.summary) {
        setSummary(res.summary);
      }
      await loadData();
      showToast('success', 'Lista Redefinida', 'Pares estáveis padrão (USDT/USDC, USDG/USDT, PYUSD, etc.) restaurados.');
    } catch (err: any) {
      showToast('error', 'Erro ao redefinir lista', err?.message);
    } finally {
      setIsExcludingLoading(false);
    }
  };

  const handleTriggerManualScan = async () => {
    try {
      setIsScanning(true);
      const res = await apiClient.triggerScreenerScan();
      showToast('success', 'Varredura Concluída', `Radar reavaliado: ${res.monitoredCount} ativos ativos no universo de execução.`);
      await loadData();
    } catch (err: any) {
      showToast('error', 'Erro na varredura', err?.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setSavingSettings(true);
      await apiClient.saveScreenerSettings(settings);
      showToast('success', 'Configurações Salvas', 'Parâmetros do universo dinâmico, lista de exclusão e pesos de momentum atualizados.');
      setIsSettingsOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('error', 'Erro ao salvar configurações', err?.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Sector filter
      if (selectedSector === 'EXCLUDED') {
        if (!asset.isExcluded) return false;
      } else {
        // If user activated "hideExcluded", suppress excluded assets from normal tabs
        if (hideExcluded && asset.isExcluded) return false;

        if (selectedSector === 'FAVORITES' && !asset.isFavorite) return false;
        if (selectedSector !== 'ALL' && selectedSector !== 'FAVORITES' && asset.sector !== selectedSector) return false;
      }

      // Monitored filter
      if (onlyMonitored && !asset.isMonitored) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toUpperCase();
        return asset.symbol.includes(query) || (asset.categoryTag && asset.categoryTag.toUpperCase().includes(query));
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'score') return b.compositeScore - a.compositeScore;
      if (sortBy === 'gain') return b.priceChangePercent24h - a.priceChangePercent24h;
      if (sortBy === 'volume') return b.quoteVolume24h - a.quoteVolume24h;
      if (sortBy === 'oi') return b.openInterestChange24h - a.openInterestChange24h;
      if (sortBy === 'funding') return Math.abs(b.fundingRate) - Math.abs(a.fundingRate);
      return 0;
    });
  }, [assets, selectedSector, onlyMonitored, searchQuery, sortBy, hideExcluded]);

  const excludedCount = assets.filter(a => a.isExcluded).length || (settings?.excludedSymbols?.length || 0);

  const sectors: { id: MarketSector; label: string }[] = [
    { id: 'ALL', label: 'Todos os Ativos' },
    { id: 'FAVORITES', label: '★ Meus Favoritos' },
    { id: 'L1_L2', label: 'Layer 1 & L2' },
    { id: 'DEFI', label: 'DeFi & RWA' },
    { id: 'MEME', label: 'Memes & Beta' },
    { id: 'AI', label: 'AI & Infra' },
    { id: 'EXCLUDED', label: `🚫 Excluídos (${excludedCount})` }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Universe */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Universo Ativo</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Radar className="w-5 h-5 animate-pulse" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {summary ? summary.totalMonitored : 0}
            </span>
            <span className="text-xs text-slate-400">
              ativos em execução (4s)
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              ★ {summary?.favoritesCount || 0} Favoritos
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
              ⚡ {summary?.dynamicCount || 0} Radar Dinâmico
            </span>
            <Tooltip content="Pares e ativos colocados na lista de exclusão (stablecoins, moedas ignoradas) que não serão monitorados pelo robô.">
              <button
                type="button"
                onClick={() => setIsExclusionModalOpen(true)}
                className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-medium transition cursor-pointer inline-flex items-center gap-1"
              >
                <Ban className="w-3 h-3 text-rose-400" />
                {excludedCount} Excluídos
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Card 2: Top Gainer / Momentum */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Aceleração 24h</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {summary?.topGainer.symbol || '---'}
            </span>
            <span className={`text-base font-bold font-mono ${
              (summary?.topGainer.change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {summary?.topGainer.change ? formatPercent(summary.topGainer.change) : '+0.00%'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Maior impulso percentual no book de derivativos
          </p>
        </div>

        {/* Card 3: Top Open Interest Surge */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expansão de OI (Dinheiro Novo)</span>
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {summary?.topOiSurge.symbol || '---'}
            </span>
            <span className="text-base font-bold font-mono text-indigo-400">
              {summary?.topOiSurge.oiChange ? formatPercent(summary.topOiSurge.oiChange) : '+0.00%'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Aporte institucional em contratos em aberto
          </p>
        </div>

        {/* Card 4: Maior Volume & Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Volume 24h</span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {summary?.topVolume.symbol || 'BTCUSDT'}
            </span>
            <span className="text-base font-bold font-mono text-amber-400">
              {summary?.topVolume.quoteVolume ? formatVolume(summary.topVolume.quoteVolume) : '$0'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Última varredura: {summary?.lastScanDurationMs || 0}ms</span>
            <button
              onClick={handleTriggerManualScan}
              disabled={isScanning}
              className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              Reescanear
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, and Actions */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Sector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {sectors.map(sec => (
            <button
              key={sec.id}
              onClick={() => setSelectedSector(sec.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedSector === sec.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Search, Monitored Toggle, Sort, and Settings Button */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar símbolo ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Toggle Monitored Only */}
          <button
            onClick={() => setOnlyMonitored(!onlyMonitored)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition inline-flex items-center gap-1.5 ${
              onlyMonitored 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Apenas em Execução
          </button>

          {/* Toggle Hide Excluded */}
          <button
            type="button"
            onClick={() => setHideExcluded(!hideExcluded)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition inline-flex items-center gap-1.5 cursor-pointer ${
              hideExcluded
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={hideExcluded ? 'Excluídos ocultados do grid. Clique para exibir.' : 'Exibindo todos os ativos. Clique para ocultar excluídos.'}
          >
            <Ban className="w-3.5 h-3.5" />
            {hideExcluded ? 'Excluídos Ocultos' : 'Mostrar Excluídos'}
          </button>

          {/* Exclusion Manager Button */}
          <button
            type="button"
            onClick={() => setIsExclusionModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-950/30"
            title="Gerenciar lista de ativos e pares de stablecoin ignorados"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Lista de Exclusão ({excludedCount})
          </button>

          {/* Quick Jump to Smart Volume Screener Multi-TF */}
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('volume_screener')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Smart Volume Screener (1h/4h/1d)
            </button>
          )}

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="score">Ordenar: Score Institucional</option>
            <option value="gain">Ordenar: Maior Alta 24h</option>
            <option value="volume">Ordenar: Maior Volume</option>
            <option value="oi">Ordenar: Variação de OI</option>
            <option value="funding">Ordenar: Funding Anômalo</option>
          </select>

          {/* Settings Modal Toggle */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700"
            title="Configurações do Universo Dinâmico"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Screener Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-semibold tracking-wider uppercase">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">Fav</th>
                <th className="py-3.5 px-4">Ativo / Setor</th>
                <th className="py-3.5 px-4 text-right">Preço</th>
                <th className="py-3.5 px-4 text-right">Var 24h</th>
                <th className="py-3.5 px-4 text-right">Volume 24h</th>
                <th className="py-3.5 px-4 text-right">RVOL</th>
                <th className="py-3.5 px-4 text-right">Δ OI (24h)</th>
                <th className="py-3.5 px-4 text-right">Funding (Anual)</th>
                <th className="py-3.5 px-4 text-center">Score Momentum</th>
                <th className="py-3.5 px-4 text-center">Status no Robô</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Varrendo pares perpétuos da Binance...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Nenhum ativo corresponde aos filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isPositive = asset.priceChangePercent24h >= 0;
                  const isOiPositive = asset.openInterestChange24h >= 0;

                  return (
                    <tr 
                      key={asset.symbol}
                      className={`transition group cursor-pointer ${
                        asset.isExcluded 
                          ? 'bg-rose-950/15 hover:bg-rose-950/25 border-l-2 border-l-rose-500/80' 
                          : 'hover:bg-slate-800/40'
                      }`}
                      onClick={() => {
                        if (onSelectTicker) {
                          onSelectTicker({
                            symbol: asset.symbol,
                            baseAsset: asset.baseAsset,
                            quoteAsset: asset.quoteAsset,
                            name: asset.name,
                            marketType: 'crypto_futures',
                            price: asset.price,
                            priceChangePercent24h: asset.priceChangePercent24h,
                            high24h: asset.high24h,
                            low24h: asset.low24h,
                            volume24h: asset.volume24h,
                            quoteVolume24h: asset.quoteVolume24h,
                            openInterest: asset.openInterest,
                            openInterestChange24h: asset.openInterestChange24h,
                            openInterestChange1h: asset.openInterestChange1h,
                            fundingRate: asset.fundingRate,
                            fundingRateDaily: asset.fundingRate * 3,
                            fundingRateAnnualized: asset.fundingRateAnnualized,
                            cvd: 0,
                            cvdDelta: 0,
                            cvdDeltaPercent: 0,
                            cvdDirection: 'NEUTRAL',
                            takerBuyRatio: 0.5,
                            fibonacci: { fib50: asset.price, fib618: asset.price * 0.995, fib68: asset.price * 0.992, swingHigh: asset.high24h, swingLow: asset.low24h, inGoldenPocket: false },
                            rangeProfile: { vah: asset.price * 1.01, val: asset.price * 0.99, poc: asset.price, inValueArea: true },
                            keyLevels: { support1: asset.price * 0.98, support2: asset.price * 0.96, resistance1: asset.price * 1.02, resistance2: asset.price * 1.04, structureBreak: 'NONE', hasSinglePrintFVG: false },
                            confluenceScore: asset.compositeScore,
                            signalType: 'NEUTRAL',
                            signalReason: 'Carregado via Screener institucional.',
                            confluenceFactors: ['Screener Radar'],
                            updatedAt: asset.lastScannedAt
                          });
                        }
                      }}
                    >
                      {/* Favorite Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => handleToggleFavorite(asset.symbol, asset.isFavorite, e)}
                          className={`p-1.5 rounded-lg transition ${
                            asset.isFavorite 
                              ? 'text-amber-400 hover:text-amber-300' 
                              : 'text-slate-600 hover:text-amber-400'
                          }`}
                          title={asset.isFavorite ? 'Remover dos favoritos' : 'Fixar como favorito prioritário'}
                        >
                          <Star className={`w-4 h-4 ${asset.isFavorite ? 'fill-amber-400' : ''}`} />
                        </button>
                      </td>

                      {/* Symbol & Sector Tag */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-sm">{asset.symbol}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                            {asset.categoryTag || asset.sector}
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                        ${formatPrice(asset.price)}
                      </td>

                      {/* 24h Change */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {formatPercent(asset.priceChangePercent24h)}
                        </span>
                      </td>

                      {/* Volume 24h */}
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatVolume(asset.quoteVolume24h)}
                      </td>

                      {/* Relative Volume (RVOL) */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          asset.rvol >= 2.5 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : asset.rvol >= 1.5 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                            : 'text-slate-400'
                        }`}>
                          {asset.rvol.toFixed(2)}x
                        </span>
                      </td>

                      {/* Open Interest Delta */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`font-semibold ${isOiPositive ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {formatPercent(asset.openInterestChange24h)}
                        </span>
                      </td>

                      {/* Funding Rate Annualized */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`font-medium ${
                          asset.fundingRate > 0.0003 
                            ? 'text-rose-400 font-bold' 
                            : asset.fundingRate < -0.0001 
                            ? 'text-emerald-400 font-bold' 
                            : 'text-slate-400'
                        }`}>
                          {asset.fundingRateAnnualized > 0 ? `+${asset.fundingRateAnnualized}%` : `${asset.fundingRateAnnualized}%`}
                        </span>
                      </td>

                      {/* Institutional Composite Score */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                asset.compositeScore >= 80 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                  : asset.compositeScore >= 60 
                                  ? 'bg-gradient-to-r from-cyan-500 to-blue-400' 
                                  : 'bg-slate-600'
                              }`}
                              style={{ width: `${asset.compositeScore}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs text-white">
                            {asset.compositeScore}
                          </span>
                        </div>
                      </td>

                      {/* Robot Monitoring Status */}
                      <td className="py-3 px-4 text-center">
                        {asset.isExcluded ? (
                          <Tooltip content="Ativo presente na lista de exclusão do radar. Desativado de análises dinâmicas e ordens do robô.">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-rose-500/15 text-rose-300 border-rose-500/35">
                              <Ban className="w-3 h-3 text-rose-400" />
                              EXCLUÍDO (BLACKLIST)
                            </span>
                          </Tooltip>
                        ) : asset.isMonitored ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            asset.monitoringReason === 'FAVORITE'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : asset.monitoringReason === 'ACTIVE_TRADE'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          }`}>
                            <Activity className="w-3 h-3" />
                            {asset.monitoringReason === 'FAVORITE' ? 'FAVORITO (FIXO)' : asset.monitoringReason === 'ACTIVE_TRADE' ? 'EM OPERAÇÃO' : 'RADAR (TOP)'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Standby
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectTicker) {
                                onSelectTicker({
                                  symbol: asset.symbol,
                                  baseAsset: asset.baseAsset,
                                  quoteAsset: asset.quoteAsset,
                                  name: asset.name,
                                  marketType: 'crypto_futures',
                                  price: asset.price,
                                  priceChangePercent24h: asset.priceChangePercent24h,
                                  high24h: asset.high24h,
                                  low24h: asset.low24h,
                                  volume24h: asset.volume24h,
                                  quoteVolume24h: asset.quoteVolume24h,
                                  openInterest: asset.openInterest,
                                  openInterestChange24h: asset.openInterestChange24h,
                                  openInterestChange1h: asset.openInterestChange1h,
                                  fundingRate: asset.fundingRate,
                                  fundingRateDaily: asset.fundingRate * 3,
                                  fundingRateAnnualized: asset.fundingRateAnnualized,
                                  cvd: 0,
                                  cvdDelta: 0,
                                  cvdDeltaPercent: 0,
                                  cvdDirection: 'NEUTRAL',
                                  takerBuyRatio: 0.5,
                                  fibonacci: { fib50: asset.price, fib618: asset.price * 0.995, fib68: asset.price * 0.992, swingHigh: asset.high24h, swingLow: asset.low24h, inGoldenPocket: false },
                                  rangeProfile: { vah: asset.price * 1.01, val: asset.price * 0.99, poc: asset.price, inValueArea: true },
                                  keyLevels: { support1: asset.price * 0.98, support2: asset.price * 0.96, resistance1: asset.price * 1.02, resistance2: asset.price * 1.04, structureBreak: 'NONE', hasSinglePrintFVG: false },
                                  confluenceScore: asset.compositeScore,
                                  signalType: 'NEUTRAL',
                                  signalReason: 'Selecionado para análise.',
                                  confluenceFactors: ['Screener'],
                                  updatedAt: asset.lastScannedAt
                                });
                              }
                              if (onNavigateToTab) {
                                onNavigateToTab('chart');
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                            title="Abrir Gráfico"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Gráfico
                          </button>

                          {/* Exclude / Restore Button */}
                          {asset.isExcluded ? (
                            <Tooltip content="Remover da lista de exclusão (permitir monitoramento no radar)">
                              <button
                                type="button"
                                onClick={(e) => handleToggleExclude(asset.symbol, false, e)}
                                disabled={isExcludingLoading}
                                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/35 font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Adicionar à lista de exclusão (não monitorar)">
                              <button
                                type="button"
                                onClick={(e) => handleToggleExclude(asset.symbol, true, e)}
                                disabled={isExcludingLoading}
                                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/30 font-medium transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Excluir
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

      {/* Settings Modal */}
      {isSettingsOpen && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                Parâmetros do Universo Dinâmico (Screener)
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 mt-4 border-b border-slate-800/80 pb-2">
              <button
                type="button"
                onClick={() => setActiveSettingsTab('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSettingsTab === 'general'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Parâmetros Gerais
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('exclusions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSettingsTab === 'exclusions'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Lista de Exclusão ({excludedCount})
              </button>
            </div>

            {activeSettingsTab === 'general' ? (
              <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
                {/* Mode Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Modo de Operação do Universo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, mode: 'HYBRID' })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.mode === 'HYBRID'
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">Híbrido (Recomendado)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Favoritos fixos + Top ativos do Screener</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, mode: 'FAVORITES_ONLY' })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.mode === 'FAVORITES_ONLY'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">Apenas Favoritos</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Monitora somente ativos favoritados (★)</div>
                    </button>
                  </div>
                </div>

                {/* Dynamic Quota and Interval */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Cota Dinâmica (Top N Ativos)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={settings.maxMonitoredDynamicAssets}
                      onChange={(e) => setSettings({ ...settings, maxMonitoredDynamicAssets: parseInt(e.target.value) || 8 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Ex: 8 ativos mais quentes do radar</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Intervalo de Revalidação
                    </label>
                    <select
                      value={settings.rescanIntervalMinutes}
                      onChange={(e) => setSettings({ ...settings, rescanIntervalMinutes: parseInt(e.target.value) || 15 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value={5}>A cada 5 minutos</option>
                      <option value={15}>A cada 15 minutos (Padrão)</option>
                      <option value={30}>A cada 30 minutos</option>
                      <option value={60}>A cada 1 hora</option>
                    </select>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Frequência da varredura geral da Binance</span>
                  </div>
                </div>

                {/* Min Volume Usd & Include Memes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Filtro de Liquidez Mínima (USD)
                    </label>
                    <select
                      value={settings.minVolume24hUsd}
                      onChange={(e) => setSettings({ ...settings, minVolume24hUsd: parseInt(e.target.value) || 25000000 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value={10000000}>$10 Milhões (Mais flexível)</option>
                      <option value={25000000}>$25 Milhões (Padrão Institucional)</option>
                      <option value={50000000}>$50 Milhões (Alta Liquidez)</option>
                      <option value={100000000}>$100 Milhões (Mega Caps)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.includeMemes}
                        onChange={(e) => setSettings({ ...settings, includeMemes: e.target.checked })}
                        className="rounded bg-slate-800 border-slate-700 text-cyan-500"
                      />
                      <span className="text-xs text-slate-300 font-medium">Incluir Moedas Meme no Radar</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center gap-1.5"
                  >
                    {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Salvar Parâmetros
                  </button>
                </div>
              </form>
            ) : (
              /* Settings Exclusions Tab */
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p>
                    Ativos excluídos são filtrados pelo algoritmo e não entram na rotação de 4s do robô.
                    Você pode adicionar ativos digitando abaixo ou usar o gerenciador completo.
                  </p>
                </div>

                {/* Quick Add */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar símbolo (ex: USDGUSDT)..."
                    value={newExcludeInput}
                    onChange={(e) => setNewExcludeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomExclude();
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 uppercase font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomExclude()}
                    disabled={isExcludingLoading || !newExcludeInput.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>

                {/* Excluded Badges Preview */}
                <div className="max-h-48 overflow-y-auto p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap gap-1.5">
                  {(settings.excludedSymbols || []).length === 0 ? (
                    <span className="text-xs text-slate-500">Nenhum ativo na lista de exclusão.</span>
                  ) : (
                    (settings.excludedSymbols || []).map(sym => (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-rose-500/30 text-rose-300 text-[11px] font-mono font-semibold"
                      >
                        {sym}
                        <button
                          type="button"
                          onClick={() => handleToggleExclude(sym, false)}
                          className="hover:text-white p-0.5 rounded transition cursor-pointer"
                          title="Remover da lista de exclusão"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleResetExclusions}
                    disabled={isExcludingLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsExclusionModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 transition flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Abrir Gerenciador Avançado
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Exclusion Manager Modal */}
      {isExclusionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-rose-400" />
                  Lista de Exclusão de Ativos (Blacklist de Monitoramento)
                </h3>
                <p className="text-xs text-slate-400">
                  Ativos cadastrados nesta lista são ignorados pelo algoritmo dinâmico e nunca serão selecionados para o universo ativo de execução do robô (4s).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExclusionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
              {/* Add Custom Symbol Section */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-200 block">
                  Adicionar Par ou Moeda para Excluir
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: USDGUSDT, PYUSDUSDT, USDCUSDT..."
                      value={newExcludeInput}
                      onChange={(e) => setNewExcludeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomExclude();
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 uppercase font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddCustomExclude()}
                    disabled={isExcludingLoading || !newExcludeInput.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar à Lista
                  </button>
                </div>
              </div>

              {/* Suggestions: Common Stablecoins and Pegged Assets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Sugestões Rápidas: Pares de Stablecoins & Pegged Assets
                  </span>
                  <span className="text-slate-500 text-[11px]">Clique para adicionar</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_STABLECOINS
                    .filter(st => !(settings?.excludedSymbols || []).includes(st.symbol))
                    .map(st => (
                      <button
                        key={st.symbol}
                        type="button"
                        onClick={() => handleAddCustomExclude(st.symbol)}
                        disabled={isExcludingLoading}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-950 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer font-mono group"
                      >
                        <Plus className="w-3 h-3 text-slate-500 group-hover:text-rose-400" />
                        <span>{st.symbol}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-rose-400/80 font-sans">({st.name})</span>
                      </button>
                    ))}
                  {SUGGESTED_STABLECOINS.every(st => (settings?.excludedSymbols || []).includes(st.symbol)) && (
                    <span className="text-xs text-emerald-400/90 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Todos os pares de stablecoin recomendados já estão na lista de exclusão.
                    </span>
                  )}
                </div>
              </div>

              {/* Filter and List of Currently Excluded Symbols */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    Ativos Excluídos do Radar ({(settings?.excludedSymbols || []).length})
                  </span>
                  {/* Search within excluded */}
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar nesta lista..."
                      value={excludeFilterQuery}
                      onChange={(e) => setExcludeFilterQuery(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-xl min-h-[120px] max-h-[220px] overflow-y-auto">
                  {(() => {
                    const list = (settings?.excludedSymbols || []).filter(sym => 
                      !excludeFilterQuery.trim() || sym.includes(excludeFilterQuery.trim())
                    );

                    if (list.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs text-slate-500">
                          {excludeFilterQuery.trim() 
                            ? 'Nenhum ativo encontrado para este termo.' 
                            : 'A lista de exclusão está vazia. Adicione ativos acima.'}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {list.map(sym => (
                          <div
                            key={sym}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-rose-500/20 hover:border-rose-500/40 transition group"
                          >
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-xs text-white group-hover:text-rose-300 transition">
                                {sym}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {SUGGESTED_STABLECOINS.find(s => s.symbol === sym)?.name || 'Ignorado'}
                              </span>
                            </div>
                            <Tooltip content={`Restaurar ${sym} para análise`}>
                              <button
                                type="button"
                                onClick={() => handleToggleExclude(sym, false)}
                                disabled={isExcludingLoading}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleResetExclusions}
                disabled={isExcludingLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                title="Restaura a lista para os pares de stablecoin padrão"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Lista Padrão de Stablecoins
              </button>

              <button
                type="button"
                onClick={() => setIsExclusionModalOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
