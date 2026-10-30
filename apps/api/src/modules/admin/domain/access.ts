import type { RoleCode, Scope, Shell } from '@quatreros/contracts';

/**
 * Reglas puras de acceso (BR-001, BR-002, security-design §3). Sin E/S.
 */

const SCOPE_RANK: Record<Scope, number> = { OWN: 1, SITE: 2, ALL: 3 };

/** Permisos efectivos: si varios roles otorgan el mismo permiso, gana el alcance más amplio. */
export function effectivePermissions(grants: { code: string; scope: Scope }[]): Map<string, Scope> {
  const result = new Map<string, Scope>();
  for (const { code, scope } of grants) {
    const current = result.get(code);
    if (!current || SCOPE_RANK[scope] > SCOPE_RANK[current]) result.set(code, scope);
  }
  return result;
}

export interface AccessSubject {
  userId: string;
  siteIds: readonly string[];
  permissions: ReadonlyMap<string, Scope>;
}

/** Recurso concreto sobre el que se pide acceso. */
export interface AccessTarget {
  siteId?: string | undefined;
  /** Usuario responsable del registro (repartidor del despacho, cajero del turno...). */
  ownerId?: string | undefined;
}

export type AccessDecision = 'allow' | 'no_permission' | 'out_of_scope';

/**
 * - Sin el permiso → no_permission (403).
 * - Con permiso pero el recurso es de otra sede o de otro usuario → out_of_scope (404, no revela existencia).
 */
export function decide(subject: AccessSubject, permission: string, target?: AccessTarget): AccessDecision {
  const scope = subject.permissions.get(permission);
  if (!scope) return 'no_permission';
  if (scope === 'ALL' || !target) return 'allow';
  if (target.siteId !== undefined && !subject.siteIds.includes(target.siteId)) return 'out_of_scope';
  if (scope === 'OWN' && target.ownerId !== undefined && target.ownerId !== subject.userId)
    return 'out_of_scope';
  return 'allow';
}

/** Filtro para listados según el alcance (los registros fuera de alcance no se devuelven ni se cuentan). */
export type ScopeFilter =
  { kind: 'all' } | { kind: 'sites'; siteIds: string[] } | { kind: 'own'; userId: string; siteIds: string[] };

export function scopeFilter(subject: AccessSubject, permission: string): ScopeFilter | null {
  const scope = subject.permissions.get(permission);
  if (!scope) return null;
  if (scope === 'ALL') return { kind: 'all' };
  if (scope === 'SITE') return { kind: 'sites', siteIds: [...subject.siteIds] };
  return { kind: 'own', userId: subject.userId, siteIds: [...subject.siteIds] };
}

/** Pantalla de inicio según los roles (especificación adm §5). */
export function homeShell(roleCodes: readonly RoleCode[]): Shell {
  const erpRoles: RoleCode[] = ['ADM', 'MGR', 'COMP', 'PROD', 'CONT'];
  if (roleCodes.some((r) => erpRoles.includes(r))) return 'erp';
  if (roleCodes.includes('CAJ')) return 'pos';
  if (roleCodes.includes('DIST')) return 'ruta';
  return 'erp';
}

/**
 * Regla del último administrador: no se puede dejar el sistema sin un administrador activo.
 * `activeAdminIds` son los administradores activos ANTES del cambio.
 */
export function wouldRemoveLastAdmin(
  activeAdminIds: readonly string[],
  userId: string,
  stillAdminAfter: boolean,
): boolean {
  if (stillAdminAfter) return false;
  return activeAdminIds.length === 1 && activeAdminIds[0] === userId;
}
