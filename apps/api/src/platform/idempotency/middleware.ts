import { createHash } from 'node:crypto';
import { IDEMPOTENCY_HEADER, IdempotencyKey } from '@quatreros/contracts';
import type { RequestHandler } from 'express';
import { AppError } from '../http/errors.js';
import type { IdempotencyStore } from './store.js';

/**
 * Exige `Idempotency-Key` en escrituras críticas (ADR-010, BR-007, api-design §1).
 *
 * - Sin cabecera → 428 IDEMPOTENCY_KEY_REQUIRED.
 * - Misma clave y mismo cuerpo, ya completada → repite la respuesta guardada (cabecera Idempotent-Replayed).
 * - Misma clave con cuerpo distinto → 422 IDEMPOTENCY_KEY_REUSED.
 * - Misma clave aún en proceso → 409 IDEMPOTENCY_IN_PROGRESS.
 * - Respuestas 5xx liberan la clave para permitir el reintento.
 *
 * Se usa por ruta: `router.post('/pos/sales', requireIdempotency(store), handler)`.
 */
export function requireIdempotency(store: IdempotencyStore): RequestHandler {
  return async (req, res, next) => {
    const raw = req.header(IDEMPOTENCY_HEADER);
    if (!raw) {
      next(
        new AppError(
          428,
          'IDEMPOTENCY_KEY_REQUIRED',
          'Falta Idempotency-Key',
          'Esta operación exige la cabecera Idempotency-Key.',
        ),
      );
      return;
    }
    const parsedKey = IdempotencyKey.safeParse(raw);
    if (!parsedKey.success) {
      next(
        new AppError(
          422,
          'VALIDATION_FAILED',
          'Idempotency-Key inválida',
          'Idempotency-Key debe ser un UUID.',
        ),
      );
      return;
    }
    const actorId = req.ctx.actorId;
    if (!actorId) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Sesión requerida', 'Inicia sesión para continuar.'));
      return;
    }
    const key = parsedKey.data;
    const route = `${req.method} ${req.baseUrl}${req.route ? (req.route as { path: string }).path : req.path}`;
    const requestHash = createHash('sha256')
      .update(`${route}\n${JSON.stringify(req.body ?? null)}`)
      .digest('hex');

    const existing = await store.reserve(actorId, key, route, requestHash);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        next(
          new AppError(
            422,
            'IDEMPOTENCY_KEY_REUSED',
            'Clave de idempotencia reutilizada',
            'Esta Idempotency-Key ya se usó con datos distintos. Genera una nueva para otra operación.',
          ),
        );
        return;
      }
      if (existing.status === 'in_progress' || existing.responseCode === null) {
        next(
          AppError.conflict(
            'IDEMPOTENCY_IN_PROGRESS',
            'Operación en curso',
            'Esta operación aún se está procesando.',
          ),
        );
        return;
      }
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.responseCode).json(existing.responseBody);
      return;
    }

    // Captura la respuesta para guardarla al terminar.
    const originalJson = res.json.bind(res);
    let captured: unknown = null;
    res.json = (body: unknown) => {
      captured = body;
      return originalJson(body);
    };
    res.on('finish', () => {
      const done =
        res.statusCode >= 500
          ? store.release(actorId, key)
          : store.complete(actorId, key, res.statusCode, captured);
      done.catch((err: unknown) => {
        req.log.error({ err }, 'No se pudo registrar el resultado de idempotencia');
      });
    });
    next();
  };
}
