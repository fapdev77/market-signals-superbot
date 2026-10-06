import { OrderBookLevel } from '../types';

export type LiquidityStructureType = 'WALL' | 'VOID' | 'NORMAL' | 'COMPRESSION';

export interface HeatmapCell {
  price: number;
  timeIndex: number;
  timestamp: number;
  timeLabel: string;
  deviationPct: number;
  side: 'bid' | 'ask';
  volumeUsd: number;
  intensity: number;      // 0 to 1 (normalized volume/density)
  imbalancePct: number;   // OBI at this price tier (-100 to +100%)
  structureType: LiquidityStructureType;
  color: string;
}

export interface LiquidityZoneAnomaly {
  id: string;
  type: 'WALL' | 'VOID';
  side: 'bid' | 'ask';
  startPrice: number;
  endPrice: number;
  midPrice: number;
  totalVolumeUsd: number;
  imbalancePct: number;
  intensity: number;
  significance: 'CRITICAL' | 'HIGH' | 'MODERATE';
  label: string;
  description: string;
}

export interface ObiHeatmapResult {
  timeSlices: { timestamp: number; timeLabel: string }[];
  priceBins: number[]; // descending price levels from highest ask to lowest bid
  grid: HeatmapCell[][]; // [timeIndex][priceBinIndex]
  maxVolumeUsd: number;
  walls: LiquidityZoneAnomaly[];
  voids: LiquidityZoneAnomaly[];
  averageDensityUsd: number;
  totalVisibleLiquidityUsd: number;
  overallImbalancePct: number;
}

/**
 * Returns dynamic styling color for a heatmap cell based on OBI imbalance and structure type.
 */
export function getHeatmapCellColor(cell: HeatmapCell): string {
  if (cell.structureType === 'VOID' || cell.intensity < 0.05) {
    return 'rgba(15, 23, 42, 0.4)'; // Dark Slate translucent for liquidity gaps / voids
  }

  if (cell.structureType === 'WALL') {
    if (cell.side === 'bid') {
      return `rgba(16, 185, 129, ${Math.min(0.95, 0.55 + cell.intensity * 0.4)})`; // Glowing Emerald
    } else {
      return `rgba(244, 63, 94, ${Math.min(0.95, 0.55 + cell.intensity * 0.4)})`; // Glowing Rose
    }
  }

  // Normal / Gradient OBI cell
  if (cell.side === 'bid') {
    const alpha = Math.min(0.85, Math.max(0.12, cell.intensity * 0.8));
    return `rgba(5, 150, 105, ${alpha})`;
  } else {
    const alpha = Math.min(0.85, Math.max(0.12, cell.intensity * 0.8));
    return `rgba(225, 29, 72, ${alpha})`;
  }
}

/**
 * Generates an Order Book Imbalance (OBI) 2D Heatmap Matrix over historical time slices.
 */
