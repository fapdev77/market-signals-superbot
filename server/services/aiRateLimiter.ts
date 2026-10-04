import type { Database } from 'sql.js';
import { getDb } from '../db.js';
import { AIModelConfig } from '../../src/types.js';

/**
 * HIGH-4 — Enforcement dos limites de taxa declarados por modelo de IA.
 *
 * ANTES: `rateLimit: { maxReqPerMinute, maxReqPerDay }` era gravado em quatro
 * defaults (`db.ts`), repetido no fallback de `aiMotor.ts:118` e validado por
 * `validation.ts:98-99` (`z.number().min(1)`) — mas NENHUM consumidor no runtime
 * lia o campo. O único controle efetivo era o limiter de rota em `app.ts:127`
 * (45/min agregado em `/api/ai`).
 *
 * Isso é pior do que "não implementado": o controle efetivo era MAIS PERMISSIVO
 * que os limites declarados por modelo (`m2` = 15/min, `m4` = 100/min). O
 * sistema anunciava uma contenção de custo inexistente, e a que existia era mais
 * frouxa que a anunciada.
 *
 * DECISÕES DE DESENHO
 *
 * 1. Where: no DISPATCH (`generateContentWithModel`), não na camada HTTP. Um
 *    limiter de rota não sabe qual modelo a cadeia de fallback resolveu; o
 *    limite é propriedade do MODELO, não da rota nem da requisição HTTP.
 *
 * 2. Persistência: contador no banco, não em memória. Para um controle cujo
 *    propósito é conter gasto, reiniciabilidade é bypass trivial — um restart
 *    do processo zeraria a contagem. Por isso o módulo é STATELESS: todo o
 *    estado vive em `ai_rate_usage`, e o servidor inteiro compartilha a mesma
 *    contagem.
 *
 * 3. Fail-closed: se o banco não puder ser consultado, a chamada é BARADA. Um
 *    controle de custo que falha aberto não é controle.
 *
 * 4. SQL parametrizado: `AIModelConfig.id` chega do usuário via
 *    `POST /settings/ai-models`, então nunca é interpolado na query.
 *
 * 5. O rate limit é distinct por tipo (`AIRateLimitError`): a cadeia de
 *    fallback trata erro de modelo como "este provider falhou, tente o
 *    próximo". Tratar "orçamento esgotado" como falha de provider transformaria
 *    o fallback em bypass — o próximo modelo do cascateamento responderia, e o
 *    limite do primeiro nunca valeria nada.
 */

export type AIRateLimitReason = 'minute' | 'day';

/** Erro de domínio: orçamento do modelo esgotado. Não é falha de provider. */
export class AIRateLimitError extends Error {
  readonly reason: AIRateLimitReason;
  readonly retryAfterSeconds: number;
  readonly modelId: string;

  constructor(reason: AIRateLimitReason, retryAfterSeconds: number, modelId: string) {
    const label = reason === 'minute' ? 'por minuto' : 'diário';
    super(
      `Limite de uso ${label} atingido para o modelo '${modelId}'. ` +
        `Tente novamente em ${retryAfterSeconds}s.`
    );
    this.name = 'AIRateLimitError';
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
    this.modelId = modelId;
  }
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Início da janela deslizante que contém `now`. */
function windowStart(now: number, sizeMs: number): number {
  return Math.floor(now / sizeMs) * sizeMs;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function readCount(db: Database, modelId: string, kind: AIRateLimitReason, start: number): number {
  const res = db.exec(
    `SELECT request_count FROM ai_rate_usage
     WHERE model_id = ? AND window_kind = ? AND window_start = ?`,
    [modelId, kind, start]
  );
  const value = res[0]?.values?.[0]?.[0];
  return typeof value === 'number' ? value : 0;
}

function bump(db: Database, modelId: string, kind: AIRateLimitReason, start: number, now: number): void {
  db.run(
    `INSERT INTO ai_rate_usage (model_id, window_kind, window_start, request_count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(model_id, window_kind, window_start)
     DO UPDATE SET request_count = request_count + 1, updated_at = ?`,
    [modelId, kind, start, now, now]
  );
}

/**
 * Consome uma unidade do orçamento de `modelConfig`. Lança `AIRateLimitError`
 * se a janela de minuto ou a de dia estiver esgotada.
 *
 * `now` é injetável para que a janela seja testável sem relógio real.
 */
export async function consumeAiRateLimit(modelConfig: AIModelConfig, now: number = Date.now()): Promise<void> {
  const modelId = modelConfig?.id;
  if (!modelId) return;

  // Contrato opcional: sem rateLimit declarado, não há orçamento a conter.
  const rateLimit = modelConfig.rateLimit;
  if (!rateLimit) return;

  const perMinute = rateLimit.maxReqPerMinute;
  const perDay = rateLimit.maxReqPerDay;

  let db;
  try {
    db = await getDb();
  } catch (err) {
    // Fail-closed: sem banco não há como avaliar o limite, então não liberamos.
    throw new AIRateLimitError('minute', 60, modelId);
  }

  const minuteStart = windowStart(now, MINUTE_MS);
  const dayStart = windowStart(now, DAY_MS);

  // Janela de minuto primeiro: é a mais apertada e a de retorno mais curto.
  if (isPositiveInt(perMinute) && readCount(db, modelId, 'minute', minuteStart) >= perMinute) {
    throw new AIRateLimitError('minute', Math.ceil((minuteStart + MINUTE_MS - now) / 1000), modelId);
  }

  if (isPositiveInt(perDay) && readCount(db, modelId, 'day', dayStart) >= perDay) {
    throw new AIRateLimitError('day', Math.ceil((dayStart + DAY_MS - now) / 1000), modelId);
  }

  bump(db, modelId, 'minute', minuteStart, now);
  bump(db, modelId, 'day', dayStart, now);
}