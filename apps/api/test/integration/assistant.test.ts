import { randomUUID } from 'node:crypto';
import { inArray, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssistantRetentionService } from '../../src/addons/assistant/application/retention.js';
import { loadActor } from '../../src/modules/admin/application/public.js';
import { seedAdminCatalog, seedDemoSites } from '../../src/modules/admin/infrastructure/seed.js';
import {
  rolePermissions,
  roles,
  userRoles,
  userSites,
  users,
} from '../../src/modules/admin/infrastructure/schema.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { FakeAssistantProvider } from '../helpers/assistant-provider.js';
import { connectTestDb } from './db.js';

/** Entrega 8 — asistente con herramientas de lectura y escrituras preparadas (DEC-106). */
const ORIGIN = testEnv.APP_BASE_URL;
const PASSWORD = `demo-${randomUUID()}`;
const handle = connectTestDb();
const db = handle.db as unknown as Database;
const auth = createAuth(db, testEnv, { isBlocked: () => Promise.resolve(false) });
const provisioner = createAuthProvisioner(auth, db);
const provider = new FakeAssistantProvider();
const app = buildTestApp({
  auth,
  db,
  provisioner,
  idempotency: new PgIdempotencyStore(db),
  flags: { isEnabled: (key) => Promise.resolve(key === 'feature.assistant.writes') },
  assistantProvider: provider,
  resolveActor: (authUserId) => loadActor(db, authUserId),
  registerModules,
});

type Agent = ReturnType<typeof request.agent>;
const createdRoleIds: string[] = [];
let agent: Agent;
let siteId = '';

async function ensureRole(code: string, permissions: string[]): Promise<string> {
  const [role] = await db
    .insert(roles)
    .values({ code, name: code, isSystem: false, requiresMfa: false })
    .onConflictDoUpdate({ target: roles.code, set: { isSystem: false, requiresMfa: false } })
    .returning({ id: roles.id });
  if (!role) throw new Error('No se pudo crear el rol');
  createdRoleIds.push(role.id);
  await db.delete(rolePermissions).where(sql`${rolePermissions.roleId} = ${role.id}`);
  await db
    .insert(rolePermissions)
    .values(
      permissions.map((permissionCode) => ({ roleId: role.id, permissionCode, scope: 'ALL' as const })),
    );
  return role.id;
}

async function createUser(email: string, roleId: string): Promise<string> {
  const authUserId = await provisioner.createCredentialUser({ name: email, email, password: PASSWORD });
  const [row] = await db
    .insert(users)
    .values({ authUserId, fullName: email, email })
    .returning({ id: users.id });
  if (!row) throw new Error('No se pudo crear el usuario');
  await db.insert(userRoles).values({ userId: row.id, roleId });
  await db.insert(userSites).values({ userId: row.id, siteId });
  return row.id;
}

async function signIn(email: string): Promise<Agent> {
  const client = request.agent(app);
  const res = await client
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGIN)
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return client;
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('La condición no se cumplió a tiempo');
}

async function createTicket(text: string): Promise<string> {
  const res = await agent
    .post('/api/v1/assistant/tickets')
    .set('Idempotency-Key', randomUUID())
    .send({ requestText: text });
  expect(res.status).toBe(201);
  return (res.body as { data: { id: string } }).data.id;
}

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);
  await seedDemoSites(db);
  const site = await db.execute(sql`select id from admin.sites where name = 'Bodega principal' limit 1`);
  siteId = (site.rows[0] as { id: string }).id;
  const roleId = await ensureRole('AI_TEST', [
    'ia.query',
    'ia.usage.read',
    'adm.addon.toggle',
    'inv.stock.read',
    'cat.raw_material.manage',
    'cat.product.read',
    'cat.raw_material.read',
    'prod.recipe.manage',
  ]);
  await createUser('assistant@test.example', roleId);
  await db.execute(sql`
    update platform.addon_settings set is_enabled = true, settings = '{}'::jsonb where addon = 'assistant'
  `);
  agent = await signIn('assistant@test.example');
});

