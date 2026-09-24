import React, { useState, useEffect, useCallback } from 'react';
import { 
  ResponsiveGridLayout, 
  useContainerWidth, 
  LayoutItem, 
  Layout, 
  ResponsiveLayouts 
} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { 
  GripVertical, 
  RotateCcw, 
  SlidersHorizontal, 
  Layers, 
  Eye, 
  EyeOff, 
  Check, 
  Flame, 
  Activity, 
  Zap, 
  Sparkles,
  Lock,
  Unlock,
  Scale,
  Server,
  CheckCheck,
  Target,
  Compass,
  Maximize2,
  Minimize2,
  Expand,
  X,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';

export type DashboardWidgetId = 
  | 'system_health'
  | 'prime_banner'
  | 'trapped_radar'
  | 'rsi_divergence'
  | 'market_heatmap'
  | 'volatility_heatmap'
  | 'liquidity_depth'
  | 'correlation_matrix'
  | 'ticker_grid';

export interface WidgetConfig {
  id: DashboardWidgetId;
  title: string;
  description: string;
  icon: React.ElementType;
  visible: boolean;
  minW: number;
  minH: number;
  badge?: string;
}

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'system_health', x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'prime_banner', x: 0, y: 6, w: 12, h: 4, minW: 6, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 10, w: 12, h: 14, minW: 6, minH: 6 },
    { i: 'rsi_divergence', x: 0, y: 24, w: 12, h: 14, minW: 6, minH: 6 },
    { i: 'market_heatmap', x: 0, y: 38, w: 12, h: 12, minW: 6, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 50, w: 12, h: 11, minW: 6, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 61, w: 12, h: 12, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 73, w: 12, h: 8, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 81, w: 12, h: 16, minW: 6, minH: 6 }
  ],
  md: [
    { i: 'system_health', x: 0, y: 0, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'prime_banner', x: 0, y: 6, w: 10, h: 4, minW: 5, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 10, w: 10, h: 14, minW: 5, minH: 6 },
    { i: 'rsi_divergence', x: 0, y: 24, w: 10, h: 14, minW: 5, minH: 6 },
    { i: 'market_heatmap', x: 0, y: 38, w: 10, h: 12, minW: 5, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 50, w: 10, h: 11, minW: 5, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 61, w: 10, h: 12, minW: 5, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 73, w: 10, h: 8, minW: 5, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 81, w: 10, h: 16, minW: 5, minH: 6 }
  ],
  sm: [
    { i: 'system_health', x: 0, y: 0, w: 6, h: 6, minW: 6, minH: 4 },
    { i: 'prime_banner', x: 0, y: 6, w: 6, h: 4, minW: 6, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 10, w: 6, h: 14, minW: 6, minH: 6 },
    { i: 'rsi_divergence', x: 0, y: 24, w: 6, h: 14, minW: 6, minH: 6 },
    { i: 'market_heatmap', x: 0, y: 38, w: 6, h: 12, minW: 6, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 50, w: 6, h: 11, minW: 6, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 61, w: 6, h: 12, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 73, w: 6, h: 8, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 81, w: 6, h: 16, minW: 6, minH: 6 }
  ]
};

const STORAGE_LAYOUT_KEY = 'superbot_dashboard_grid_layouts_v9';
const STORAGE_VISIBILITY_KEY = 'superbot_dashboard_widgets_visibility_v9';
const STORAGE_VIEW_MODE_KEY = 'superbot_dashboard_view_mode_v9';

