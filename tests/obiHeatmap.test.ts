import { describe, it, expect } from 'vitest';
import {
  generateObiHeatmapMatrix,
  detectLiquidityWallsAndVoids,
  getHeatmapCellColor,
  type HeatmapCell,
  type ObiHeatmapResult
} from '../src/utils/obiHeatmapUtils.js';
import type { OrderBookLevel } from '../src/types.js';

describe('Order Book Imbalance (OBI) Heatmap Matrix & Liquidity Zones (TDD)', () => {
  const mockBids: OrderBookLevel[] = [
    { price: 64900, qty: 5, totalQty: 5, totalUsd: 324500, deviationPct: -0.15 },
    { price: 64800, qty: 12, totalQty: 17, totalUsd: 1101600, deviationPct: -0.3 },
    { price: 64500, qty: 150, totalQty: 167, totalUsd: 10776600, deviationPct: -0.77, isWall: true }, // Big Wall
    { price: 64200, qty: 0.1, totalQty: 167.1, totalUsd: 10783020, deviationPct: -1.23 }, // Void
    { price: 64000, qty: 80, totalQty: 247.1, totalUsd: 15903020, deviationPct: -1.54 }
  ];

  const mockAsks: OrderBookLevel[] = [
    { price: 65100, qty: 4, totalQty: 4, totalUsd: 260400, deviationPct: 0.15 },
    { price: 65200, qty: 10, totalQty: 14, totalUsd: 912400, deviationPct: 0.3 },
    { price: 65500, qty: 180, totalQty: 194, totalUsd: 12702400, deviationPct: 0.77, isWall: true }, // Big Wall
    { price: 65800, qty: 0.1, totalQty: 194.1, totalUsd: 12708980, deviationPct: 1.23 }, // Void
    { price: 66000, qty: 75, totalQty: 269.1, totalUsd: 17658980, deviationPct: 1.54 }
  ];

  const midPrice = 65000;

  it('generates a structured 2D Heatmap Matrix across time slices and price bins', () => {
    const heatmap: ObiHeatmapResult = generateObiHeatmapMatrix(mockBids, mockAsks, midPrice, 12, 20);

    expect(heatmap).toBeDefined();
    expect(heatmap.timeSlices).toHaveLength(12);
    expect(heatmap.grid).toHaveLength(12);
    expect(heatmap.priceBins.length).toBeGreaterThan(0);
    expect(heatmap.maxVolumeUsd).toBeGreaterThan(0);

    // Each time slice has price bin cells
    const firstSlice = heatmap.grid[0];
    expect(firstSlice.length).toBe(heatmap.priceBins.length);

    const cell = firstSlice[0];
    expect(cell).toHaveProperty('price');
    expect(cell).toHaveProperty('volumeUsd');
    expect(cell).toHaveProperty('intensity');
    expect(cell).toHaveProperty('imbalancePct');
    expect(cell).toHaveProperty('structureType');
    expect(cell).toHaveProperty('color');
  });

  it('detects liquidity walls correctly on bids and asks', () => {
    const heatmap = generateObiHeatmapMatrix(mockBids, mockAsks, midPrice, 10, 20);

    expect(heatmap.walls.length).toBeGreaterThan(0);
    const bidWall = heatmap.walls.find(w => w.side === 'bid');
    const askWall = heatmap.walls.find(w => w.side === 'ask');

    expect(bidWall).toBeDefined();
    expect(bidWall?.label).toContain('Muralha de Compra');
    expect(askWall).toBeDefined();
    expect(askWall?.label).toContain('Muralha de Venda');
  });

  it('detects liquidity voids (gaps with low limit order density)', () => {
    const heatmap = generateObiHeatmapMatrix(mockBids, mockAsks, midPrice, 10, 20);

    expect(heatmap.voids.length).toBeGreaterThan(0);
    const voidZone = heatmap.voids[0];
    expect(voidZone.type).toBe('VOID');
    expect(voidZone.label).toContain('Vácuo de Liquidez');
    expect(voidZone.description).toContain('deslizamento');
  });

  it('computes accurate heatmap cell colors according to OBI intensity and side', () => {
    const bidWallCell: HeatmapCell = {
      price: 64500,
      timeIndex: 0,
      timestamp: Date.now(),
      timeLabel: '12:00',
      deviationPct: -0.77,
      side: 'bid',
      volumeUsd: 10000000,
      intensity: 0.95,
      imbalancePct: 65,
      structureType: 'WALL',
      color: ''
    };

    const color = getHeatmapCellColor(bidWallCell);
    expect(typeof color).toBe('string');
    expect(color.startsWith('rgba') || color.startsWith('#')).toBe(true);

    const voidCell: HeatmapCell = {
      ...bidWallCell,
      volumeUsd: 5000,
      intensity: 0.02,
      structureType: 'VOID'
    };

    const voidColor = getHeatmapCellColor(voidCell);
    expect(typeof voidColor).toBe('string');
  });

  it('handles empty order book depth safely', () => {
    const emptyHeatmap = generateObiHeatmapMatrix([], [], 100, 8, 10);
    expect(emptyHeatmap).toBeDefined();
    expect(emptyHeatmap.timeSlices).toHaveLength(8);
    expect(emptyHeatmap.walls).toHaveLength(0);
    expect(emptyHeatmap.voids).toHaveLength(0);
  });
});