afterAll(async () => {
  if (createdRoleIds.length) {
    await db.delete(userRoles).where(inArray(userRoles.roleId, createdRoleIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
  }
  await handle.close();
});

describe('asistente de IA (DEC-106)', () => {
  it('expone estado y configuración al usuario autorizado', async () => {
    const status = await agent.get('/api/v1/assistant/status');
    expect(status.status).toBe(200);
    expect((status.body as { data: { enabled: boolean } }).data.enabled).toBe(true);

    const settings = await agent.get('/api/v1/assistant/settings');
    expect(settings.status).toBe(200);
    const data = (settings.body as { data: { enabled: boolean; settings: { dailyCapCents: number } } }).data;
    expect(data.enabled).toBe(true);
    expect(data.settings.dailyCapCents).toBe(300);
  });

  it('responde una consulta de lectura con una herramienta', async () => {
    provider.setMode('read');
    const ticketId = await createTicket('¿Cuánto chorizo hay?');
    const res = await agent
      .post(`/api/v1/assistant/tickets/${ticketId}/messages`)
      .set('Idempotency-Key', randomUUID())
      .send({ text: '¿Cuánto chorizo hay?' });
    expect(res.status).toBe(202);

    await waitFor(async () => {
      const ticket = await db.execute(sql`
        select status from assistant.tickets where id = ${ticketId}
      `);
      return (ticket.rows[0] as { status: string } | undefined)?.status === 'closed';
    });
    const calls = await db.execute(sql`
      select tool_name as "toolName", status from assistant.tool_calls where ticket_id = ${ticketId}
    `);
    expect(calls.rows).toEqual([{ toolName: 'inventory_get_availability', status: 'succeeded' }]);

    const tickets = await agent.get('/api/v1/assistant/tickets');
    expect(tickets.status).toBe(200);
    const ticket = (tickets.body as { data: { id: string; resolutionSummary: string }[] }).data.find(
      (row) => row.id === ticketId,
    );
    expect(ticket?.resolutionSummary).toContain('inventory_get_availability');
  });

  it('prepara una materia prima y la ejecuta solo al confirmar', async () => {
    provider.setMode('write');
    const ticketId = await createTicket('Crea la materia prima Tocino ahumado');
    const res = await agent
      .post(`/api/v1/assistant/tickets/${ticketId}/messages`)
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Crea la materia prima Tocino ahumado' });
    expect(res.status).toBe(202);

    let proposalId = '';
    await waitFor(async () => {
      const proposal = await db.execute(sql`
        select id from assistant.proposals where ticket_id = ${ticketId} limit 1
      `);
      proposalId = (proposal.rows[0] as { id: string } | undefined)?.id ?? '';
      return proposalId !== '';
    });

    const confirmed = await agent.post(`/api/v1/assistant/proposals/${proposalId}/confirm`).send({});
    expect(confirmed.status).toBe(200);
    const data = confirmed.body as { data: { status: string; entityId: string; summary: string } };
    expect(data.data.status).toBe('executed');
    expect(data.data.summary).toContain('Tocino ahumado');

    const material = await db.execute(sql`
      select name from catalog.raw_materials where name = 'Tocino ahumado' limit 1
    `);
    expect(material.rows).toHaveLength(1);

    const repeated = await agent.post(`/api/v1/assistant/proposals/${proposalId}/confirm`).send({});
    expect(repeated.status).toBe(200);
    expect((repeated.body as { data: { summary: string } }).data.summary).toContain('ya fue ejecutada');
  });

  it('rechaza una herramienta fuera de la lista blanca', async () => {
    provider.setMode('blocked');
    const ticketId = await createTicket('Registra un pago');
    const res = await agent
      .post(`/api/v1/assistant/tickets/${ticketId}/messages`)
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Registra un pago' });
    expect(res.status).toBe(202);

    await waitFor(async () => {
      const ticket = await db.execute(sql`
        select result_status as "resultStatus" from assistant.tickets where id = ${ticketId}
      `);
      return (ticket.rows[0] as { resultStatus: string } | undefined)?.resultStatus === 'failed';
    });
    const proposals = await db.execute(sql`
      select count(*)::int as total from assistant.proposals where ticket_id = ${ticketId}
    `);
    expect((proposals.rows[0] as { total: number }).total).toBe(0);
  });

  it('expone el consumo al permiso ia.usage.read', async () => {
    const usage = await agent.get('/api/v1/assistant/usage?limit=20');
    expect(usage.status).toBe(200);
    const data = usage.body as {
      data: { totals: { requests: number; listCostCents: number }; data: unknown[] };
    };
    expect(data.data.totals.requests).toBeGreaterThan(0);
    expect(data.data.totals.listCostCents).toBeGreaterThanOrEqual(0);
  });

  it('archiva a las 24 h y borra la sesión a los 30 días (Q-IA-05)', async () => {
    const ticket = await db.execute(sql`
      select id, anthropic_session_id as "sessionId" from assistant.tickets
      where anthropic_session_id is not null order by started_at asc limit 1
    `);
    const row = ticket.rows[0] as { id: string; sessionId: string } | undefined;
    expect(row).toBeDefined();
    await db.execute(sql`
      update assistant.tickets set status = 'closed', last_activity_at = now() - interval '25 hours'
      where id = ${row?.id}
    `);
    const service = new AssistantRetentionService(db, provider);
    const archived = await service.run();
    expect(archived.archived).toBeGreaterThan(0);
    expect(provider.archived).toContain(row?.sessionId);
    const archivedRow = await db.execute(sql`
      select status, archived_at as "archivedAt" from assistant.tickets where id = ${row?.id}
    `);
    expect((archivedRow.rows[0] as { status: string }).status).toBe('archived');
    expect((archivedRow.rows[0] as { archivedAt: Date | null }).archivedAt).not.toBeNull();

    await db.execute(sql`
      update assistant.tickets set archived_at = now() - interval '31 days' where id = ${row?.id}
    `);
    const deleted = await service.run();
    expect(deleted.deleted).toBeGreaterThan(0);
    expect(provider.deleted).toContain(row?.sessionId);
    const deletedRow = await db.execute(sql`
      select status, anthropic_session_id as "sessionId" from assistant.tickets where id = ${row?.id}
    `);
    expect((deletedRow.rows[0] as { status: string }).status).toBe('terminated');
    expect((deletedRow.rows[0] as { sessionId: string | null }).sessionId).toBeNull();
  });

  it('oculta las rutas cuando el complemento está apagado', async () => {
    await db.execute(sql`
      update platform.addon_settings set is_enabled = false where addon = 'assistant'
    `);
    const res = await agent.get('/api/v1/assistant/tickets');
    expect(res.status).toBe(404);
    await db.execute(sql`
      update platform.addon_settings set is_enabled = true where addon = 'assistant'
    `);
  });
});
