import { StrategyKey, StrategyConfigItem, IndicatorWeights, StrategyCategory } from '../types';

export const ALL_STRATEGY_KEYS: StrategyKey[] = ['scalp', 'daytrade', 'intraday', 'swing', 'position', 'counter'];

export const STRATEGY_PRESETS: Record<Exclude<StrategyKey, 'custom'>, StrategyConfigItem> = {
  scalp: {
    key: 'scalp',
    label: 'Scalp & Micro',
    enabled: true,
    category: 'SCALP',
    timeframe: '5m',
    candles: 36,
    minRiskRewardRatio: 1.5,
    volumeSurgeWeight: 30,
    openInterestWeight: 15,
    fundingRateWeight: 5,
    cvdImbalanceWeight: 25,
    fibonacciZoneWeight: 5,
    rangePocWeight: 15,
    supportResistanceWeight: 5,
    volumeProfileRange: 30,
    trappedTradersWeight: 10,
    rsiDivergenceWeight: 10
  },
  daytrade: {
    key: 'daytrade',
    label: 'Day Trade (POIs)',
    enabled: true,
    category: 'DAY_TRADE',
    timeframe: '15m',
    candles: 48,
    minRiskRewardRatio: 2.0,
    volumeSurgeWeight: 20,
    openInterestWeight: 15,
    fundingRateWeight: 5,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 10,
    rangePocWeight: 20,
    supportResistanceWeight: 10,
    volumeProfileRange: 40,
    trappedTradersWeight: 15,
    rsiDivergenceWeight: 20
  },
  intraday: {
    key: 'intraday',
    label: 'Intraday Flex',
    enabled: true,
    category: 'INTRADAY',
    timeframe: '30m',
    candles: 48,
    minRiskRewardRatio: 2.5,
    volumeSurgeWeight: 15,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 15,
    fibonacciZoneWeight: 15,
    rangePocWeight: 15,
    supportResistanceWeight: 10,
    volumeProfileRange: 50,
    trappedTradersWeight: 20,
    rsiDivergenceWeight: 20
  },
  swing: {
    key: 'swing',
    label: 'Swing Trade',
    enabled: true,
    category: 'SWING',
    timeframe: '1h',
    candles: 72,
    minRiskRewardRatio: 3.5,
    volumeSurgeWeight: 10,
    openInterestWeight: 25,
    fundingRateWeight: 15,
    cvdImbalanceWeight: 10,
    fibonacciZoneWeight: 20,
    rangePocWeight: 10,
    supportResistanceWeight: 10,
    volumeProfileRange: 70,
    trappedTradersWeight: 20,
    rsiDivergenceWeight: 25
  },
  position: {
    key: 'position',
    label: 'Position Macro',
    enabled: true,
    category: 'POSITION',
    timeframe: '4h',
    candles: 90,
    minRiskRewardRatio: 5.0,
    volumeSurgeWeight: 5,
    openInterestWeight: 30,
    fundingRateWeight: 20,
    cvdImbalanceWeight: 5,
    fibonacciZoneWeight: 20,
    rangePocWeight: 5,
    supportResistanceWeight: 15,
    volumeProfileRange: 100,
    trappedTradersWeight: 15,
    rsiDivergenceWeight: 20
  },
  counter: {
    key: 'counter',
    label: 'Contra-Trade (Fade & Squeeze)',
    enabled: true,
    category: 'COUNTER_TRADE',
    timeframe: '15m',
    candles: 48,
    minRiskRewardRatio: 2.8,
    volumeSurgeWeight: 15,
    openInterestWeight: 20,
    fundingRateWeight: 15,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 10,
    rangePocWeight: 15,
    supportResistanceWeight: 15,
    volumeProfileRange: 50,
    trappedTradersWeight: 35,
    rsiDivergenceWeight: 30
  }
};

