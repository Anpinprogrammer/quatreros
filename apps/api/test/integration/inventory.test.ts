import { randomUUID } from 'node:crypto';
import type {
  InventorySummary,
  LotDetail,
  LotPage,
  MovementPage,
  StockBalancePage,
  TraceabilityView,
} from '@quatreros/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadActor } from '../../src/modules/admin/application/public.js';
import { seedAdminCatalog, seedDemoSites } from '../../src/modules/admin/infrastructure/seed.js';
import { rolePermissions, roles, userRoles, users } from '../../src/modules/admin/infrastructure/schema.js';
import { seedDemoCatalog } from '../../src/modules/catalog/infrastructure/seed.js';
import { recordMovement } from '../../src/modules/inventory/application/movements.js';
import { seedDemoInventory } from '../../src/modules/inventory/infrastructure/seed.js';
import { SqlInventoryUsage } from '../../src/modules/inventory/infrastructure/repository.js';
import { registerModules } from '../../src/modules/index.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { createAuthProvisioner } from '../../src/platform/auth/provisioner.js';
import type { Database } from '../../src/platform/db/client.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';

/**
 * Entrega 2b — criterios de inv/existencias §7 contra PostgreSQL real.
 * La semilla de inventario usa fechas relativas a hoy, así que es estable en el tiempo.
 */
