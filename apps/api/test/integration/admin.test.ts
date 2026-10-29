import { randomUUID } from 'node:crypto';
import type { MeResponse, UserSummary } from '@quatreros/contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isAuthUserBlocked, loadActor } from '../../src/modules/admin/application/public.js';
import {
  seedAdminCatalog,
  seedDemoSites,
  seedDemoUsers,
} from '../../src/modules/admin/infrastructure/seed.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { auditLog } from '../../src/platform/db/schema/platform.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';
import { totpFromUri } from './totp.js';

/**
 * Criterios de aceptación de la especificación adm/acceso-usuarios §7, contra PostgreSQL real.
 */
const ORIGIN = testEnv.APP_BASE_URL;
const PASSWORD = `demo-${randomUUID()}`;
const handle = connectTestDb();
const db = handle.db as unknown as Database;
const auth = createAuth(db, testEnv, { isBlocked: (id) => isAuthUserBlocked(db, id) });
const provisioner = createAuthProvisioner(auth, db);
const app = buildTestApp({
  auth,
  db,
  provisioner,
  idempotency: new PgIdempotencyStore(db),
  resolveActor: (authUserId) => loadActor(db, authUserId),
  registerModules,
});

type Agent = ReturnType<typeof request.agent>;

async function signIn(
  email: string,
  password = PASSWORD,
): Promise<{ agent: Agent; body: Record<string, unknown> }> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password });
  return { agent, body: res.body as Record<string, unknown> };
}

let adminAgent: Agent;
let adminTotpUri: string;

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);
  const sites = await seedDemoSites(db);
  const created = await seedDemoUsers(db, provisioner, PASSWORD, sites);
  if (created.length === 0) {
    throw new Error(
      'La base de pruebas ya tiene los usuarios demo de otra ejecución: usa una base vacía (TEST_DATABASE_URL) o TEST_DB=pglite.',
    );
  }
});
afterAll(async () => {
  await handle.close();
});

describe('ingreso (RF-001)', () => {
  it('cajero entra a Caja y solo ve su sede', async () => {
    const { agent } = await signIn('caja@quatreros.example');
    const res = await agent.get('/api/v1/me');
    expect(res.status).toBe(200);
    const me = res.body as MeResponse;
    expect(me.roles.map((r) => r.code)).toEqual(['CAJ']);
    expect(me.sites.map((s) => s.name)).toEqual(['Punto de asados']);
    expect(me.homeShell).toBe('pos');
    expect(me.mfa).toEqual({ required: false, enabled: false });
    expect(me.permissions['pos.sale.create']).toBe('OWN');
  });

  it('contraseña incorrecta no crea sesión', async () => {
    const { agent } = await signIn('caja@quatreros.example', 'clave-equivocada-123');
    expect((await agent.get('/api/v1/me')).status).toBe(401);
  });

  it('sin sesión → 401', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe('UNAUTHENTICATED');
  });

  it('cajero no puede consultar usuarios → 403', async () => {
    const { agent } = await signIn('caja@quatreros.example');
    const res = await agent.get('/api/v1/admin/users');
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe('FORBIDDEN');
  });
});

