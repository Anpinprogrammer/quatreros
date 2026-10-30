import type { RequestHandler } from 'express';
import type { Actor } from './context.js';
import { AppError } from './errors.js';

export type ActorResolver = (authUserId: string) => Promise<Actor | null>;

/**
 * Resuelve la identidad de negocio del usuario autenticado (roles, sedes, permisos).
 * - Cuenta sin alta de negocio → 403 ACCOUNT_NOT_PROVISIONED.
 * - Cuenta desactivada → 401 ACCOUNT_DISABLED (BR-010).
 */
export function actorMiddleware(resolve: ActorResolver): RequestHandler {
  return async (req, _res, next) => {
    const authUserId = req.ctx.actorId;
    if (!authUserId) {
      next();
      return;
    }
    const actor = await resolve(authUserId);
    if (!actor) {
      next(
        new AppError(
          403,
          'ACCOUNT_NOT_PROVISIONED',
          'Cuenta sin configurar',
          'Pide al administrador que te asigne un rol.',
        ),
      );
      return;
    }
    if (!actor.isActive) {
      next(
        new AppError(
          401,
          'ACCOUNT_DISABLED',
          'Cuenta desactivada',
          'Tu cuenta está desactivada. Habla con el administrador.',
        ),
      );
      return;
    }
    req.ctx.actor = actor;
    next();
  };
}

/**
 * Segundo factor obligatorio para roles sensibles (DEC-043): mientras no esté activo, solo se permite /me
 * (para que la interfaz guíe la configuración). La activación ocurre en /api/auth/two-factor/*.
 */
export const mfaGate: RequestHandler = (req, _res, next) => {
  const actor = req.ctx.actor;
  if (actor?.mfaRequired && !actor.mfaEnabled && req.path !== '/me') {
    next(
      new AppError(
        403,
        'MFA_SETUP_REQUIRED',
        'Configura el segundo factor',
        'Tu rol exige verificación en dos pasos. Configúrala para continuar.',
      ),
    );
    return;
  }
  next();
};

/** Exige sesión en todas las rutas de negocio. */
export const requireAuthenticated: RequestHandler = (req, _res, next) => {
  if (!req.ctx.actor) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Sesión requerida', 'Inicia sesión para continuar.'));
    return;
  }
  next();
};
