import { randomUUID } from 'node:crypto';
import { inArray, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadActor } from '../../src/modules/admin/application/public.js';
import { seedAdminCatalog, seedDemoSites } from '../../src/modules/admin/infrastructure/seed.js';
import {
  rolePermissions,
  roles,
  userRoles,
  userSites,
  users,
} from '../../src/modules/admin/infrastructure/schema.js';
import { seedDemoFinance } from '../../src/modules/finance/infrastructure/seed.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';

/** Entrega 7 — cartera, abonos, conciliación y hechos económicos contra PostgreSQL real. */
const ORIGIN = testEnv.APP_BASE_URL;
const PASSWORD = `demo-${randomUUID()}`;
const handle = connectTestDb();
const db = handle.db as unknown as Database;
const auth = createAuth(db, testEnv, { isBlocked: () => Promise.resolve(false) });
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
const createdRoleIds: string[] = [];
let manager: Agent;
let siteId = '';
let customerId = '';
const saleKey = randomUUID();

async function ensureRole(code: string, permissionCodes: string[], scope: 'ALL' | 'SITE'): Promise<string> {
  const [role] = await db
    .insert(roles)
    .values({ code, name: code, isSystem: false, requiresMfa: false })
    .onConflictDoUpdate({ target: roles.code, set: { isSystem: false, requiresMfa: false } })
    .returning({ id: roles.id });
  if (!role) throw new Error(`No se pudo crear el rol ${code}`);
  createdRoleIds.push(role.id);
  await db.delete(rolePermissions).where(sql`${rolePermissions.roleId} = ${role.id}`);
  await db
    .insert(rolePermissions)
    .values(permissionCodes.map((permissionCode) => ({ roleId: role.id, permissionCode, scope })));
  return role.id;
}

async function createUser(email: string, roleId: string, site: string): Promise<string> {
  const authUserId = await provisioner.createCredentialUser({ name: email, email, password: PASSWORD });
  const [row] = await db
    .insert(users)
    .values({ authUserId, fullName: email, email })
    .returning({ id: users.id });
  if (!row) throw new Error('No se pudo crear el usuario de prueba');
  await db.insert(userRoles).values({ userId: row.id, roleId });
  await db.insert(userSites).values({ userId: row.id, siteId: site });
  return row.id;
}

async function ensureSeedUser(email: string, roleId: string, site: string): Promise<string> {
  const existing = await db.execute(sql`select id from admin.users where email = ${email} limit 1`);
  const row = (existing.rows as unknown as { id: string }[])[0];
  if (row) return row.id;
  return createUser(email, roleId, site);
}

async function signIn(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGIN)
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);
  await seedDemoSites(db);

  const siteResult = await db.execute(sql`
    select id from admin.sites where name = 'Bodega principal' limit 1
  `);
  siteId = (siteResult.rows[0] as { id: string }).id;

  const managerRole = await ensureRole(
    'FIN_TEST_MANAGER',
    [
      'fin.receivable.read',
      'fin.receivable_payment.create',
      'fin.reconciliation.manage',
      'rep.operational.read',
      'cont.report.read',
    ],
    'ALL',
  );
  const driverRole = await ensureRole('FIN_TEST_DRIVER', ['fin.receivable.read'], 'ALL');
  const managerId = await createUser('manager-fin@test.example', managerRole, siteId);
  await createUser('driver-fin@test.example', driverRole, siteId);

  // El seed de cartera busca estos correos para los recaudos demo.
  await ensureSeedUser('manager@quatreros.example', managerRole, siteId);
  await ensureSeedUser('reparto@quatreros.example', driverRole, siteId);

  const customerResult = await db.execute(sql`
    insert into sales.customers (kind, name, tax_id, phone, delivery_address)
    values
      ('restaurant', 'Restaurante La Brasa', '901111222-3', '310 555 0101', 'Av. 6N # 23-45'),
      ('business', 'Tienda Doña Rosa', '901333444-5', '315 555 0202', 'Calle 45 # 12-30')
    on conflict (tax_id) do nothing
    returning id, name
  `);
  const rows = customerResult.rows as unknown as { id: string; name: string }[];
  customerId = rows.find((row) => row.name === 'Restaurante La Brasa')?.id ?? '';
  if (!customerId) {
    const existing = await db.execute(sql`
      select id from sales.customers where name = 'Restaurante La Brasa' limit 1
    `);
    customerId = (existing.rows[0] as { id: string }).id;
  }

  await seedDemoFinance(db, managerId);
  manager = await signIn('manager-fin@test.example');
});