const ORIGIN = testEnv.APP_BASE_URL;
const PASSWORD = `demo-${randomUUID()}`;
const handle = connectTestDb();
const db = handle.db as unknown as Database;
const auth = createAuth(db, testEnv, { isBlocked: () => Promise.resolve(false) });
const provisioner = createAuthProvisioner(auth, db);
// El puerto se simula en la API para no abrir otra consulta dentro de la transacción de
// catálogo (PGlite tiene una sola sesión). La implementación SQL se prueba aparte.
const fakeUsage = {
  hasStockOrMovementsForProduct: () => Promise.resolve(true),
  hasStockOrMovementsForPresentation: () => Promise.resolve(true),
  hasStockOrMovementsForRawMaterial: () => Promise.resolve(true),
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
const createdRoleIds: string[] = [];
let admin: Agent;
let reader: Agent;
let adminUserId = '';
let lotId = '';

async function ensureRole(code: string, permissionCodes: string[]): Promise<string> {
  const [role] = await db
    .insert(roles)
    .values({ code, name: code, isSystem: false, requiresMfa: false })
    .onConflictDoUpdate({ target: roles.code, set: { isSystem: false, requiresMfa: false } })
    .returning({ id: roles.id });
  if (!role) throw new Error(`No se pudo crear el rol ${code}`);
  createdRoleIds.push(role.id);
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  await db.insert(rolePermissions).values(
    permissionCodes.map((permissionCode) => ({
      roleId: role.id,
      permissionCode,
      scope: 'ALL' as const,
    })),
  );
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

async function inventoryCounts() {
  const result = await db.execute(sql`
    select
      (select count(*)::int from inventory.lots) as lots,
      (select count(*)::int from inventory.stock_movements) as movements,
      (select count(*)::int from inventory.stock_balances) as balances
  `);
  return result.rows[0] as { lots: number; movements: number; balances: number };
}

beforeAll(async () => {
  await seedPlatform(db);
  await seedAdminCatalog(db);
  await seedDemoSites(db);

  const adminRole = await ensureRole('INV_TEST_ADMIN', [
    'cat.product.read',
    'cat.product.manage',
    'cat.price.update',
    'cat.raw_material.read',
    'cat.raw_material.manage',
    'inv.stock.read',
    'inv.traceability.read',
  ]);
  const readerRole = await ensureRole('INV_TEST_READ', ['inv.stock.read']);

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `inv-admin-${suffix}@test.example`;
  adminUserId = await createUser(adminEmail, adminRole);
  await createUser(`inv-reader-${suffix}@test.example`, readerRole);

  await seedDemoCatalog(db, adminUserId);
  await seedDemoInventory(db, adminUserId);

  admin = await signIn(adminEmail);
  reader = await signIn(`inv-reader-${suffix}@test.example`);

  const lots = await admin.get('/api/v1/inventory/lots?q=PT-2026-0001');
  lotId = (lots.body as { data: LotPage['data'] }).data[0]?.id ?? '';
  expect(lotId).toBeTruthy();
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

describe('existencias y kardex (RF-110, RF-111)', () => {
  it('la carga inicial crea lotes, movimientos y saldos una sola vez', async () => {
    const first = await inventoryCounts();
    expect(first).toEqual({ lots: 8, movements: 12, balances: 12 });

    await seedDemoInventory(db, adminUserId);
    expect(await inventoryCounts()).toEqual(first);
  });

  it('resume productos, materias primas, ubicaciones y vencimientos', async () => {
    const res = await admin.get('/api/v1/inventory/summary');
    expect(res.status).toBe(200);
    const summary = (res.body as { data: InventorySummary }).data;
    expect(summary).toEqual({
      productsWithStock: 2,
      rawMaterialsWithStock: 4,
      lotsNearExpiry: 2,
      expiredLots: 0,
      locationsWithStock: 2,
    });
  });

  it('devuelve saldos por lote y presentación', async () => {
    const res = await admin.get('/api/v1/inventory/stock-balances?limit=100');
    expect(res.status).toBe(200);
    const page = res.body as StockBalancePage;
    expect(page.data).toHaveLength(12);

    const chorizo = page.data.filter((row) => row.lotCode === 'PT-2026-0001');
    expect(chorizo).toHaveLength(2);
    expect(chorizo.map((row) => row.quantity).sort()).toEqual(['120.000', '24.000']);
    expect(chorizo.every((row) => row.isSellable)).toBe(true);
  });

  it('el lote expone su saldo total en unidad base', async () => {
    const res = await admin.get('/api/v1/inventory/lots?q=PT-2026-0001');
    expect(res.status).toBe(200);
    const page = res.body as LotPage;
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.totalQuantity).toBe('360.000');
    expect(page.data[0]?.baseUnit).toBe('unidad');
  });

  it('el kardex del lote está en orden descendente y con origen', async () => {
    const res = await admin.get(`/api/v1/inventory/movements?lotId=${lotId}`);
    expect(res.status).toBe(200);
    const page = res.body as MovementPage;
    expect(page.data).toHaveLength(2);
    expect(page.data.every((m) => m.movementType === 'opening_balance')).toBe(true);
    expect(page.data[0]?.sourceType).toBe('migration.opening_balance');
    expect(page.data[0]?.createdByName).toBeTruthy();
    expect(Number(page.data[0]?.id)).toBeGreaterThan(Number(page.data[1]?.id));
  });

  it('la ficha del lote incluye saldos y movimientos', async () => {
    const res = await admin.get(`/api/v1/inventory/lots/${lotId}`);
    expect(res.status).toBe(200);
    const detail = (res.body as { data: LotDetail }).data;
    expect(detail.balances).toHaveLength(2);
    expect(detail.movements).toHaveLength(2);
  });

  it('la disponibilidad excluye lo no vendible y usa presentaciones', async () => {
    const res = await admin.get('/api/v1/inventory/availability?limit=200');
    expect(res.status).toBe(200);
    const rows = (
      res.body as { data: { itemName: string; presentationName: string | null; available: string }[] }
    ).data;
    const paquete = rows.find(
      (row) => row.itemName === 'Chorizo Santarrosano' && row.presentationName === 'Paquete x10',
    );
    expect(paquete?.available).toBe('36.000');
  });

  it('la trazabilidad declara los vacíos que dependen de otras entregas', async () => {
    const res = await admin.get(`/api/v1/inventory/lots/${lotId}/traceability`);
    expect(res.status).toBe(200);
    const trace = (res.body as { data: TraceabilityView }).data;
    expect(trace.lot.code).toBe('PT-2026-0001');
    expect(trace.backward.inputs).toEqual([]);
    expect(trace.backward.supplier).toBeNull();
    expect(trace.backward.pending.length).toBeGreaterThan(0);
    expect(trace.forward.movements).toEqual([]);
    expect(trace.forward.pending.length).toBeGreaterThan(0);
  });

  it('rechaza cursores inválidos y lotes inexistentes', async () => {
    expect((await admin.get('/api/v1/inventory/movements?cursor=abc')).status).toBe(422);
    expect((await admin.get(`/api/v1/inventory/lots/${randomUUID()}`)).status).toBe(404);
    expect((await admin.get(`/api/v1/inventory/lots/${randomUUID()}/traceability`)).status).toBe(404);
  });
});

describe('inventario: reglas y permisos', () => {
  it('un lector consulta existencias pero no trazabilidad', async () => {
    expect((await reader.get('/api/v1/inventory/stock-balances')).status).toBe(200);
    expect((await reader.get(`/api/v1/inventory/lots/${lotId}/traceability`)).status).toBe(403);
  });

  it('el kardex es inmutable', async () => {
    const res = await admin.get(`/api/v1/inventory/movements?lotId=${lotId}&limit=1`);
    const movement = (res.body as MovementPage).data[0];
    expect(movement).toBeTruthy();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`update inventory.stock_movements set quantity = quantity + 1 where id = ${Number(movement?.id ?? '0')}`,
        );
      }),
    ).rejects.toThrow();
  });

  it('una salida mayor al saldo se rechaza y no cambia el saldo', async () => {
    const balanceResult = await db.execute(sql`
      select b.lot_id, b.presentation_id, b.location_id, b.quantity
      from inventory.stock_balances b
      join inventory.lots l on l.id = b.lot_id
      where l.code = 'PT-2026-0001' and b.presentation_id is not null
      order by b.quantity desc
      limit 1
    `);
    const balance = balanceResult.rows[0] as {
      lot_id: string;
      presentation_id: string;
      location_id: string;
      quantity: string;
    };
    expect(balance).toBeTruthy();

    await expect(
      db.transaction(async (tx) => {
        await recordMovement(tx, {
          movementType: 'adjustment',
          lotId: balance.lot_id,
          presentationId: balance.presentation_id,
          locationId: balance.location_id,
          quantity: '-999.000',
          baseQuantity: '-999.000',
          sourceType: 'test',
          sourceId: randomUUID(),
          createdBy: adminUserId,
          reason: 'Prueba de saldo negativo',
        });
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    const after = await db.execute(sql`
      select quantity from inventory.stock_balances
      where lot_id = ${balance.lot_id} and presentation_id = ${balance.presentation_id}
        and location_id = ${balance.location_id}
    `);
    expect((after.rows[0] as { quantity: string }).quantity).toBe(balance.quantity);
  });

  it('el puerto SQL detecta existencias y movimientos', async () => {
    const usage = new SqlInventoryUsage(db);
    const productResult = await db.execute(sql`
      select id from catalog.products where name = 'Chorizo Santarrosano' limit 1
    `);
    const productId = (productResult.rows[0] as { id: string }).id;
    const presentationResult = await db.execute(sql`
      select pr.id
      from catalog.presentations pr
      join catalog.products p on p.id = pr.product_id
      where p.name = 'Chorizo Santarrosano' and pr.name = 'Paquete x10'
      limit 1
    `);
    const presentationId = (presentationResult.rows[0] as { id: string }).id;
    const materialResult = await db.execute(sql`
      select id from catalog.raw_materials where name = 'Carne de cerdo magra' limit 1
    `);
    const materialId = (materialResult.rows[0] as { id: string }).id;

    expect(await usage.hasStockOrMovementsForProduct(productId)).toBe(true);
    expect(await usage.hasStockOrMovementsForPresentation(presentationId)).toBe(true);
    expect(await usage.hasStockOrMovementsForRawMaterial(materialId)).toBe(true);
  });

  it('el catálogo no cambia unidad ni composición con movimientos', async () => {
    const productResult = await db.execute(sql`
      select id, version from catalog.products where name = 'Chorizo Santarrosano' limit 1
    `);
    const product = productResult.rows[0] as { id: string; version: number };
    const unit = await admin
      .patch(`/api/v1/catalog/products/${product.id}`)
      .set('If-Match', `"v${String(product.version)}"`)
      .send({ baseUnit: 'kg' });
    expect(unit.status).toBe(409);
    expect((unit.body as { code: string }).code).toBe('UNIT_LOCKED');

    const presentationResult = await db.execute(sql`
      select pr.id, pr.version
      from catalog.presentations pr
      join catalog.products p on p.id = pr.product_id
      where p.name = 'Chorizo Santarrosano' and pr.name = 'Paquete x10'
      limit 1
    `);
    const presentation = presentationResult.rows[0] as { id: string; version: number };
    const composition = await admin
      .patch(`/api/v1/catalog/presentations/${presentation.id}`)
      .set('If-Match', `"v${String(presentation.version)}"`)
      .send({ unitsPer: '12.000' });
    expect(composition.status).toBe(409);
    expect((composition.body as { code: string }).code).toBe('PRESENTATION_LOCKED');
  });
});
