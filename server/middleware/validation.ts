import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateOutboundAIUrl } from '../utils/outboundPolicy.js';

export const symbolParamSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9_]{2,20}$/, 'Símbolo inválido. Deve conter de 2 a 20 caracteres alfanuméricos.')
});

export const weightsUpdateSchema = z.object({
  activeStrategy: z.enum(['scalp', 'daytrade', 'intraday', 'swing', 'position']).optional(),
  strategyLabel: z.string().optional(),
  multiStrategyMode: z.boolean().optional(),
  enabledStrategies: z.array(z.enum(['scalp', 'daytrade', 'intraday', 'swing', 'position'])).optional(),
  volumeSurgeWeight: z.number().min(0).max(100).optional(),
  openInterestWeight: z.number().min(0).max(100).optional(),
  fundingRateWeight: z.number().min(0).max(100).optional(),
  cvdWeight: z.number().min(0).max(100).optional(),
  goldenPocketWeight: z.number().min(0).max(100).optional(),
  fvgWeight: z.number().min(0).max(100).optional(),
  orderBlockWeight: z.number().min(0).max(100).optional(),
  vwapWeight: z.number().min(0).max(100).optional(),
  rsiWeight: z.number().min(0).max(100).optional(),
  macdWeight: z.number().min(0).max(100).optional(),
  emaWeight: z.number().min(0).max(100).optional(),
  minConfluenceScore: z.number().min(0).max(100).optional()
}).passthrough();

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
