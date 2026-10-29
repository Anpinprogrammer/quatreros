import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { user as authUser } from '../../../platform/db/schema/auth.js';

/**
 * Esquema `admin` (database-design §2, especificación adm/acceso-usuarios §3).
 * La identidad de autenticación vive en `auth.user`; aquí está la identidad de negocio.
 */
export const adminSchema = pgSchema('admin');

export const sites = adminSchema.table(
  'sites',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    kind: text({ enum: ['warehouse', 'point_of_sale'] }).notNull(),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('sites_kind_chk', sql`${t.kind} IN ('warehouse','point_of_sale')`)],
);

export const LOCATION_KINDS = [
  'warehouse',
  'pos_goods',
  'kitchen',
  'in_transit',
  'in_route',
  'in_inspection',
  'production',
] as const;

export const locations = adminSchema.table(
  'locations',
  {
    id: uuid().primaryKey().defaultRandom(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    name: text().notNull(),
    kind: text({ enum: LOCATION_KINDS }).notNull(),
    isActive: boolean().notNull().default(true),
  },
  (t) => [
    unique('locations_site_name_uq').on(t.siteId, t.name),
    check(
      'locations_kind_chk',
      sql`${t.kind} IN ('warehouse','pos_goods','kitchen','in_transit','in_route','in_inspection','production')`,
    ),
  ],
);

export const users = adminSchema.table(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    authUserId: text()
      .notNull()
      .unique()
      .references(() => authUser.id),
    fullName: text().notNull(),
    email: text().notNull().unique(),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('users_version_chk', sql`${t.version} > 0`)],
);

export const roles = adminSchema.table('roles', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  isSystem: boolean().notNull().default(false),
  requiresMfa: boolean().notNull().default(false),
  isActive: boolean().notNull().default(true),
});

export const permissions = adminSchema.table('permissions', {
  code: text().primaryKey(),
  description: text().notNull(),
});

export const rolePermissions = adminSchema.table(
  'role_permissions',
  {
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    permissionCode: text()
      .notNull()
      .references(() => permissions.code),
    scope: text({ enum: ['ALL', 'SITE', 'OWN'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionCode] }),
    check('role_permissions_scope_chk', sql`${t.scope} IN ('ALL','SITE','OWN')`),
  ],
);

export const userRoles = adminSchema.table(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_role_idx').on(t.roleId)],
);

export const userSites = adminSchema.table(
  'user_sites',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.siteId] }), index('user_sites_site_idx').on(t.siteId)],
);
