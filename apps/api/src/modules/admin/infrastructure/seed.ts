import type { RoleCode } from '@quatreros/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
import type { AuthProvisioner } from '../../../platform/auth/provisioner.js';
import type { Database } from '../../../platform/db/client.js';
import { PERMISSIONS, ROLES } from '../domain/permission-catalog.js';
import { emailInUse } from './repository.js';
import {
  locations,
  permissions,
  rolePermissions,
  roles,
  sites,
  userRoles,
  userSites,
  users,
} from './schema.js';

/**
 * Catálogo de permisos y roles predefinidos (matriz PROVISIONAL, DEC-083).
 * Idempotente: actualiza nombres y reemplaza los permisos de los roles del sistema.
 */
export async function seedAdminCatalog(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(permissions)
      .values(Object.entries(PERMISSIONS).map(([code, description]) => ({ code, description })))
      .onConflictDoUpdate({ target: permissions.code, set: { description: sql`excluded.description` } });

    for (const role of ROLES) {
      const [row] = await tx
        .insert(roles)
        .values({ code: role.code, name: role.name, requiresMfa: role.requiresMfa, isSystem: true })
        .onConflictDoUpdate({
          target: roles.code,
          set: { name: role.name, requiresMfa: role.requiresMfa, isSystem: true },
        })
        .returning({ id: roles.id });
      if (!row) throw new Error(`No se pudo sembrar el rol ${role.code}`);
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id));
      const grants = Object.entries(role.grants);
      if (grants.length) {
        await tx
          .insert(rolePermissions)
          .values(grants.map(([permissionCode, scope]) => ({ roleId: row.id, permissionCode, scope })));
      }
    }
  });
}

export const DEMO_SITES = [
  {
    name: 'Bodega principal',
    kind: 'warehouse' as const,
    locations: [
      { name: 'Principal', kind: 'warehouse' as const },
      { name: 'Producción', kind: 'production' as const },
      { name: 'En tránsito', kind: 'in_transit' as const },
      { name: 'En ruta', kind: 'in_route' as const },
      { name: 'En inspección', kind: 'in_inspection' as const },
    ],
  },
  {
    name: 'Punto de asados',
    kind: 'point_of_sale' as const,
    locations: [
      { name: 'Productos del punto', kind: 'pos_goods' as const },
      { name: 'Cocina', kind: 'kitchen' as const },
    ],
  },
];

export const DEMO_USERS: { fullName: string; email: string; role: RoleCode; sites: string[] }[] = [
  {
    fullName: 'Ana Administradora',
    email: 'admin@quatreros.example',
    role: 'ADM',
    sites: ['Bodega principal', 'Punto de asados'],
  },
  {
    fullName: 'Mario Manager',
    email: 'manager@quatreros.example',
    role: 'MGR',
    sites: ['Bodega principal', 'Punto de asados'],
  },
  {
    fullName: 'Carla Compras',
    email: 'compras@quatreros.example',
    role: 'COMP',
    sites: ['Bodega principal'],
  },
  {
    fullName: 'Pedro Producción',
    email: 'produccion@quatreros.example',
    role: 'PROD',
    sites: ['Bodega principal'],
  },
  {
    fullName: 'Diego Reparto',
    email: 'reparto@quatreros.example',
    role: 'DIST',
    sites: ['Bodega principal'],
  },
  { fullName: 'Camila Caja', email: 'caja@quatreros.example', role: 'CAJ', sites: ['Punto de asados'] },
  {
    fullName: 'Clara Contadora',
    email: 'contabilidad@quatreros.example',
    role: 'CONT',
    sites: ['Bodega principal', 'Punto de asados'],
  },
];

/** Sedes y ubicaciones de demostración (especificación adm §9). Idempotente. */
export async function seedDemoSites(db: Database): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const site of DEMO_SITES) {
    const [row] = await db
      .insert(sites)
      .values({ name: site.name, kind: site.kind })
      .onConflictDoUpdate({ target: sites.name, set: { kind: site.kind } })
      .returning({ id: sites.id });
    if (!row) throw new Error(`No se pudo sembrar la sede ${site.name}`);
    ids.set(site.name, row.id);
    await db
      .insert(locations)
      .values(site.locations.map((l) => ({ siteId: row.id, name: l.name, kind: l.kind })))
      .onConflictDoNothing();
  }
  return ids;
}

/** Usuarios de demostración, uno por rol. No modifica los que ya existen. */
export async function seedDemoUsers(
  db: Database,
  provisioner: AuthProvisioner,
  password: string,
  siteIds: Map<string, string>,
): Promise<string[]> {
  const created: string[] = [];
  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(
      inArray(
        roles.code,
        DEMO_USERS.map((u) => u.role),
      ),
    );
  for (const demo of DEMO_USERS) {
    if (await emailInUse(db, demo.email)) continue;
    const roleId = roleRows.find((r) => r.code === demo.role)?.id;
    if (!roleId) throw new Error(`Falta el rol ${demo.role}: ejecuta primero la semilla del catálogo`);
    const authUserId = await provisioner.createCredentialUser({
      name: demo.fullName,
      email: demo.email,
      password,
    });
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ authUserId, fullName: demo.fullName, email: demo.email })
        .returning({ id: users.id });
      if (!row) throw new Error('No se pudo crear el usuario demo');
      await tx.insert(userRoles).values({ userId: row.id, roleId });
      const userSiteIds = demo.sites.map((name) => siteIds.get(name)).filter((x): x is string => Boolean(x));
      if (userSiteIds.length)
        await tx.insert(userSites).values(userSiteIds.map((siteId) => ({ userId: row.id, siteId })));
    });
    created.push(demo.email);
  }
  return created;
}
