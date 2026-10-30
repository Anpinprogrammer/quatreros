import type { ExecutionContext, Actor } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import type { Database } from '../../../platform/db/client.js';
import {
  decide,
  effectivePermissions,
  scopeFilter,
  type AccessTarget,
  type ScopeFilter,
} from '../domain/access.js';
import { findUserByAuthId, grantsOf, rolesOf, sitesOf } from '../infrastructure/repository.js';

/**
 * Autorización: ÚNICA fuente de decisión de permisos (security-design §3.2, PM §4.D).
 * Todos los módulos, el ToolGateway y los complementos la usan.
 */
export function requireActor(ctx: ExecutionContext): Actor {
  if (!ctx.actor)
    throw new AppError(401, 'UNAUTHENTICATED', 'Sesión requerida', 'Inicia sesión para continuar.');
  return ctx.actor;
}

export function authorize(ctx: ExecutionContext, permission: string, target?: AccessTarget): Actor {
  const actor = requireActor(ctx);
  const decision = decide(actor, permission, target);
  if (decision === 'no_permission') throw AppError.forbidden();
  if (decision === 'out_of_scope') throw AppError.notFound();
  return actor;
}

export function listFilter(ctx: ExecutionContext, permission: string): ScopeFilter {
  const filter = scopeFilter(requireActor(ctx), permission);
  if (!filter) throw AppError.forbidden();
  return filter;
}

/** Carga la identidad de negocio a partir del usuario de autenticación. */
export async function loadActor(db: Database, authUserId: string): Promise<Actor | null> {
  const record = await findUserByAuthId(db, authUserId);
  if (!record) return null;
  const [roleRows, siteRows, grants] = await Promise.all([
    rolesOf(db, [record.id]),
    sitesOf(db, [record.id]),
    grantsOf(db, record.id),
  ]);
  return {
    userId: record.id,
    authUserId: record.authUserId,
    fullName: record.fullName,
    email: record.email,
    isActive: record.isActive,
    roleCodes: roleRows.map((r) => r.code as Actor['roleCodes'][number]),
    siteIds: siteRows.map((s) => s.id),
    permissions: effectivePermissions(grants),
    mfaRequired: roleRows.some((r) => r.requiresMfa),
    mfaEnabled: record.mfaEnabled,
  };
}

/** Para el ingreso: una cuenta de negocio desactivada no recibe sesión. */
export async function isAuthUserBlocked(db: Database, authUserId: string): Promise<boolean> {
  const record = await findUserByAuthId(db, authUserId);
  return record ? !record.isActive : false;
}
