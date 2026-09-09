import { AIPersona } from '../types';

export const DEFAULT_AI_PERSONAS: AIPersona[] = [
  {
    id: 'conservative',
    name: 'Conservador / Gestão Institucional',
    description: 'Prioriza a preservação de capital e rejeita operações sem confluência inequívoca de Orderflow e liquidez.',
    riskTolerance: 'LOW',
    preferredTimeframes: ['15m', '1h', '4h'],
    minRRRatio: 2.5,
    systemPromptAddendum: `ESTILO DE OPERAÇÃO: CONSERVADOR & PRESERVAÇÃO DE CAPITAL.
- Exija rigorosamente confirmação de absorção e rejeição de zonas fracas.
- Se houver divergência entre CVD e Preço, ou se o Funding Rate estiver superaquecido contra a posição, REJEITE a operação ou alerte para alto risco.
- Priorize Risk/Reward mínimo de 2.5:1 com Stop Loss técnico muito bem protegido atrás de POC ou Golden Pocket.`
  },
  {
    id: 'aggressive',
    name: 'Agressivo / Caçador de Squeeze',
    description: 'Busca capturar impulsos violentos de liquidação (Short/Long Squeezes) e rompimentos de alta volatilidade.',
    riskTolerance: 'HIGH',
    preferredTimeframes: ['1m', '5m', '15m'],
    minRRRatio: 3.0,
    systemPromptAddendum: `ESTILO DE OPERAÇÃO: AGRESSIVO & CAÇADOR DE VOLATILIDADE/SQUEEZE.
- Busque confluência de Open Interest em elevação rápida com Funding Rate distorcido para antecipar cascatas de liquidação.
- Aceite operações de momentum com stops ligeiramente mais largos para evitar violinadas e alvos ambiciosos de Take Profit (3:1 ou mais).`
  },
  {
    id: 'scalper',
    name: 'Scalper de Microestrutura',
    description: 'Focado em micro-movimentos rápidos, desequilíbrio imediato de CVD (Taker Delta) e absorção de liquidez.',
    riskTolerance: 'MEDIUM',
    preferredTimeframes: ['1m', '3m', '5m'],
    minRRRatio: 1.8,
    systemPromptAddendum: `ESTILO DE OPERAÇÃO: SCALPING DE ALTA VELOCIDADE.
- Concentre-se no Delta Taker recente, volume taker ratio (>60% ou <40%) e desequilíbrios imediatos de liquidez.
- Alvos rápidos (TP1 curto para garantir parciais imediatas), stop loss estrito e tolerância zero a trades que andam de lado.`
  },
  {
    id: 'swing',
    name: 'Swing Trader Estrutural',
    description: 'Focado em estruturas macro de mercado, Golden Pocket Fibonacci (0.618 - 0.68) e POC de Volume Profile.',
    riskTolerance: 'MEDIUM',
    preferredTimeframes: ['15m', '1h', '4h', '1d'],
    minRRRatio: 2.2,
    systemPromptAddendum: `ESTILO DE OPERAÇÃO: SWING TRADER ESTRUTURAL & VALUE ZONES.
- Priorize entradas exclusivamente em torno do POC (Point of Control) e Value Area (VAH/VAL) do Range Profile ou Golden Pocket Fibonacci 0.618-0.68.
- Ignore ruídos rápidos de 1 minuto; foque na sustentabilidade da tendência e suporte/resistência institucional.`
  }
];

export function getAIPersonaById(id?: string): AIPersona {
  const found = DEFAULT_AI_PERSONAS.find(p => p.id === id);
  return found || DEFAULT_AI_PERSONAS[0];
}
