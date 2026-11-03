import { sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import type { Database } from '../db/client.js';
import type { Actor } from '../http/context.js';
import { AppError } from '../http/errors.js';

/** RNF-006 / DEC-107: límites de inactividad por shell. */
export const IDLE_LIMITS_MS = {
  erp: 30 * 60 * 1000,
  pos: 12 * 60 * 60 * 1000,
  ruta: 8 * 60 * 60 * 1000,
} as const;

export type SessionShell = keyof typeof IDLE_LIMITS_MS;

const ERP_ROLES = new Set(['ADM', 'MGR', 'COMP', 'PROD', 'CONT']);

/** El shell de casa del usuario decide el límite; roles mixtos conservan el más restrictivo. */
export function shellForActor(actor: Pick<Actor, 'roleCodes'>): SessionShell {
  if (actor.roleCodes.some((role) => ERP_ROLES.has(role))) return 'erp';
  if (actor.roleCodes.includes('CAJ')) return 'pos';
  if (actor.roleCodes.includes('DIST')) return 'ruta';
  return 'erp';
}

/**
 * Cierra la sesión por inactividad en el servidor (no solo en la UI).
 * La última actividad se guarda en `platform.session_activity`.
 */
export function sessionActivityMiddleware(db: Database): RequestHandler {
  return async (req, _res, next) => {
    const actor = req.ctx.actor;
    if (!actor || !req.ctx.sessionId) {
      next();
      return;
    }
    try {
      const shell = shellForActor(actor);
      const result = await db.execute(sql`
        select last_seen_at as "lastSeenAt"
        from platform.session_activity
        where session_id = ${req.ctx.sessionId}
        limit 1
      `);
      const lastSeenAt = (result.rows[0] as { lastSeenAt: Date | string } | undefined)?.lastSeenAt;
      if (lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() > IDLE_LIMITS_MS[shell]) {
        next(
          new AppError(
            401,
            'SESSION_EXPIRED',
            'Sesión expirada',
            'Tu sesión expiró por inactividad. Vuelve a ingresar.',
          ),
        );
        return;
      }
      await db.execute(sql`
        insert into platform.session_activity (session_id, user_id, shell, last_seen_at)
        values (${req.ctx.sessionId}, ${actor.userId}, ${shell}, now())
        on conflict (session_id) do update set
          user_id = excluded.user_id,
          shell = excluded.shell,
          last_seen_at = now()
      `);
      next();
    } catch (error) {
      next(error);
    }
  };
}
