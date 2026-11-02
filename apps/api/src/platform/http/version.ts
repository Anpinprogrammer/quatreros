import { AppError } from './errors.js';

/**
 * Versión esperada desde If-Match (ETag "v<n>"), para edición concurrente segura.
 * Se usa en los módulos que editan registros con control de versión.
 */
export function expectedVersion(header: string | undefined): number | undefined {
  if (!header) return undefined;
  const match = /^"?v?(\d+)"?$/.exec(header.trim());
  if (!match?.[1])
    throw new AppError(400, 'MALFORMED_REQUEST', 'If-Match inválido', 'Usa el valor ETag recibido.');
  return Number(match[1]);
}