export function getDefaultStrategyConfigs(): Record<StrategyKey, StrategyConfigItem> {
  const configs: any = {};
  for (const key of ALL_STRATEGY_KEYS) {
    if (key !== 'custom') {
      configs[key] = { ...STRATEGY_PRESETS[key] };
    }
  }
  return configs;
}

export function getDefaultIndicatorWeights(): IndicatorWeights {
  return {
    activeStrategy: 'intraday',
    strategyLabel: 'Intraday Flex (30m)',
    multiStrategyMode: true,
    enabledStrategies: ['scalp', 'daytrade', 'intraday', 'swing', 'position', 'counter'],
    strategyConfigs: getDefaultStrategyConfigs(),
    volumeSurgeWeight: 15,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 15,
    fibonacciZoneWeight: 15,
    rangePocWeight: 15,
    supportResistanceWeight: 10,
    trappedTradersWeight: 25,
    rsiDivergenceWeight: 20,
    minRiskRewardRatio: 2.5,
    volumeProfileRange: 50,
    volumeProfileTimeframe: '30m',
    volumeProfileCandles: 48
  };
}

/**
 * Returns the list of active strategy configurations that should be evaluated in parallel.
 */
export function resolveActiveStrategies(weights?: IndicatorWeights): StrategyConfigItem[] {
  if (!weights) {
    return Object.values(STRATEGY_PRESETS);
  }

  // If multiStrategyMode is explicitly false, return only the single active strategy
  if (weights.multiStrategyMode === false) {
    const key = (weights.activeStrategy && weights.activeStrategy !== 'custom' ? weights.activeStrategy : 'intraday') as Exclude<StrategyKey, 'custom'>;
    const base = weights.strategyConfigs?.[key] || STRATEGY_PRESETS[key] || STRATEGY_PRESETS.intraday;
    return [{ ...base, enabled: true }];
  }

  // Multi-Strategy Mode (default: runs all enabled strategies concurrently)
  const enabledKeys = weights.enabledStrategies && weights.enabledStrategies.length > 0
    ? weights.enabledStrategies
    : ALL_STRATEGY_KEYS;

  const result: StrategyConfigItem[] = [];
  for (const rawKey of enabledKeys) {
    if (rawKey === 'custom') continue;
    const key = rawKey as Exclude<StrategyKey, 'custom'>;
    const customConfig = weights.strategyConfigs?.[key];
    const defaultConfig = STRATEGY_PRESETS[key] || STRATEGY_PRESETS.intraday;
    
    const resolved: StrategyConfigItem = {
      ...defaultConfig,
      ...(customConfig || {}),
      key
    };

    if (resolved.enabled !== false) {
      result.push(resolved);
    }
  }

  // Fallback: if user disabled all, keep at least intraday
  if (result.length === 0) {
    result.push({ ...STRATEGY_PRESETS.intraday, enabled: true });
  }

  return result;
}

/**
 * Converts a StrategyConfigItem to an IndicatorWeights structure compatible with processTickerState
 */
export function configToWeights(config: StrategyConfigItem): IndicatorWeights {
  return {
    activeStrategy: config.key,
    strategyLabel: config.label,
    volumeSurgeWeight: config.volumeSurgeWeight,
    openInterestWeight: config.openInterestWeight,
    fundingRateWeight: config.fundingRateWeight,
    cvdImbalanceWeight: config.cvdImbalanceWeight,
    fibonacciZoneWeight: config.fibonacciZoneWeight,
    rangePocWeight: config.rangePocWeight,
    supportResistanceWeight: config.supportResistanceWeight,
    trappedTradersWeight: config.trappedTradersWeight || 25,
    rsiDivergenceWeight: config.rsiDivergenceWeight || 20,
    minRiskRewardRatio: config.minRiskRewardRatio,
    volumeProfileRange: config.volumeProfileRange,
    volumeProfileTimeframe: config.timeframe,
    volumeProfileCandles: config.candles
  };
}
