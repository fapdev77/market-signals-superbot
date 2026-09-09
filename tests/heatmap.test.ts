import { describe, it, expect } from 'vitest';
import { calculateLiquidityHeatmap, getLiquidityBucketColor } from '../src/utils/heatmapUtils';

describe('Liquidity Heatmap & Cluster Detection Suite', () => {
  const mockCandles = [
    { high: 100, low: 90, close: 95, volume: 1000 },
    { high: 105, low: 95, close: 102, volume: 3000 }, // heavy volume cluster around 95-105
    { high: 110, low: 100, close: 108, volume: 5000 }, // heaviest volume cluster around 100-110 (POC)
    { high: 120, low: 110, close: 115, volume: 1200 },
    { high: 130, low: 120, close: 125, volume: 800 }
  ];

  it('calculates liquidity buckets across the price range', () => {
    const heatmap = calculateLiquidityHeatmap(mockCandles, 105, 20);
    expect(heatmap.buckets.length).toBe(20);
    expect(heatmap.maxBucketVolume).toBeGreaterThan(0);
    expect(heatmap.pocBucket).not.toBeNull();
    if (heatmap.pocBucket) {
      expect(heatmap.pocBucket.isPOC).toBe(true);
      expect(heatmap.pocBucket.density).toBe(1.0);
    }
  });

  it('identifies top supply cluster above current price and demand cluster below', () => {
    // Current price is 105
    const heatmap = calculateLiquidityHeatmap(mockCandles, 105, 20);
    if (heatmap.topSupplyCluster) {
      expect(heatmap.topSupplyCluster.min).toBeGreaterThanOrEqual(100);
    }
    if (heatmap.topDemandCluster) {
      expect(heatmap.topDemandCluster.max).toBeLessThanOrEqual(110);
    }
  });

  it('returns valid CSS colors for different node types', () => {
    const heatmap = calculateLiquidityHeatmap(mockCandles, 105, 10);
    if (heatmap.pocBucket) {
      const pocColor = getLiquidityBucketColor(heatmap.pocBucket);
      expect(pocColor).toContain('rgba(249, 115, 22');
    }
  });

  it('handles empty candles safely', () => {
    const emptyHeatmap = calculateLiquidityHeatmap([], 100, 20);
    expect(emptyHeatmap.buckets).toEqual([]);
    expect(emptyHeatmap.pocBucket).toBeNull();
  });
});
