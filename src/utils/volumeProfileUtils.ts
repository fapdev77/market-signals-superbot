import { ChartDataItem } from '../components/OrderflowIndicators';

export interface VolumeProfileBin {
  price: number;
  priceLow: number;
  priceHigh: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  deltaUSD: number;
  totalUSD: number;
  isPOC: boolean;
  isInValueArea: boolean;
  isHVN: boolean; // High Volume Node
  isLVN: boolean; // Low Volume Node
  widthPercent: number;
  buyPercent: number;
  sellPercent: number;
}

export interface VolumeProfileResult {
  bins: VolumeProfileBin[];
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  totalUSD: number;
  totalBuyUSD: number;
  totalSellUSD: number;
  sessionDelta: number;
  sessionDeltaUSD: number;
  takerBuyRatio: number; // 0 to 1
  minPrice: number;
  maxPrice: number;
  priceStep: number;
  maxBinVolume: number;
  hvnLevels: number[];
  lvnLevels: number[];
  candleCount: number;
  pressureState: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  pressureScore: number; // -100 to +100
}

/**
 * Calculates a high-precision Volume Profile and Volume Delta for a given set of candles.
 * Distributes each candle's volume across price bins spanning from low to high.
 */
export function calculateVolumeProfile(
  candles: ChartDataItem[],
  binCount: number = 36,
  valueAreaPercent: number = 0.70
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;

  const validCandles = candles.filter(
    c => typeof c.low === 'number' && typeof c.high === 'number' && !isNaN(c.low) && !isNaN(c.high)
  );
  if (validCandles.length === 0) return null;

  const minPrice = Math.min(...validCandles.map(c => c.low));
  const maxPrice = Math.max(...validCandles.map(c => c.high));
  const priceRange = maxPrice - minPrice;

  if (priceRange <= 0) return null;

  const rowCount = Math.max(12, Math.min(100, binCount));
  const priceStep = priceRange / rowCount;

  // Initialize raw bins
  const rawBins: {
    buyVol: number;
    sellVol: number;
    totalVol: number;
    price: number;
    priceLow: number;
    priceHigh: number;
  }[] = [];

  for (let i = 0; i < rowCount; i++) {
    const pLow = minPrice + i * priceStep;
    const pHigh = pLow + priceStep;
    const pMid = (pLow + pHigh) / 2;
    rawBins.push({
      buyVol: 0,
      sellVol: 0,
      totalVol: 0,
      price: pMid,
      priceLow: pLow,
      priceHigh: pHigh
    });
  }

  let totalVolume = 0;
  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  let totalUSD = 0;
  let totalBuyUSD = 0;
  let totalSellUSD = 0;

  // Distribute volume into bins proportionally across each candle's range
  validCandles.forEach(c => {
    const cLow = c.low;
    const cHigh = Math.max(c.high, c.low + 0.000001);
    const cClose = c.close || c.price || cMid(cLow, cHigh);
    const cVol = (c.volume ?? 0) > 0 ? c.volume! : ((c.takerBuy ?? 0) + (c.takerSell ?? 0));
    const cBuy = c.takerBuy ?? (cVol * 0.5);
    const cSell = c.takerSell ?? Math.max(0, cVol - cBuy);

    totalVolume += cVol;
    totalBuyVolume += cBuy;
    totalSellVolume += cSell;
    totalUSD += c.quoteVolume || (cVol * cClose);
    totalBuyUSD += (c.takerBuyUSD || (cBuy * cClose));
    totalSellUSD += (c.takerSellUSD || (cSell * cClose));

    // Find overlapping bins
    const startBinIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((cLow - minPrice) / priceStep)));
    const endBinIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((cHigh - minPrice) / priceStep)));

    const span = Math.max(1, endBinIdx - startBinIdx + 1);
    const volPerBin = cVol / span;
    const buyPerBin = cBuy / span;
    const sellPerBin = cSell / span;

    for (let b = startBinIdx; b <= endBinIdx; b++) {
      rawBins[b].totalVol += volPerBin;
      rawBins[b].buyVol += buyPerBin;
      rawBins[b].sellVol += sellPerBin;
    }
  });

  if (totalVolume <= 0) return null;

  // Find POC (Point of Control)
  let maxBinVol = 0;
  let maxBinIdx = 0;
  rawBins.forEach((b, idx) => {
    if (b.totalVol > maxBinVol) {
      maxBinVol = b.totalVol;
      maxBinIdx = idx;
    }
  });

  const poc = rawBins[maxBinIdx].price;

  // Calculate Value Area (70% standard) expanding from POC
  const targetVA = totalVolume * valueAreaPercent;
  let accumulatedVA = maxBinVol;
  let upIdx = maxBinIdx;
  let downIdx = maxBinIdx;

  while (accumulatedVA < targetVA && (upIdx < rowCount - 1 || downIdx > 0)) {
    const nextUpVol = upIdx < rowCount - 1 ? rawBins[upIdx + 1].totalVol : -1;
    const nextDownVol = downIdx > 0 ? rawBins[downIdx - 1].totalVol : -1;

    if (nextUpVol >= nextDownVol && nextUpVol !== -1) {
      upIdx++;
      accumulatedVA += rawBins[upIdx].totalVol;
    } else if (nextDownVol !== -1) {
      downIdx--;
      accumulatedVA += rawBins[downIdx].totalVol;
    } else if (nextUpVol !== -1) {
      upIdx++;
      accumulatedVA += rawBins[upIdx].totalVol;
    } else {
      break;
    }
  }

  const vah = rawBins[upIdx].priceHigh;
  const val = rawBins[downIdx].priceLow;

  // Calculate High Volume Nodes (HVN) & Low Volume Nodes (LVN)
  const avgBinVol = totalVolume / rowCount;
  const hvnThreshold = avgBinVol * 1.35;
  const lvnThreshold = avgBinVol * 0.45;

  const hvnLevels: number[] = [];
  const lvnLevels: number[] = [];

  const bins: VolumeProfileBin[] = rawBins.map((b, idx) => {
    const isPOC = idx === maxBinIdx;
    const isInValueArea = idx >= downIdx && idx <= upIdx;
    const widthPercent = maxBinVol > 0 ? (b.totalVol / maxBinVol) * 100 : 0;
    const buyPercent = b.totalVol > 0 ? (b.buyVol / b.totalVol) * 100 : 50;
    const sellPercent = b.totalVol > 0 ? (b.sellVol / b.totalVol) * 100 : 50;
    const delta = b.buyVol - b.sellVol;
    const deltaUSD = delta * b.price;
    const binTotalUSD = b.totalVol * b.price;

    const isHVN = !isPOC && b.totalVol >= hvnThreshold;
    const isLVN = b.totalVol <= lvnThreshold && b.totalVol > 0;

    if (isHVN) hvnLevels.push(b.price);
    if (isLVN) lvnLevels.push(b.price);

    return {
      price: b.price,
      priceLow: b.priceLow,
      priceHigh: b.priceHigh,
      totalVolume: b.totalVol,
      buyVolume: b.buyVol,
      sellVolume: b.sellVol,
      delta,
      deltaUSD,
      totalUSD: binTotalUSD,
      isPOC,
      isInValueArea,
      isHVN,
      isLVN,
      widthPercent,
      buyPercent,
      sellPercent
    };
  });

  const sessionDelta = totalBuyVolume - totalSellVolume;
  const sessionDeltaUSD = totalBuyUSD - totalSellUSD;
  const takerBuyRatio = totalVolume > 0 ? totalBuyVolume / totalVolume : 0.5;

  // Pressure score: -100 to +100
  const pressureScore = Math.max(-100, Math.min(100, (takerBuyRatio - 0.5) * 200));

  let pressureState: VolumeProfileResult['pressureState'] = 'NEUTRAL';
  if (pressureScore >= 35) pressureState = 'STRONG_BUY';
  else if (pressureScore >= 12) pressureState = 'BUY';
  else if (pressureScore <= -35) pressureState = 'STRONG_SELL';
  else if (pressureScore <= -12) pressureState = 'SELL';
  else pressureState = 'NEUTRAL';

  return {
    bins,
    poc,
    vah,
    val,
    totalVolume,
    totalBuyVolume,
    totalSellVolume,
    totalUSD,
    totalBuyUSD,
    totalSellUSD,
    sessionDelta,
    sessionDeltaUSD,
    takerBuyRatio,
    minPrice,
    maxPrice,
    priceStep,
    maxBinVolume: maxBinVol,
    hvnLevels,
    lvnLevels,
    candleCount: validCandles.length,
    pressureState,
    pressureScore
  };
}

function cMid(a: number, b: number): number {
  return (a + b) / 2;
}
