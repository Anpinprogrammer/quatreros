import { fromNodeHeaders } from 'better-auth/node';
import type { RequestHandler } from 'express';
import { AppError } from '../http/errors.js';
import type { Auth } from './auth.js';

/**
 * Resuelve la sesión (si existe) y la deja en req.ctx.actorId. No rechaza:
 * las rutas protegidas usan `requireSession`.
 */
export function sessionMiddleware(auth: Auth): RequestHandler {
  return async (req, _res, next) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) req.ctx.actorId = session.user.id;
    next();
  };
}

export const requireSession: RequestHandler = (req, _res, next) => {
  if (!req.ctx.actorId) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Sesión requerida', 'Inicia sesión para continuar.'));
    return;
  }
  next();
};
