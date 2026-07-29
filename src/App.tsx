import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TickerGrid } from './components/TickerGrid';
import { SignalsMatrix } from './components/SignalsMatrix';
import { ChartAndProfile } from './components/ChartAndProfile';
import { AIMotorPanel } from './components/AIMotorPanel';
import { StrategySettings } from './components/StrategySettings';
import { BinanceConnectionPanel } from './components/BinanceConnectionPanel';
import { AIDashboard } from './components/AIDashboard';
import { AIModelsConfigDashboard } from './components/AIModelsConfigDashboard';
import { BacktestDashboard } from './components/BacktestDashboard';
import { defaultModels } from './config/defaultModels';
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket';
import { TickerData, TradeSignal, BotState, IndicatorWeights } from './types';
import { Zap, Flame, ShieldCheck, RefreshCw, Activity, ArrowUpRight, Database } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<TickerData | null>(null);

  const { status: clientWsStatus, logs: clientWsLogs } = useBinanceWebSocket(tickers, (updatedTickers) => {
    setTickers(updatedTickers);
    // Maintain current selectedTicker updated
    setSelectedTicker(prev => {
      if (prev) {
        const updated = updatedTickers.find(t => t.symbol === prev.symbol);
        return updated || prev;
      }
      return prev;
    });
  });

  const [botState, setBotState] = useState<BotState>({
    isMonitoring: true,
    activeTickersCount: 18,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: {
      volumeSurgeWeight: 15,
      openInterestWeight: 20,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 20,
      fibonacciZoneWeight: 15,
      rangePocWeight: 10,
      supportResistanceWeight: 10
    },
    aiModels: defaultModels,
    aiAnalysisEnabled: true
  });

  const fetchData = async () => {
    try {
      // Fetch Tickers
      const resT = await fetch('/api/tickers');
      if (resT.ok) {
        const dataT: TickerData[] = await resT.json();
        setTickers(dataT);
        // Atualiza os dados do ticker selecionado atual com os dados vindos do backend
        setSelectedTicker(prev => {
          if (!prev && dataT.length > 0) {
            return dataT[0];
          }
          if (prev) {
            const updated = dataT.find(t => t.symbol === prev.symbol);
            return updated || prev;
          }
          return prev;
        });
      }

      // Fetch Signals
      const resS = await fetch('/api/signals');
      if (resS.ok) {
        const dataS: TradeSignal[] = await resS.json();
        setSignals(dataS);
      }

      // Fetch Bot Status
      const resB = await fetch('/api/bot/status');
      if (resB.ok) {
        const dataB: BotState = await resB.json();
        setBotState(dataB);
      }
    } catch (err) {
      console.error('Error fetching bot state:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleBot = async () => {
    try {
      const res = await fetch('/api/bot/toggle', { method: 'POST' });
      const data = await res.json();
      setBotState(prev => ({ ...prev, isMonitoring: data.isMonitoring }));
    } catch (err) {
      console.error('Failed to toggle bot state:', err);
    }
  };

  const handleToggleAI = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/bot/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        const data = await res.json();
        setBotState(prev => ({ ...prev, aiAnalysisEnabled: data.aiAnalysisEnabled }));
      } else {
        setBotState(prev => ({ ...prev, aiAnalysisEnabled: enabled }));
      }
    } catch (err) {
      console.error('Failed to toggle AI mode:', err);
      setBotState(prev => ({ ...prev, aiAnalysisEnabled: enabled }));
    }
  };

  const handleSaveWeights = async (newWeights: IndicatorWeights) => {
    try {
      const res = await fetch('/api/settings/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWeights)
      });
      if (res.ok) {
        setBotState(prev => ({ ...prev, weights: newWeights }));
      }
    } catch (err) {
      console.error('Failed to save weights:', err);
    }
  };

  const handleSelectTickerBySymbol = (symbol: string) => {
    const found = tickers.find(t => t.symbol === symbol);
    if (found) {
      setSelectedTicker(found);
      setActiveTab('chart');
    }
  };

  const handleRequestAIReviewFromGrid = (ticker: TickerData) => {
    setSelectedTicker(ticker);
    setActiveTab('chart');
  };

  // Prime Opportunity Highlighted Signal
  const topGoldenPocketTicker = tickers.find(t => t.fibonacci.inGoldenPocket && t.confluenceScore >= 60);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <Header
        botState={botState}
        tickers={tickers}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleBot={handleToggleBot}
        onRefresh={fetchData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 md:pb-6">
        {/* Top Prime Signal Alert Banner */}
        {topGoldenPocketTicker && (
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Flame className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold font-mono text-white">
                    OPORTUNIDADE PRIME: {topGoldenPocketTicker.symbol} no Golden Pocket Fibo (0.618 - 0.68)
                  </h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded uppercase">
                    {topGoldenPocketTicker.confluenceScore}% Confluência
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Preço em ${topGoldenPocketTicker.price} re-testando retração de ouro com CVD {topGoldenPocketTicker.cvdDirection === 'BUY' ? 'Comprador' : 'Vendedor'}.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSelectTickerBySymbol(topGoldenPocketTicker.symbol)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 whitespace-nowrap"
            >
              Analisar {topGoldenPocketTicker.symbol}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dynamic Tab Views */}
        {activeTab === 'dashboard' && (
          <TickerGrid
            tickers={tickers}
            onSelectTicker={(t) => {
              setSelectedTicker(t);
              setActiveTab('chart');
            }}
            onRequestAIReview={handleRequestAIReviewFromGrid}
          />
        )}

        {activeTab === 'signals' && (
          <SignalsMatrix
            signals={signals}
            tickers={tickers}
            onRequestAIReview={handleRequestAIReviewFromGrid}
          />
        )}

        {activeTab === 'ai_motor' && (
          <AIMotorPanel
            tickers={tickers}
            currentWeights={botState.weights}
            onApplyWeights={handleSaveWeights}
            aiModels={botState.aiModels}
            aiAnalysisEnabled={botState.aiAnalysisEnabled}
            onToggleAI={handleToggleAI}
          />
        )}

        {activeTab === 'chart' && (
          <ChartAndProfile
            selectedTicker={selectedTicker}
            allTickers={tickers}
            onSelectTickerBySymbol={handleSelectTickerBySymbol}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestDashboard
            tickers={tickers}
            weights={botState.weights}
          />
        )}

        {activeTab === 'ai_models_config' && (
          <AIModelsConfigDashboard
            models={botState.aiModels}
            onUpdateModels={(newModels) => setBotState({ ...botState, aiModels: newModels })}
          />
        )}

        {activeTab === 'ai_dashboard' && (
          <AIDashboard />
        )}

        {activeTab === 'settings' && (
          <StrategySettings
            weights={botState.weights}
            onSaveWeights={handleSaveWeights}
          />
        )}

        {activeTab === 'binance_logs' && (
          <BinanceConnectionPanel
            clientWsStatus={clientWsStatus}
            clientWsLogs={clientWsLogs}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Market Signals SuperBot • Cripto Perpetuos USDT & TradFi</span>
          <span>Motor de IA: Gemini 3.6 Flash & OpenRouter Nemotron • SQLite Persistent</span>
        </div>
      </footer>
    </div>
  );
}