afterAll(async () => {
  if (createdRoleIds.length) {
    await db.delete(userRoles).where(inArray(userRoles.roleId, createdRoleIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
  }
  await handle.close();
});

describe('cartera, recaudos y conciliación (RF-262..265)', () => {
  it('devuelve cartera con antigüedad y los clientes de la semilla', async () => {
    const res = await manager.get('/api/v1/finance/receivables/aging');
    expect(res.status).toBe(200);
    const data = (
      res.body as {
        data: {
          totals: { open: string; buckets: Record<string, string> };
          customers: {
            customerId: string;
            customerName: string;
            total: string;
            buckets: Record<string, string>;
          }[];
        };
      }
    ).data;
    expect(Number(data.totals.open)).toBeGreaterThan(0);
    // La base compartida puede tener obligaciones de otras pruebas: se verifica la semilla,
    // no la cantidad exacta de clientes.
    const names = data.customers.map((customer) => customer.customerName);
    expect(names).toContain('Restaurante La Brasa');
    expect(names).toContain('Tienda Doña Rosa');

    // El filtro por cliente sí es determinista.
    const filtered = await manager.get(`/api/v1/finance/receivables/aging?customerId=${customerId}`);
    expect(filtered.status).toBe(200);
    const single = (filtered.body as { data: { customers: unknown[] } }).data.customers;
    expect(single).toHaveLength(1);

    const bucketTotal = Object.values(data.totals.buckets).reduce((sum, amount) => sum + Number(amount), 0);
    expect(bucketTotal).toBeCloseTo(Number(data.totals.open), 2);
  });

  it('lista los recaudos demo y su estado', async () => {
    const res = await manager.get('/api/v1/finance/collections');
    expect(res.status).toBe(200);
    const data = (res.body as { data: { number: string; status: string }[] }).data;
    expect(data).toHaveLength(3);
    expect(data.find((row) => row.number === 'RC-0003')?.status).toBe('reconciled_with_variance');
  });

  it('registra un abono FIFO y es idempotente', async () => {
    const payload = {
      customerId,
      siteId,
      amount: '10000.00',
    };
    const methodId = (
      await db.execute(sql`select id from finance.payment_methods where name = 'Efectivo' limit 1`)
    ).rows[0] as { id: string };
    const res = await manager
      .post('/api/v1/finance/collections')
      .set('Idempotency-Key', saleKey)
      .send({ ...payload, paymentMethodId: methodId.id });
    expect(res.status).toBe(201);
    const data = (res.body as { data: { number: string; allocatedAmount: string } }).data;
    expect(data.number).toMatch(/^RC-\d{4}$/);
    expect(data.allocatedAmount).toBe('10000.00');

    const replay = await manager
      .post('/api/v1/finance/collections')
      .set('Idempotency-Key', saleKey)
      .send({ ...payload, paymentMethodId: methodId.id });
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');

    const over = await manager
      .post('/api/v1/finance/collections')
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, paymentMethodId: methodId.id, amount: '9999999.00' });
    expect(over.status).toBe(409);
    expect((over.body as { code: string }).code).toBe('ABONO_EXCEEDS_BALANCE');
  });

  it('concilia un recaudo pendiente y evita repetirlo', async () => {
    const cash = (
      await db.execute(sql`select id from finance.payment_methods where name = 'Efectivo' limit 1`)
    ).rows[0] as { id: string };
    const collection = (
      await db.execute(sql`
        select id, site_id as "siteId", collector_user_id as "collectorUserId", amount, payment_method_id as "paymentMethodId"
        from finance.collections where number = 'RC-0001' limit 1
      `)
    ).rows[0] as { id: string; siteId: string; collectorUserId: string; amount: string };
    const res = await manager
      .post('/api/v1/finance/reconciliations')
      .set('Idempotency-Key', randomUUID())
      .send({
        siteId: collection.siteId,
        collectorType: 'driver',
        collectorUserId: collection.collectorUserId,
        collectionIds: [collection.id],
        counts: [{ paymentMethodId: cash.id, receivedAmount: collection.amount }],
      });
    expect(res.status).toBe(201);
    const data = (res.body as { data: { number: string; variance: string } }).data;
    expect(data.number).toMatch(/^CONC-\d{4}$/);
    expect(data.variance).toBe('0.00');

    const repeat = await manager
      .post('/api/v1/finance/reconciliations')
      .set('Idempotency-Key', randomUUID())
      .send({
        siteId: collection.siteId,
        collectorType: 'driver',
        collectorUserId: collection.collectorUserId,
        collectionIds: [collection.id],
        counts: [{ paymentMethodId: cash.id, receivedAmount: collection.amount }],
      });
    expect(repeat.status).toBe(409);
    expect((repeat.body as { code: string }).code).toBe('COLLECTION_NOT_PENDING');
  });

  it('expone los hechos económicos de cartera', async () => {
    const res = await manager.get('/api/v1/accounting/economic-events?limit=100');
    expect(res.status).toBe(200);
    const types = (res.body as { data: { type: string }[] }).data.map((event) => event.type);
    expect(types).toContain('ReceivableCreated');
    expect(types).toContain('PaymentReceived');
    expect(types).toContain('CollectionReconciled');
  });
});
