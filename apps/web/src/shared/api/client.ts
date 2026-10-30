import { IDEMPOTENCY_HEADER, ProblemDetails } from '@quatreros/contracts';

/**
 * Cliente HTTP de la SPA (api-design.md).
 * - Errores siempre como ApiError con el Problem Details del servidor.
 * - `idempotencyKey` se genera UNA vez por intento lógico (p. ej. al abrir el formulario de entrega)
 *   y se reutiliza en los reintentos, para no duplicar operaciones (BR-007).
 */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
  get code() {
    return this.problem.code;
  }
  get status() {
    return this.problem.status;
  }
  /** Mensaje de un campo concreto (errores de validación 422). */
  fieldError(path: string): string | undefined {
    return this.problem.errors?.find((e) => e.path === path)?.message;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  ifMatch?: string;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;
  if (options.ifMatch) headers['If-Match'] = options.ifMatch;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError({
      type: 'about:blank',
      title: 'Sin conexión',
      status: 0,
      code: 'NETWORK_ERROR',
      detail: 'No hay conexión con el servidor. Revisa Internet e inténtalo de nuevo; no se registró nada.',
    });
  }

  if (response.ok) {
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
  const parsed = ProblemDetails.safeParse(await response.json().catch(() => null));
  throw new ApiError(
    parsed.success
      ? parsed.data
      : { type: 'about:blank', title: 'Error inesperado', status: response.status, code: 'INTERNAL' },
  );
}

/** Nueva clave para un intento lógico de operación. */
export const newIdempotencyKey = () => crypto.randomUUID();
