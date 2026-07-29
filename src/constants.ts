import { TradingProfile } from './types';

export const PROFILE_PRESETS: Record<TradingProfile, {
  name: string;
  timeframeLabel: string;
  minConfluence: number;
  targetRiskRatio: number;
  stopLossPct: number;
  candleStep: number;
  description: string;
}> = {
  scalp: {
    name: 'Scalp (Alta Frequência)',
    timeframeLabel: '1m - 5m',
    minConfluence: 58,
    targetRiskRatio: 1.6,
    stopLossPct: 0.45,
    candleStep: 1,
    description: 'Operações ultra rápidas buscando pequenos impulsos de volatilidade e desequilíbrios de CVD.'
  },
  daytrade: {
    name: 'Day Trade (Sessão Intraday)',
    timeframeLabel: '15m - 30m',
    minConfluence: 63,
    targetRiskRatio: 2.2,
    stopLossPct: 0.95,
    candleStep: 3,
    description: 'Operações intra-dia focadas em consolidações de Volume Profile, POC e rompimentos sustentados.'
  },
  intraday: {
    name: 'Intraday Estrutural',
    timeframeLabel: '30m - 1h',
    minConfluence: 68,
    targetRiskRatio: 3.0,
    stopLossPct: 1.60,
    candleStep: 6,
    description: 'Buscando reversão em Golden Pocket Fibonacci e absorção pesada em níveis de suporte e resistência.'
  },
  swing: {
    name: 'Swing Trade (Macro Tendência)',
    timeframeLabel: '4h - 1D',
    minConfluence: 74,
    targetRiskRatio: 4.2,
    stopLossPct: 3.20,
    candleStep: 15,
    description: 'Tendência primária de mercado com amplos alvos de retorno e filtros rígidos de Open Interest.'
  }
};
