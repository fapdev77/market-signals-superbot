/**
 * 8.7 / Onda 1 — narrowing de erros para `unknown` (lado frontend).
 *
 * Espelha `server/utils/errors.ts`: com `useUnknownInCatchVariables` o binding
 * de `catch` torna-se `unknown`, então `err.message`/`err.name` deixam de
 * compilar. Centraliza o padrão sem depender de bibliotecas.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Mensagem legível de qualquer valor lançado. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (isObject(err) && typeof err.message === 'string') return err.message;
  return String(err);
}

/** Nome do erro (`Error.name`, `AbortError`...). */
export function getErrorName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  if (isObject(err) && typeof err.name === 'string') return err.name;
  return undefined;
}
