import {
  CreateUserRequest,
  ROLE_NAMES,
  type MeResponse,
  type RoleCode,
  type RoleView,
  type SiteView,
  UpdateUserRequest,
  type UserSummary,
} from '@quatreros/contracts';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { AuthProvisioner } from '../../../platform/auth/provisioner.js';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { homeShell, wouldRemoveLastAdmin } from '../domain/access.js';
import {
  activeAdminIds,
  emailInUse,
  existingSiteIds,
  findUserById,
  listRolesWithPermissions,
  listSites,
  listUsers,
  replaceRolesAndSites,
  revokeSessions,
  roleIdsByCode,
  rolesOf,
  sitesOf,
  type UserRecord,
} from '../infrastructure/repository.js';
import { users } from '../infrastructure/schema.js';
import { authorize, listFilter, requireActor } from './authz.js';

export interface UsersDeps {
  db: Database;
  provisioner: AuthProvisioner;
}

const lastAdminError = () =>
  AppError.conflict(
    'LAST_ADMIN',
    'Último administrador',
    'Debe quedar al menos un administrador activo. Asigna el rol a otra persona antes de este cambio.',
  );

async function toSummaries(db: Database, records: UserRecord[]): Promise<UserSummary[]> {
  const ids = records.map((r) => r.id);
  const [roleRows, siteRows] = await Promise.all([rolesOf(db, ids), sitesOf(db, ids)]);
  return records.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    isActive: r.isActive,
    mfaEnabled: r.mfaEnabled,
    roles: roleRows.filter((x) => x.userId === r.id).map((x) => x.code as RoleCode),
    sites: siteRows.filter((x) => x.userId === r.id).map((x) => ({ id: x.id, name: x.name })),
    version: r.version,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function validateRolesAndSites(
  db: Database,
  roleCodes: RoleCode[] | undefined,
  siteIds: string[] | undefined,
) {
  let roleIds: string[] | undefined;
  if (roleCodes) {
    const found = await roleIdsByCode(db, roleCodes);
    const missing = roleCodes.filter((c) => !found.some((f) => f.code === c));
    if (missing.length) {
      throw new AppError(422, 'UNKNOWN_ROLE', 'Rol inexistente', `No existe el rol: ${missing.join(', ')}.`);
    }
    roleIds = found.map((f) => f.id);
  }
  if (siteIds) {
    const found = await existingSiteIds(db, siteIds);
    if (found.length !== new Set(siteIds).size) {
      throw new AppError(
        422,
        'UNKNOWN_SITE',
        'Sede inexistente',
        'Alguna de las sedes no existe o está inactiva.',
      );
    }
  }
  return roleIds;
}

/** GET /me — contexto del usuario para la interfaz. */
export async function getMe(deps: UsersDeps, ctx: ExecutionContext): Promise<MeResponse> {
  const actor = requireActor(ctx);
  const siteRows = await sitesOf(deps.db, [actor.userId]);
  return {
    user: { id: actor.userId, fullName: actor.fullName, email: actor.email },
    roles: actor.roleCodes.map((code) => ({ code, name: ROLE_NAMES[code] })),
    sites: siteRows.map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
    permissions: Object.fromEntries(actor.permissions),
    mfa: { required: actor.mfaRequired, enabled: actor.mfaEnabled },
    homeShell: homeShell(actor.roleCodes),
  };
}

export async function listUsersUseCase(
  deps: UsersDeps,
  ctx: ExecutionContext,
  query: { q?: string | undefined; status: 'active' | 'inactive' | 'all' },
): Promise<UserSummary[]> {
  authorize(ctx, 'adm.user.read');
  return toSummaries(deps.db, await listUsers(deps.db, query));
}

export async function createUser(deps: UsersDeps, ctx: ExecutionContext, raw: unknown): Promise<UserSummary> {
  authorize(ctx, 'adm.user.create');
  const input = CreateUserRequest.parse(raw);
  const roleIds = await validateRolesAndSites(deps.db, input.roleCodes, input.siteIds);
  if (await emailInUse(deps.db, input.email)) {
    throw AppError.conflict('EMAIL_TAKEN', 'Correo en uso', 'Ya existe un usuario con ese correo.');
  }

  const authUserId = await deps.provisioner.createCredentialUser({
    name: input.fullName,
    email: input.email,
    password: input.temporaryPassword,
  });

  try {
    const id = await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ authUserId, fullName: input.fullName, email: input.email })
        .returning({ id: users.id });
      if (!row) throw new Error('No se pudo crear el usuario');
      await replaceRolesAndSites(tx, row.id, roleIds, input.siteIds);
      await recordAudit(tx, ctx, {
        action: 'adm.user.create',
        entityType: 'admin.user',
        entityId: row.id,
        after: {
          fullName: input.fullName,
          email: input.email,
          roles: input.roleCodes,
          siteIds: input.siteIds,
        },
      });
      return row.id;
    });
    const created = await findUserById(deps.db, id);
    if (!created) throw new Error('Usuario creado no encontrado');
    const [summary] = await toSummaries(deps.db, [created]);
    if (!summary) throw new Error('Usuario creado no encontrado');
    return summary;
  } catch (err) {
    await deps.provisioner.deleteAuthUser(authUserId);
    throw err;
  }
}

