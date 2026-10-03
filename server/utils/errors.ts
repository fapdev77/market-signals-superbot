/**
 * 8.7 / Onda 1 — narrowing de erros para `unknown`.
 *
 * Com `useUnknownInCatchVariables` (parte de `strict`), o binding de `catch`
 * passa a ser `unknown`, então `err.message`/`err.status` deixam de compilar.
 * Estes helpers fazem o narrowing uma vez e centralizam o padrão
 * `e instanceof Error ? e.message : String(e)`, sem afetar runtime.
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

/** Stack trace, quando disponível. */
export function getErrorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack;
  if (isObject(err) && typeof err.stack === 'string') return err.stack;
  return undefined;
}

/** Nome do erro (`Error.name`, `DOMException.name`, `AbortError`...). */
export function getErrorName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  if (isObject(err) && typeof err.name === 'string') return err.name;
  return undefined;
}

/** Status HTTP de erros no estilo axios/fetch, ou 0 quando ausente. */
export function getHttpStatus(err: unknown): number {
  if (isObject(err) && typeof err.status === 'number') return err.status;
  if (isObject(err)) {
    const response = err.response;
    if (isObject(response) && typeof response.status === 'number') return response.status;
  }
  return 0;
}

/** Headers HTTP de erros no estilo axios/fetch. */
export function getErrorHeaders(err: unknown): Record<string, string | string[] | undefined> {
  if (isObject(err)) {
    if (isObject(err.headers)) return err.headers as Record<string, string | string[] | undefined>;
    const response = err.response;
    if (isObject(response) && isObject(response.headers)) {
      return response.headers as Record<string, string | string[] | undefined>;
    }
  }
  return {};
}
