import React from 'react';
import { ReferenceArea } from 'recharts';
import { LiquidityHeatmapData, LiquidityBucket } from '../types';
import { getLiquidityBucketColor } from '../utils/heatmapUtils';
import { formatPrice, formatCompactNumber } from '../utils/formatters';
import { Flame, ShieldCheck, AlertOctagon, Layers } from 'lucide-react';

interface LiquidityHeatmapReferenceAreasProps {
  heatmapData: LiquidityHeatmapData;
  visible: boolean;
}

export const LiquidityHeatmapReferenceAreas: React.FC<LiquidityHeatmapReferenceAreasProps> = React.memo(({
  heatmapData,
  visible
}) => {
  if (!visible || !heatmapData || !heatmapData.buckets.length) {
    return null;
  }

  return (
    <>
      {heatmapData.buckets.map((bucket, idx) => {
        // Only render buckets with significant volume or node classification
        if (!bucket.isHighVolumeNode && !bucket.isPOC && bucket.density < 0.35) {
          return null;
        }

        const color = getLiquidityBucketColor(bucket);
        if (color === 'transparent') return null;

        return (
          <ReferenceArea
            key={`hm-band-${idx}`}
            y1={bucket.priceMin}
            y2={bucket.priceMax}
            fill={color}
            stroke={bucket.isPOC ? '#f97316' : 'none'}
            strokeDasharray={bucket.isPOC ? '2 2' : undefined}
            strokeWidth={bucket.isPOC ? 1 : 0}
            ifOverflow="extendDomain"
          />
        );
      })}
    </>
  );
});

LiquidityHeatmapReferenceAreas.displayName = 'LiquidityHeatmapReferenceAreas';

interface LiquidityHeatmapBadgeProps {
  heatmapData: LiquidityHeatmapData;
  visible: boolean;
  onToggle: () => void;
  bucketCount: number;
  onChangeBucketCount: (count: number) => void;
}

export const LiquidityHeatmapBadge: React.FC<LiquidityHeatmapBadgeProps> = ({
  heatmapData,
  visible,
  onToggle,
  bucketCount,
  onChangeBucketCount
}) => {
  const { pocBucket, topDemandCluster, topSupplyCluster } = heatmapData;

  return (
    <div className="bg-[#0A0A0A]/90 backdrop-blur-md p-2.5 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition border ${
            visible
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm'
              : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-white'
          }`}
          title="Alternar camada de Heatmap de Liquidez"
        >
          <Flame className={`h-3.5 w-3.5 ${visible ? 'text-orange-400 animate-pulse' : 'text-neutral-500'}`} />
          <span>Heatmap de Liquidez: {visible ? 'ATIVO' : 'DESLIGADO'}</span>
        </button>

        {visible && (
          <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5">
            <span className="text-[10px] text-neutral-500 font-bold px-1.5 uppercase flex items-center gap-1">
              <Layers className="h-3 w-3" /> Resolução:
            </span>
            {[24, 36, 48].map((cnt) => (
              <button
                key={cnt}
                onClick={() => onChangeBucketCount(cnt)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                  bucketCount === cnt
                    ? 'bg-orange-500 text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible && (
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {/* Top Demand */}
          {topDemandCluster && (
            <div className="flex items-center gap-1.5 bg-emerald-950/30 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-[10px] uppercase text-neutral-400">Demanda (Suporte):</span>
              <span className="font-bold">
                {formatPrice(topDemandCluster.min, { currency: true })} - {formatPrice(topDemandCluster.max, { currency: true })}
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono">
                {formatCompactNumber(topDemandCluster.volume)}
              </span>
            </div>
          )}

          {/* Point of Control (POC) */}
          {pocBucket && (
            <div className="flex items-center gap-1.5 bg-orange-950/30 text-orange-400 px-2 py-1 rounded border border-orange-500/30">
              <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="font-semibold text-[10px] uppercase text-neutral-400">Ponto de Controle (POC):</span>
              <span className="font-extrabold">{formatPrice(pocBucket.priceCenter, { currency: true })}</span>
            </div>
          )}

          {/* Top Supply */}
          {topSupplyCluster && (
            <div className="flex items-center gap-1.5 bg-rose-950/30 text-rose-400 px-2 py-1 rounded border border-rose-500/20">
              <AlertOctagon className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span className="font-semibold text-[10px] uppercase text-neutral-400">Oferta (Resistência):</span>
              <span className="font-bold">
                {formatPrice(topSupplyCluster.min, { currency: true })} - {formatPrice(topSupplyCluster.max, { currency: true })}
              </span>
              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded font-mono">
                {formatCompactNumber(topSupplyCluster.volume)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
