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
  Compass
} from 'lucide-react';
import { useToast } from './Toast';

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
    { i: 'system_health', x: 0, y: 0, w: 12, h: 5, minW: 6, minH: 4 },
    { i: 'prime_banner', x: 0, y: 5, w: 12, h: 4, minW: 6, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 9, w: 12, h: 8, minW: 6, minH: 5 },
    { i: 'rsi_divergence', x: 0, y: 17, w: 12, h: 8, minW: 6, minH: 5 },
    { i: 'market_heatmap', x: 0, y: 25, w: 12, h: 9, minW: 6, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 34, w: 12, h: 8, minW: 6, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 42, w: 12, h: 10, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 52, w: 12, h: 7, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 59, w: 12, h: 14, minW: 6, minH: 6 }
  ],
  md: [
    { i: 'system_health', x: 0, y: 0, w: 10, h: 5, minW: 5, minH: 4 },
    { i: 'prime_banner', x: 0, y: 5, w: 10, h: 4, minW: 5, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 9, w: 10, h: 8, minW: 5, minH: 5 },
    { i: 'rsi_divergence', x: 0, y: 17, w: 10, h: 8, minW: 5, minH: 5 },
    { i: 'market_heatmap', x: 0, y: 25, w: 10, h: 9, minW: 5, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 34, w: 10, h: 8, minW: 5, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 42, w: 10, h: 10, minW: 5, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 52, w: 10, h: 7, minW: 5, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 59, w: 10, h: 14, minW: 5, minH: 6 }
  ],
  sm: [
    { i: 'system_health', x: 0, y: 0, w: 6, h: 5, minW: 6, minH: 4 },
    { i: 'prime_banner', x: 0, y: 5, w: 6, h: 4, minW: 6, minH: 3 },
    { i: 'trapped_radar', x: 0, y: 9, w: 6, h: 8, minW: 6, minH: 5 },
    { i: 'rsi_divergence', x: 0, y: 17, w: 6, h: 8, minW: 6, minH: 5 },
    { i: 'market_heatmap', x: 0, y: 25, w: 6, h: 8, minW: 6, minH: 6 },
    { i: 'volatility_heatmap', x: 0, y: 33, w: 6, h: 8, minW: 6, minH: 5 },
    { i: 'liquidity_depth', x: 0, y: 41, w: 6, h: 10, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 51, w: 6, h: 7, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 58, w: 6, h: 14, minW: 6, minH: 6 }
  ]
};

const STORAGE_LAYOUT_KEY = 'superbot_dashboard_grid_layouts_v8';
const STORAGE_VISIBILITY_KEY = 'superbot_dashboard_widgets_visibility_v8';

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
    minH: 5,
    badge: 'ORDER FLOW'
  },
  {
    id: 'rsi_divergence',
    title: 'Monitor de Divergência RSI (14)',
    description: 'Radar de divergências regulares e ocultas no RSI para detecção precoce de reversão e exaustão de tendência.',
    icon: Compass,
    visible: true,
    minW: 6,
    minH: 5,
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
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);

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
              h: 8,
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
    showToast('success', 'Todos os Widgets Ativados', 'Os 7 módulos foram reabilitados na tela.');
  };

  const handleResetLayout = () => {
    const cleanDefault = sanitizeLayouts(DEFAULT_LAYOUTS);
    setLayouts(cleanDefault);
    setWidgets(INITIAL_WIDGETS);
    try {
      localStorage.removeItem(STORAGE_LAYOUT_KEY);
      localStorage.removeItem(STORAGE_VISIBILITY_KEY);
      showToast('info', 'Layout Redefinido', 'Os 7 widgets foram restaurados com dimensões e posições padrão.');
    } catch {
      // ignore
    }
  };

  // Determine active visible widgets that have available content
  const visibleWidgets = widgets.filter(w => {
    if (!w.visible) return false;
    return Boolean(childrenMap[w.id]);
  });

  const getLayoutItemConfig = (widgetId: string) => {
    const currentBpLayout = layouts['lg'] || DEFAULT_LAYOUTS['lg'];
    const found = currentBpLayout?.find(item => item.i === widgetId);
    return found || DEFAULT_LAYOUTS['lg']?.find(item => item.i === widgetId) || { i: widgetId, x: 0, y: 0, w: 12, h: 8 };
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
            </div>
            <p className="text-[11px] text-neutral-400">
              Arraste pelo cabeçalho para reordenar os cards ou use o botão de visibilidade para ocultar/ativar módulos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Drag Lock Toggle */}
          <button
            onClick={() => {
              setIsDraggable(prev => !prev);
              showToast('info', !isDraggable ? 'Arrasto Habilitado' : 'Posições Travadas', !isDraggable ? 'Agora você pode mover os cards pelo cabeçalho.' : 'O layout foi fixado contra movimentações acidentais.');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
              isDraggable
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25'
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
            title={isDraggable ? 'Travar posições dos widgets' : 'Habilitar arrasto dos widgets'}
          >
            {isDraggable ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{isDraggable ? 'Arrasto Ativo' : 'Layout Travado'}</span>
          </button>

          {/* Visibility / Customize Dropdown Button */}
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

          {/* Reset Layout */}
          <button
            onClick={handleResetLayout}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-white/10 hover:border-white/20 transition flex items-center gap-1.5"
            title="Restaurar layout inicial padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar</span>
          </button>
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

      {/* Grid Canvas with Drag Handles */}
      <div className="relative">
        {mounted && width > 0 ? (
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
              enabled: false
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
                  className="group/widget flex flex-col h-full rounded-2xl transition-shadow focus-within:ring-1 focus-within:ring-orange-500/50 bg-[#060608] border border-white/5 overflow-hidden shadow-xl"
                >
                  {/* Visual Drag Handle Bar */}
                  <div 
                    className={`widget-drag-handle flex items-center justify-between px-3.5 py-2 bg-[#09090b] border-b border-white/10 select-none transition-colors ${
                      isDraggable 
                        ? 'cursor-grab active:cursor-grabbing hover:bg-neutral-900 group-hover/widget:border-orange-500/30' 
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                      <GripVertical className={`w-3.5 h-3.5 ${isDraggable ? 'text-orange-400 animate-pulse' : 'text-neutral-600'}`} />
                      <span className="font-bold text-neutral-200 uppercase tracking-wider">{widget.title}</span>
                      {widget.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px]">
                          {widget.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                      {isDraggable ? (
                        <span className="text-orange-400/80 text-[9px]">Arraste para mover</span>
                      ) : (
                        <span className="text-neutral-600 text-[9px]">Fixado</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWidgetVisibility(widget.id);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition"
                        title="Ocultar este widget"
                      >
                        <EyeOff className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Widget Real Content */}
                  <div className="flex-1 w-full overflow-hidden">
                    {content}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        ) : (
          <div className="space-y-4">
            {visibleWidgets.map(widget => (
              <div key={widget.id} className="rounded-2xl border border-white/10 overflow-hidden">
                {childrenMap[widget.id]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

