import { LiquidityBucket, LiquidityHeatmapData } from '../types';

export interface CandlePriceVolume {
  high: number;
  low: number;
  close?: number;
  volume?: number;
  takerBuy?: number;
  takerSell?: number;
}

/**
 * Computes horizontal liquidity clusters from candle data and current price.
 * Identifies Point of Control (POC), High Volume Nodes (HVN), Low Volume Nodes (LVN),
 * and primary Supply/Demand interest zones.
 */
export function calculateLiquidityHeatmap(
  candles: CandlePriceVolume[],
  currentPrice: number,
  bucketCount: number = 32
): LiquidityHeatmapData {
  const emptyResult: LiquidityHeatmapData = {
    buckets: [],
    pocBucket: null,
    topSupplyCluster: null,
    topDemandCluster: null,
    maxBucketVolume: 0
  };

  if (!candles || candles.length === 0 || bucketCount <= 0) {
    return emptyResult;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }

  if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice >= maxPrice) {
    return emptyResult;
  }

  const priceStep = (maxPrice - minPrice) / bucketCount;
  const rawBuckets: { priceMin: number; priceMax: number; volume: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bMin = minPrice + i * priceStep;
    const bMax = bMin + priceStep;
    rawBuckets.push({
      priceMin: bMin,
      priceMax: bMax,
      volume: 0
    });
  }

  // Distribute candle volume across the price intervals it intersects
  for (const c of candles) {
    const candleSpan = Math.max(c.high - c.low, priceStep * 0.1);
    const vol = (c.volume ?? ((c.takerBuy ?? 0) + (c.takerSell ?? 0))) || 1;

    for (let i = 0; i < bucketCount; i++) {
      const b = rawBuckets[i];
      // Check intersection of [c.low, c.high] with [b.priceMin, b.priceMax]
      const overlapStart = Math.max(c.low, b.priceMin);
      const overlapEnd = Math.min(c.high, b.priceMax);

      if (overlapEnd > overlapStart) {
        const overlapRatio = (overlapEnd - overlapStart) / candleSpan;
        b.volume += vol * overlapRatio;
      }
    }
  }

  let maxVol = 0;
  for (const b of rawBuckets) {
    if (b.volume > maxVol) maxVol = b.volume;
  }

  if (maxVol === 0) {
    return emptyResult;
  }

  let pocBucket: LiquidityBucket | null = null;
  const buckets: LiquidityBucket[] = [];

  for (const b of rawBuckets) {
    const density = Math.min(1.0, Math.max(0.0, b.volume / maxVol));
    const priceCenter = (b.priceMin + b.priceMax) / 2;
    const isPOC = b.volume === maxVol;
    const isHVN = density >= 0.60;
    const isLVN = density <= 0.20;
    const isSupply = priceCenter > currentPrice && isHVN;
    const isDemand = priceCenter < currentPrice && isHVN;

    const bucket: LiquidityBucket = {
      priceMin: b.priceMin,
      priceMax: b.priceMax,
      priceCenter,
      volume: b.volume,
      density,
      isHighVolumeNode: isHVN,
      isLowVolumeNode: isLVN,
      isSupplyZone: isSupply,
      isDemandZone: isDemand,
      isPOC
    };

    buckets.push(bucket);
    if (isPOC && !pocBucket) {
      pocBucket = bucket;
    }
  }

  // Find the top supply cluster above current price
  let topSupply: { min: number; max: number; volume: number } | null = null;
  let maxSupplyVol = 0;
  for (const b of buckets) {
    if (b.isSupplyZone && b.volume > maxSupplyVol) {
      maxSupplyVol = b.volume;
      topSupply = {
        min: b.priceMin,
        max: b.priceMax,
        volume: b.volume
      };
    }
  }

  // Find the top demand cluster below current price
  let topDemand: { min: number; max: number; volume: number } | null = null;
  let maxDemandVol = 0;
  for (const b of buckets) {
    if (b.isDemandZone && b.volume > maxDemandVol) {
      maxDemandVol = b.volume;
      topDemand = {
        min: b.priceMin,
        max: b.priceMax,
        volume: b.volume
      };
    }
  }

  return {
    buckets,
    pocBucket,
    topSupplyCluster: topSupply,
    topDemandCluster: topDemand,
    maxBucketVolume: maxVol
  };
}

/**
 * Returns an RGBA color string tailored for heat intensity and zone semantics.
 */
export function getLiquidityBucketColor(bucket: LiquidityBucket): string {
  if (bucket.isPOC) {
    // Glowing Amber for Point of Control (Highest Liquidity Concentration)
    return 'rgba(249, 115, 22, 0.45)';
  }
  if (bucket.isSupplyZone) {
    // Rose / Crimson for Supply (Resistance Clusters)
    const alpha = (0.10 + bucket.density * 0.25).toFixed(3);
    return `rgba(244, 63, 94, ${alpha})`;
  }
  if (bucket.isDemandZone) {
    // Emerald / Cyan for Demand (Support Clusters)
    const alpha = (0.10 + bucket.density * 0.25).toFixed(3);
    return `rgba(16, 185, 129, ${alpha})`;
  }
  if (bucket.isHighVolumeNode) {
    // High neutral acceptance zone
    const alpha = (0.08 + bucket.density * 0.18).toFixed(3);
    return `rgba(234, 179, 8, ${alpha})`;
  }
  // Low volume / neutral background
  return 'transparent';
}
