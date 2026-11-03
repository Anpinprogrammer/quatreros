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
import { seedDemoCatalog } from '../../src/modules/catalog/infrastructure/seed.js';
import { seedDemoInventory } from '../../src/modules/inventory/infrastructure/seed.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';

/**
 * Entrega 6 — criterios de pos/caja §7 contra PostgreSQL real.
 * Un cajero abre turno, vende un plato y un fabricado, cierra con diferencia y un manager revisa.
 */
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
let cashier: Agent;
let manager: Agent;
let cashierEmail = '';
let managerEmail = '';
let siteId = '';
let picadaProductId = '';
let picadaPresentationId = '';
let chorizoPresentationId = '';
let cashMethodId = '';
let transferMethodId = '';
let shiftId = '';
let saleId = '';
const openKey = randomUUID();
const saleKey = randomUUID();

async function ensureRole(code: string, permissionCodes: string[], scope: 'ALL' | 'OWN'): Promise<string> {
  const [role] = await db
    .insert(roles)
    .values({ code, name: code, isSystem: false, requiresMfa: false })
    .onConflictDoUpdate({ target: roles.code, set: { isSystem: false, requiresMfa: false } })
    .returning({ id: roles.id });
  if (!role) throw new Error(`No se pudo crear el rol ${code}`);
  createdRoleIds.push(role.id);
  await db.delete(rolePermissions).where(sql`${rolePermissions.roleId} = ${role.id}`);
  if (permissionCodes.length > 0) {
    await db
      .insert(rolePermissions)
      .values(permissionCodes.map((permissionCode) => ({ roleId: role.id, permissionCode, scope })));
  }
  return role.id;
}

async function createUser(email: string, roleId: string): Promise<string> {
  const authUserId = await provisioner.createCredentialUser({ name: email, email, password: PASSWORD });
  const [row] = await db
    .insert(users)
    .values({ authUserId, fullName: email, email })
    .returning({ id: users.id });
  if (!row) throw new Error('No se pudo crear el usuario de prueba');
  await db.insert(userRoles).values({ userId: row.id, roleId });
  await db.insert(userSites).values({ userId: row.id, siteId });
  return row.id;
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

async function chorizoAtPos(): Promise<string> {
  const result = await db.execute(sql`
    select coalesce(sum(b.quantity), 0) as quantity
    from inventory.stock_balances b
    join admin.locations l on l.id = b.location_id
    join catalog.presentations pr on pr.id = b.presentation_id
    join catalog.products p on p.id = pr.product_id
    where l.name = 'Productos del punto' and p.name = 'Chorizo Santarrosano'
  `);
  return (result.rows[0] as { quantity: string }).quantity;
}

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);
  await seedDemoSites(db);

  const siteResult = await db.execute(sql`
    select id from admin.sites where name = 'Punto de asados' limit 1
  `);
  siteId = (siteResult.rows[0] as { id: string }).id;

  const seedRole = await ensureRole('POS_TEST_SEED', ['cat.product.read'], 'ALL');
  const seedUserId = await createUser(`seed-${randomUUID().slice(0, 8)}@pos.test`, seedRole);
  await seedDemoCatalog(db, seedUserId);
  await seedDemoInventory(db, seedUserId);

  const refs = await db.execute(sql`
    select
      (select p.id from catalog.products p where p.name = 'Picada Quatreros XL') as "productId",
      (select pr.id from catalog.presentations pr
        join catalog.products p on p.id = pr.product_id
        where p.name = 'Picada Quatreros XL' and pr.name = 'Porción') as "picadaId",
      (select pr.id from catalog.presentations pr
        join catalog.products p on p.id = pr.product_id
        where p.name = 'Chorizo Santarrosano' and pr.name = 'Unidad') as "chorizoId",
      (select pr.id from catalog.presentations pr
        join catalog.products p on p.id = pr.product_id
        where p.name = 'Rellena Mixta' and pr.name = 'Unidad') as "rellenaId",
      (select id from finance.payment_methods where name = 'Efectivo') as "cashId",
      (select id from finance.payment_methods where name = 'Transferencia') as "transferId"
  `);
  const ref = refs.rows[0] as {
    productId: string;
    picadaId: string;
    chorizoId: string;
    rellenaId: string;
    cashId: string;
    transferId: string;
  };
  picadaProductId = ref.productId;
  picadaPresentationId = ref.picadaId;
  chorizoPresentationId = ref.chorizoId;
  cashMethodId = ref.cashId;
  transferMethodId = ref.transferId;

  const cashierRole = await ensureRole(
    'POS_TEST_CASHIER',
    ['pos.shift.open', 'pos.shift.close', 'pos.sale.create'],
    'OWN',
  );
  const managerRole = await ensureRole(
    'POS_TEST_MANAGER',
    ['pos.cash_variance.review', 'pos.dish_recipe.manage'],
    'ALL',
  );
  cashierEmail = `cashier-${randomUUID().slice(0, 8)}@pos.test`;
  managerEmail = `manager-${randomUUID().slice(0, 8)}@pos.test`;
  await createUser(cashierEmail, cashierRole);
  await createUser(managerEmail, managerRole);

  cashier = await signIn(cashierEmail);
  manager = await signIn(managerEmail);

  const recipe = await manager
    .post('/api/v1/pos/dish-recipes')
    .set('Idempotency-Key', randomUUID())
    .send({
      productId: picadaProductId,
      baseOutputQty: '1.000',
      components: [
        { presentationId: ref.chorizoId, quantity: '2.000' },
        { presentationId: ref.rellenaId, quantity: '1.000' },
      ],
    });
  expect([201, 409]).toContain(recipe.status);
});

