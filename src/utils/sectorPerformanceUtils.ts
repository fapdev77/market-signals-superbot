import { TickerData } from '../types';

export type SectorCategoryKey = 
  | 'L1_L2' 
  | 'DEFI' 
  | 'AI' 
  | 'MEME' 
  | 'GAMING' 
  | 'DEPIN' 
  | 'RWA' 
  | 'TRADFI' 
  | 'STABLECOIN';

export interface SectorDefinition {
  id: SectorCategoryKey;
  name: string;
  shortName: string;
  tagline: string;
  color: string;
  iconName: string;
  benchmarkBeta: number;
}

export const SECTOR_DEFINITIONS: Record<SectorCategoryKey, SectorDefinition> = {
  L1_L2: {
    id: 'L1_L2',
    name: 'Layer 1 & Layer 2',
    shortName: 'L1 / L2',
    tagline: 'Infraestrutura blockchain, smart contracts e rollups escaláveis',
    color: '#3b82f6', // blue
    iconName: 'Layers',
    benchmarkBeta: 1.15
  },
  DEFI: {
    id: 'DEFI',
    name: 'DeFi & Liquidity',
    shortName: 'DeFi',
    tagline: 'DEXs, protocolos de empréstimo, oráculos e yield aggregators',
    color: '#10b981', // emerald
    iconName: 'Zap',
    benchmarkBeta: 1.30
  },
  AI: {
    id: 'AI',
    name: 'Inteligência Artificial & Compute',
    shortName: 'IA / Big Data',
    tagline: 'Redes neurais descentralizadas, agentes autônomos e GPU compute',
    color: '#8b5cf6', // purple
    iconName: 'Cpu',
    benchmarkBeta: 1.65
  },
  MEME: {
    id: 'MEME',
    name: 'Meme & High Beta',
    shortName: 'Memes',
    tagline: 'Ativos de alta volatilidade e forte tração comunitária',
    color: '#f43f5e', // rose
    iconName: 'Flame',
    benchmarkBeta: 2.10
  },
  GAMING: {
    id: 'GAMING',
    name: 'Gaming & Metaverse',
    shortName: 'GameFi / NFT',
    tagline: 'Economias digitais em jogos, metaversos e itens on-chain',
    color: '#ec4899', // pink
    iconName: 'Gamepad2',
    benchmarkBeta: 1.55
  },
  DEPIN: {
    id: 'DEPIN',
    name: 'DePIN & Storage',
    shortName: 'DePIN',
    tagline: 'Redes de infraestrutura física descentralizada e armazenamento',
    color: '#06b6d4', // cyan
    iconName: 'HardDrive',
    benchmarkBeta: 1.40
  },
  RWA: {
    id: 'RWA',
    name: 'Real World Assets (RWA)',
    shortName: 'RWA',
    tagline: 'Tokenização de títulos do tesouro, crédito e ativos reais',
    color: '#f59e0b', // amber
    iconName: 'Building2',
    benchmarkBeta: 1.10
  },
  TRADFI: {
    id: 'TRADFI',
    name: 'TradFi, Ouro & Macro',
    shortName: 'TradFi / Macro',
    tagline: 'Commodities, ouro tokenizado, índices e forex',
    color: '#eab308', // yellow
    iconName: 'Landmark',
    benchmarkBeta: 0.20
  },
  STABLECOIN: {
    id: 'STABLECOIN',
    name: 'Stablecoins & Pegs',
    shortName: 'Stablecoins',
    tagline: 'Moedas estáveis e derivativos lastreados em dólar/euro',
    color: '#14b8a6', // teal
    iconName: 'Coins',
    benchmarkBeta: 0.02
  }
};

