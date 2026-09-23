import React, { useState, useEffect } from 'react';
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
  Server
} from 'lucide-react';
import { useToast } from './Toast';

export type DashboardWidgetId = 
  | 'system_health'
  | 'prime_banner'
  | 'market_heatmap'
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
    { i: 'market_heatmap', x: 0, y: 9, w: 12, h: 9, minW: 6, minH: 6 },
    { i: 'liquidity_depth', x: 0, y: 18, w: 12, h: 10, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 28, w: 12, h: 7, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 35, w: 12, h: 14, minW: 6, minH: 6 }
  ],
  md: [
    { i: 'system_health', x: 0, y: 0, w: 10, h: 5, minW: 5, minH: 4 },
    { i: 'prime_banner', x: 0, y: 5, w: 10, h: 4, minW: 5, minH: 3 },
    { i: 'market_heatmap', x: 0, y: 9, w: 10, h: 9, minW: 5, minH: 6 },
    { i: 'liquidity_depth', x: 0, y: 18, w: 10, h: 10, minW: 5, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 28, w: 10, h: 7, minW: 5, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 35, w: 10, h: 14, minW: 5, minH: 6 }
  ],
  sm: [
    { i: 'system_health', x: 0, y: 0, w: 6, h: 5, minW: 6, minH: 4 },
    { i: 'prime_banner', x: 0, y: 5, w: 6, h: 4, minW: 6, minH: 3 },
    { i: 'market_heatmap', x: 0, y: 9, w: 6, h: 8, minW: 6, minH: 6 },
    { i: 'liquidity_depth', x: 0, y: 17, w: 6, h: 10, minW: 6, minH: 7 },
    { i: 'correlation_matrix', x: 0, y: 27, w: 6, h: 7, minW: 6, minH: 5 },
    { i: 'ticker_grid', x: 0, y: 34, w: 6, h: 14, minW: 6, minH: 6 }
  ]
};

const STORAGE_LAYOUT_KEY = 'superbot_dashboard_grid_layouts_v4';
const STORAGE_VISIBILITY_KEY = 'superbot_dashboard_widgets_visibility_v4';

interface DashboardGridLayoutProps {
  childrenMap: Record<DashboardWidgetId, React.ReactNode>;
  hasPrimeBanner: boolean;
  hasCorrelationMatrix: boolean;
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
  childrenMap,
  hasPrimeBanner,
  hasCorrelationMatrix
}) => {
  const { showToast } = useToast();
  const { width, containerRef, mounted } = useContainerWidth();
  const [isDraggable, setIsDraggable] = useState<boolean>(true);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);

  // Widget definitions
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
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
      icon: Activity,
      visible: true,
      minW: 6,
      minH: 6
    }
  ]);

  // Load saved layouts or fallback to defaults
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lg && parsed.md) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_LAYOUTS;
  });

  // Load visibility preferences
  useEffect(() => {
    try {
      const savedVis = localStorage.getItem(STORAGE_VISIBILITY_KEY);
      if (savedVis) {
        const parsed: Record<string, boolean> = JSON.parse(savedVis);
        setWidgets(prev => prev.map(w => ({
          ...w,
          visible: parsed[w.id] !== undefined ? parsed[w.id] : w.visible
        })));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLayoutChange = (currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
    try {
      localStorage.setItem(STORAGE_LAYOUT_KEY, JSON.stringify(allLayouts));
    } catch {
      // ignore
    }
  };

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
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

  const handleResetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    setWidgets(prev => prev.map(w => ({ ...w, visible: true })));
    try {
      localStorage.removeItem(STORAGE_LAYOUT_KEY);
      localStorage.removeItem(STORAGE_VISIBILITY_KEY);
      showToast('info', 'Layout Redefinido', 'Os widgets foram restaurados para a ordem padrão.');
    } catch {
      // ignore
    }
  };

  // Determine active visible widgets
  const visibleWidgets = widgets.filter(w => {
    if (!w.visible) return false;
    if (w.id === 'prime_banner' && !hasPrimeBanner) return false;
    if (w.id === 'correlation_matrix' && !hasCorrelationMatrix) return false;
    return true;
  });

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
              <span className="text-[9px] bg-white/5 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-white/10">
                React Grid Layout
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Arraste pelo cabeçalho do widget para reordenar a prioridade de informações do seu estilo de trading.
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
                ? 'bg-neutral-800 text-white border-white/30'
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Widgets ({visibleWidgets.length}/{widgets.length})</span>
          </button>

          {/* Reset Layout */}
          <button
            onClick={handleResetLayout}
            className="px-2 py-1.5 rounded-lg text-xs font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-white/10 hover:border-white/20 transition flex items-center gap-1"
            title="Restaurar layout inicial padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar</span>
          </button>
        </div>
      </div>

      {/* Widget Customization Drawer */}
      {isCustomizing && (
        <div className="bg-[#0c0d0e] border border-orange-500/20 rounded-xl p-3.5 shadow-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-neutral-200 font-mono flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Visibilidade dos Painéis do Dashboard
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Clique para ocultar/exibir qualquer widget
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {widgets.map(w => {
              const Icon = w.icon;
              return (
                <div
                  key={w.id}
                  onClick={() => toggleWidgetVisibility(w.id)}
                  className={`flex items-start justify-between p-2.5 rounded-lg border cursor-pointer select-none transition ${
                    w.visible
                      ? 'bg-neutral-900/90 border-white/20 hover:border-orange-500/50'
                      : 'bg-black/50 border-white/5 opacity-50 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded ${w.visible ? 'bg-orange-500/20 text-orange-400' : 'bg-neutral-800 text-neutral-500'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                        <span>{w.title}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                        {w.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {w.visible ? (
                      <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 p-1 rounded-md flex items-center">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-neutral-500 bg-neutral-900 p-1 rounded-md flex items-center">
                        <EyeOff className="w-3 h-3" />
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

              return (
                <div 
                  key={widget.id} 
                  className="group/widget flex flex-col h-full rounded-2xl transition-shadow focus-within:ring-1 focus-within:ring-orange-500/50"
                >
                  {/* Visual Drag Handle Bar */}
                  <div 
                    className={`widget-drag-handle flex items-center justify-between px-3 py-1.5 bg-[#09090b] border-t border-x border-white/10 rounded-t-xl select-none transition-colors ${
                      isDraggable 
                        ? 'cursor-grab active:cursor-grabbing hover:bg-neutral-900 group-hover/widget:border-orange-500/30' 
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                      <GripVertical className={`w-3.5 h-3.5 ${isDraggable ? 'text-orange-400 animate-pulse' : 'text-neutral-600'}`} />
                      <span className="font-bold text-neutral-300 uppercase tracking-wider">{widget.title}</span>
                      {widget.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px]">
                          {widget.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-500">
                      {isDraggable ? (
                        <span className="text-orange-400/80 text-[9px]">Arraste para mover</span>
                      ) : (
                        <span className="text-neutral-600 text-[9px]">Fixado</span>
                      )}
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
              <div key={widget.id}>
                {childrenMap[widget.id]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