afterAll(async () => {
  // No deja roles de prueba en la base compartida.
  if (createdRoleIds.length) {
    await db.delete(userRoles).where(inArray(userRoles.roleId, createdRoleIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
  }
  await handle.close();
});

describe('pos/caja (RF-220..225)', () => {
  it('lista el catálogo vendible con precios y medios de pago', async () => {
    const res = await cashier.get('/api/v1/pos/catalog');
    expect(res.status).toBe(200);
    const data = res.body as {
      data: {
        siteId: string;
        items: { productName: string; sellable: boolean }[];
        paymentMethods: { name: string }[];
      };
    };
    expect(data.data.siteId).toBe(siteId);
    expect(data.data.paymentMethods.map((method) => method.name)).toEqual(
      expect.arrayContaining(['Efectivo', 'Transferencia']),
    );
    expect(data.data.items.some((item) => item.productName === 'Picada Quatreros XL')).toBe(true);
  });

  it('abre un turno y rechaza el segundo turno del mismo cajero', async () => {
    const res = await cashier
      .post('/api/v1/pos/shifts')
      .set('Idempotency-Key', openKey)
      .send({ siteId, openingCash: '100000.00' });
    expect(res.status).toBe(201);
    const data = res.body as { data: { id: string; status: string } };
    shiftId = data.data.id;
    expect(data.data.status).toBe('open');

    const current = await cashier.get('/api/v1/pos/shifts/current');
    expect(current.status).toBe(200);
    expect((current.body as { data: { id: string } }).data.id).toBe(shiftId);

    const duplicate = await cashier
      .post('/api/v1/pos/shifts')
      .set('Idempotency-Key', randomUUID())
      .send({ siteId, openingCash: '50000.00' });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { code: string }).code).toBe('SHIFT_ALREADY_OPEN');
  });

  it('vende un plato y un fabricado con pago mixto, FEFO y consumo teórico', async () => {
    const before = await chorizoAtPos();
    const res = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', saleKey)
      .send({
        shiftId,
        lines: [
          { presentationId: picadaPresentationId, quantity: '1.000' },
          { presentationId: chorizoPresentationId, quantity: '2.000' },
        ],
        payments: [
          { paymentMethodId: cashMethodId, amount: '30000.00' },
          { paymentMethodId: transferMethodId, amount: '17600.00' },
        ],
      });
    expect(res.status).toBe(201);
    const sale = res.body as {
      data: {
        id: string;
        number: string;
        total: string;
        changeAmount: string;
        lines: { kind: string; lots: unknown[]; consumption: unknown[] }[];
        payments: unknown[];
      };
    };
    saleId = sale.data.id;
    expect(sale.data.number).toMatch(/^V-\d{4}$/);
    expect(sale.data.total).toBe('47600.00');
    expect(sale.data.changeAmount).toBe('0.00');
    expect(sale.data.lines[0]?.kind).toBe('prepared');
    expect(sale.data.lines[0]?.consumption).toHaveLength(2);
    expect(sale.data.lines[1]?.kind).toBe('manufactured');
    expect(sale.data.lines[1]?.lots.length ?? 0).toBeGreaterThan(0);
    expect(sale.data.payments).toHaveLength(2);
    expect(await chorizoAtPos()).toBe((Number(before) - 2).toFixed(3));
  });

  it('repite la venta con la misma Idempotency-Key sin duplicar inventario', async () => {
    const stock = await chorizoAtPos();
    const res = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', saleKey)
      .send({
        shiftId,
        lines: [
          { presentationId: picadaPresentationId, quantity: '1.000' },
          { presentationId: chorizoPresentationId, quantity: '2.000' },
        ],
        payments: [
          { paymentMethodId: cashMethodId, amount: '30000.00' },
          { paymentMethodId: transferMethodId, amount: '17600.00' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.headers['idempotent-replayed']).toBe('true');
    expect((res.body as { data: { id: string } }).data.id).toBe(saleId);
    expect(await chorizoAtPos()).toBe(stock);
  });

  it('rechaza pagos incompletos, cambio no efectivo y existencia insuficiente', async () => {
    const below = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', randomUUID())
      .send({
        shiftId,
        lines: [{ presentationId: chorizoPresentationId, quantity: '1.000' }],
        payments: [{ paymentMethodId: cashMethodId, amount: '100.00' }],
      });
    expect(below.status).toBe(422);
    expect((below.body as { code: string }).code).toBe('PAYMENT_SUM_BELOW_TOTAL');

    const change = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', randomUUID())
      .send({
        shiftId,
        lines: [{ presentationId: chorizoPresentationId, quantity: '1.000' }],
        payments: [{ paymentMethodId: transferMethodId, amount: '5000.00' }],
      });
    expect(change.status).toBe(422);
    expect((change.body as { code: string }).code).toBe('CHANGE_REQUIRES_CASH');

    const missing = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', randomUUID())
      .send({
        shiftId,
        lines: [{ presentationId: chorizoPresentationId, quantity: '999.000' }],
        payments: [{ paymentMethodId: cashMethodId, amount: '2000000.00' }],
      });
    expect(missing.status).toBe(409);
    expect((missing.body as { code: string }).code).toBe('INSUFFICIENT_STOCK');
  });

  it('cierra con diferencia y el manager revisa el turno', async () => {
    const close = await cashier
      .post(`/api/v1/pos/shifts/${shiftId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({
        counts: [
          { paymentMethodId: cashMethodId, countedAmount: '125000.00' },
          { paymentMethodId: transferMethodId, countedAmount: '17600.00' },
        ],
        note: 'Faltante de $5.000 en efectivo.',
      });
    expect(close.status).toBe(200);
    const closed = close.body as { data: { status: string; cashDifference: string } };
    expect(closed.data.status).toBe('closed_with_variance');
    expect(closed.data.cashDifference).toBe('-5000.00');

    const list = await manager.get('/api/v1/pos/shifts');
    expect(list.status).toBe(200);
    expect((list.body as { data: { id: string }[] }).data.some((shift) => shift.id === shiftId)).toBe(true);

    const cashierReview = await cashier
      .post(`/api/v1/pos/shifts/${shiftId}/review`)
      .set('Idempotency-Key', randomUUID())
      .send({ conclusion: 'Intento del cajero.' });
    expect(cashierReview.status).toBe(403);

    const review = await manager
      .post(`/api/v1/pos/shifts/${shiftId}/review`)
      .set('Idempotency-Key', randomUUID())
      .send({ conclusion: 'Se verificó el arqueo con el supervisor.' });
    expect(review.status).toBe(200);
    expect((review.body as { data: { status: string } }).data.status).toBe('reviewed');

    const secondReview = await manager
      .post(`/api/v1/pos/shifts/${shiftId}/review`)
      .set('Idempotency-Key', randomUUID())
      .send({ conclusion: 'Segunda revisión.' });
    expect(secondReview.status).toBe(409);
    expect((secondReview.body as { code: string }).code).toBe('SHIFT_ALREADY_REVIEWED');
  });

  it('no permite vender con el turno cerrado', async () => {
    const res = await cashier
      .post('/api/v1/pos/sales')
      .set('Idempotency-Key', randomUUID())
      .send({
        shiftId,
        lines: [{ presentationId: chorizoPresentationId, quantity: '1.000' }],
        payments: [{ paymentMethodId: cashMethodId, amount: '1300.00' }],
      });
    expect(res.status).toBe(409);
    expect((res.body as { code: string }).code).toBe('SHIFT_NOT_OPEN');
  });
});
