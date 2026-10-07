import React from 'react';
import { TickerData } from '../types';
import { ShieldCheck, AlertTriangle, Radio } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface DataQualityBadgeProps {
  ticker?: TickerData | null;
  className?: string;
  compact?: boolean;
}

/**
 * FASE 0 (A-07): o selo agora DERIVA a afirmação do dado real.
 *
 * Antes ele afirmava estaticamente "DADOS REAIS / Feed 100% verificado / Zero
 * fabricação de preço" mesmo quando o `dataQuality` estava ausente ou o feed era
 * SYNTHETIC. Agora:
 *  - sem `dataQuality` ⇒ proveniência DESCONHECIDA (nunca "real");
 *  - `source === 'SYNTHETIC'` ⇒ rótulo de dado sintético;
 *  - `unavailableFactors` ⇒ listados explicitamente (o fator não foi medido).
 */
export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({ ticker, className = '', compact = false }) => {
  if (!ticker) return null;

  const quality = ticker.dataQuality ?? null;
  const ageSeconds = Math.round((Date.now() - (ticker.updatedAt || Date.now())) / 1000);
  const isStale = ageSeconds > 45;

  const source = quality?.source ?? 'DESCONHECIDO';
  const unavailable = quality?.unavailableFactors ?? [];
  const hasUnavailable = unavailable.length > 0;
  const isSynthetic = source === 'SYNTHETIC';
  const needsAttention = isStale || isSynthetic || hasUnavailable || quality?.isDegraded === true;

  const provenanceLine = quality
    ? `Fonte do feed: ${source}. Idade do dado: ${ageSeconds}s.`
    : `Proveniência do feed desconhecida (sem registro de dataQuality). Idade do dado: ${ageSeconds}s.`;

  const unavailableLine = hasUnavailable
    ? ` Fatores indisponíveis neste tick: ${unavailable.join('; ')}.`
    : '';

  const tooltipContent = `${provenanceLine}${unavailableLine} Dados sem registro são tratados como não verificados.`;

  if (compact) {
    return (
      <Tooltip
        position="top"
        title="Proveniência & Integridade dos Dados"
        badge={source}
        content={tooltipContent}
      >
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono cursor-help ${
          needsAttention
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
        } ${className}`}>
          <Radio className={`h-2.5 w-2.5 ${needsAttention ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`} />
          <span>{source}</span>
          <span className="text-[8px] opacity-75">{ageSeconds}s</span>
        </span>
      </Tooltip>
    );
  }

  const label = isSynthetic
    ? 'Dado Sintético'
    : hasUnavailable
    ? `Parcial (${unavailable.length} n/d)`
    : isStale
    ? `Feed Lento (${ageSeconds}s)`
    : quality?.isDegraded
    ? 'Feed Degradado'
    : `Fonte ${source}`;

  return (
    <Tooltip
      position="bottom"
      title="Integridade & Proveniência de Mercado (Fase 0)"
      badge={source}
      content={tooltipContent}
    >
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-help transition ${
        needsAttention
          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
      } ${className}`}>
        {needsAttention ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="text-[10px] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[9px] text-neutral-400 font-normal">
          {ageSeconds}s atrás
        </span>
      </div>
    </Tooltip>
  );
};
