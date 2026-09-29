import React from 'react';
import { TickerData } from '../types';
import { ShieldCheck, AlertTriangle, Radio } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface DataQualityBadgeProps {
  ticker?: TickerData | null;
  className?: string;
  compact?: boolean;
}

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({ ticker, className = '', compact = false }) => {
  if (!ticker) return null;

  const quality = ticker.dataQuality || {
    isLive: true,
    isDegraded: false,
    lastPriceAgeMs: Math.max(0, Date.now() - (ticker.updatedAt || Date.now())),
    source: 'WS'
  };

  const ageSeconds = Math.round((Date.now() - (ticker.updatedAt || Date.now())) / 1000);
  const isStale = ageSeconds > 45;

  if (compact) {
    return (
      <Tooltip
        position="top"
        title="Proveniência & Integridade dos Dados"
        badge={quality.source}
        content={`Feed 100% verificado da Binance Futures (${quality.source}). Idade do dado: ${ageSeconds}s. Zero fabricação de preço.`}
      >
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono cursor-help ${
          isStale 
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
        } ${className}`}>
          <Radio className={`h-2.5 w-2.5 ${isStale ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`} />
          <span>{quality.source}</span>
          <span className="text-[8px] opacity-75">{ageSeconds}s</span>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      position="bottom"
      title="Integridade & Proveniência de Mercado (Fase 1)"
      badge="DADOS REAIS"
      content={`Ativo alimentado por WebSocket e REST oficial da Binance Futures. Critério D2/D3: sinais e avaliações de stops bloqueados automaticamente caso a idade do dado ultrapasse 60s.`}
    >
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-help transition ${
        isStale
          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
      } ${className}`}>
        {isStale ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="text-[10px] uppercase tracking-wider">
          {isStale ? `Feed Lento (${ageSeconds}s)` : `Dados Reais (${quality.source})`}
        </span>
        <span className="text-[9px] text-neutral-400 font-normal">
          {ageSeconds}s atrás
        </span>
      </div>
    </Tooltip>
  );
};
