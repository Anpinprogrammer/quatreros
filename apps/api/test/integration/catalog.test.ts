import { randomUUID } from 'node:crypto';
import type { PriceView, ProductView, RawMaterialView } from '@quatreros/contracts';
import { and, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadActor } from '../../src/modules/admin/application/public.js';
import { seedAdminCatalog } from '../../src/modules/admin/infrastructure/seed.js';
import { rolePermissions, roles, userRoles, users } from '../../src/modules/admin/infrastructure/schema.js';
import type { InventoryUsage } from '../../src/modules/catalog/application/ports.js';
import { products } from '../../src/modules/catalog/infrastructure/schema.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { auditLog } from '../../src/platform/db/schema/platform.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';

/**
 * Entrega 2a — criterios de cat/catalogo §7 contra PostgreSQL real.
 * Usa roles y usuarios propios (sin MFA) para no depender del orden de otros archivos ni de la semilla demo.
 */
const ORIGIN = testEnv.APP_BASE_URL;
const PASSWORD = `demo-${randomUUID()}`;
const handle = connectTestDb();
const db = handle.db as unknown as Database;
const auth = createAuth(db, testEnv, { isBlocked: () => Promise.resolve(false) });
const provisioner = createAuthProvisioner(auth, db);

const createdRoleIds: string[] = [];
const usage = { product: false, presentation: false, rawMaterial: false };
const fakeUsage: InventoryUsage = {
  hasStockOrMovementsForProduct: () => Promise.resolve(usage.product),
  hasStockOrMovementsForPresentation: () => Promise.resolve(usage.presentation),
  hasStockOrMovementsForRawMaterial: () => Promise.resolve(usage.rawMaterial),
};

const app = buildTestApp({
  auth,
  db,
  provisioner,
  idempotency: new PgIdempotencyStore(db),
  resolveActor: (authUserId) => loadActor(db, authUserId),
  registerModules: (api, deps) => {
    registerModules(api, deps, { inventoryUsage: fakeUsage });
  },
});

type Agent = ReturnType<typeof request.agent>;