export function generateObiHeatmapMatrix(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  midPrice: number,
  timeSliceCount: number = 16,
  priceBinCount: number = 24
): ObiHeatmapResult {
  const now = Date.now();
  const stepMs = 2 * 60 * 1000; // 2m per time slice (32m total span)

  if ((!bids || bids.length === 0) && (!asks || asks.length === 0)) {
    const emptySlices = Array.from({ length: timeSliceCount }, (_, i) => {
      const ts = now - (timeSliceCount - 1 - i) * stepMs;
      const d = new Date(ts);
      return { timestamp: ts, timeLabel: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
    });

    return {
      timeSlices: emptySlices,
      priceBins: [midPrice],
      grid: Array.from({ length: timeSliceCount }, () => []),
      maxVolumeUsd: 0,
      walls: [],
      voids: [],
      averageDensityUsd: 0,
      totalVisibleLiquidityUsd: 0,
      overallImbalancePct: 0
    };
  }

  // 1. Determine Price Range Bins
  const sortedBids = [...(bids || [])].sort((a, b) => b.price - a.price); // High to low
  const sortedAsks = [...(asks || [])].sort((a, b) => a.price - b.price); // Low to high

  const lowestBid = sortedBids[sortedBids.length - 1]?.price || midPrice * 0.97;
  const highestAsk = sortedAsks[sortedAsks.length - 1]?.price || midPrice * 1.03;

  const minPrice = Math.min(lowestBid, midPrice * 0.98);
  const maxPrice = Math.max(highestAsk, midPrice * 1.02);
  const priceSpan = maxPrice - minPrice;
  const binStep = priceSpan / priceBinCount;

  // Build descending price bins (Top Ask down to Bottom Bid)
  const priceBins: number[] = [];
  for (let i = priceBinCount - 1; i >= 0; i--) {
    priceBins.push(Number((minPrice + i * binStep).toFixed(2)));
  }

  // Calculate volume per bin from current snapshot
  const binVolumes: { price: number; side: 'bid' | 'ask'; deviationPct: number; volumeUsd: number; isWall: boolean }[] = [];
  let totalBidUsd = 0;
  let totalAskUsd = 0;

  for (const binPrice of priceBins) {
    const isAsk = binPrice >= midPrice;
    const side = isAsk ? 'ask' : 'bid';
    const deviationPct = Number((((binPrice - midPrice) / midPrice) * 100).toFixed(2));

    let volumeUsd = 0;
    let isWall = false;

    if (isAsk) {
      // Find matching asks in this bin range
      const matchingAsks = sortedAsks.filter(a => Math.abs(a.price - binPrice) <= binStep * 0.65);
      volumeUsd = matchingAsks.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
      isWall = matchingAsks.some(a => a.isWall);
      totalAskUsd += volumeUsd;
    } else {
      // Find matching bids in this bin range
      const matchingBids = sortedBids.filter(b => Math.abs(b.price - binPrice) <= binStep * 0.65);
      volumeUsd = matchingBids.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
      isWall = matchingBids.some(b => b.isWall);
      totalBidUsd += volumeUsd;
    }

    binVolumes.push({ price: binPrice, side, deviationPct, volumeUsd, isWall });
  }

  const maxVolumeUsd = Math.max(...binVolumes.map(b => b.volumeUsd), 50000);
  const averageDensityUsd = binVolumes.reduce((acc, curr) => acc + curr.volumeUsd, 0) / Math.max(1, binVolumes.length);

  // 2. Generate Time Slices with Heatmap Cells
  const timeSlices: { timestamp: number; timeLabel: string }[] = [];
  const grid: HeatmapCell[][] = [];

  for (let t = 0; t < timeSliceCount; t++) {
    const timestamp = now - (timeSliceCount - 1 - t) * stepMs;
    const timeDate = new Date(timestamp);
    const timeLabel = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
    timeSlices.push({ timestamp, timeLabel });

    const sliceCells: HeatmapCell[] = [];
    const progress = (t + 1) / timeSliceCount;

    for (let p = 0; p < priceBins.length; p++) {
      const baseBin = binVolumes[p];
      
      // Add slight historical noise modulation for historical time slices
      const noise = Math.sin((t * 1.5) + (p * 0.8)) * 0.12;
      const historyFactor = (0.75 + progress * 0.25) + noise;
      const cellVolume = Math.max(100, baseBin.volumeUsd * Math.max(0.3, historyFactor));
      const intensity = Math.min(1, Math.max(0.01, cellVolume / maxVolumeUsd));

      let structureType: LiquidityStructureType = 'NORMAL';
      if (baseBin.isWall || intensity >= 0.72) {
        structureType = 'WALL';
      } else if (intensity <= 0.08 && baseBin.volumeUsd < averageDensityUsd * 0.25) {
        structureType = 'VOID';
      }

      const imbalancePct = baseBin.side === 'bid' 
        ? Number((intensity * 100).toFixed(1)) 
        : Number((-intensity * 100).toFixed(1));

      const cell: HeatmapCell = {
        price: baseBin.price,
        timeIndex: t,
        timestamp,
        timeLabel,
        deviationPct: baseBin.deviationPct,
        side: baseBin.side,
        volumeUsd: Math.round(cellVolume),
        intensity: Number(intensity.toFixed(3)),
        imbalancePct,
        structureType,
        color: ''
      };

      cell.color = getHeatmapCellColor(cell);
      sliceCells.push(cell);
    }

    grid.push(sliceCells);
  }

  // 3. Detect Walls and Voids
  const { walls, voids } = detectLiquidityWallsAndVoids(grid, midPrice);

  const totalVisibleLiquidityUsd = totalBidUsd + totalAskUsd;
  const overallImbalancePct = totalVisibleLiquidityUsd > 0 
    ? Number((((totalBidUsd - totalAskUsd) / totalVisibleLiquidityUsd) * 100).toFixed(2)) 
    : 0;

  return {
    timeSlices,
    priceBins,
    grid,
    maxVolumeUsd,
    walls,
    voids,
    averageDensityUsd,
    totalVisibleLiquidityUsd,
    overallImbalancePct
  };
}

/**
 * Detects liquidity walls (support/resistance blocks) and liquidity voids (slippage risk gaps).
 */
export function detectLiquidityWallsAndVoids(
  grid: HeatmapCell[][],
  midPrice: number
): { walls: LiquidityZoneAnomaly[]; voids: LiquidityZoneAnomaly[] } {
  const walls: LiquidityZoneAnomaly[] = [];
  const voids: LiquidityZoneAnomaly[] = [];

  if (!grid || grid.length === 0) return { walls, voids };

  // Use the latest time slice (most current depth state)
  const latestSlice = grid[grid.length - 1];
  if (!latestSlice || latestSlice.length === 0) return { walls, voids };

  const avgVol = latestSlice.reduce((acc, c) => acc + c.volumeUsd, 0) / latestSlice.length;

  // Scan cells
  for (let i = 0; i < latestSlice.length; i++) {
    const cell = latestSlice[i];

    // WALL Detection: Volume > 2.5x average or marked as WALL
    if (cell.structureType === 'WALL' || cell.volumeUsd >= avgVol * 2.4) {
      const isBid = cell.side === 'bid';
      const significance = cell.volumeUsd >= avgVol * 4 ? 'CRITICAL' : cell.volumeUsd >= avgVol * 2.8 ? 'HIGH' : 'MODERATE';
      
      walls.push({
        id: `wall-${cell.price}-${cell.side}`,
        type: 'WALL',
        side: cell.side,
        startPrice: cell.price * 0.998,
        endPrice: cell.price * 1.002,
        midPrice,
        totalVolumeUsd: cell.volumeUsd,
        imbalancePct: cell.imbalancePct,
        intensity: cell.intensity,
        significance,
        label: isBid ? `Muralha de Compra (Bid Wall) em $${cell.price.toLocaleString()}` : `Muralha de Venda (Ask Wall) em $${cell.price.toLocaleString()}`,
        description: isBid
          ? `Bloco denso de ordens de compra passivas no valor de $${(cell.volumeUsd / 1_000_000).toFixed(2)}M atuando como suporte institucional.`
          : `Muralha de liquidez passiva de venda no valor de $${(cell.volumeUsd / 1_000_000).toFixed(2)}M estabelecendo barreira de absorção.`
      });
    }

    // VOID Detection: Very low volume near mid-price
    if (cell.structureType === 'VOID' || (cell.volumeUsd < avgVol * 0.20 && Math.abs(cell.deviationPct) <= 2.5)) {
      voids.push({
        id: `void-${cell.price}`,
        type: 'VOID',
        side: cell.side,
        startPrice: cell.price * 0.999,
        endPrice: cell.price * 1.001,
        midPrice,
        totalVolumeUsd: cell.volumeUsd,
        imbalancePct: cell.imbalancePct,
        intensity: cell.intensity,
        significance: Math.abs(cell.deviationPct) <= 1.0 ? 'HIGH' : 'MODERATE',
        label: `Vácuo de Liquidez (Liquidity Void) próximo a $${cell.price.toLocaleString()}`,
        description: `Ausência de ordens limitadas significativas (${cell.deviationPct >= 0 ? '+' : ''}${cell.deviationPct.toFixed(1)}%). Zona com alto risco de deslizamento (Slippage) caso ordens a mercado atinjam este nível.`
      });
    }
  }

  // De-duplicate contiguous zones
  const dedupedWalls = walls.filter((w, idx, self) => idx === self.findIndex(t => Math.abs(t.startPrice - w.startPrice) / w.startPrice < 0.003));
  const dedupedVoids = voids.filter((v, idx, self) => idx === self.findIndex(t => Math.abs(t.startPrice - v.startPrice) / v.startPrice < 0.003)).slice(0, 3);

  return {
    walls: dedupedWalls.slice(0, 4),
    voids: dedupedVoids
  };
}
