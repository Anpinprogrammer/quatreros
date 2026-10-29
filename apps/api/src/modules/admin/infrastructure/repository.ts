import type { RoleCode, Scope } from '@quatreros/contracts';
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { session as authSession, user as authUser } from '../../../platform/db/schema/auth.js';
import { locations, rolePermissions, roles, sites, userRoles, userSites, users } from './schema.js';

/** Ejecutor: la base o una transacción en curso. */
export type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export interface UserRecord {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  mfaEnabled: boolean;
}

const userColumns = {
  id: users.id,
  authUserId: users.authUserId,
  fullName: users.fullName,
  email: users.email,
  isActive: users.isActive,
  version: users.version,
  createdAt: users.createdAt,
  mfaEnabled: sql<boolean>`coalesce(${authUser.twoFactorEnabled}, false)`,
};

export async function findUserByAuthId(db: Executor, authUserId: string): Promise<UserRecord | undefined> {
  const [row] = await db
    .select(userColumns)
    .from(users)
    .innerJoin(authUser, eq(authUser.id, users.authUserId))
    .where(eq(users.authUserId, authUserId));
  return row;
}

export async function findUserById(db: Executor, id: string): Promise<UserRecord | undefined> {
  const [row] = await db
    .select(userColumns)
    .from(users)
    .innerJoin(authUser, eq(authUser.id, users.authUserId))
    .where(eq(users.id, id));
  return row;
}

export async function emailInUse(db: Executor, email: string): Promise<boolean> {
  const [a] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  const [b] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));
  return Boolean(a ?? b);
}

export async function rolesOf(db: Executor, userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: userRoles.userId, code: roles.code, requiresMfa: roles.requiresMfa })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(inArray(userRoles.userId, userIds), eq(roles.isActive, true)));
}

export async function sitesOf(db: Executor, userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: userSites.userId, id: sites.id, name: sites.name, kind: sites.kind })
    .from(userSites)
    .innerJoin(sites, eq(sites.id, userSites.siteId))
    .where(and(inArray(userSites.userId, userIds), eq(sites.isActive, true)));
}

export async function grantsOf(db: Executor, userId: string): Promise<{ code: string; scope: Scope }[]> {
  return db
    .select({ code: rolePermissions.permissionCode, scope: rolePermissions.scope })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
}

export async function listUsers(
  db: Executor,
  opts: { q?: string | undefined; status: 'active' | 'inactive' | 'all' },
) {
  const conditions = [];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conditions.push(or(ilike(users.fullName, like), ilike(users.email, like)));
  }
  if (opts.status !== 'all') conditions.push(eq(users.isActive, opts.status === 'active'));
  return db
    .select(userColumns)
    .from(users)
    .innerJoin(authUser, eq(authUser.id, users.authUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.fullName))
    .limit(500);
}

export async function roleIdsByCode(db: Executor, codes: RoleCode[]) {
  if (codes.length === 0) return [];
  return db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(and(inArray(roles.code, codes), eq(roles.isActive, true)));
}

export async function existingSiteIds(db: Executor, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(inArray(sites.id, ids), eq(sites.isActive, true)));
  return rows.map((r) => r.id);
}

/** Administradores activos (regla del último administrador). */
export async function activeAdminIds(db: Executor): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.code, 'ADM'), eq(users.isActive, true)));
  return rows.map((r) => r.id);
}

export async function replaceRolesAndSites(
  db: Executor,
  userId: string,
  roleIds: string[] | undefined,
  siteIds: string[] | undefined,
) {
  if (roleIds) {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length) await db.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })));
  }
  if (siteIds) {
    await db.delete(userSites).where(eq(userSites.userId, userId));
    if (siteIds.length) await db.insert(userSites).values(siteIds.map((siteId) => ({ userId, siteId })));
  }
}

/** Cierra todas las sesiones de un usuario (desactivación, security-design §2). */
export async function revokeSessions(db: Executor, authUserId: string) {
  await db.delete(authSession).where(eq(authSession.userId, authUserId));
}

export async function listRolesWithPermissions(db: Executor) {
  const rows = await db
    .select({
      code: roles.code,
      name: roles.name,
      requiresMfa: roles.requiresMfa,
      permission: rolePermissions.permissionCode,
      scope: rolePermissions.scope,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(roles.isActive, true))
    .orderBy(asc(roles.code), asc(rolePermissions.permissionCode));
  return rows;
}

export async function listSites(db: Executor, siteIds?: string[]) {
  const siteRows = await db
    .select({ id: sites.id, name: sites.name, kind: sites.kind })
    .from(sites)
    .where(and(eq(sites.isActive, true), siteIds ? inArray(sites.id, siteIds) : undefined))
    .orderBy(asc(sites.name));
  if (siteRows.length === 0) return [];
  const locRows = await db
    .select({ id: locations.id, siteId: locations.siteId, name: locations.name, kind: locations.kind })
    .from(locations)
    .where(
      and(
        eq(locations.isActive, true),
        inArray(
          locations.siteId,
          siteRows.map((s) => s.id),
        ),
      ),
    )
    .orderBy(asc(locations.name));
  return siteRows.map((s) => ({ ...s, locations: locRows.filter((l) => l.siteId === s.id) }));
}
