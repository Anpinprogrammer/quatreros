import { z } from 'zod';

/**
 * Contratos del módulo de administración (especificación adm/acceso-usuarios).
 */

export const RoleCode = z.enum(['ADM', 'MGR', 'COMP', 'PROD', 'DIST', 'CAJ', 'CONT']);
export type RoleCode = z.infer<typeof RoleCode>;

export const ROLE_NAMES: Record<RoleCode, string> = {
  ADM: 'Administrador',
  MGR: 'Manager',
  COMP: 'Comprador',
  PROD: 'Productor',
  DIST: 'Distribuidor',
  CAJ: 'Cajero',
  CONT: 'Contador',
};

/** Alcance de un permiso (actors-permissions §1.1). */
export const Scope = z.enum(['ALL', 'SITE', 'OWN']);
export type Scope = z.infer<typeof Scope>;

export const Shell = z.enum(['erp', 'pos', 'ruta']);
export type Shell = z.infer<typeof Shell>;

export const SiteKind = z.enum(['warehouse', 'point_of_sale']);

export const LocationView = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.string(),
});

export const SiteView = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: SiteKind,
  locations: z.array(LocationView),
});
export type SiteView = z.infer<typeof SiteView>;

export const MeResponse = z.object({
  user: z.object({ id: z.uuid(), fullName: z.string(), email: z.email() }),
  roles: z.array(z.object({ code: RoleCode, name: z.string() })),
  sites: z.array(z.object({ id: z.uuid(), name: z.string(), kind: SiteKind })),
  permissions: z.record(z.string(), Scope),
  mfa: z.object({ required: z.boolean(), enabled: z.boolean() }),
  homeShell: Shell,
});
export type MeResponse = z.infer<typeof MeResponse>;

export const UserSummary = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  isActive: z.boolean(),
  mfaEnabled: z.boolean(),
  roles: z.array(RoleCode),
  sites: z.array(z.object({ id: z.uuid(), name: z.string() })),
  version: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type UserSummary = z.infer<typeof UserSummary>;

const FullName = z.string().trim().min(2, 'Escribe el nombre completo').max(120);

export const CreateUserRequest = z.object({
  fullName: FullName,
  email: z.email('Correo inválido').transform((v) => v.toLowerCase()),
  temporaryPassword: z
    .string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres')
    .max(128, 'Máximo 128 caracteres'),
  roleCodes: z.array(RoleCode).min(1, 'Asigna al menos un rol'),
  siteIds: z.array(z.uuid()).default([]),
});
export type CreateUserRequest = z.input<typeof CreateUserRequest>;

export const UpdateUserRequest = z
  .object({
    fullName: FullName.optional(),
    roleCodes: z.array(RoleCode).min(1, 'Asigna al menos un rol').optional(),
    siteIds: z.array(z.uuid()).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'No hay cambios para guardar');
export type UpdateUserRequest = z.input<typeof UpdateUserRequest>;

export const UserListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

export const RoleView = z.object({
  code: RoleCode,
  name: z.string(),
  requiresMfa: z.boolean(),
  permissions: z.array(z.object({ code: z.string(), scope: Scope })),
});
export type RoleView = z.infer<typeof RoleView>;