// Mapeamento detalhado de símbolos para setores
export const ASSET_TO_SECTOR_MAP: Record<string, { sector: SectorCategoryKey; name: string; tag: string }> = {
  // L1 / L2
  BTCUSDT: { sector: 'L1_L2', name: 'Bitcoin', tag: 'Store of Value / L1' },
  ETHUSDT: { sector: 'L1_L2', name: 'Ethereum', tag: 'Smart Contracts L1' },
  SOLUSDT: { sector: 'L1_L2', name: 'Solana', tag: 'High-Performance L1' },
  BNBUSDT: { sector: 'L1_L2', name: 'BNB Chain', tag: 'Exchange Ecosystem' },
  XRPUSDT: { sector: 'L1_L2', name: 'Ripple', tag: 'Payment Settlement' },
  ADAUSDT: { sector: 'L1_L2', name: 'Cardano', tag: 'PoS Smart Contracts' },
  AVAXUSDT: { sector: 'L1_L2', name: 'Avalanche', tag: 'Subnet Architecture' },
  SUIUSDT: { sector: 'L1_L2', name: 'Sui Network', tag: 'Move VM L1' },
  APTUSDT: { sector: 'L1_L2', name: 'Aptos', tag: 'Move VM L1' },
  ARBUSDT: { sector: 'L1_L2', name: 'Arbitrum', tag: 'Optimistic Rollup L2' },
  OPUSDT: { sector: 'L1_L2', name: 'Optimism', tag: 'OP Stack L2' },
  SEIUSDT: { sector: 'L1_L2', name: 'Sei Network', tag: 'Trading Optimized L1' },
  TIAUSDT: { sector: 'L1_L2', name: 'Celestia', tag: 'Modular DA' },
  DOTUSDT: { sector: 'L1_L2', name: 'Polkadot', tag: 'Interoperability' },
  FTMUSDT: { sector: 'L1_L2', name: 'Fantom / Sonic', tag: 'Fast DAG L1' },
  MATICUSDT: { sector: 'L1_L2', name: 'Polygon', tag: 'Polygon PoS / ZK' },
  POLUSDT: { sector: 'L1_L2', name: 'Polygon Ecosystem', tag: 'Polygon 2.0 L2' },
  NEARUSDT: { sector: 'L1_L2', name: 'NEAR Protocol', tag: 'Sharded L1 & AI' },
  TONUSDT: { sector: 'L1_L2', name: 'Telegram Open Network', tag: 'Mass Adoption L1' },
  LTCUSDT: { sector: 'L1_L2', name: 'Litecoin', tag: 'Payments PoW' },
  BCHUSDT: { sector: 'L1_L2', name: 'Bitcoin Cash', tag: 'P2P Electronic Cash' },
  ATOMUSDT: { sector: 'L1_L2', name: 'Cosmos Hub', tag: 'IBC Interchain' },
  HBARUSDT: { sector: 'L1_L2', name: 'Hedera Hashgraph', tag: 'Enterprise DLT' },
  KASUSDT: { sector: 'L1_L2', name: 'Kaspa', tag: 'GHOSTDAG PoW' },

  // DEFI
  LINKUSDT: { sector: 'DEFI', name: 'Chainlink', tag: 'Oracle & CCIP' },
  UNIUSDT: { sector: 'DEFI', name: 'Uniswap', tag: 'AMM DEX Leader' },
  AAVEUSDT: { sector: 'DEFI', name: 'Aave', tag: 'Lending Market' },
  MKRUSDT: { sector: 'DEFI', name: 'Maker / Sky', tag: 'CDP & Stablecoin' },
  PENDLEUSDT: { sector: 'DEFI', name: 'Pendle', tag: 'Yield Tokenization' },
  INJUSDT: { sector: 'DEFI', name: 'Injective', tag: 'Derivatives DeFi' },
  CRVUSDT: { sector: 'DEFI', name: 'Curve Finance', tag: 'StableSwap AMM' },
  SNXUSDT: { sector: 'DEFI', name: 'Synthetix', tag: 'Synthetic Assets' },
  LDOUSDT: { sector: 'DEFI', name: 'Lido DAO', tag: 'Liquid Staking' },
  JUPUSDT: { sector: 'DEFI', name: 'Jupiter', tag: 'Solana DEX Aggregator' },
  COMPUSDT: { sector: 'DEFI', name: 'Compound', tag: 'Money Market' },
  DYDXUSDT: { sector: 'DEFI', name: 'dYdX', tag: 'Perpetuals DEX' },
  RUNEUSDT: { sector: 'DEFI', name: 'THORChain', tag: 'Cross-chain Liquidity' },
  ENAUSDT: { sector: 'DEFI', name: 'Ethena', tag: 'Synthetic Dollar Protocol' },
  RAYUSDT: { sector: 'DEFI', name: 'Raydium', tag: 'Solana AMM' },
  CAKEUSDT: { sector: 'DEFI', name: 'PancakeSwap', tag: 'Multi-chain DEX' },
  '1INCHUSDT': { sector: 'DEFI', name: '1inch Network', tag: 'DEX Aggregator' },

  // AI & COMPUTE
  RENDERUSDT: { sector: 'AI', name: 'Render Network', tag: 'Decentralized GPU' },
  FETUSDT: { sector: 'AI', name: 'Artificial Superintelligence', tag: 'Autonomous AI Agents' },
  TAOUSDT: { sector: 'AI', name: 'Bittensor', tag: 'Decentralized ML' },
  GRTUSDT: { sector: 'AI', name: 'The Graph', tag: 'Indexing & AI Queries' },
  WLDUSDT: { sector: 'AI', name: 'Worldcoin', tag: 'Proof of Personhood' },
  AKTUSDT: { sector: 'AI', name: 'Akash Network', tag: 'Decentralized Cloud' },
  JASMYUSDT: { sector: 'AI', name: 'JasmyCoin', tag: 'IoT & Data Democracy' },
  VIRTUALUSDT: { sector: 'AI', name: 'Virtuals Protocol', tag: 'AI Agent Co-Ownership' },
  AIUSDT: { sector: 'AI', name: 'Sleepless AI', tag: 'AI Gaming & Companions' },

  // MEMES
  DOGEUSDT: { sector: 'MEME', name: 'Dogecoin', tag: 'OG Meme King' },
  SHIBUSDT: { sector: 'MEME', name: 'Shiba Inu', tag: 'Ecosystem Meme' },
  PEPEUSDT: { sector: 'MEME', name: 'Pepe', tag: 'Cult Cultural Meme' },
  WIFUSDT: { sector: 'MEME', name: 'Dogwifhat', tag: 'Solana Hat Meme' },
  BONKUSDT: { sector: 'MEME', name: 'Bonk', tag: 'Solana Community Meme' },
  FLOKIUSDT: { sector: 'MEME', name: 'Floki', tag: 'Viking Meme & Metaverse' },
  POPCATUSDT: { sector: 'MEME', name: 'Popcat', tag: 'Solana Cat Meme' },
  BOMEUSDT: { sector: 'MEME', name: 'Book of Meme', tag: 'Meme Archive' },
  MEMEUSDT: { sector: 'MEME', name: 'Memecoin', tag: 'Memeland Studio' },
  NEIROUSDT: { sector: 'MEME', name: 'First Neiro', tag: 'Ethereum Dog Meme' },
  TURBOUSDT: { sector: 'MEME', name: 'Turbo', tag: 'AI-Generated Meme' },

  // GAMING & METAVERSE
  IMXUSDT: { sector: 'GAMING', name: 'Immutable X', tag: 'Web3 Gaming ZK Rollup' },
  GALAUSDT: { sector: 'GAMING', name: 'Gala Games', tag: 'Gaming Ecosystem' },
  SANDUSDT: { sector: 'GAMING', name: 'The Sandbox', tag: 'Virtual World' },
  MANAUSDT: { sector: 'GAMING', name: 'Decentraland', tag: '3D Metaverse' },
  AXSUSDT: { sector: 'GAMING', name: 'Axie Infinity', tag: 'Play-and-Earn Gaming' },
  BEAMUSDT: { sector: 'GAMING', name: 'Beam / Merit Circle', tag: 'Gaming DAO' },
  PIXELUSDT: { sector: 'GAMING', name: 'Pixels', tag: 'Social Web3 Game' },

  // DEPIN & STORAGE
  FILUSDT: { sector: 'DEPIN', name: 'Filecoin', tag: 'Decentralized Storage' },
  ARUSDT: { sector: 'DEPIN', name: 'Arweave', tag: 'Permanent Storage' },
  HNTUSDT: { sector: 'DEPIN', name: 'Helium', tag: 'Decentralized Wireless' },
  IOTXUSDT: { sector: 'DEPIN', name: 'IoTeX', tag: 'DePIN Machine Network' },
  THETAUSDT: { sector: 'DEPIN', name: 'Theta Network', tag: 'Video & AI Edge' },

  // RWA
  ONDOUSDT: { sector: 'RWA', name: 'Ondo Finance', tag: 'US Treasuries & Yield' },
  TRUUSDT: { sector: 'RWA', name: 'TrueFi', tag: 'Uncollateralized Lending' },
  CFGUSDT: { sector: 'RWA', name: 'Centrifuge', tag: 'Real World Credit' },

  // TRADFI & COMMODITIES
  XAUUSDT: { sector: 'TRADFI', name: 'Gold / Ouro', tag: 'Precious Metal' },
  PAXGUSDT: { sector: 'TRADFI', name: 'Pax Gold', tag: 'Tokenized Physical Gold' },
  EURUSDT: { sector: 'TRADFI', name: 'Euro / USD', tag: 'Foreign Exchange' },

  // STABLECOINS
  USDCUSDT: { sector: 'STABLECOIN', name: 'USD Coin', tag: 'Regulated Stablecoin' },
  USDTUSDC: { sector: 'STABLECOIN', name: 'USDT / USDC', tag: 'Stablecoin Pair' },
  USDGUSDT: { sector: 'STABLECOIN', name: 'Global Dollar', tag: 'Yield-bearing Stable' },
  FDUSDUSDT: { sector: 'STABLECOIN', name: 'First Digital USD', tag: 'Binance Pegged' },
  PYUSDUSDT: { sector: 'STABLECOIN', name: 'PayPal USD', tag: 'Fintech Stablecoin' },
  USDEUSDT: { sector: 'STABLECOIN', name: 'Ethena USDe', tag: 'Delta-Neutral Synthetic' },
  DAIUSDT: { sector: 'STABLECOIN', name: 'Maker DAI', tag: 'Decentralized CDP' }
};