// Helper to sanitize and ensure all widgets are present with proper dimensions
function sanitizeLayouts(
  inputLayouts: ResponsiveLayouts | null | undefined
): ResponsiveLayouts {
  const bps: Array<'lg' | 'md' | 'sm'> = ['lg', 'md', 'sm'];
  const sanitized: ResponsiveLayouts = { lg: [], md: [], sm: [] };

  bps.forEach(bp => {
    const existing = inputLayouts?.[bp] || [];
    const defaultBp = DEFAULT_LAYOUTS[bp] || [];
    const defaultBpMap = new Map<string, LayoutItem>(defaultBp.map(item => [item.i, item]));
    const resultItems: LayoutItem[] = [];
    const seenIds = new Set<string>();

    // Process existing saved items first
    existing.forEach(item => {
      if (!item || !item.i) return;
      const defaultItem = defaultBpMap.get(item.i);
      if (defaultItem) {
        seenIds.add(item.i);
        const minW = defaultItem.minW || 4;
        const minH = defaultItem.minH || 3;
        // Fix collapsed/corrupted dimensions
        const fixedW = item.w && item.w >= minW ? item.w : defaultItem.w;
        const fixedH = item.h && item.h >= minH ? item.h : defaultItem.h;
        resultItems.push({
          ...defaultItem,
          ...item,
          w: fixedW,
          h: fixedH,
          minW: defaultItem.minW,
          minH: defaultItem.minH
        });
      }
    });

    // Append any known widgets missing from saved layout
    defaultBp.forEach(defaultItem => {
      if (!seenIds.has(defaultItem.i)) {
        const maxY = resultItems.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 0)), 0);
        resultItems.push({
          ...defaultItem,
          x: 0,
          y: maxY
        });
      }
    });

    sanitized[bp] = resultItems;
  });

  return sanitized;
}

const INITIAL_WIDGETS: WidgetConfig[] = [
  {
    id: 'system_health',
    title: 'Saúde do Sistema & Feeds de Dados',
    description: 'Telemetria de latência em tempo real, status de feeds WebSocket, processamento de Order Flow e motor de IA.',
    icon: Server,
    visible: true,
    minW: 6,
    minH: 4,
    badge: 'PRO SLA'
  },
  {
    id: 'prime_banner',
    title: 'Oportunidade Prime (Golden Pocket)',
    description: 'Destaque algorítmico do ativo com maior confluência de order flow e fibonacci.',
    icon: Sparkles,
    visible: true,
    minW: 6,
    minH: 3,
    badge: 'ALERTA'
  },
  {
    id: 'trapped_radar',
    title: 'Trapped Traders & Squeeze Radar',
    description: 'Radar institucional de Net Longs/Shorts, Absorção Wyckoff de Delta CVD e Alertas de Contra-Trade.',
    icon: Target,
    visible: true,
    minW: 6,
    minH: 6,
    badge: 'ORDER FLOW'
  },
  {
    id: 'rsi_divergence',
    title: 'Monitor de Divergência RSI (14)',
    description: 'Radar de divergências regulares e ocultas no RSI para detecção precoce de reversão e exaustão de tendência.',
    icon: Compass,
    visible: true,
    minW: 6,
    minH: 6,
    badge: 'REVERSÃO'
  },
  {
    id: 'market_heatmap',
    title: 'Mapa de Calor Global (Heatmap D3)',
    description: 'Treemap visual com volume 24h e desvio da Média Móvel de 24h (MA24h).',
    icon: Flame,
    visible: true,
    minW: 6,
    minH: 6,
    badge: 'D3'
  },
  {
    id: 'volatility_heatmap',
    title: 'Heatmap de Volatilidade & Ação (ATR)',
    description: 'Mapeamento de expansão de volatilidade, ATR%, compressão de range e ranking de ativos de alta ação.',
    icon: Activity,
    visible: true,
    minW: 6,
    minH: 5,
    badge: 'ATR PRO'
  },
  {
    id: 'liquidity_depth',
    title: 'Profundidade de Liquidez & Pressão (D3 Depth)',
    description: 'Curvas cumulativas de Bids vs Asks, spread, desequilíbrio e muralhas institucionais.',
    icon: Scale,
    visible: true,
    minW: 6,
    minH: 7,
    badge: 'D3'
  },
  {
    id: 'correlation_matrix',
    title: 'Matriz de Correlação Setorial',
    description: 'Análise de correlação estatística de Pearson com o ativo de destaque.',
    icon: Layers,
    visible: true,
    minW: 6,
    minH: 5
  },
  {
    id: 'ticker_grid',
    title: 'Grid de Ativos & Métricas Quânticas',
    description: 'Catálogo de ativos com cards técnicos, força de tendência e filtros rápidos.',
    icon: Zap,
    visible: true,
    minW: 6,
    minH: 6
  }
];