export async function updateUser(
  deps: UsersDeps,
  ctx: ExecutionContext,
  userId: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<UserSummary> {
  authorize(ctx, 'adm.user.update');
  const input = UpdateUserRequest.parse(raw);
  const roleIds = await validateRolesAndSites(deps.db, input.roleCodes, input.siteIds);

  await deps.db.transaction(async (tx) => {
    // Bloquea la fila para evitar ediciones simultáneas inconsistentes.
    const [locked] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    if (!locked) throw AppError.notFound();
    const before = await findUserById(tx, userId);
    if (!before) throw AppError.notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) {
      throw new AppError(
        412,
        'PRECONDITION_FAILED',
        'El usuario cambió',
        'Otra persona modificó este usuario. Recarga para ver la versión actual.',
      );
    }
    const beforeRoles = (await rolesOf(tx as Database, [userId])).map((r) => r.code as RoleCode);
    const beforeSites = (await sitesOf(tx as Database, [userId])).map((s) => s.id);
    if (input.roleCodes && before.isActive) {
      const admins = await activeAdminIds(tx);
      if (wouldRemoveLastAdmin(admins, userId, input.roleCodes.includes('ADM'))) throw lastAdminError();
    }
    await tx
      .update(users)
      .set({
        ...(input.fullName ? { fullName: input.fullName } : {}),
        version: sql`${users.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await replaceRolesAndSites(tx, userId, roleIds, input.siteIds);
    await recordAudit(tx, ctx, {
      action: 'adm.user.update',
      entityType: 'admin.user',
      entityId: userId,
      before: { fullName: before.fullName, roles: beforeRoles, siteIds: beforeSites },
      after: {
        fullName: input.fullName ?? before.fullName,
        roles: input.roleCodes ?? beforeRoles,
        siteIds: input.siteIds ?? beforeSites,
      },
    });
  });
  const updated = await findUserById(deps.db, userId);
  if (!updated) throw AppError.notFound();
  const [summary] = await toSummaries(deps.db, [updated]);
  if (!summary) throw AppError.notFound();
  return summary;
}

export async function setUserActive(
  deps: UsersDeps,
  ctx: ExecutionContext,
  userId: string,
  active: boolean,
): Promise<UserSummary> {
  const actor = authorize(ctx, 'adm.user.update');
  if (!active && actor.userId === userId) {
    throw AppError.conflict(
      'SELF_DEACTIVATION',
      'No puedes desactivarte',
      'Pide a otro administrador que desactive tu cuenta.',
    );
  }
  await deps.db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: users.id, isActive: users.isActive, authUserId: users.authUserId })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!locked) throw AppError.notFound();
    if (locked.isActive === active) return; // sin cambios
    if (!active) {
      const admins = await activeAdminIds(tx);
      if (wouldRemoveLastAdmin(admins, userId, false)) throw lastAdminError();
    }
    await tx
      .update(users)
      .set({ isActive: active, version: sql`${users.version} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));
    if (!active) await revokeSessions(tx, locked.authUserId);
    await recordAudit(tx, ctx, {
      action: active ? 'adm.user.reactivate' : 'adm.user.deactivate',
      entityType: 'admin.user',
      entityId: userId,
      before: { isActive: !active },
      after: { isActive: active },
    });
  });
  const updated = await findUserById(deps.db, userId);
  if (!updated) throw AppError.notFound();
  const [summary] = await toSummaries(deps.db, [updated]);
  if (!summary) throw AppError.notFound();
  return summary;
}

export async function listRoles(deps: UsersDeps, ctx: ExecutionContext): Promise<RoleView[]> {
  authorize(ctx, 'adm.user.read');
  const rows = await listRolesWithPermissions(deps.db);
  const byCode = new Map<string, RoleView>();
  for (const r of rows) {
    const view = byCode.get(r.code) ?? {
      code: r.code as RoleCode,
      name: r.name,
      requiresMfa: r.requiresMfa,
      permissions: [],
    };
    if (r.permission && r.scope) view.permissions.push({ code: r.permission, scope: r.scope });
    byCode.set(r.code, view);
  }
  return [...byCode.values()];
}

export async function listSitesUseCase(deps: UsersDeps, ctx: ExecutionContext): Promise<SiteView[]> {
  const filter = listFilter(ctx, 'adm.site.read');
  const rows = await listSites(deps.db, filter.kind === 'all' ? undefined : filter.siteIds);
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    locations: s.locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind })),
  }));
}
