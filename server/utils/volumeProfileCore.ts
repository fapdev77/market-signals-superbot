/**
 * Unified Volume Profile Engine (Phase 11 - SDD/TDD)
 *
 * Implements proportional volume distribution across the candle's price span (low to high),
 * replacing single-point midpoint approximation.
 * Ensures mathematical parity between backend signal evaluation and frontend HUD rendering.
 */

export interface VolumeBin {
  priceMin: number;
  priceMax: number;
  midPrice: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface UnifiedVolumeProfile {
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  valueAreaVolume: number;
  bins: VolumeBin[];
}

/**
 * Computes a unified, proportional Volume Profile.
 *
 * @param candles Candlestick series with high, low, volume and takerBuyVolume
 * @param binsCount Number of price bands (default: 24)
 * @param valueAreaPercent Target percentage of volume around POC (default: 0.70)
 */
export function computeUnifiedVolumeProfile(
  candles: Array<{ high: number; low: number; volume: number; takerBuyVolume?: number; close?: number }>,
  binsCount: number = 24,
  valueAreaPercent: number = 0.70
): UnifiedVolumeProfile {
  if (!candles || candles.length === 0) {
    return {
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      valueAreaVolume: 0,
      bins: []
    };
  }

  const validCandles = candles.filter(
    c => typeof c.low === 'number' && typeof c.high === 'number' && !isNaN(c.low) && !isNaN(c.high)
  );

  if (validCandles.length === 0) {
    return {
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      valueAreaVolume: 0,
      bins: []
    };
  }

  const minPrice = Math.min(...validCandles.map(c => c.low));
  let maxPrice = Math.max(...validCandles.map(c => c.high));

  if (maxPrice <= minPrice) {
    maxPrice = minPrice + 1;
  }

  const step = (maxPrice - minPrice) / binsCount;

  const bins: VolumeBin[] = Array.from({ length: binsCount }, (_, i) => {
    const pMin = minPrice + i * step;
    const pMax = pMin + step;
    return {
      priceMin: pMin,
      priceMax: pMax,
      midPrice: (pMin + pMax) / 2,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0
    };
  });

  let totalVolume = 0;
  let totalBuyVolume = 0;
  let totalSellVolume = 0;

  validCandles.forEach(c => {
    const cLow = c.low;
    const cHigh = Math.max(c.high, c.low + 0.000001);
    const vol = c.volume || 0;
    const buyVol = typeof c.takerBuyVolume === 'number' ? c.takerBuyVolume : vol * 0.5;
    const sellVol = Math.max(0, vol - buyVol);

    totalVolume += vol;
    totalBuyVolume += buyVol;
    totalSellVolume += sellVol;

    // Distribute proportionally across bins overlapping candle span
    const startBinIdx = Math.max(0, Math.min(binsCount - 1, Math.floor((cLow - minPrice) / step)));
    const endBinIdx = Math.max(0, Math.min(binsCount - 1, Math.floor((cHigh - minPrice) / step)));

    const span = Math.max(1, endBinIdx - startBinIdx + 1);
    const volPerBin = vol / span;
    const buyPerBin = buyVol / span;
    const sellPerBin = sellVol / span;

    for (let b = startBinIdx; b <= endBinIdx; b++) {
      bins[b].volume += volPerBin;
      bins[b].buyVolume += buyPerBin;
      bins[b].sellVolume += sellPerBin;
    }
  });

  if (totalVolume <= 0) {
    return {
      poc: (minPrice + maxPrice) / 2,
      vah: maxPrice,
      val: minPrice,
      totalVolume: 0,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      valueAreaVolume: 0,
      bins
    };
  }

  // POC = bin with highest volume
  let pocBin = bins[0];
  let pocIdx = 0;
  bins.forEach((b, idx) => {
    if (b.volume > pocBin.volume) {
      pocBin = b;
      pocIdx = idx;
    }
  });

  // Value Area: standard expansion outward from POC until accumulated volume >= 70%
  const targetVolume = totalVolume * valueAreaPercent;
  let accVolume = pocBin.volume;
  let lowerIdx = pocIdx;
  let upperIdx = pocIdx;

  while (accVolume < targetVolume && (upperIdx < binsCount - 1 || lowerIdx > 0)) {
    const nextUpperVol = upperIdx < binsCount - 1 ? bins[upperIdx + 1].volume : -1;
    const nextLowerVol = lowerIdx > 0 ? bins[lowerIdx - 1].volume : -1;

    if (nextUpperVol >= nextLowerVol && nextUpperVol !== -1) {
      upperIdx++;
      accVolume += bins[upperIdx].volume;
    } else if (nextLowerVol !== -1) {
      lowerIdx--;
      accVolume += bins[lowerIdx].volume;
    } else if (nextUpperVol !== -1) {
      upperIdx++;
      accVolume += bins[upperIdx].volume;
    } else {
      break;
    }
  }

  const val = bins[lowerIdx].priceMin;
  const vah = bins[upperIdx].priceMax;

  return {
    poc: pocBin.midPrice,
    vah,
    val,
    totalVolume,
    totalBuyVolume,
    totalSellVolume,
    valueAreaVolume: accVolume,
    bins
  };
}
