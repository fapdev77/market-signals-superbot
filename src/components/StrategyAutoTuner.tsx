import React, { useState } from 'react';
import { AutoTuneResult, BacktestResult, IndicatorWeights, TradingProfile } from '../types';
import { apiClient } from '../services/apiClient';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  Scale,
  Activity,
  AlertTriangle,
  FlaskConical,
  Lock,
  Check,
  Info
} from 'lucide-react';

/**
 * Strategy Auto-Tuner — pesos vindo do OTIMIZADOR REAL DO SERVIDOR.
 *
 * HISTÓRICO (auditoria CRÍTICO-1): esta tela chamava `runStrategyAutoTuning()`, um módulo
 * client-only (`src/utils/strategyAutoTuning.ts`, removido) que decidia vitória/derrota com
 * `Math.abs(Math.sin(idx * 997 + ...)) < winProb`. Os 4 candidatos eram literais hardcoded,
 * não existia busca nenhuma, e as métricas tinham piso (`Math.max(0.2, sharpeRatio)`) que
 * impedia o tuner de reportar um resultado ruim. O botão "Aplicar" empurrava esses números
 * para a estratégia real.
 *
 * Hoje a tela fala com `POST /api/backtest/autotune` → `BacktestEngine.runAutoTune`, que:
 *  - ajusta os pesos na fatia de TREINO (60% da série, truncada por `isOnlyUntil`);
 *  - reserva os 20% seguintes para validação;
 *  - mantém o holdout (20% final) invisível a todos os candidatos;
 *  - reporta IC95% por bootstrap e `isRobust` (limite inferior estritamente > 0).
 *
 * O botão de aplicar é BLOQUEADO quando o holdout não certifica robustez — o mesmo critério
 * de `evaluateGoNoGo` já usado no servidor. Não reintroduza atalho de otimização local.
 */

interface StrategyAutoTunerProps {
  currentWeights: IndicatorWeights;
  onApplyWeights: (newWeights: IndicatorWeights) => void;
}