describe('segundo factor obligatorio (DEC-043)', () => {
  it('administrador sin segundo factor: solo /me, el resto 403 MFA_SETUP_REQUIRED', async () => {
    const { agent } = await signIn('admin@quatreros.example');
    adminAgent = agent;
    const me = (await agent.get('/api/v1/me')).body as MeResponse;
    expect(me.mfa).toEqual({ required: true, enabled: false });
    const res = await agent.get('/api/v1/admin/users');
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe('MFA_SETUP_REQUIRED');
  });

  it('activa TOTP con su contraseña y el primer código; luego accede', async () => {
    const enable = await adminAgent
      .post('/api/auth/two-factor/enable')
      .set('Origin', ORIGIN)
      .send({ password: PASSWORD, method: 'totp' });
    expect(enable.status).toBe(200);
    adminTotpUri = (enable.body as { totpURI: string }).totpURI;
    expect(adminTotpUri).toMatch(/^otpauth:\/\/totp\//);

    const verify = await adminAgent
      .post('/api/auth/two-factor/verify-totp')
      .set('Origin', ORIGIN)
      .send({ code: totpFromUri(adminTotpUri) });
    expect(verify.status).toBe(200);

    const me = (await adminAgent.get('/api/v1/me')).body as MeResponse;
    expect(me.mfa.enabled).toBe(true);
    expect((await adminAgent.get('/api/v1/admin/users')).status).toBe(200);
  });

  it('un nuevo ingreso del administrador exige el código antes de crear la sesión', async () => {
    const { agent, body } = await signIn('admin@quatreros.example');
    expect(body.twoFactorRedirect).toBe(true);
    expect((await agent.get('/api/v1/me')).status).toBe(401);
    const verify = await agent
      .post('/api/auth/two-factor/verify-totp')
      .set('Origin', ORIGIN)
      .send({ code: totpFromUri(adminTotpUri) });
    expect(verify.status).toBe(200);
    expect((await agent.get('/api/v1/me')).status).toBe(200);
  });
});

describe('gestión de usuarios (RF-003)', () => {
  let sites: { id: string; name: string }[] = [];
  let juan: UserSummary;

  it('lista sedes con sus ubicaciones', async () => {
    const res = await adminAgent.get('/api/v1/admin/sites');
    expect(res.status).toBe(200);
    sites = (res.body as { data: { id: string; name: string; locations: unknown[] }[] }).data;
    expect(sites.map((s) => s.name)).toEqual(['Bodega principal', 'Punto de asados']);
  });

  it('crea un repartidor; reintento con la misma clave no duplica; queda auditado', async () => {
    const bodega = sites.find((s) => s.name === 'Bodega principal');
    const key = randomUUID();
    const body = {
      fullName: 'Juan Repartidor',
      email: 'Juan@Quatreros.Example',
      temporaryPassword: PASSWORD,
      roleCodes: ['DIST'],
      siteIds: [bodega?.id],
    };
    const first = await adminAgent
      .post('/api/v1/admin/users')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    juan = (first.body as { data: UserSummary }).data;
    expect(juan.email).toBe('juan@quatreros.example');
    expect(juan.roles).toEqual(['DIST']);

    await new Promise((r) => setTimeout(r, 100));
    const again = await adminAgent
      .post('/api/v1/admin/users')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', key)
      .send(body);
    expect(again.status).toBe(201);
    expect((again.body as { data: UserSummary }).data.id).toBe(juan.id);
    expect(again.headers['idempotent-replayed']).toBe('true');

    const audit = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, 'adm.user.create'), eq(auditLog.entityId, juan.id)));
    expect(audit).toHaveLength(1);
  });

  it('el nuevo usuario ingresa y queda en el portal de Ruta', async () => {
    const { agent } = await signIn('juan@quatreros.example');
    const me = (await agent.get('/api/v1/me')).body as MeResponse;
    expect(me.homeShell).toBe('ruta');
  });

  it('correo repetido → 409 EMAIL_TAKEN', async () => {
    const res = await adminAgent
      .post('/api/v1/admin/users')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Otro',
        email: 'caja@quatreros.example',
        temporaryPassword: PASSWORD,
        roleCodes: ['CAJ'],
      });
    expect(res.status).toBe(409);
    expect((res.body as { code: string }).code).toBe('EMAIL_TAKEN');
  });

  it('sede inexistente → 422 UNKNOWN_SITE; datos inválidos → 422 VALIDATION_FAILED', async () => {
    const bad = await adminAgent
      .post('/api/v1/admin/users')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Ana',
        email: 'ana2@quatreros.example',
        temporaryPassword: PASSWORD,
        roleCodes: ['CAJ'],
        siteIds: [randomUUID()],
      });
    expect((bad.body as { code: string }).code).toBe('UNKNOWN_SITE');
    const invalid = await adminAgent
      .post('/api/v1/admin/users')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', randomUUID())
      .send({ fullName: 'A', email: 'no-es-correo', temporaryPassword: 'corta', roleCodes: [] });
    expect(invalid.status).toBe(422);
    expect((invalid.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });

  it('edición con versión vieja → 412; con versión correcta cambia roles y audita', async () => {
    const stale = await adminAgent
      .patch(`/api/v1/admin/users/${juan.id}`)
      .set('Origin', ORIGIN)
      .set('If-Match', `"v${String(juan.version + 5)}"`)
      .send({ fullName: 'Juan Pérez' });
    expect(stale.status).toBe(412);
    const ok = await adminAgent
      .patch(`/api/v1/admin/users/${juan.id}`)
      .set('Origin', ORIGIN)
      .set('If-Match', `"v${String(juan.version)}"`)
      .send({ fullName: 'Juan Pérez', roleCodes: ['DIST', 'CAJ'] });
    expect(ok.status).toBe(200);
    juan = (ok.body as { data: UserSummary }).data;
    expect(juan.roles.sort()).toEqual(['CAJ', 'DIST']);
    expect(juan.version).toBe(2);
  });

  it('desactivar cierra sus sesiones y le impide volver a ingresar', async () => {
    const { agent } = await signIn('juan@quatreros.example');
    expect((await agent.get('/api/v1/me')).status).toBe(200);
    const res = await adminAgent.post(`/api/v1/admin/users/${juan.id}/deactivate`).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect((res.body as { data: UserSummary }).data.isActive).toBe(false);
    expect((await agent.get('/api/v1/me')).status).toBe(401);
    const retry = await signIn('juan@quatreros.example');
    expect((await retry.agent.get('/api/v1/me')).status).toBe(401);

    const back = await adminAgent.post(`/api/v1/admin/users/${juan.id}/reactivate`).set('Origin', ORIGIN);
    expect((back.body as { data: UserSummary }).data.isActive).toBe(true);
  });

  it('el único administrador no puede quitarse el rol ni desactivarse', async () => {
    const me = (await adminAgent.get('/api/v1/me')).body as MeResponse;
    const removeRole = await adminAgent
      .patch(`/api/v1/admin/users/${me.user.id}`)
      .set('Origin', ORIGIN)
      .send({ roleCodes: ['MGR'] });
    expect(removeRole.status).toBe(409);
    expect((removeRole.body as { code: string }).code).toBe('LAST_ADMIN');
    const self = await adminAgent.post(`/api/v1/admin/users/${me.user.id}/deactivate`).set('Origin', ORIGIN);
    expect((self.body as { code: string }).code).toBe('SELF_DEACTIVATION');
  });

  it('petición desde otro origen → 403', async () => {
    const res = await adminAgent
      .post(`/api/v1/admin/users/${juan.id}/deactivate`)
      .set('Origin', 'https://sitio-malicioso.example');
    expect(res.status).toBe(403);
  });

  it('roles con sus permisos y alcances', async () => {
    const res = await adminAgent.get('/api/v1/admin/roles');
    const roles = (res.body as { data: { code: string; requiresMfa: boolean }[] }).data;
    expect(roles.map((r) => r.code).sort()).toEqual(['ADM', 'CAJ', 'COMP', 'CONT', 'DIST', 'MGR', 'PROD']);
  });
});
