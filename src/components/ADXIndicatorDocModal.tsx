import React, { useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Zap, 
  ArrowRight 
} from 'lucide-react';

export interface ADXIndicatorDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ADXIndicatorDocModal: React.FC<ADXIndicatorDocModalProps> = ({
  isOpen,
  onClose
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs font-sans animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adx-modal-title"
    >
      <div 
        className="bg-[#0b0c10] border border-orange-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-orange-950/20 overflow-hidden ring-1 ring-orange-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0e1015] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 id="adx-modal-title" className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>Estimated ADX (10–65)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  DOCUMENTAÇÃO TÉCNICA
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Guia operacional de leitura de força de tendência e momentum para Cripto e TradFi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Fechar modal de documentação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-neutral-300 text-sm">
          {/* Section 1: Concept */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>O que é o Estimated ADX em Tempo Real?</span>
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              O <strong>Estimated ADX (*Average Directional Index*)</strong> é uma métrica quantitativa institucional que mede a 
              <strong> intensidade e persistência da tendência</strong> de um ativo, independentemente se a direção é de alta ou baixa.
            </p>
            <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 space-y-2 text-xs">
              <div className="font-semibold text-neutral-200">
                Como difere do ADX clássico de 14 períodos:
              </div>
              <p className="text-neutral-400 leading-relaxed">
                O ADX convencional de análise gráfica depende do fechamento de velas passadas (lag de 14 períodos) e não detecta
                acelerações imediatas de fluxo. O <strong>Estimated ADX do SuperBot</strong> calcula uma estimativa instantânea integrando
                diretamente os fluxos do <strong>WebSocket da Binance</strong>:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-neutral-300">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Velocidade de Preço (ROC 24h - 25%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Posição no Range 24h (High/Low - 20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Agressão CVD & Taker Ratio (20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Influxo de Open Interest (15%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Desvio da Média Móvel MA24h (10%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Confluência e Quebra Estrutural (10%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Scale Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Escala de Níveis e Regimes Operacionais</span>
            </h3>

            <div className="border border-white/10 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-[#121318] text-neutral-400 border-b border-white/10 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Faixa ADX</th>
                    <th className="py-2.5 px-3">Barras</th>
                    <th className="py-2.5 px-3">Regime de Mercado</th>
                    <th className="py-2.5 px-3">Conduta Recomendada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[11px]">
                  <tr className="bg-neutral-950/40">
                    <td className="py-2.5 px-3 font-bold text-neutral-400">10 – 19.9</td>
                    <td className="py-2.5 px-3 text-neutral-400">1 Barra</td>
                    <td className="py-2.5 px-3 text-neutral-300 font-semibold">Lateral / Consolidação</td>
                    <td className="py-2.5 px-3 text-neutral-400">Evitar rompimentos; operar reversão na Value Area ou aguardar.</td>
                  </tr>
                  <tr className="bg-neutral-900/30">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">20 – 24.9</td>
                    <td className="py-2.5 px-3 text-cyan-400">2 Barras</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-semibold">Tendência em Formação</td>
                    <td className="py-2.5 px-3 text-neutral-300">Preparar ordens e aguardar reteste no Golden Pocket.</td>
                  </tr>
                  <tr className="bg-emerald-950/20">
                    <td className="py-2.5 px-3 font-bold text-emerald-400">25 – 39.9</td>
                    <td className="py-2.5 px-3 text-emerald-400">3–4 Barras</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">Tendência Forte (Ideal)</td>
                    <td className="py-2.5 px-3 text-emerald-200">Melhor regime para sinais LONG/SHORT de continuação.</td>
                  </tr>
                  <tr className="bg-teal-950/20">
                    <td className="py-2.5 px-3 font-bold text-teal-400">40 – 49.9</td>
                    <td className="py-2.5 px-3 text-teal-400">4 Barras</td>
                    <td className="py-2.5 px-3 text-teal-300 font-bold">Tendência Muito Forte</td>
                    <td className="py-2.5 px-3 text-neutral-300">Aceleração direcional intensa; conduzir com trailing stop e TP parciais.</td>
                  </tr>
                  <tr className="bg-rose-950/20">
                    <td className="py-2.5 px-3 font-bold text-rose-400">50 – 65+</td>
                    <td className="py-2.5 px-3 text-rose-400">5 Barras</td>
                    <td className="py-2.5 px-3 text-rose-300 font-bold">Clímax / Exaustão Parabólica</td>
                    <td className="py-2.5 px-3 text-rose-200">Não entrar a mercado a favor da tendência; risco de squeeze ou flush reverso.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Concrete Examples in Crypto & TradFi */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Exemplos Práticos: Mercado Lateral vs. Forte Momentum</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Example 1: Low ADX */}
              <div className="p-3.5 rounded-xl bg-[#0e1015] border border-white/10 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Cenário 1: ADX Baixo (~14.5)</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                    EXEMPLO: BTC ou SOL
                  </span>
                </div>

                <div className="text-xs text-neutral-300 space-y-1 font-mono">
                  <div className="text-neutral-400">
                    • <strong>Contexto:</strong> Preço variando apenas +0.2% no dia, oscilando no meio do range 24h (48%).
                  </div>
                  <div className="text-neutral-400">
                    • <strong>Fluxo:</strong> Taker Buy Ratio em 50.2%, CVD quase neutro e Open Interest sem variação.
                  </div>
                  <div className="text-amber-400 font-sans pt-1">
                    👉 <strong>Diagnóstico:</strong> Mercado em congestão e baixa volatilidade. Sinais de rompimento têm alto índice de falso rompimento (*fakeout*). O trader experiente aguarda acumulação ou opera apenas extremos da Value Area.
                  </div>
                </div>
              </div>

              {/* Example 2: High ADX */}
              <div className="p-3.5 rounded-xl bg-[#0e1015] border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cenário 2: ADX Alto (~36.2)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    EXEMPLO: ETH ou Altcoin em Alta
                  </span>
                </div>

                <div className="text-xs text-neutral-300 space-y-1 font-mono">
                  <div className="text-neutral-400">
                    • <strong>Contexto:</strong> Preço subindo +4.5%, rompendo a máxima de 24h (85% do range) e acima da MA24h.
                  </div>
                  <div className="text-neutral-400">
                    • <strong>Fluxo:</strong> Taker Buy Ratio em 59%, CVD comprador crescente e OI subindo +2.1% na hora.
                  </div>
                  <div className="text-emerald-400 font-sans pt-1">
                    👉 <strong>Diagnóstico:</strong> Momentum direcional sólido com forte influxo institucional. Excelente regime para sinais LONG. Pullbacks no reteste de suporte tendem a ser rapidamente defendidos pelos compradores.
                  </div>
                </div>
              </div>
            </div>

            {/* Example 3: Extreme Climax */}
            <div className="p-3.5 rounded-xl bg-[#0e1015] border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cenário 3: ADX Extremo (&gt; 52.0) — Alerta de Clímax / Squeeze</span>
                </span>
                <span className="text-[10px] text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                  CRIPTO / TRADFI OVEREXTENDED
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed font-mono">
                Quando o ADX ultrapassa 50, o ativo atingiu aceleração parabólica. Em cripto, isso frequentemente coincide com
                <strong> liquidações em cascata</strong> (short squeeze forçado ou long capitulation) e taxas de financiamento
                (Funding Rate) esticadas. Entrar a mercado nesse ponto expõe o trader a recuos severos de 5% a 10%.
                A conduta correta é proteger o stop móvel ou aguardar exaustão e divergência no CVD.
              </p>
            </div>
          </div>

          {/* Section 4: Signal Engine Integration */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Como Combinar o ADX com os Sinais do SuperBot</span>
            </h4>
            <div className="space-y-1.5 text-xs text-neutral-300">
              <div className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Sinais LONG / SHORT:</strong> Dê preferência aos sinais emitidos quando o ADX estiver na faixa de 
                  <strong> 25 a 40</strong>. Sinais emitidos com ADX &lt; 20 devem ser executados com alvos menores ou confirmação no livro.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Golden Pocket (0.618 - 0.68):</strong> Quando o preço recua para o Golden Pocket e o Estimated ADX
                  reverte para cima (saindo de 20 para 30), marca o ponto de entrada de maior precisão e menor risco do bot.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#0e1015] flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-neutral-400">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-white/10 text-neutral-200">Esc</kbd> para fechar
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-white bg-orange-500 hover:bg-orange-600 transition shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