async function ensureRole(code: string, permissionCodes: string[]): Promise<string> {
  const [role] = await db
    .insert(roles)
    .values({ code, name: code, isSystem: false, requiresMfa: false })
    .onConflictDoUpdate({ target: roles.code, set: { isSystem: false, requiresMfa: false } })
    .returning({ id: roles.id });
  if (!role) throw new Error(`No se pudo crear el rol ${code}`);
  createdRoleIds.push(role.id);
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  if (permissionCodes.length) {
    await db
      .insert(rolePermissions)
      .values(
        permissionCodes.map((permissionCode) => ({ roleId: role.id, permissionCode, scope: 'ALL' as const })),
      );
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

const idempotency = () => randomUUID();

/** Supertest devuelve `any`; se tipa en un solo lugar para no sembrar accesos inseguros. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- tipa la respuesta de supertest
function dataOf<T>(res: { body: unknown }): T {
  return (res.body as { data: T }).data;
}
function codeOf(res: { body: unknown }): string {
  return (res.body as { code: string }).code;
}

let admin: Agent;
let reader: Agent;
let rawOnly: Agent;

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);

  const adminRole = await ensureRole('CAT_TEST_ADMIN', [
    'cat.product.read',
    'cat.product.manage',
    'cat.price.update',
    'cat.raw_material.read',
    'cat.raw_material.manage',
  ]);
  const readerRole = await ensureRole('CAT_TEST_READ', ['cat.product.read', 'cat.raw_material.read']);
  const rawRole = await ensureRole('CAT_TEST_RAW', [
    'cat.product.read',
    'cat.raw_material.read',
    'cat.raw_material.manage',
  ]);

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `catalog-admin-${suffix}@test.example`;
  await createUser(adminEmail, adminRole);
  await createUser(`catalog-reader-${suffix}@test.example`, readerRole);
  await createUser(`catalog-raw-${suffix}@test.example`, rawRole);

  admin = await signIn(adminEmail);
  reader = await signIn(`catalog-reader-${suffix}@test.example`);
  rawOnly = await signIn(`catalog-raw-${suffix}@test.example`);
});

afterAll(async () => {
  // No deja roles de prueba en la base compartida: otros archivos verifican la lista de roles del sistema.
  if (createdRoleIds.length) {
    await db.delete(userRoles).where(inArray(userRoles.roleId, createdRoleIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
  }
  await handle.close();
});

async function createProduct(overrides: Record<string, unknown> = {}) {
  const name = `Chorizo ${randomUUID().slice(0, 8)}`;
  const res = await admin
    .post('/api/v1/catalog/products')
    .set('Idempotency-Key', idempotency())
    .send({ name, kind: 'manufactured', baseUnit: 'unidad', shelfLifeDays: 30, ...overrides });
  expect(res.status).toBe(201);
  return dataOf<ProductView>(res);
}

async function createPresentation(productId: string, name = 'Unidad', unitsPer = '1.000') {
  const res = await admin
    .post(`/api/v1/catalog/products/${productId}/presentations`)
    .set('Idempotency-Key', idempotency())
    .send({ name, unitsPer });
  expect(res.status).toBe(201);
  return dataOf<{ id: string; version: number }>(res);
}

describe('catálogo: alta y consulta (RF-030..032)', () => {
  it('crea producto, presentaciones y precio vigente; queda auditado', async () => {
    const product = await createProduct();
    expect(product).toMatchObject({ kind: 'manufactured', baseUnit: 'unidad', shelfLifeDays: 30 });
    expect(product.version).toBe(1);

    const unit = await createPresentation(product.id, 'Unidad', '1.000');
    await createPresentation(product.id, 'Paquete x10', '10.000');

    const price = await admin
      .post(`/api/v1/catalog/presentations/${unit.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1300.00' });
    expect(price.status).toBe(201);
    expect(dataOf<PriceView>(price).price).toBe('1300.00');

    const detail = await admin.get(`/api/v1/catalog/products/${product.id}`);
    expect(detail.status).toBe(200);
    const view = dataOf<ProductView>(detail);
    expect(view.presentations).toHaveLength(2);
    expect(view.presentations.find((p) => p.name === 'Unidad')?.currentPrice).toBe('1300.00');

    const list = await admin.get('/api/v1/catalog/products?q=Chorizo');
    expect(list.status).toBe(200);
    expect(dataOf<ProductView[]>(list).some((p) => p.id === product.id)).toBe(true);

    const audit = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'catalog.product'), eq(auditLog.entityId, product.id)));
    expect(audit.map((a) => a.action)).toContain('cat.product.create');
  });

  it('pagina por cursor sin repetir el último registro', async () => {
    await createProduct();
    await createProduct();
    await createProduct();

    const first = await admin.get('/api/v1/catalog/products?limit=2&status=all');
    expect(first.status).toBe(200);
    const firstBody = first.body as { data: ProductView[]; page: { nextCursor: string | null } };
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.page.nextCursor).toBeTruthy();

    const second = await admin.get(
      `/api/v1/catalog/products?limit=2&status=all&cursor=${encodeURIComponent(firstBody.page.nextCursor ?? '')}`,
    );
    expect(second.status).toBe(200);
    const secondBody = second.body as { data: ProductView[] };
    const ids = new Set([...firstBody.data, ...secondBody.data].map((p) => p.id));
    expect(ids.size).toBe(firstBody.data.length + secondBody.data.length);
  });

  it('crea materias primas y las lista', async () => {
    const name = `Carne ${randomUUID().slice(0, 8)}`;
    const created = await admin
      .post('/api/v1/catalog/raw-materials')
      .set('Idempotency-Key', idempotency())
      .send({ name, unit: 'kg', tracksExpiry: true });
    expect(created.status).toBe(201);
    expect(dataOf<RawMaterialView>(created).name).toBe(name);

    const list = await admin.get('/api/v1/catalog/raw-materials?q=Carne');
    expect(list.status).toBe(200);
    expect(dataOf<RawMaterialView[]>(list).some((m) => m.name === name)).toBe(true);
  });
});

describe('catálogo: validación y reglas', () => {
  it('rechaza fabricado sin vida útil, presentación en cero y precio en cero', async () => {
    const product = await admin
      .post('/api/v1/catalog/products')
      .set('Idempotency-Key', idempotency())
      .send({ name: `Sin vida ${randomUUID().slice(0, 8)}`, kind: 'manufactured', baseUnit: 'unidad' });
    expect(product.status).toBe(422);

    const base = await createProduct();
    const presentation = await admin
      .post(`/api/v1/catalog/products/${base.id}/presentations`)
      .set('Idempotency-Key', idempotency())
      .send({ name: 'Cero', unitsPer: '0' });
    expect(presentation.status).toBe(422);

    const unit = await createPresentation(base.id, 'Unidad');
    const price = await admin
      .post(`/api/v1/catalog/presentations/${unit.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '0' });
    expect(price.status).toBe(422);
  });

  it('rechaza nombres duplicados', async () => {
    const product = await createProduct();
    const duplicate = await admin
      .post('/api/v1/catalog/products')
      .set('Idempotency-Key', idempotency())
      .send({ name: product.name, kind: 'manufactured', baseUnit: 'unidad', shelfLifeDays: 30 });
    expect(duplicate.status).toBe(409);
    expect(codeOf(duplicate)).toBe('NAME_TAKEN');

    await createPresentation(product.id, 'Unidad');
    const repeated = await admin
      .post(`/api/v1/catalog/products/${product.id}/presentations`)
      .set('Idempotency-Key', idempotency())
      .send({ name: 'Unidad', unitsPer: '1.000' });
    expect(repeated.status).toBe(409);
    expect(codeOf(repeated)).toBe('PRESENTATION_EXISTS');
  });

  it('cierra el precio anterior y conserva un único vigente', async () => {
    const product = await createProduct();
    const presentation = await createPresentation(product.id, 'Unidad');

    await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1300.00' });
    await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1400.00' });

    const history = await admin.get(`/api/v1/catalog/presentations/${presentation.id}/prices`);
    expect(history.status).toBe(200);
    const prices = dataOf<PriceView[]>(history);
    expect(prices).toHaveLength(2);
    expect(prices.filter((p) => p.validTo === null)).toHaveLength(1);
    expect(prices.find((p) => p.validTo === null)?.price).toBe('1400.00');
  });

  it('exige versión correcta en la edición concurrente', async () => {
    const product = await createProduct();
    const stale = await admin
      .patch(`/api/v1/catalog/products/${product.id}`)
      .set('If-Match', '"v99"')
      .send({ name: `${product.name} editado` });
    expect(stale.status).toBe(412);

    const ok = await admin
      .patch(`/api/v1/catalog/products/${product.id}`)
      .set('If-Match', '"v1"')
      .send({ name: `${product.name} editado` });
    expect(ok.status).toBe(200);
    expect(dataOf<ProductView>(ok).version).toBe(2);
  });

  it('bloquea unidad y composición cuando ya hay existencias o movimientos', async () => {
    const product = await createProduct();
    const presentation = await createPresentation(product.id, 'Unidad');

    usage.product = true;
    const unit = await admin
      .patch(`/api/v1/catalog/products/${product.id}`)
      .set('If-Match', '"v1"')
      .send({ baseUnit: 'kg' });
    expect(unit.status).toBe(409);
    expect(codeOf(unit)).toBe('UNIT_LOCKED');
    usage.product = false;

    usage.presentation = true;
    const composition = await admin
      .patch(`/api/v1/catalog/presentations/${presentation.id}`)
      .set('If-Match', '"v1"')
      .send({ unitsPer: '12.000' });
    expect(composition.status).toBe(409);
    expect(codeOf(composition)).toBe('PRESENTATION_LOCKED');
    usage.presentation = false;

    const material = await admin
      .post('/api/v1/catalog/raw-materials')
      .set('Idempotency-Key', idempotency())
      .send({ name: `Tripa ${randomUUID().slice(0, 8)}`, unit: 'm', tracksExpiry: true });
    expect(material.status).toBe(201);
    const materialId = dataOf<RawMaterialView>(material).id;
    usage.rawMaterial = true;
    const materialUnit = await admin
      .patch(`/api/v1/catalog/raw-materials/${materialId}`)
      .set('If-Match', '"v1"')
      .send({ unit: 'kg' });
    expect(materialUnit.status).toBe(409);
    expect(codeOf(materialUnit)).toBe('UNIT_LOCKED');
    usage.rawMaterial = false;
  });

  it('no agrega presentaciones ni precios a un producto inactivo', async () => {
    const product = await createProduct();
    const presentation = await createPresentation(product.id, 'Unidad');
    await admin
      .patch(`/api/v1/catalog/products/${product.id}`)
      .set('If-Match', '"v1"')
      .send({ isActive: false });

    const newPresentation = await admin
      .post(`/api/v1/catalog/products/${product.id}/presentations`)
      .set('Idempotency-Key', idempotency())
      .send({ name: 'Paquete x10', unitsPer: '10.000' });
    expect(newPresentation.status).toBe(409);
    expect(codeOf(newPresentation)).toBe('PRODUCT_INACTIVE');

    const price = await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1300.00' });
    expect(price.status).toBe(409);
    expect(codeOf(price)).toBe('PRODUCT_INACTIVE');
  });

  it('devuelve 404 para recursos inexistentes', async () => {
    expect((await admin.get(`/api/v1/catalog/products/${randomUUID()}`)).status).toBe(404);
    const missing = await admin
      .post(`/api/v1/catalog/products/${randomUUID()}/presentations`)
      .set('Idempotency-Key', idempotency())
      .send({ name: 'Unidad', unitsPer: '1.000' });
    expect(missing.status).toBe(404);
    expect((await admin.get(`/api/v1/catalog/presentations/${randomUUID()}/prices`)).status).toBe(404);
  });
});

describe('catálogo: permisos e idempotencia', () => {
  it('un lector consulta pero no escribe', async () => {
    expect((await reader.get('/api/v1/catalog/products')).status).toBe(200);
    const product = await reader
      .post('/api/v1/catalog/products')
      .set('Idempotency-Key', idempotency())
      .send({ name: `No ${randomUUID().slice(0, 8)}`, kind: 'prepared', baseUnit: 'unidad' });
    expect(product.status).toBe(403);

    const base = await createProduct();
    const presentation = await createPresentation(base.id, 'Unidad');
    const price = await reader
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1300.00' });
    expect(price.status).toBe(403);
  });

  it('quien gestiona materias primas no puede crear productos ni precios', async () => {
    const material = await rawOnly
      .post('/api/v1/catalog/raw-materials')
      .set('Idempotency-Key', idempotency())
      .send({ name: `Sal ${randomUUID().slice(0, 8)}`, unit: 'kg', tracksExpiry: false });
    expect(material.status).toBe(201);

    const product = await rawOnly
      .post('/api/v1/catalog/products')
      .set('Idempotency-Key', idempotency())
      .send({ name: `No ${randomUUID().slice(0, 8)}`, kind: 'prepared', baseUnit: 'unidad' });
    expect(product.status).toBe(403);
  });

  it('la misma Idempotency-Key no duplica producto ni precio', async () => {
    const name = `Idem ${randomUUID().slice(0, 8)}`;
    const key = idempotency();
    const body = { name, kind: 'manufactured', baseUnit: 'unidad', shelfLifeDays: 30 };
    const first = await admin.post('/api/v1/catalog/products').set('Idempotency-Key', key).send(body);
    const second = await admin.post('/api/v1/catalog/products').set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const rows = await db.select({ id: products.id }).from(products).where(eq(products.name, name));
    expect(rows).toHaveLength(1);

    const product = dataOf<ProductView>(first);
    const presentation = await createPresentation(product.id, 'Unidad');
    const priceKey = idempotency();
    await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', priceKey)
      .send({ price: '1300.00' });
    await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', priceKey)
      .send({ price: '1300.00' });

    const history = await admin.get(`/api/v1/catalog/presentations/${presentation.id}/prices`);
    expect(dataOf<PriceView[]>(history).filter((p) => p.validTo === null)).toHaveLength(1);
  });
});

describe('catálogo: concurrencia de precios', () => {
  it.skipIf(inject('singleSession'))('dos cambios simultáneos dejan un solo precio vigente', async () => {
    const product = await createProduct();
    const presentation = await createPresentation(product.id, 'Unidad');
    await admin
      .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
      .set('Idempotency-Key', idempotency())
      .send({ price: '1300.00' });

    const [a, b] = await Promise.all([
      admin
        .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
        .set('Idempotency-Key', idempotency())
        .send({ price: '1400.00' }),
      admin
        .post(`/api/v1/catalog/presentations/${presentation.id}/prices`)
        .set('Idempotency-Key', idempotency())
        .send({ price: '1500.00' }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);

    const history = await admin.get(`/api/v1/catalog/presentations/${presentation.id}/prices`);
    const prices = dataOf<PriceView[]>(history);
    expect(prices.filter((p) => p.validTo === null)).toHaveLength(1);
    expect(prices).toHaveLength(3);
  });
});