const PROFILE_OPTIONS: Array<{ value: TradingProfile; label: string }> = [
  { value: 'scalp', label: 'Scalp' },
  { value: 'daytrade', label: 'Day Trade' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing' }
];

const DAY_OPTIONS = [30, 90, 180, 365];

const WEIGHT_ROWS: Array<{
  key: keyof IndicatorWeights;
  label: string;
  bar: string;
}> = [
  { key: 'cvdImbalanceWeight', label: 'CVD Imbalance (Order Flow)', bar: 'bg-emerald-400' },
  { key: 'openInterestWeight', label: 'Open Interest (Aporte Institucional)', bar: 'bg-cyan-400' },
  { key: 'volumeSurgeWeight', label: 'Volume Surge (R-Vol)', bar: 'bg-amber-400' },
  { key: 'fibonacciZoneWeight', label: 'Fibonacci Zone / Golden Pocket', bar: 'bg-indigo-400' },
  { key: 'supportResistanceWeight', label: 'Suporte & Resistência', bar: 'bg-purple-400' },
  { key: 'rangePocWeight', label: 'Range POC (Point of Control)', bar: 'bg-blue-400' },
  { key: 'fundingRateWeight', label: 'Funding Rate', bar: 'bg-rose-400' },
  { key: 'rsiDivergenceWeight', label: 'RSI Divergências', bar: 'bg-teal-400' }
];

function num(v: number | undefined): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/**
 * Formata um valor possivelmente ausente sem inventar casa decimal.
 * `null` é "medido ausente" (ex.: profit factor sem nenhuma perda) e sai como
 * "n/d"; `undefined` é "campo não preenchido" e sai como "—".
 */
function fmt(value: number | null | undefined, digits = 2, suffix = ''): string {
  if (value === null) return 'n/d';
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

/** Painel compacto de métricas de um BacktestResult. */
function ResultMetrics({ label, result, tone }: { label: string; result: BacktestResult; tone: 'base' | 'best' }) {
  const isBest = tone === 'best';
  return (
    <div className={`p-3 rounded-lg border space-y-2 ${isBest ? 'bg-cyan-950/30 border-cyan-500/40' : 'bg-black/40 border-white/5'}`}>
      <span className={`text-[10px] uppercase font-black ${isBest ? 'text-cyan-300' : 'text-neutral-400'}`}>
        {label}
      </span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-neutral-500">Win Rate</span>
          <strong className="text-white tabular-nums">{fmt(result.winRate)}%</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Profit Factor</span>
          <strong className="text-white tabular-nums">{fmt(result.profitFactor)}</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Max Drawdown</span>
          <strong className="text-rose-400 tabular-nums">{fmt(result.maxDrawdown)}%</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Sharpe</span>
          <strong className="text-white tabular-nums">{fmt(result.sharpeRatio)}</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Posições</span>
          <strong className="text-white tabular-nums">{num(result.positionsClosed ?? result.totalTrades)}</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Custos médios</span>
          <strong className="text-amber-400 tabular-nums">
            {result.rDecomposition ? fmt(result.rDecomposition.costAvgR, 3, ' R') : '—'}
          </strong>
        </div>
      </div>
      {typeof result.rDecomposition?.rNet === 'number' && (
        <div className="flex justify-between pt-1.5 border-t border-white/5 text-[11px]">
          <span className="text-neutral-500">R líquido médio</span>
          <strong className={result.rDecomposition.rNet > 0 ? 'text-emerald-400' : 'text-rose-400'} tabular-nums>
            {fmt(result.rDecomposition.rNet, 3, ' R')}
          </strong>
        </div>
      )}
    </div>
  );
}

export const StrategyAutoTuner: React.FC<StrategyAutoTunerProps> = ({
  currentWeights,
  onApplyWeights
}) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [profile, setProfile] = useState<TradingProfile>('intraday');
  const [days, setDays] = useState(90);
  const [iterations, setIterations] = useState(20);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<AutoTuneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);

  const handleRunOptimizer = async () => {
    setIsOptimizing(true);
    setError(null);
    setAppliedSuccessfully(false);
    try {
      const response = await apiClient.autoTuneStrategy({ symbol, days, profile, iterations });
      if (!response.success || !response.tuneResult) {
        setError('O servidor respondeu sem resultado de otimização.');
        setResult(null);
        return;
      }
      setResult(response.tuneResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setIsOptimizing(false);
    }
  };

  const holdout = result?.holdoutValidation;
  const isRobust = holdout?.isRobust === true;
  const canApply = Boolean(result) && isRobust;

  const handleApply = () => {
    if (!result || !canApply) return;
    onApplyWeights(result.bestWeights);
    setAppliedSuccessfully(true);
    setTimeout(() => setAppliedSuccessfully(false), 3000);
  };

  return (
    <div className="bg-[#0A0B0E] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 space-y-6 font-mono text-xs shadow-2xl shadow-cyan-950/20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-cyan-500/40 text-cyan-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                Auto-Tune de Parâmetros (Walk-Forward)
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                BACKTEST REAL
              </span>
            </div>
            <p className="text-neutral-400 text-xs">
              Otimiza os pesos sobre a fatia de treino, valida fora-da-amostra e certifica o
              resultado com bootstrap de 95%. Holdout nunca visto pela busca.
            </p>
          </div>
        </div>
      </div>

      {/* Parâmetros da busca */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Símbolo</span>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.trim().toUpperCase())}
            className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white font-black focus:outline-none focus:border-cyan-500"
            placeholder="BTCUSDT"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Perfil</span>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value as TradingProfile)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white font-black focus:outline-none focus:border-cyan-500"
          >
            {PROFILE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-[#0A0B0E]">
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Janela</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white font-black focus:outline-none focus:border-cyan-500"
          >
            {DAY_OPTIONS.map(d => (
              <option key={d} value={d} className="bg-[#0A0B0E]">{d} dias</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Iterações</span>
          <input
            type="number"
            min={1}
            max={200}
            value={iterations}
            onChange={(e) => setIterations(Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white font-black focus:outline-none focus:border-cyan-500"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleRunOptimizer}
            disabled={isOptimizing || symbol.length === 0}
            className="w-full px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Otimizando...' : 'Executar Otimização'}</span>
          </button>
        </div>
      </div>

      {isOptimizing && (
        <div className="flex items-center gap-2 text-cyan-300 text-[11px]">
          <FlaskConical className="w-3.5 h-3.5 animate-pulse" />
          <span>
            Rodando {iterations} iterações sobre {days} dias de histórico real de {symbol}. Cada
            iteração é um backtest completo com taxas, slippage e funding.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <span className="font-black block mb-0.5">Otimização falhou</span>
            <span className="text-rose-200/80">{error}</span>
          </div>
        </div>
      )}

      {/* Estado inicial: nada é exibido até haver medição real */}
      {!result && !isOptimizing && !error && (
        <div className="p-6 rounded-xl border border-white/5 bg-neutral-900/40 text-center space-y-2">
          <Activity className="w-6 h-6 text-neutral-600 mx-auto" />
          <p className="text-neutral-400 text-[11px] max-w-lg mx-auto leading-relaxed">
            Nenhum resultado carregado. Este painel só exibe números medidos em backtest sobre
            dados reais — nenhum valor é estimado, arredondado por piso ou gerado no navegador.
            Configure a janela e execute a otimização.
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Certificação do holdout — o gate que decide se os pesos podem entrar */}
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              isRobust
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-amber-950/25 border-amber-500/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isRobust ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-px" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-px" />
              )}
              <div className="space-y-1.5 min-w-0">
                <span className={`text-xs font-black uppercase ${isRobust ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {isRobust ? 'Holdout certificado (isRobust = true)' : 'Holdout NÃO certifica robustez'}
                </span>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  {holdout ? (
                    <>
                      Bootstrap de 95% sobre {num(holdout.trialsCount)} posições do holdout
                      (20% final da série, invisível à busca): média{' '}
                      <strong className="tabular-nums">{fmt(holdout.confidenceInterval?.mean, 3)} R</strong>,
                      IC95% [
                      <strong className="tabular-nums">{fmt(holdout.confidenceInterval?.lowerBound, 3)}</strong>,{' '}
                      <strong className="tabular-nums">{fmt(holdout.confidenceInterval?.upperBound, 3)}</strong>
                      ].{' '}
                      {isRobust
                        ? 'O limite inferior é estritamente positivo: a expectativa sobrevive fora da amostra.'
                        : 'O limite inferior não é positivo: os pesos não foram aprovados para produção.'}
                    </>
                  ) : (
                    'O servidor não retornou validação de holdout para esta execução. Sem ela não há como afirmar que os pesos generalizam.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Comparativo: baseline de treino vs melhor candidato */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-cyan-400" />
                Treino vs Melhor Candidato
              </h3>

              <ResultMetrics label="Baseline (pesos atuais)" result={result.initialResult} tone="base" />
              <ResultMetrics label="Melhor candidato (treino)" result={result.bestResult} tone="best" />

              {result.oosValidation && (
                <ResultMetrics label="Validação fora-da-amostra" result={result.oosValidation} tone="base" />
              )}

              {result.tuningSummary && (
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-[11px] text-neutral-400 leading-relaxed">
                  <span className="font-black text-neutral-300 block mb-1">Resumo do servidor</span>
                  {result.tuningSummary}
                </div>
              )}
            </div>

            {/* Pesos propostos */}
            <div className="lg:col-span-7 bg-neutral-900/50 p-4 rounded-xl border border-white/5 space-y-3 flex flex-col justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Pesos Propostos vs Atuais
                </span>
                <span className="text-[10px] text-neutral-400">
                  {result.symbol} · {result.profile} · {result.iterations} iterações
                </span>
              </h3>

              <div className="space-y-2">
                {WEIGHT_ROWS.map(item => {
                  const cur = num(currentWeights[item.key] as number | undefined);
                  const nxt = num(result.bestWeights[item.key] as number | undefined);
                  const delta = nxt - cur;
                  return (
                    <div key={String(item.key)} className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] gap-2">
                        <span className="font-bold text-neutral-300 truncate">{item.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-neutral-500 tabular-nums">Atual: {cur}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-neutral-600" />
                          <strong className="text-cyan-300 tabular-nums font-black">Proposto: {nxt}</strong>
                          {delta !== 0 && (
                            <span className={`tabular-nums ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({delta > 0 ? '+' : ''}{delta})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${Math.max(0, Math.min(100, nxt))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ressalvas do backtest — o que NÃO foi simulado */}
              {(result.bestResult.disabledFactors?.length || result.bestResult.reducedFactorSet || result.bestResult.assumptions?.length) ? (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] space-y-1.5">
                  <span className="font-black text-amber-300 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ressalvas do backtest
                  </span>
                  {result.bestResult.reducedFactorSet && (
                    <p className="text-amber-200/80">
                      Conjunto de fatores reduzido — cobertura histórica incompleta
                      {result.bestResult.factorCoverage ? (
                        <> (OI {fmt(result.bestResult.factorCoverage.openInterest, 0)}% · funding {fmt(result.bestResult.factorCoverage.funding, 0)}% · L/S {fmt(result.bestResult.factorCoverage.longShort, 0)}%)</>
                      ) : null}.
                    </p>
                  )}
                  {result.bestResult.disabledFactors?.map(f => (
                    <p key={f} className="text-amber-200/80">Fator não backtestável nesta janela: {f}</p>
                  ))}
                  {result.bestResult.assumptions?.map(a => (
                    <p key={a} className="text-amber-200/80">Premissa: {a}</p>
                  ))}
                </div>
              ) : null}

              {/* Curva de fitness da busca */}
              {result.fitnessHistory.length > 0 && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 font-bold">
                    Curva de fitness ({result.fitnessHistory.length} iterações)
                  </summary>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5 pr-1">
                    {result.fitnessHistory.map(it => (
                      <div key={it.iteration} className="flex justify-between gap-2 text-neutral-500">
                        <span>#{it.iteration}</span>
                        <span className="tabular-nums">
                          fitness {fmt(it.fitnessScore, 4)} · WR {fmt(it.winRate)}% · PF {fmt(it.profitFactor)} · DD {fmt(it.maxDrawdown)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Ação */}
              <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1.5">
                  {canApply ? (
                    <>
                      <Info className="w-3.5 h-3.5 text-emerald-400" />
                      Pesos certificados no holdout — prontos para aplicar.
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Aplicação bloqueada: o holdout não certifica os pesos.
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply}
                  title={canApply ? undefined : 'Requer holdoutValidation.isRobust = true no servidor.'}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:from-neutral-700 disabled:to-neutral-700"
                >
                  {appliedSuccessfully ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Pesos Atualizados</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Aplicar Pesos na Estratégia</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};