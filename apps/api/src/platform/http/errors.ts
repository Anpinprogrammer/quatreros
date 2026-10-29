import type { ErrorCode, ProblemDetails } from '@quatreros/contracts';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Logger } from '../logger.js';

/**
 * Error de aplicación con código estable (api-design.md §3).
 * Los casos de uso lanzan AppError; el manejador lo traduce a Problem Details.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | (string & {}),
    readonly title: string,
    readonly detail?: string,
    readonly extra: Partial<ProblemDetails> = {},
  ) {
    super(detail ?? title);
    this.name = 'AppError';
  }

  static notFound(detail = 'El recurso no existe o no tienes acceso a él.') {
    return new AppError(404, 'NOT_FOUND', 'No encontrado', detail);
  }

  static forbidden(detail = 'No tienes permiso para realizar esta acción.') {
    return new AppError(403, 'FORBIDDEN', 'Acceso denegado', detail);
  }

  static conflict(code: string, title: string, detail?: string) {
    return new AppError(409, code, title, detail);
  }

  static featureBlocked(blockedBy: string) {
    return new AppError(
      423,
      'FEATURE_BLOCKED',
      'Funcionalidad no disponible',
      `Esta funcionalidad está pendiente de una decisión del negocio (${blockedBy}).`,
      { blockedBy },
    );
  }
}

const typeFor = (code: string) => `https://quatreros.app/errors/${code.toLowerCase().replaceAll('_', '-')}`;

export function toProblem(err: AppError, requestId?: string): ProblemDetails {
  return {
    type: typeFor(err.code),
    title: err.title,
    status: err.status,
    code: err.code,
    ...(err.detail ? { detail: err.detail } : {}),
    ...(requestId ? { requestId } : {}),
    ...err.extra,
  };
}

export function fromZodError(error: ZodError): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', 'Revisa los campos marcados.', {
    errors: error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
  });
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('La ruta solicitada no existe.'));
};

/** Manejador final: nunca expone detalles internos al cliente (security-design §5). */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    // contextMiddleware corre primero; aun así se protege por si el error ocurre antes.
    const requestId = (req.ctx as { requestId?: string } | undefined)?.requestId;
    let appError: AppError;
    if (err instanceof AppError) {
      appError = err;
    } else if (err instanceof ZodError) {
      appError = fromZodError(err);
    } else if (err instanceof SyntaxError && 'body' in err) {
      appError = new AppError(
        400,
        'MALFORMED_REQUEST',
        'Solicitud mal formada',
        'El cuerpo JSON no es válido.',
      );
    } else {
      logger.error({ err, requestId }, 'Error no controlado');
      appError = new AppError(
        500,
        'INTERNAL',
        'Error interno',
        'Ocurrió un error inesperado. Usa el requestId para soporte.',
      );
    }
    if (appError.status >= 500 && err instanceof AppError) {
      logger.error({ err, requestId }, 'Error de aplicación 5xx');
    }
    res.status(appError.status).type('application/problem+json').json(toProblem(appError, requestId));
  };
}
