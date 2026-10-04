import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateOutboundAIUrl } from '../utils/outboundPolicy.js';

export const symbolParamSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9_]{2,20}$/, 'Símbolo inválido. Deve conter de 2 a 20 caracteres alfanuméricos.')
});

const STRATEGY_KEY = z.enum(['scalp', 'daytrade', 'intraday', 'swing', 'position', 'counter', 'custom']);

/**
 * HIGH-3 (auditoria 2026-10-04) — schema do POST /api/settings/weights.
 *
 * Antes este schema era importado mas NUNCA aplicado, e o que ele descrevia nem
 * batia com `IndicatorWeights`: validava `cvdWeight`/`goldenPocketWeight`/`fvgWeight`/
 * `orderBlockWeight`/`vwapWeight`/`rsiWeight`/`macdWeight`/`emaWeight`, campos que não
 * existem no tipo, enquanto os campos reais passavam por `.passthrough()` sem limite
 * nenhum. O merge cego da rota escrevia o payload direto em `botState.weights`.
 *
 * Consequências concretas que este schema fecha:
 *  - `maxStopLossAtrMultiple` negativo => `signalEngine` só aplica o cap ATR quando
 *    `capMultiple > 0`, ou seja, o teto de risco de stop era DESLIGADO;
 *  - `volumeProfileRange: 0` e afins => divisão por zero / perfil degenerado;
 *  - pesos fora de [0,100] anulando a confluência inteira sem nenhum sinal de erro.
 *
 * `.passthrough()` é mantido de propósito: `strategyConfigs` e `signalTtlSettings` são
 * objetos estruturados que o merge precisa preservar. O que muda é que TODO campo
 * escalar de risco agora tem faixa explícita.
 */
export const indicatorWeightsSchema = z.object({
  activeStrategy: STRATEGY_KEY.optional(),
  strategyLabel: z.string().max(120).optional(),
  multiStrategyMode: z.boolean().optional(),
  enabledStrategies: z.array(STRATEGY_KEY).optional(),
  strategyConfigs: z.record(STRATEGY_KEY, z.object({}).passthrough()).optional(),
  signalTtlSettings: z.object({}).passthrough().optional(),

  // Pesos de confluência: [0, 100] — fora disso o score perde meaning e o sinal
  // passa a ser decidido por um peso degenerado.
  volumeSurgeWeight: z.number().min(0).max(100).optional(),
  openInterestWeight: z.number().min(0).max(100).optional(),
  fundingRateWeight: z.number().min(0).max(100).optional(),
  cvdImbalanceWeight: z.number().min(0).max(100).optional(),
  fibonacciZoneWeight: z.number().min(0).max(100).optional(),
  rangePocWeight: z.number().min(0).max(100).optional(),
  supportResistanceWeight: z.number().min(0).max(100).optional(),
  trappedTradersWeight: z.number().min(0).max(100).optional(),
  rsiDivergenceWeight: z.number().min(0).max(100).optional(),

  minConfluenceScore: z.number().min(0).max(100).optional(),
  // RR tem de ser > 0 e finito: é o denominador do dimensionamento de risco.
  minRiskRewardRatio: z.number().min(0.1).max(100).optional(),
  // Resolução do volume profile: inteira e >= 1 (0 => divisão degenerada).
  volumeProfileRange: z.number().int().min(1).max(1000).optional(),
  // Cap do stop em múltiplos do ATR. PRECISA ser > 0: `signalEngine` só aplica o
  // teto quando `capMultiple > 0`, então <= 0 desliga o teto de risco silenciosamente.
  maxStopLossAtrMultiple: z.number().positive().max(100).optional(),
  volumeProfileTimeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']).optional(),
  volumeProfileCandles: z.number().int().min(1).max(2000).optional()
}).passthrough();

/** Envelope aceito pela rota: `{ weights, scope, resetCategory, activeStrategy }`. */
const weightsEnvelopeSchema = z.object({
  weights: indicatorWeightsSchema.optional(),
  scope: z.enum(['ALL_FUTURE', 'RESET_AND_RESCAN']).optional(),
  resetCategory: z.string().max(60).optional(),
  activeStrategy: STRATEGY_KEY.optional()
}).passthrough();

/**
 * A rota aceita dois formatos — objeto de pesos direto (usado pelo BacktestDashboard ao
 * aplicar pesos auto-tunados) e envelope `{ weights, scope, ... }` (usado pelo App.tsx).
 * Valida os dois sem ambiguidade: se `weights` existe e é objeto, é envelope; caso
 * contrário o corpo inteiro é o objeto de pesos.
 */
export const weightsUpdateSchema = z.preprocess((value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.weights !== undefined && obj.weights !== null && typeof obj.weights === 'object' && !Array.isArray(obj.weights)) {
      return obj;
    }
    return { weights: obj };
  }
  return value;
}, weightsEnvelopeSchema);

export const aiModelConfigItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(['gemini', 'openrouter', 'anthropic', 'local']),
  modelId: z.string().min(1),
  apiUrl: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean(),
  isFallback: z.boolean(),
  priority: z.number().int().min(1),
  rateLimit: z.object({
    maxReqPerMinute: z.number().min(1),
    maxReqPerDay: z.number().min(1)
  }).optional(),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(32768).optional(),
    topP: z.number().min(0).max(1).optional(),
    systemInstruction: z.string().optional()
  }).optional()
}).passthrough().superRefine((data, ctx) => {
  if (data.apiUrl && data.apiUrl.trim().length > 0) {
    const validation = validateOutboundAIUrl(data.apiUrl, data.provider);
    if (!validation.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiUrl'],
        message: validation.error || 'URL da API inválida ou não autorizada pela política anti-SSRF.'
      });
    }
  }
});

export const aiModelsUpdateSchema = z.array(aiModelConfigItemSchema).min(1, 'Pelo menos um modelo deve ser configurado.');

export const resetConfirmationSchema = z.object({
  confirm: z.literal('RESET'),
  scope: z.enum(['ALL', 'SIGNALS', 'SETTINGS', 'LOGS']).optional(),
  reason: z.string().optional()
});

export const tableClearConfirmationSchema = z.object({
  confirm: z.enum(['TABLE_CLEAR', 'CLEAR']),
  table: z.string().optional(),
  tableName: z.string().optional()
}).refine(data => Boolean(data.table || data.tableName), {
  message: 'Nome da tabela é obrigatório (campo table ou tableName).'
});

/**
 * Express middleware helper to validate request body with a Zod schema.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorIssues = result.error.issues || [];
      res.status(400).json({
        error: 'Bad Request',
        message: 'Dados enviados na requisição são inválidos.',
        details: errorIssues.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware helper to validate request params with a Zod schema.
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errorIssues = result.error.issues || [];
      res.status(400).json({
        error: 'Bad Request',
        message: 'Parâmetros de rota inválidos.',
        details: errorIssues.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }
    req.params = result.data as any;
    next();
  };
}