/**
 * Classifica um ativo para um setor conhecido com fallback heurístico inteligente
 */
export function classifyAssetSector(ticker: TickerData): {
  sectorKey: SectorCategoryKey;
  definition: SectorDefinition;
  assetName: string;
  categoryTag: string;
} {
  const sym = (ticker.symbol || '').toUpperCase();
  
  if (ASSET_TO_SECTOR_MAP[sym]) {
    const map = ASSET_TO_SECTOR_MAP[sym];
    return {
      sectorKey: map.sector,
      definition: SECTOR_DEFINITIONS[map.sector],
      assetName: map.name,
      categoryTag: map.tag
    };
  }

  // Heurísticas por nome de baseAsset / símbolo
  const base = (ticker.baseAsset || sym.replace(/USDT|BUSD|USDC/g, '')).toUpperCase();

  if (['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'POPCAT', 'BOME', 'MEME', 'TURBO', 'NEIRO', 'DOGS', 'CAT'].some(m => base.includes(m))) {
    return {
      sectorKey: 'MEME',
      definition: SECTOR_DEFINITIONS.MEME,
      assetName: ticker.name || base,
      categoryTag: 'Meme Token'
    };
  }

  if (['AI', 'GPT', 'RENDER', 'FET', 'TAO', 'GRT', 'AGIX', 'OCEAN', 'WLD', 'AKT', 'VIRTUAL', 'IO', 'JASMY', 'PHB'].some(m => base.includes(m))) {
    return {
      sectorKey: 'AI',
      definition: SECTOR_DEFINITIONS.AI,
      assetName: ticker.name || base,
      categoryTag: 'AI & Data Compute'
    };
  }

  if (['UNI', 'AAVE', 'LINK', 'MKR', 'PENDLE', 'INJ', 'CRV', 'SNX', 'LDO', 'JUP', 'COMP', 'DYDX', 'RUNE', 'ENA', 'RAY', 'SWAP', 'DEFI'].some(m => base.includes(m))) {
    return {
      sectorKey: 'DEFI',
      definition: SECTOR_DEFINITIONS.DEFI,
      assetName: ticker.name || base,
      categoryTag: 'DeFi Protocol'
    };
  }

  if (['GALA', 'SAND', 'MANA', 'AXS', 'IMX', 'BEAM', 'PIXEL', 'GAME', 'NFT'].some(m => base.includes(m))) {
    return {
      sectorKey: 'GAMING',
      definition: SECTOR_DEFINITIONS.GAMING,
      assetName: ticker.name || base,
      categoryTag: 'Gaming & Metaverse'
    };
  }

  if (['FIL', 'AR', 'HNT', 'IOTX', 'THETA', 'STORAGE', 'DEPIN'].some(m => base.includes(m))) {
    return {
      sectorKey: 'DEPIN',
      definition: SECTOR_DEFINITIONS.DEPIN,
      assetName: ticker.name || base,
      categoryTag: 'DePIN & Storage'
    };
  }

  if (['ONDO', 'RWA', 'TRUE', 'REAL'].some(m => base.includes(m))) {
    return {
      sectorKey: 'RWA',
      definition: SECTOR_DEFINITIONS.RWA,
      assetName: ticker.name || base,
      categoryTag: 'Real World Assets'
    };
  }

  if (['XAU', 'GOLD', 'PAXG', 'SPX', 'NDX', 'DJI', 'OIL', 'WTI', 'EUR', 'USD'].some(m => base.includes(m))) {
    return {
      sectorKey: 'TRADFI',
      definition: SECTOR_DEFINITIONS.TRADFI,
      assetName: ticker.name || base,
      categoryTag: 'TradFi & Macro'
    };
  }

  if (['USDT', 'USDC', 'USDG', 'FDUSD', 'PYUSD', 'USDE', 'DAI', 'TUSD', 'BUSD', 'USDP'].some(m => base === m)) {
    return {
      sectorKey: 'STABLECOIN',
      definition: SECTOR_DEFINITIONS.STABLECOIN,
      assetName: ticker.name || base,
      categoryTag: 'Stablecoin'
    };
  }

  return {
    sectorKey: 'L1_L2',
    definition: SECTOR_DEFINITIONS.L1_L2,
    assetName: ticker.name || base,
    categoryTag: 'Layer 1 / Layer 2'
  };
}

export type CapitalRotationPhase = 
  | 'LEADER'            // Outperforming market with strong volume expansion (Alpha > +2%)
  | 'ROTATION_INFLOW'   // Capital accelerating into sector, rising momentum (Alpha > 0%)
  | 'CONSOLIDATION'     // Moving in tandem with broader market (Alpha ~ 0%)
  | 'ROTATION_OUTFLOW'  // Underperforming market, capital rotating away (Alpha < -2%)
  | 'STABLE_ANCHOR';    // Pegged assets / low volatility baseline

export interface SectorAggregatedMetrics {
  definition: SectorDefinition;
  sectorKey: SectorCategoryKey;
  tickersCount: number;
  tickers: TickerData[];
  
  // Return metrics
  equalWeightedReturn24h: number;     // Arithmetic average of 24h %
  volumeWeightedReturn24h: number;    // Turnover weighted return
  alphaVsBtc: number;                 // Sector Return - BTC Return
  alphaVsMarket: number;              // Sector Return - Market Equal Weight Return
  
  // Capital & Volume metrics
  totalVolume24hUsd: number;
  marketVolumeSharePct: number;       // % of all tickers turnover
  totalOpenInterestUsd: number;
  openInterestChange24h: number;      // Weighted OI Change %
  netCvdVolumeUsd: number;            // Net Taker Buy - Sell in USD
  cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  averageFundingRateDaily: number;
  
  // Breadth metrics
  advancersCount: number;             // Coins with 24h change > 0
  declinersCount: number;             // Coins with 24h change < 0
  advanceDeclineRatio: number;        // Advancers / Total (%)
  
  // Leaders & Laggards
  topGainer: { ticker: TickerData; change24h: number; name: string } | null;
  worstLaggard: { ticker: TickerData; change24h: number; name: string } | null;
  
  // Rotation diagnostic
  rotationPhase: CapitalRotationPhase;
  rotationVerdict: string;
  momentumScore: number;              // 0 to 100 ranking score
}

export interface SectorScreenerSummary {
  totalAssetsAnalyzed: number;
  totalMarketTurnoverUsd: number;
  totalMarketOpenInterestUsd: number;
  btcBenchmarkReturn24h: number;
  marketEqualWeightReturn24h: number;
  leadingSector: SectorAggregatedMetrics | null;
  weakestSector: SectorAggregatedMetrics | null;
  topCapitalInflowSector: SectorAggregatedMetrics | null;
  sectors: SectorAggregatedMetrics[];
}

/**
 * Calcula todas as métricas agregadas dos setores e identifica padrões de rotação de capital
 */
export function computeSectorPerformanceSummary(tickers: TickerData[]): SectorScreenerSummary {
  if (!tickers || tickers.length === 0) {
    return {
      totalAssetsAnalyzed: 0,
      totalMarketTurnoverUsd: 0,
      totalMarketOpenInterestUsd: 0,
      btcBenchmarkReturn24h: 0,
      marketEqualWeightReturn24h: 0,
      leadingSector: null,
      weakestSector: null,
      topCapitalInflowSector: null,
      sectors: []
    };
  }

  // 1. Achar Benchmark do BTC e Média Global do Mercado
  const btcTicker = tickers.find(t => t.symbol === 'BTCUSDT') || tickers[0];
  const btcReturn = btcTicker ? btcTicker.priceChangePercent24h : 0;

  const validTickersForMarketAvg = tickers.filter(t => {
    const sym = t.symbol.toUpperCase();
    return !['USDTUSDC', 'USDCUSDT', 'USDGUSDT', 'FDUSDUSDT', 'PYUSDUSDT', 'DAIUSDT'].includes(sym);
  });

  const marketEqualWeightReturn = validTickersForMarketAvg.length > 0
    ? validTickersForMarketAvg.reduce((acc, t) => acc + t.priceChangePercent24h, 0) / validTickersForMarketAvg.length
    : 0;

  const totalMarketTurnoverUsd = tickers.reduce((acc, t) => acc + (t.quoteVolume24h || t.volume24h * t.price || 0), 0);
  const totalMarketOpenInterestUsd = tickers.reduce((acc, t) => acc + (t.openInterest || 0), 0);

  // 2. Agrupar tickers por setor
  const sectorGroups: Record<SectorCategoryKey, TickerData[]> = {
    L1_L2: [],
    DEFI: [],
    AI: [],
    MEME: [],
    GAMING: [],
    DEPIN: [],
    RWA: [],
    TRADFI: [],
    STABLECOIN: []
  };

  tickers.forEach(t => {
    const { sectorKey } = classifyAssetSector(t);
    if (sectorGroups[sectorKey]) {
      sectorGroups[sectorKey].push(t);
    } else {
      sectorGroups.L1_L2.push(t);
    }
  });

  // 3. Processar métricas agregadas para cada setor
  const aggregatedSectors: SectorAggregatedMetrics[] = Object.keys(sectorGroups).map(key => {
    const sectorKey = key as SectorCategoryKey;
    const def = SECTOR_DEFINITIONS[sectorKey];
    const group = sectorGroups[sectorKey];

    if (group.length === 0) {
      return {
        definition: def,
        sectorKey,
        tickersCount: 0,
        tickers: [],
        equalWeightedReturn24h: 0,
        volumeWeightedReturn24h: 0,
        alphaVsBtc: 0,
        alphaVsMarket: 0,
        totalVolume24hUsd: 0,
        marketVolumeSharePct: 0,
        totalOpenInterestUsd: 0,
        openInterestChange24h: 0,
        netCvdVolumeUsd: 0,
        cvdDirection: 'NEUTRAL',
        averageFundingRateDaily: 0,
        advancersCount: 0,
        declinersCount: 0,
        advanceDeclineRatio: 0,
        topGainer: null,
        worstLaggard: null,
        rotationPhase: 'CONSOLIDATION',
        rotationVerdict: 'Sem ativos mapeados',
        momentumScore: 50
      };
    }

    const tickersCount = group.length;
    const totalSectorVolume = group.reduce((acc, t) => acc + (t.quoteVolume24h || t.volume24h * t.price || 0), 0);
    const totalSectorOI = group.reduce((acc, t) => acc + (t.openInterest || 0), 0);

    const equalWeightedReturn = group.reduce((acc, t) => acc + t.priceChangePercent24h, 0) / tickersCount;

    const volumeWeightedReturn = totalSectorVolume > 0
      ? group.reduce((acc, t) => acc + t.priceChangePercent24h * ((t.quoteVolume24h || t.volume24h * t.price || 0) / totalSectorVolume), 0)
      : equalWeightedReturn;

    const alphaVsBtc = equalWeightedReturn - btcReturn;
    const alphaVsMarket = equalWeightedReturn - marketEqualWeightReturn;
    const marketVolumeSharePct = totalMarketTurnoverUsd > 0 ? (totalSectorVolume / totalMarketTurnoverUsd) * 100 : 0;

    // OI Change ponderado
    const weightedOIChange = totalSectorOI > 0
      ? group.reduce((acc, t) => acc + (t.openInterestChange24h || 0) * ((t.openInterest || 0) / totalSectorOI), 0)
      : 0;

    // CVD e Agressão
    const netCvdVolumeUsd = group.reduce((acc, t) => acc + (t.cvdDelta || t.cvd || 0), 0);
    const cvdDirection = netCvdVolumeUsd > 1000000 ? 'BUY' : (netCvdVolumeUsd < -1000000 ? 'SELL' : 'NEUTRAL');

    // Funding Rate diário médio
    const avgFundingDaily = group.reduce((acc, t) => acc + (t.fundingRateDaily || (t.fundingRate || 0) * 3), 0) / tickersCount;

    // Breadth (Altas vs Baixas)
    const advancers = group.filter(t => t.priceChangePercent24h > 0.05).length;
    const decliners = group.filter(t => t.priceChangePercent24h < -0.05).length;
    const advanceDeclineRatio = (advancers / tickersCount) * 100;

    // Leaders & Laggards
    const sortedByReturn = [...group].sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);
    const top = sortedByReturn[0];
    const bottom = sortedByReturn[sortedByReturn.length - 1];

    const topGainer = top ? {
      ticker: top,
      change24h: top.priceChangePercent24h,
      name: classifyAssetSector(top).assetName
    } : null;

    const worstLaggard = bottom ? {
      ticker: bottom,
      change24h: bottom.priceChangePercent24h,
      name: classifyAssetSector(bottom).assetName
    } : null;

    // Diagnóstico de Rotação de Capital
    let rotationPhase: CapitalRotationPhase = 'CONSOLIDATION';
    let rotationVerdict = 'Acompanhando o fluxo macro sem rotação expressiva.';

    if (sectorKey === 'STABLECOIN') {
      rotationPhase = 'STABLE_ANCHOR';
      rotationVerdict = 'Ativos de liquidez e ancoragem.';
    } else if (alphaVsBtc >= 3.0 && advanceDeclineRatio >= 65) {
      rotationPhase = 'LEADER';
      rotationVerdict = '🚀 Setor Líder: Forte atração de capital institucional e liderança sobre o Bitcoin.';
    } else if (alphaVsBtc > 0.8 && netCvdVolumeUsd > 0) {
      rotationPhase = 'ROTATION_INFLOW';
      rotationVerdict = '⚡ Entrada de Capital: Aceleração compradora com fluxo positivo superando o mercado.';
    } else if (alphaVsBtc <= -2.5 && advanceDeclineRatio <= 35) {
      rotationPhase = 'ROTATION_OUTFLOW';
      rotationVerdict = '🔻 Saída de Capital: Desempenho inferior ao mercado com pressão vendedora líquida.';
    }

    // Momentum Score (0 a 100)
    let momentum = 50 + (alphaVsBtc * 5) + (advanceDeclineRatio - 50) * 0.3 + (marketVolumeSharePct > 15 ? 10 : 0);
    momentum = Math.max(5, Math.min(98, Math.round(momentum)));

    return {
      definition: def,
      sectorKey,
      tickersCount,
      tickers: group,
      equalWeightedReturn24h: equalWeightedReturn,
      volumeWeightedReturn24h: volumeWeightedReturn,
      alphaVsBtc,
      alphaVsMarket,
      totalVolume24hUsd: totalSectorVolume,
      marketVolumeSharePct,
      totalOpenInterestUsd: totalSectorOI,
      openInterestChange24h: weightedOIChange,
      netCvdVolumeUsd,
      cvdDirection,
      averageFundingRateDaily: avgFundingDaily,
      advancersCount: advancers,
      declinersCount: decliners,
      advanceDeclineRatio,
      topGainer,
      worstLaggard,
      rotationPhase,
      rotationVerdict,
      momentumScore: momentum
    };
  });

  // Ordenar setores por performance 24h
  const activeSectorsWithTickers = aggregatedSectors.filter(s => s.tickersCount > 0);
  const sortedByPerf = [...activeSectorsWithTickers].sort((a, b) => b.equalWeightedReturn24h - a.equalWeightedReturn24h);

  const leadingSector = sortedByPerf.length > 0 ? sortedByPerf[0] : null;
  const weakestSector = sortedByPerf.length > 0 ? sortedByPerf[sortedByPerf.length - 1] : null;
  
  const topCapitalInflowSector = [...activeSectorsWithTickers].sort((a, b) => b.alphaVsBtc - a.alphaVsBtc)[0] || null;

  return {
    totalAssetsAnalyzed: tickers.length,
    totalMarketTurnoverUsd,
    totalMarketOpenInterestUsd,
    btcBenchmarkReturn24h: btcReturn,
    marketEqualWeightReturn24h: marketEqualWeightReturn,
    leadingSector,
    weakestSector,
    topCapitalInflowSector,
    sectors: aggregatedSectors
  };
}
