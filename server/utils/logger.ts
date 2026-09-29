/**
 * R-15 — Logger estruturado mínimo (sem dependência nova).
 *
 * Uma linha JSON por evento com: `level`, `module`, `msg`, `ts` (epoch ms) e
 * `correlationId` do tick quando houver. Segredos são redigidos ANTES da
 * serialização (critério 3: nenhum segredo em log) — tanto em `data` (chaves
 * sensíveis) quanto na própria mensagem (padrões token-like).
 *
 * Uso nos caminhos quentes:
 *   logJson('INFO', 'tick', 'tick processado', { symbols, correlationId: tickId });
 *
 * `__setLogSinkForTests` permite capturar as linhas em testes; sem sink, a linha
 * vai para stdout via console.log (um único console.log por evento).
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogLine {
  ts: number;
  level: LogLevel;
  module: string;
  msg: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

/** Chaves cujo valor é segredo e deve ser redigido (match por substring — ex.: GEMINI_API_KEY). */
const SECRET_KEY_PATTERN =
  /(api[-_]?key|apikey|secret|password|passwd|token|authorization|auth|cookie|session[-_]?id)/i;

/** Padrões de segredo que aparecem soltos no texto da mensagem. */
const SECRET_TEXT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /Bearer\s+[A-Za-z0-9._\-=/+]{8,}/gi, label: 'Bearer [REDACTED]' },
  { re: /\b(?:sk|pk)[-_][A-Za-z0-9]{8,}/g, label: '[REDACTED_KEY]' },
  { re: /\bAIza[0-9A-Za-z\-_]{10,}/g, label: '[REDACTED_GOOGLE_KEY]' },
  { re: /(?:api[-_]?key|apikey|access[-_]?token|token)\s*[=:]\s*\S+/gi, label: '$1=[REDACTED]' }
];

/** Redige segredos que aparecem soltos em texto livre. */
export function loggerRedactsSecrets(text: string): string {
  let out = String(text ?? '');
  for (const { re, label } of SECRET_TEXT_PATTERNS) {
    out = out.replace(re, label);
  }
  return out;
}

/** Redige recursivamente valores de chaves sensíveis dentro de objetos de log. */
function redactData(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redactData(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'string') {
        out[k] = loggerRedactsSecrets(v);
      } else {
        out[k] = redactData(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

type LogSink = (line: string) => void;

let logSink: LogSink | null = null;

/** Test-only: captura as linhas emitidas. */
export function __setLogSinkForTests(sink: LogSink): void {
  logSink = sink;
}

/** Test-only: volta ao console padrão e limpa o sink. */
export function __resetLoggerForTests(): void {
  logSink = null;
}

function emit(line: string): void {
  if (logSink) {
    logSink(line);
    return;
  }
  console.log(line);
}

/**
 * Emite um evento estruturado: UMA linha JSON (quebras de linha dentro dos valores
 * são escapadas por JSON.stringify, o formato nunca quebra).
 */
export function logJson(
  level: LogLevel,
  module: string,
  msg: string,
  data?: Record<string, unknown>
): void {
  const { correlationId, ...rest } = data || {};
  const line: StructuredLogLine = {
    ts: Date.now(),
    level,
    module: String(module || 'app').slice(0, 60),
    msg: loggerRedactsSecrets(String(msg ?? ''))
  };
  if (typeof correlationId === 'string' && correlationId) {
    line.correlationId = correlationId.slice(0, 120);
  }
  if (Object.keys(rest).length > 0) {
    line.data = redactData(rest) as Record<string, unknown>;
  }
  emit(JSON.stringify(line));
}
