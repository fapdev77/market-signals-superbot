import React, { useState } from 'react';
import { IndicatorWeights } from '../types';
import { Sliders, Save, RotateCcw, CheckCircle } from 'lucide-react';

interface StrategySettingsProps {
  weights: IndicatorWeights;
  onSaveWeights: (newWeights: IndicatorWeights) => void;
}

export const StrategySettings: React.FC<StrategySettingsProps> = ({
  weights,
  onSaveWeights
}) => {
  const [formWeights, setFormWeights] = useState<IndicatorWeights>(weights);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activePreset, setActivePreset] = useState<'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'custom'>('intraday');

  const handleSliderChange = (key: keyof IndicatorWeights, val: number) => {
    setFormWeights(prev => ({ ...prev, [key]: val }));
    setActivePreset('custom');
  };

  const applyPreset = (preset: 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'custom') => {
    setActivePreset(preset);
    switch (preset) {
      case 'scalp': // Foco em SMC (Order Blocks, FVG curtos), TPO rapido e Analise Grafica micro
        setFormWeights({
          volumeSurgeWeight: 30,
          openInterestWeight: 15,
          fundingRateWeight: 5,
          cvdImbalanceWeight: 25,
          fibonacciZoneWeight: 5,
          rangePocWeight: 15,
          supportResistanceWeight: 5,
          minRiskRewardRatio: 1.5,
          volumeProfileRange: 10
        });
        break;
      case 'daytrade': // Mais filtrado que scalp, foco em POIs fortes
        setFormWeights({
          volumeSurgeWeight: 20,
          openInterestWeight: 15,
          fundingRateWeight: 5,
          cvdImbalanceWeight: 20,
          fibonacciZoneWeight: 10,
          rangePocWeight: 20,
          supportResistanceWeight: 10,
          minRiskRewardRatio: 2.0,
          volumeProfileRange: 20
        });
        break;
      case 'intraday': // Trades que podem durar o dia todo, TPO mais longo
        setFormWeights({
          volumeSurgeWeight: 15,
          openInterestWeight: 20,
          fundingRateWeight: 10,
          cvdImbalanceWeight: 15,
          fibonacciZoneWeight: 15,
          rangePocWeight: 15,
          supportResistanceWeight: 10,
          minRiskRewardRatio: 2.5,
          volumeProfileRange: 40
        });
        break;
      case 'swing': // Foco em FVG/OB macro, Fibonacci Retracement, POC semanal
        setFormWeights({
          volumeSurgeWeight: 10,
          openInterestWeight: 25,
          fundingRateWeight: 15,
          cvdImbalanceWeight: 10,
          fibonacciZoneWeight: 20,
          rangePocWeight: 10,
          supportResistanceWeight: 10,
          minRiskRewardRatio: 3.5,
          volumeProfileRange: 100
        });
        break;
      case 'position': // Position Trade / Macro, Foco extremo em SR Macro e Fib Macro
        setFormWeights({
          volumeSurgeWeight: 5,
          openInterestWeight: 30,
          fundingRateWeight: 20,
          cvdImbalanceWeight: 5,
          fibonacciZoneWeight: 20,
          rangePocWeight: 5,
          supportResistanceWeight: 15,
          minRiskRewardRatio: 5.0,
          volumeProfileRange: 200
        });
        break;
      case 'custom':
        // No auto-change, just set preset to custom
        break;
    }
  };

  const handleResetDefaults = () => {
    const defaultWeights: IndicatorWeights = {
      volumeSurgeWeight: 15,
      openInterestWeight: 20,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 20,
      fibonacciZoneWeight: 15,
      rangePocWeight: 10,
      supportResistanceWeight: 10,
      minRiskRewardRatio: 3.0,
      volumeProfileRange: 20
    };
    setFormWeights(defaultWeights);
  };

  const handleSave = () => {
    onSaveWeights(formWeights);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const totalPoints = formWeights.volumeSurgeWeight + 
                      formWeights.openInterestWeight + 
                      formWeights.fundingRateWeight + 
                      formWeights.cvdImbalanceWeight + 
                      formWeights.fibonacciZoneWeight + 
                      formWeights.rangePocWeight + 
                      formWeights.supportResistanceWeight;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto font-mono">
      {/* Header Card */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Dashboard de Estratégias & Motor Quantitativo</h2>
            <p className="text-[10px] text-neutral-400">
              Personalize o perfil do bot para SMC, Análise Gráfica, e Perfil de Volume (TPO)
            </p>
          </div>
        </div>
      </div>

      
      {/* Presets Dashboard */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-neutral-300 uppercase">Estratégias Prontas (SMC / TPO)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <button 
            onClick={() => applyPreset('scalp')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'scalp' ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Scalp & Micro
          </button>
          <button 
            onClick={() => applyPreset('daytrade')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'daytrade' ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Day Trade (POIs)
          </button>
          <button 
            onClick={() => applyPreset('intraday')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'intraday' ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Intraday Flex
          </button>
          <button 
            onClick={() => applyPreset('swing')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'swing' ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Swing Trade
          </button>
          <button 
            onClick={() => applyPreset('position')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'position' ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Position Macro
          </button>
          <button 
            onClick={() => applyPreset('custom')}
            className={`px-3 py-2 text-xs rounded border transition font-bold ${activePreset === 'custom' ? 'bg-orange-500 text-black border-orange-400 shadow-md shadow-orange-500/20' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'}`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Sliders Box */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
          <span className="text-neutral-300 font-bold uppercase">Pesos dos Indicadores</span>
          <span className="text-orange-400 font-extrabold">Pontuação Total: {totalPoints} pts</span>
        </div>

        <div className="space-y-4">
          {/* CVD Imbalance */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">CVD (Delta Acumulado) Imbalance</span>
              <span className="text-orange-400 font-extrabold">{formWeights.cvdImbalanceWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.cvdImbalanceWeight}
              onChange={(e) => handleSliderChange('cvdImbalanceWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Avalia o fluxo agressor de mercado (compras taker vs vendas taker).</p>
          </div>

          {/* Open Interest */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Acúmulo de Open Interest (OI)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.openInterestWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.openInterestWeight}
              onChange={(e) => handleSliderChange('openInterestWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Entrada de posições institucionais em contratos futuros.</p>
          </div>

          {/* Fibonacci Golden Pocket */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Zona Golden Pocket Fibo (0.618 - 0.68)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.fibonacciZoneWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.fibonacciZoneWeight}
              onChange={(e) => handleSliderChange('fibonacciZoneWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Região técnica chave para retração e melhor relação risco/retorno.</p>
          </div>

          {/* Volume Surge */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Surto de Volume</span>
              <span className="text-orange-400 font-extrabold">{formWeights.volumeSurgeWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.volumeSurgeWeight}
              onChange={(e) => handleSliderChange('volumeSurgeWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Picos de volume acima de 1.5x a média móvel de 15m.</p>
          </div>

          {/* Range POC */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Volume Profile: POC / VAL / VAH</span>
              <span className="text-orange-400 font-extrabold">{formWeights.rangePocWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.rangePocWeight}
              onChange={(e) => handleSliderChange('rangePocWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Rejeição ou aceitação do preço no nó de maior volume (POC).</p>
          </div>

          {/* Funding Rate */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Taxa de Financiamento (Funding Rate)</span>
              <span className="text-orange-400 font-extrabold">{formWeights.fundingRateWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.fundingRateWeight}
              onChange={(e) => handleSliderChange('fundingRateWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Desequilíbrio de funding em posições compradas vs vendidas.</p>
          </div>

          {/* Support / Resistance */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Suporte e Resistência</span>
              <span className="text-orange-400 font-extrabold">{formWeights.supportResistanceWeight} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={formWeights.supportResistanceWeight}
              onChange={(e) => handleSliderChange('supportResistanceWeight', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Níveis chave institucionais e estrutura de mercado.</p>
          </div>

          {/* Risk/Reward Ratio Constraint */}
          <div className="space-y-1 pt-4 border-t border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Risco/Retorno Mínimo Requerido</span>
              <span className="text-orange-400 font-extrabold">{formWeights.minRiskRewardRatio.toFixed(1)}:1</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={formWeights.minRiskRewardRatio * 10}
              onChange={(e) => handleSliderChange('minRiskRewardRatio', parseInt(e.target.value) / 10)}
              className="w-full accent-orange-500"
            />
            <p className="text-[10px] text-neutral-400">Define o fator de Risco/Retorno mínimo aceitável (ex: 3.0 para 3:1). Sinais com RR inferior serão rejeitados.</p>
          </div>

          <div className="space-y-1 pt-4 border-t border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-200 font-bold">Range do Volume Profile (velas)</span>
              <span className="text-cyan-400 font-extrabold">{formWeights.volumeProfileRange}</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={formWeights.volumeProfileRange}
              onChange={(e) => handleSliderChange('volumeProfileRange', parseInt(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <p className="text-[10px] text-neutral-400">Número de velas usadas para calcular POC, VAH e VAL.</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-xs font-bold transition flex items-center gap-1 border border-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrão
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Salvo!
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar Pesos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