interface DashboardGridLayoutProps {
  childrenMap: Record<DashboardWidgetId, React.ReactNode>;
  hasPrimeBanner?: boolean;
  hasCorrelationMatrix?: boolean;
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
  childrenMap
}) => {
  const { showToast } = useToast();
  const { width, containerRef, mounted } = useContainerWidth();
  const [isDraggable, setIsDraggable] = useState<boolean>(true);
  const [isResizable, setIsResizable] = useState<boolean>(true);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [maximizedWidgetId, setMaximizedWidgetId] = useState<DashboardWidgetId | null>(null);
  const [expandedAllMode, setExpandedAllMode] = useState<boolean>(false);
  const [forceMobileStack, setForceMobileStack] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW_MODE_KEY);
      return saved === 'stack';
    } catch {
      return false;
    }
  });

  // Automatically detect small screen viewports (< 768px)
  const isSmallScreen = width > 0 && width < 768;
  const isStackView = forceMobileStack || isSmallScreen;

  // Widget definitions initialized with saved visibility if present
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const savedVis = localStorage.getItem(STORAGE_VISIBILITY_KEY);
      if (savedVis) {
        const parsed: Record<string, boolean> = JSON.parse(savedVis);
        return INITIAL_WIDGETS.map(w => ({
          ...w,
          visible: parsed[w.id] !== undefined ? parsed[w.id] : true
        }));
      }
    } catch {
      // ignore
    }
    return INITIAL_WIDGETS;
  });

  // Load saved layouts or fallback to sanitized defaults
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.lg || parsed.md || parsed.sm)) {
          return sanitizeLayouts(parsed);
        }
      }
    } catch {
      // ignore
    }
    return sanitizeLayouts(DEFAULT_LAYOUTS);
  });

  const handleLayoutChange = useCallback((currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
    const cleanLayouts = sanitizeLayouts(allLayouts);
    setLayouts(cleanLayouts);
    try {
      localStorage.setItem(STORAGE_LAYOUT_KEY, JSON.stringify(cleanLayouts));
    } catch {
      // ignore
    }
  }, []);

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    setWidgets(prev => {
      const target = prev.find(w => w.id === id);
      const willBeVisible = target ? !target.visible : true;
      const next = prev.map(w => (w.id === id ? { ...w, visible: willBeVisible } : w));

      // If re-enabling, ensure layouts has valid dimensions for this item across all breakpoints
      if (willBeVisible) {
        setLayouts(prevLayouts => {
          const bps: Array<'lg' | 'md' | 'sm'> = ['lg', 'md', 'sm'];
          const updated: ResponsiveLayouts = { ...prevLayouts };

          bps.forEach(bp => {
            const currentList = [...(updated[bp] || [])];
            const defaultItem = DEFAULT_LAYOUTS[bp]?.find(d => d.i === id) || {
              i: id,
              x: 0,
              y: 0,
              w: bp === 'sm' ? 6 : bp === 'md' ? 10 : 12,
              h: 12,
              minW: bp === 'sm' ? 6 : 5,
              minH: 4
            };

            const existingIndex = currentList.findIndex(item => item.i === id);
            const maxY = currentList.reduce((acc, curr) => Math.max(acc, (curr.y || 0) + (curr.h || 0)), 0);

            if (existingIndex >= 0) {
              const current = currentList[existingIndex];
              const minW = defaultItem.minW || 4;
              const minH = defaultItem.minH || 3;
              const fixedW = current.w && current.w >= minW ? current.w : defaultItem.w;
              const fixedH = current.h && current.h >= minH ? current.h : defaultItem.h;
              currentList[existingIndex] = {
                ...defaultItem,
                ...current,
                w: fixedW,
                h: fixedH,
                minW: defaultItem.minW,
                minH: defaultItem.minH
              };
            } else {
              currentList.push({
                ...defaultItem,
                x: 0,
                y: maxY
              });
            }
            updated[bp] = currentList;
          });

          try {
            localStorage.setItem(STORAGE_LAYOUT_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }

      try {
        const visMap: Record<string, boolean> = {};
        next.forEach(w => { visMap[w.id] = w.visible; });
        localStorage.setItem(STORAGE_VISIBILITY_KEY, JSON.stringify(visMap));
      } catch {
        // ignore
      }

      return next;
    });
  };

  const handleEnableAllWidgets = () => {
    setWidgets(prev => {
      const next = prev.map(w => ({ ...w, visible: true }));
      try {
        const visMap: Record<string, boolean> = {};
        next.forEach(w => { visMap[w.id] = true; });
        localStorage.setItem(STORAGE_VISIBILITY_KEY, JSON.stringify(visMap));
      } catch {
        // ignore
      }
      return next;
    });
    setLayouts(sanitizeLayouts(DEFAULT_LAYOUTS));
    showToast('success', 'Todos os Widgets Ativados', 'Todos os módulos foram reabilitados na tela.');
  };

  const handleResetLayout = () => {
    const cleanDefault = sanitizeLayouts(DEFAULT_LAYOUTS);
    setLayouts(cleanDefault);
    setWidgets(INITIAL_WIDGETS);
    setExpandedAllMode(false);
    try {
      localStorage.removeItem(STORAGE_LAYOUT_KEY);
      localStorage.removeItem(STORAGE_VISIBILITY_KEY);
      showToast('info', 'Layout Redefinido', 'Os widgets foram restaurados com dimensões e posições padrão.');
    } catch {
      // ignore
    }
  };

  const toggleStackMode = () => {
    const nextMode = !forceMobileStack;
    setForceMobileStack(nextMode);
    try {
      localStorage.setItem(STORAGE_VIEW_MODE_KEY, nextMode ? 'stack' : 'grid');
    } catch {
      // ignore
    }
    showToast(
      'info',
      nextMode ? 'Visualização Fluida Ativada' : 'Visualização em Grade Ativada',
      nextMode 
        ? 'Os cards agora expandem sem limite de corte de altura vertical.' 
        : 'Grade modular redimensionável e arrastável reativada.'
    );
  };

  // Determine active visible widgets that have available content
  const visibleWidgets = widgets.filter(w => {
    if (!w.visible) return false;
    return Boolean(childrenMap[w.id]);
  });

  const getLayoutItemConfig = (widgetId: string) => {
    const currentBpLayout = layouts['lg'] || DEFAULT_LAYOUTS['lg'];
    const found = currentBpLayout?.find(item => item.i === widgetId);
    return found || DEFAULT_LAYOUTS['lg']?.find(item => item.i === widgetId) || { i: widgetId, x: 0, y: 0, w: 12, h: 12 };
  };

  // Quick resize preset: Increase or reset widget heights by delta
  const handleAdjustHeights = (multiplier: number) => {
    setLayouts(prev => {
      const bps: Array<'lg' | 'md' | 'sm'> = ['lg', 'md', 'sm'];
      const updated: ResponsiveLayouts = { ...prev };
      bps.forEach(bp => {
        const list = (updated[bp] || []).map(item => {
          const defaultH = DEFAULT_LAYOUTS[bp]?.find(d => d.i === item.i)?.h || 10;
          const newH = Math.max(item.minH || 4, Math.round(defaultH * multiplier));
          return { ...item, h: newH };
        });
        updated[bp] = list;
      });
      try {
        localStorage.setItem(STORAGE_LAYOUT_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showToast('info', 'Dimensões dos Cards Calibradas', multiplier > 1 ? 'Cards verticalmente expandidos para exibir mais dados.' : 'Dimensões restauradas ao padrão de grade.');
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Top Layout Management Bar */}
      <div className="bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider font-mono">
                Dashboard Customizável
              </span>
              <span className="text-[9px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-mono border border-orange-500/20">
                {visibleWidgets.length} de {widgets.length} ATIVOS
              </span>
              {isStackView && (
                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono border border-cyan-500/20">
                  MODO FLUIDO (SEM CORTES)
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Redimensione pelos cantos inferiores, use a barra de rolagem interna ou expanda em tela cheia para ver todos os dados.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch: Grid vs Fluid Stack */}
          <Tooltip
            position="bottom"
            title={isStackView ? 'Modo Fluido Ativo' : 'Modo Grade Ativo'}
            badge={isStackView ? 'STACK' : 'GRID'}
            badgeColor="cyan"
            content={
              isStackView 
                ? 'Cards empilhados com altura dinâmica automática, eliminando cortes verticais. Clique para alternar para Grade modular.' 
                : 'Grade modular redimensionável e arrastável. Clique para alternar para Modo Fluido contínuo.'
            }
          >
            <button
              onClick={toggleStackMode}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                isStackView
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              {isStackView ? <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> : <Monitor className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isStackView ? 'Modo Fluido' : 'Modo Grade'}</span>
            </button>
          </Tooltip>

          {/* Expand All / Auto Height Toggle */}
          <Tooltip
            position="bottom"
            title={expandedAllMode ? 'Altura Total Liberada' : 'Scroll Interno Ativo'}
            badge={expandedAllMode ? 'AUTO HEIGHT' : 'SCROLL'}
            badgeColor="emerald"
            content={
              expandedAllMode 
                ? 'Todos os cards expandem verticalmente para exibir tabelas e gráficos sem barras de rolagem internas.' 
                : 'Cards operam com caixas compactas e barras de rolagem internas dedicadas.'
            }
          >
            <button
              onClick={() => {
                setExpandedAllMode(prev => !prev);
                showToast(
                  'info',
                  !expandedAllMode ? 'Cards Expandidos' : 'Scroll Interno Reativado',
                  !expandedAllMode 
                    ? 'Todos os cards foram liberados verticalmente para exibir todo o conteúdo.' 
                    : 'Cards limitados com barras de rolagem independentes ativas.'
                );
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                expandedAllMode
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <Expand className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{expandedAllMode ? 'Exibindo Tudo' : 'Expandir Altura'}</span>
            </button>
          </Tooltip>

          {!isStackView && (
            <>
              {/* Preset Height Buttons */}
              <div className="hidden lg:flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
                <Tooltip
                  position="bottom"
                  title="Calibração Compacta"
                  badge="0.85x"
                  content="Reduz a altura padrão dos cards para caber mais dados na tela simultaneamente."
                >
                  <button
                    onClick={() => handleAdjustHeights(0.85)}
                    className="px-2 py-1 text-[10px] font-mono text-neutral-400 hover:text-white rounded transition"
                  >
                    Compacto
                  </button>
                </Tooltip>
                <Tooltip
                  position="bottom"
                  title="Calibração Padrão"
                  badge="1.0x"
                  content="Restaura a escala padrão balanceada do layout institucional."
                >
                  <button
                    onClick={() => handleAdjustHeights(1.0)}
                    className="px-2 py-1 text-[10px] font-mono text-neutral-300 hover:text-white rounded transition"
                  >
                    Padrão
                  </button>
                </Tooltip>
                <Tooltip
                  position="bottom"
                  title="Calibração Expandida"
                  badge="+40%"
                  badgeColor="orange"
                  content="Aumenta em 40% a altura de todos os cards da grade para visualização aprofundada."
                >
                  <button
                    onClick={() => handleAdjustHeights(1.4)}
                    className="px-2 py-1 text-[10px] font-mono text-orange-400 hover:text-orange-300 rounded transition font-bold"
                  >
                    +Alto
                  </button>
                </Tooltip>
              </div>

              {/* Drag Lock Toggle */}
              <Tooltip
                position="bottom"
                title={isDraggable ? 'Arrasto Habilitado' : 'Posições Fixadas'}
                badge={isDraggable ? 'EDITÁVEL' : 'TRAVADO'}
                badgeColor={isDraggable ? 'orange' : 'cyan'}
                content={
                  isDraggable
                    ? 'Você pode mover qualquer card clicando e arrastando pela barra de título. Clique para travar contra cliques acidentais.'
                    : 'O layout está travado. Os cards não mudarão de posição por arrasto até que você destrave.'
                }
              >
                <button
                  onClick={() => {
                    setIsDraggable(prev => !prev);
                    showToast(
                      'info', 
                      !isDraggable ? 'Arrasto Habilitado' : 'Posições Travadas', 
                      !isDraggable ? 'Agora você pode mover os cards pelo cabeçalho.' : 'O layout foi fixado contra movimentações acidentais.'
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                    isDraggable
                      ? 'bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25'
                      : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                  }`}
                >
                  {isDraggable ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isDraggable ? 'Mover Ativo' : 'Mover Travado'}</span>
                </button>
              </Tooltip>
            </>
          )}

          {/* Visibility / Customize Dropdown Button */}
          <Tooltip
            position="bottom"
            title="Gerenciar Módulos"
            badge={`${visibleWidgets.length}/${widgets.length}`}
            content="Abre o painel de seleção para ativar ou ocultar os módulos individuais do dashboard."
          >
            <button
              onClick={() => setIsCustomizing(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                isCustomizing
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-md shadow-orange-500/10'
                  : 'bg-neutral-900 text-neutral-300 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Widgets ({visibleWidgets.length}/{widgets.length})</span>
            </button>
          </Tooltip>

          {/* Reset Layout */}
          <Tooltip
            position="bottom-right"
            title="Restaurar Layout Original"
            badge="RESET"
            badgeColor="rose"
            content="Restaura as posições, dimensões e módulos visíveis para a configuração de fábrica recomendada."
          >
            <button
              onClick={handleResetLayout}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-white/10 hover:border-white/20 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Widget Customization Drawer */}
      {isCustomizing && (
        <div className="bg-[#0c0d0e] border border-orange-500/30 rounded-xl p-4 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-400" />
              <div>
                <span className="text-xs font-bold text-neutral-100 font-mono">
                  Gerenciador de Módulos do Dashboard
                </span>
                <p className="text-[10px] text-neutral-400">
                  Selecione quais painéis devem aparecer na sua área de trabalho operacional.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableAllWidgets}
                className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Ativar Todos ({widgets.length})</span>
              </button>
              <button
                onClick={() => setIsCustomizing(false)}
                className="px-2.5 py-1 rounded-md text-[11px] font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-white/10 hover:bg-neutral-800 transition"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {widgets.map(w => {
              const Icon = w.icon;
              return (
                <div
                  key={w.id}
                  onClick={() => toggleWidgetVisibility(w.id)}
                  className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer select-none transition-all ${
                    w.visible
                      ? 'bg-neutral-900/90 border-orange-500/40 shadow-sm shadow-orange-500/5 hover:border-orange-500/70'
                      : 'bg-black/60 border-white/5 opacity-50 hover:opacity-80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`p-2 rounded-md shrink-0 ${w.visible ? 'bg-orange-500/20 text-orange-400' : 'bg-neutral-800 text-neutral-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5 truncate">
                        <span>{w.title}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-2 mt-1 leading-snug">
                        {w.description}
                      </p>
                      {w.badge && (
                        <span className="inline-block mt-1.5 px-1.5 py-0.2 rounded bg-white/5 text-[9px] font-mono text-neutral-400 border border-white/10">
                          {w.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {w.visible ? (
                      <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 p-1 rounded-md flex items-center shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-neutral-500 bg-neutral-900 border border-white/5 p-1 rounded-md flex items-center">
                        <EyeOff className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Canvas with Drag Handles & Resizing */}
      <div className="relative">
        {!isStackView && mounted && width > 0 ? (
          <ResponsiveGridLayout
            width={width}
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 800, sm: 480 }}
            cols={{ lg: 12, md: 10, sm: 6 }}
            rowHeight={40}
            dragConfig={{
              enabled: isDraggable,
              handle: '.widget-drag-handle'
            }}
            resizeConfig={{
              enabled: isResizable,
              handles: ['se']
            }}
            onLayoutChange={handleLayoutChange}
            margin={[12, 12]}
            containerPadding={[0, 0]}
          >
            {visibleWidgets.map(widget => {
              const content = childrenMap[widget.id];
              if (!content) return null;
              const layoutConfig = getLayoutItemConfig(widget.id);

              return (
                <div 
                  key={widget.id} 
                  data-grid={layoutConfig}
                  className={`group/widget flex flex-col h-full rounded-2xl transition-shadow focus-within:ring-1 focus-within:ring-orange-500/50 bg-[#060608] border border-white/10 shadow-xl ${
                    expandedAllMode ? 'overflow-visible' : 'overflow-hidden'
                  }`}
                >
                  {/* Visual Drag Handle Bar */}
                  <div 
                    className={`widget-drag-handle flex items-center justify-between px-3.5 py-2 bg-[#09090b] border-b border-white/10 select-none transition-colors shrink-0 ${
                      isDraggable 
                        ? 'cursor-grab active:cursor-grabbing hover:bg-neutral-900 group-hover/widget:border-orange-500/30' 
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400 min-w-0">
                      <GripVertical className={`w-3.5 h-3.5 shrink-0 ${isDraggable ? 'text-orange-400 animate-pulse' : 'text-neutral-600'}`} />
                      <span className="font-bold text-neutral-200 uppercase tracking-wider truncate">{widget.title}</span>
                      {widget.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] shrink-0 hidden sm:inline">
                          {widget.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 shrink-0">
                      {/* Maximize Button */}
                      <Tooltip
                        position="top"
                        title="Modo Foco / Tela Cheia"
                        badge="EXPANDIR"
                        badgeColor="cyan"
                        content="Abre este módulo em uma janela modal maximizada para análise detalhada com amplitude máxima."
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMaximizedWidgetId(widget.id);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-cyan-400 transition"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>

                      {/* Hide Widget */}
                      <Tooltip
                        position="top"
                        title="Ocultar Módulo"
                        badge="MINIMIZAR"
                        content="Remove este módulo do layout ativo. Você pode reativá-lo a qualquer momento no botão Widgets."
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWidgetVisibility(widget.id);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Widget Real Content with smart custom scrollbar */}
                  <div className={`flex-1 w-full p-1 custom-scrollbar ${expandedAllMode ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>
                    {content}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        ) : (
          /* Mobile or Fluid Stack View: Zero vertical cuts, natural page scrolling */
          <div className="space-y-4">
            {visibleWidgets.map(widget => {
              const content = childrenMap[widget.id];
              if (!content) return null;

              return (
                <div 
                  key={widget.id} 
                  className="rounded-2xl border border-white/10 bg-[#060608] shadow-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#09090b] border-b border-white/10">
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
                      <widget.icon className="w-4 h-4 text-orange-400 shrink-0" />
                      <span className="font-bold uppercase tracking-wider">{widget.title}</span>
                      {widget.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px]">
                          {widget.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tooltip
                        position="top"
                        title="Modo Foco / Tela Cheia"
                        badge="EXPANDIR"
                        badgeColor="cyan"
                        content="Abre este módulo em uma janela modal maximizada para análise aprofundada."
                      >
                        <button
                          onClick={() => setMaximizedWidgetId(widget.id)}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-cyan-400 transition"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>

                      <Tooltip
                        position="top"
                        title="Ocultar Módulo"
                        badge="MINIMIZAR"
                        content="Oculta este widget. Reative quando desejar na lista de widgets."
                      >
                        <button
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="p-2 overflow-x-auto">
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Focus Modal for any Widget */}
      {maximizedWidgetId && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-2 sm:p-6 animate-fadeIn"
          onClick={() => setMaximizedWidgetId(null)}
        >
          <div 
            className="flex-1 w-full max-w-7xl mx-auto bg-[#08080a] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-cyan-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0c0d10] border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Maximize2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    {widgets.find(w => w.id === maximizedWidgetId)?.title}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      MODO FOCO AMPLIADO
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Visualização expandida com todos os dados técnicos, filtros e métricas completas sem limite de altura.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMaximizedWidgetId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-white/10 transition flex items-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Fechar Foco</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Complete Scrollable View */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {childrenMap[maximizedWidgetId]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

