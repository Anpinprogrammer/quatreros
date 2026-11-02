import { randomUUID } from 'node:crypto';
import type {
  InventorySummary,
  LotDetail,
  LotPage,
  MovementPage,
  FefoAllocationResponse,
  StockBalancePage,
  TraceabilityView,
  TransferDetail,
} from '@quatreros/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
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

async function ensureRole(
  code: string,
  permissionCodes: string[],
  scope: 'ALL' | 'SITE' = 'ALL',
): Promise<string> {
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
      scope,
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
    'inv.transfer.create',
    'inv.transfer.receive',
    'comp.supplier.read',
    'comp.supplier.manage',
    'comp.purchase.read',
    'comp.purchase.create',
    'comp.receipt.create',
    'prod.recipe.read',
    'prod.recipe.manage',
    'prod.order.read',
    'prod.order.create',
    'prod.order.execute',
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

describe('FEFO y traslados (RF-112, RF-114)', () => {
  let presentationId = '';
  let fromLocationId = '';
  let toLocationId = '';
  let pointLotId = '';

  beforeAll(async () => {
    const refs = await db.execute(sql`
      select pr.id as "presentationId", fl.id as "fromLocationId", tl.id as "toLocationId"
      from catalog.presentations pr
      join catalog.products p on p.id = pr.product_id
      join admin.locations fl on fl.name = 'Principal'
      join admin.locations tl on tl.name = 'Productos del punto'
      where p.name = 'Chorizo Santarrosano' and pr.name = 'Paquete x10'
      limit 1
    `);
    const ref = refs.rows[0] as
      { presentationId: string; fromLocationId: string; toLocationId: string } | undefined;
    if (!ref) throw new Error('La semilla no tiene la presentación y ubicaciones esperadas');
    presentationId = ref.presentationId;
    fromLocationId = ref.fromLocationId;
    toLocationId = ref.toLocationId;

    const pointLot = await db.execute(sql`
      select id from inventory.lots where code = 'PT-2026-0004' limit 1
    `);
    pointLotId = (pointLot.rows[0] as { id: string } | undefined)?.id ?? '';
  });

  it('reparte la asignación FEFO entre lotes y no usa lotes no vendibles', async () => {
    const res = await admin
      .post('/api/v1/inventory/fefo-allocations')
      .send({ presentationId, locationId: fromLocationId, quantity: '30.000' });
    expect(res.status).toBe(200);
    const data = (res.body as FefoAllocationResponse).data;
    expect(data.allocations).toHaveLength(2);
    expect(data.allocations[0]?.code).toBe('PT-2026-0001');
    expect(data.allocations[0]?.quantity).toBe('24.000');
    expect(data.allocations[1]?.quantity).toBe('6.000');
    expect(data.baseQuantity).toBe('300.000');
  });

  it('falla con 409 cuando la existencia vendible no alcanza', async () => {
    const res = await admin
      .post('/api/v1/inventory/fefo-allocations')
      .send({ presentationId, locationId: fromLocationId, quantity: '9999.000' });
    expect(res.status).toBe(409);
    expect((res.body as { code: string }).code).toBe('INSUFFICIENT_STOCK');
    expect((res.body as { missing: string }).missing).toBeTruthy();
  });

  it('envía a tránsito, recibe en destino y no permite recibir dos veces', async () => {
    const key = randomUUID();
    const create = await admin
      .post('/api/v1/inventory/transfers')
      .set('Idempotency-Key', key)
      .send({
        fromLocationId,
        toLocationId,
        lines: [{ presentationId, quantity: '5.000' }],
      });
    expect(create.status).toBe(201);
    const transfer = (create.body as { data: TransferDetail }).data;
    expect(transfer.status).toBe('in_transit');
    expect(transfer.lines).toHaveLength(1);
    expect(transfer.lines[0]?.sentQuantity).toBe('5.000');

    const repeated = await admin
      .post('/api/v1/inventory/transfers')
      .set('Idempotency-Key', key)
      .send({
        fromLocationId,
        toLocationId,
        lines: [{ presentationId, quantity: '5.000' }],
      });
    expect(repeated.status).toBe(201);
    expect((repeated.body as { data: TransferDetail }).data.id).toBe(transfer.id);

    const lotId = transfer.lines[0]?.lotId ?? '';
    const afterSend = await db.execute(sql`
      select
        (select coalesce(sum(quantity), 0) from inventory.stock_balances
          where lot_id = ${lotId} and presentation_id = ${presentationId}
            and location_id = ${fromLocationId}) as origin,
        (select coalesce(sum(quantity), 0) from inventory.stock_balances
          where lot_id = ${lotId} and presentation_id = ${presentationId}
            and location_id = (select id from admin.locations where kind = 'in_transit' limit 1)) as transit
    `);
    expect(afterSend.rows[0]).toEqual({ origin: '19.000', transit: '5.000' });

    const lineId = transfer.lines[0]?.id ?? '';
    const receive = await admin
      .post(`/api/v1/inventory/transfers/${transfer.id}/receive`)
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ lineId, receivedQuantity: '5.000' }] });
    expect(receive.status).toBe(200);
    const received = (receive.body as { data: TransferDetail }).data;
    expect(received.status).toBe('received');
    expect(received.lines[0]?.receivedQuantity).toBe('5.000');

    const afterReceive = await db.execute(sql`
      select
        (select coalesce(sum(quantity), 0) from inventory.stock_balances
          where lot_id = ${lotId} and presentation_id = ${presentationId}
            and location_id = ${toLocationId}) as destination,
        (select coalesce(sum(quantity), 0) from inventory.stock_balances
          where lot_id = ${lotId} and presentation_id = ${presentationId}
            and location_id = (select id from admin.locations where kind = 'in_transit' limit 1)) as transit
    `);
    expect(afterReceive.rows[0]).toEqual({ destination: '5.000', transit: '0.000' });

    const again = await admin
      .post(`/api/v1/inventory/transfers/${transfer.id}/receive`)
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ lineId, receivedQuantity: '5.000' }] });
    expect(again.status).toBe(409);
    expect((again.body as { code: string }).code).toBe('TRANSFER_ALREADY_RECEIVED');
  });

  it('deja la diferencia en tránsito cuando se recibe con novedad', async () => {
    const create = await admin
      .post('/api/v1/inventory/transfers')
      .set('Idempotency-Key', randomUUID())
      .send({
        fromLocationId,
        toLocationId,
        lines: [{ presentationId, quantity: '4.000' }],
      });
    expect(create.status).toBe(201);
    const transfer = (create.body as { data: TransferDetail }).data;
    const line = transfer.lines[0];
    if (!line) throw new Error('El traslado no tiene línea');

    const receive = await admin
      .post(`/api/v1/inventory/transfers/${transfer.id}/receive`)
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ lineId: line.id, receivedQuantity: '3.000' }] });
    expect(receive.status).toBe(200);
    expect((receive.body as { data: TransferDetail }).data.status).toBe('received_with_variance');

    const transit = await db.execute(sql`
      select coalesce(sum(quantity), 0) as quantity from inventory.stock_balances
      where lot_id = ${line.lotId} and presentation_id = ${presentationId}
        and location_id = (select id from admin.locations where kind = 'in_transit' limit 1)
    `);
    expect((transit.rows[0] as { quantity: string }).quantity).toBe('1.000');
  });

  it('un usuario con alcance SITE solo ve sus sedes y no la ficha de un lote ajeno', async () => {
    const warehouse = await db.execute(sql`select id from admin.sites where name = 'Bodega principal'`);
    const siteId = (warehouse.rows[0] as { id: string }).id;
    const roleId = await ensureRole('INV_TEST_SITE', ['inv.stock.read'], 'SITE');
    const suffix = randomUUID().slice(0, 8);
    const userId = await createUser(`inv-site-${suffix}@test.example`, roleId);
    await db.insert(userSites).values({ userId, siteId });
    const agent = await signIn(`inv-site-${suffix}@test.example`);

    const balances = await agent.get('/api/v1/inventory/stock-balances?limit=100');
    expect(balances.status).toBe(200);
    const rows = (balances.body as StockBalancePage).data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.siteName === 'Bodega principal')).toBe(true);
    expect((await agent.get(`/api/v1/inventory/lots/${pointLotId}`)).status).toBe(404);
  });
});

describe('compras y recepción (RF-050..052, DEC-094)', () => {
  let supplierId = '';
  let wineMaterialId = '';
  let fatMaterialId = '';
  let warehouseSiteId = '';
  let posSiteId = '';
  let warehouseLocationId = '';
  let posLocationId = '';
  let purchaseId = '';
  let carneLineId = '';
  let fatLineId = '';

  beforeAll(async () => {
    const refs = await db.execute(sql`
      select
        (select id from catalog.raw_materials where name = 'Carne de cerdo magra') as "carne",
        (select id from catalog.raw_materials where name = 'Tocino y grasa') as "tocino",
        (select id from admin.sites where name = 'Bodega principal') as "warehouseSite",
        (select id from admin.sites where name = 'Punto de asados') as "posSite",
        (select id from admin.locations where name = 'Principal') as "warehouseLocation",
        (select id from admin.locations where name = 'Productos del punto') as "posLocation"
    `);
    const ref = refs.rows[0] as {
      carne: string;
      tocino: string;
      warehouseSite: string;
      posSite: string;
      warehouseLocation: string;
      posLocation: string;
    };
    wineMaterialId = ref.carne;
    fatMaterialId = ref.tocino;
    warehouseSiteId = ref.warehouseSite;
    posSiteId = ref.posSite;
    warehouseLocationId = ref.warehouseLocation;
    posLocationId = ref.posLocation;

    const supplier = await admin
      .post('/api/v1/purchasing/suppliers')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Proveedor de prueba', taxId: `NIT-${randomUUID().slice(0, 8)}`, phone: '555' });
    expect(supplier.status).toBe(201);
    supplierId = (supplier.body as { data: { id: string } }).data.id;
  });

  it('registra proveedores y rechaza la identificación duplicada', async () => {
    const taxId = `NIT-${randomUUID().slice(0, 8)}`;
    const first = await admin
      .post('/api/v1/purchasing/suppliers')
      .set('Idempotency-Key', randomUUID())
      .send({ name: `Proveedor ${taxId}`, taxId });
    expect(first.status).toBe(201);

    const duplicate = await admin
      .post('/api/v1/purchasing/suppliers')
      .set('Idempotency-Key', randomUUID())
      .send({ name: `Otro ${taxId}`, taxId });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { code: string }).code).toBe('TAX_ID_TAKEN');

    const list = await admin.get('/api/v1/purchasing/suppliers?status=active');
    expect(list.status).toBe(200);
    expect(
      (list.body as { data: { name: string }[] }).data.some((s) => s.name === 'Proveedor de prueba'),
    ).toBe(true);
  });

  it('la compra calcula el total y no mueve inventario', async () => {
    const before = await inventoryCounts();
    const key = randomUUID();
    const create = await admin
      .post('/api/v1/purchasing/purchases')
      .set('Idempotency-Key', key)
      .send({
        supplierId,
        siteId: warehouseSiteId,
        lines: [
          { rawMaterialId: wineMaterialId, quantity: '10.000', unitCost: '18000.0000' },
          { rawMaterialId: fatMaterialId, quantity: '5.000', unitCost: '14000.0000' },
        ],
      });
    expect(create.status).toBe(201);
    const purchase = (
      create.body as {
        data: {
          id: string;
          number: string;
          total: string;
          status: string;
          lines: { id: string; rawMaterialId: string }[];
        };
      }
    ).data;
    purchaseId = purchase.id;
    expect(purchase.number).toBe('C-0001');
    expect(purchase.total).toBe('250000.00');
    expect(purchase.status).toBe('pending_receipt');
    carneLineId = purchase.lines.find((line) => line.rawMaterialId === wineMaterialId)?.id ?? '';
    fatLineId = purchase.lines.find((line) => line.rawMaterialId === fatMaterialId)?.id ?? '';
    expect(await inventoryCounts()).toEqual(before);

    const repeated = await admin
      .post('/api/v1/purchasing/purchases')
      .set('Idempotency-Key', key)
      .send({
        supplierId,
        siteId: warehouseSiteId,
        lines: [
          { rawMaterialId: wineMaterialId, quantity: '10.000', unitCost: '18000.0000' },
          { rawMaterialId: fatMaterialId, quantity: '5.000', unitCost: '14000.0000' },
        ],
      });
    expect(repeated.status).toBe(201);
    expect((repeated.body as { data: { id: string } }).data.id).toBe(purchaseId);
    const rows = await db.execute(sql`select count(*)::int as total from purchasing.purchases`);
    expect((rows.rows[0] as { total: number }).total).toBe(1);
  });

  it('la recepción parcial crea lote, movimiento y deja saldo pendiente', async () => {
    const res = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: warehouseLocationId,
        lines: [{ purchaseLineId: carneLineId, quantity: '6.000', expiresOn: '2027-12-31' }],
      });
    expect(res.status).toBe(201);
    const detail = (
      res.body as {
        data: {
          status: string;
          receipts: { number: string; lines: { lotCode: string }[] }[];
          lines: { id: string; receivedQuantity: string; pendingQuantity: string }[];
        };
      }
    ).data;
    expect(detail.status).toBe('partially_received');
    expect(detail.receipts[0]?.number).toBe('R-0001');
    const lotCode = detail.receipts[0]?.lines[0]?.lotCode ?? '';
    expect(lotCode).toMatch(/^MP-\d{4}-\d{4}$/);
    expect(detail.lines.find((line) => line.id === carneLineId)?.pendingQuantity).toBe('4.000');
    expect(detail.lines.find((line) => line.id === fatLineId)?.pendingQuantity).toBe('5.000');

    const lot = await db.execute(sql`
      select l.id, l.supplier_id as "supplierId", l.receipt_id as "receiptId",
             l.unit_cost as "unitCost", l.expires_on as "expiresOn"
      from inventory.lots l where l.code = ${lotCode}
    `);
    const lotRow = lot.rows[0] as {
      id: string;
      supplierId: string;
      receiptId: string;
      unitCost: string;
      expiresOn: string;
    };
    expect(lotRow.supplierId).toBe(supplierId);
    expect(lotRow.expiresOn).toBe('2027-12-31');
    expect(lotRow.unitCost).toBe('18000.0000');

    const balance = await db.execute(sql`
      select quantity from inventory.stock_balances
      where lot_id = ${lotRow.id} and location_id = ${warehouseLocationId}
    `);
    expect((balance.rows[0] as { quantity: string }).quantity).toBe('6.000');

    const kardex = await db.execute(sql`
      select movement_type as "movementType", source_type as "sourceType"
      from inventory.stock_movements
      where lot_id = ${lotRow.id} and location_id = ${warehouseLocationId}
    `);
    expect(kardex.rows[0]).toEqual({ movementType: 'receipt', sourceType: 'purchasing.receipt' });
  });

  it('rechaza sobre-recepción, ubicación de otra sede y vencimiento inválido', async () => {
    const over = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: warehouseLocationId,
        lines: [{ purchaseLineId: carneLineId, quantity: '5.000', expiresOn: '2027-12-31' }],
      });
    expect(over.status).toBe(422);
    expect((over.body as { code: string }).code).toBe('RECEIPT_EXCEEDS_PENDING');

    const wrongSite = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: posLocationId,
        lines: [{ purchaseLineId: carneLineId, quantity: '1.000', expiresOn: '2027-12-31' }],
      });
    expect(wrongSite.status).toBe(422);
    expect((wrongSite.body as { code: string }).code).toBe('LOCATION_NOT_IN_PURCHASE_SITE');

    const noExpiry = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({ locationId: warehouseLocationId, lines: [{ purchaseLineId: carneLineId, quantity: '1.000' }] });
    expect(noExpiry.status).toBe(422);

    const pastExpiry = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: warehouseLocationId,
        lines: [{ purchaseLineId: carneLineId, quantity: '1.000', expiresOn: '2020-01-01' }],
      });
    expect(pastExpiry.status).toBe(422);
    expect((pastExpiry.body as { code: string }).code).toBe('EXPIRY_IN_PAST');
  });

  it('completa la compra y no permite recibir dos veces', async () => {
    const complete = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: warehouseLocationId,
        lines: [
          { purchaseLineId: carneLineId, quantity: '4.000', expiresOn: '2027-12-31' },
          { purchaseLineId: fatLineId, quantity: '5.000', expiresOn: '2027-12-31' },
        ],
      });
    expect(complete.status).toBe(201);
    expect((complete.body as { data: { status: string } }).data.status).toBe('received');

    const again = await admin
      .post(`/api/v1/purchasing/purchases/${purchaseId}/receipts`)
      .set('Idempotency-Key', randomUUID())
      .send({
        locationId: warehouseLocationId,
        lines: [{ purchaseLineId: carneLineId, quantity: '1.000', expiresOn: '2027-12-31' }],
      });
    expect(again.status).toBe(409);
    expect((again.body as { code: string }).code).toBe('PURCHASE_ALREADY_RECEIVED');
  });

  it('un usuario con alcance SITE no ve compras de otra sede', async () => {
    const posPurchase = await admin
      .post('/api/v1/purchasing/purchases')
      .set('Idempotency-Key', randomUUID())
      .send({
        supplierId,
        siteId: posSiteId,
        lines: [{ rawMaterialId: wineMaterialId, quantity: '1.000', unitCost: '1000.0000' }],
      });
    expect(posPurchase.status).toBe(201);
    const posPurchaseId = (posPurchase.body as { data: { id: string } }).data.id;

    const roleId = await ensureRole('COMP_TEST_SITE', ['comp.purchase.read'], 'SITE');
    const suffix = randomUUID().slice(0, 8);
    const userId = await createUser(`comp-site-${suffix}@test.example`, roleId);
    await db.insert(userSites).values({ userId, siteId: warehouseSiteId });
    const agent = await signIn(`comp-site-${suffix}@test.example`);

    const list = await agent.get('/api/v1/purchasing/purchases?limit=100');
    expect(list.status).toBe(200);
    const ids = (list.body as { data: { id: string }[] }).data.map((purchase) => purchase.id);
    expect(ids).toContain(purchaseId);
    expect(ids).not.toContain(posPurchaseId);
    expect((await agent.get(`/api/v1/purchasing/purchases/${posPurchaseId}`)).status).toBe(404);
  });
});

describe('producción: recetas, consumo y cierre (RF-033, RF-081..083)', () => {
  let productId = '';
  let unitPresentationId = '';
  let packagePresentationId = '';
  let carneId = '';
  let tocinoId = '';
  let warehouseSiteId = '';
  let posSiteId = '';
  let recipeId = '';
  let orderId = '';
  let carneLotId = '';
  let carneLocationId = '';
  let tocinoLotId = '';
  let tocinoLocationId = '';

  beforeAll(async () => {
    const refs = await db.execute(sql`
      select
        (select id from catalog.products where name = 'Chorizo Santarrosano') as "productId",
        (select pr.id from catalog.presentations pr join catalog.products p on p.id = pr.product_id
          where p.name = 'Chorizo Santarrosano' and pr.name = 'Unidad') as "unitPresentationId",
        (select pr.id from catalog.presentations pr join catalog.products p on p.id = pr.product_id
          where p.name = 'Chorizo Santarrosano' and pr.name = 'Paquete x10') as "packagePresentationId",
        (select id from catalog.raw_materials where name = 'Carne de cerdo magra') as "carneId",
        (select id from catalog.raw_materials where name = 'Tocino y grasa') as "tocinoId",
        (select id from admin.sites where name = 'Bodega principal') as "warehouseSiteId",
        (select id from admin.sites where name = 'Punto de asados') as "posSiteId",
        null::uuid as "unused"
    `);
    const ref = refs.rows[0] as {
      productId: string;
      unitPresentationId: string;
      packagePresentationId: string;
      carneId: string;
      tocinoId: string;
      warehouseSiteId: string;
      posSiteId: string;
    };
    productId = ref.productId;
    unitPresentationId = ref.unitPresentationId;
    packagePresentationId = ref.packagePresentationId;
    carneId = ref.carneId;
    tocinoId = ref.tocinoId;
    warehouseSiteId = ref.warehouseSiteId;
    posSiteId = ref.posSiteId;
  });

  it('publica recetas versionadas y rechaza una segunda receta para el producto', async () => {
    const created = await admin
      .post('/api/v1/catalog/recipes')
      .set('Idempotency-Key', randomUUID())
      .send({
        productId,
        baseOutputQty: '100.000',
        lines: [
          { rawMaterialId: carneId, quantity: '10.000' },
          { rawMaterialId: tocinoId, quantity: '3.000' },
        ],
      });
    expect(created.status).toBe(201);
    const recipe = (
      created.body as {
        data: {
          id: string;
          currentVersion: { version: number; expectedYieldPct: string; tolerancePct: string };
        };
      }
    ).data;
    recipeId = recipe.id;
    expect(recipe.currentVersion.version).toBe(1);
    expect(recipe.currentVersion.expectedYieldPct).toBe('100.00');
    expect(recipe.currentVersion.tolerancePct).toBe('3.00');

    const versionTwo = await admin
      .post(`/api/v1/catalog/recipes/${recipeId}/versions`)
      .set('Idempotency-Key', randomUUID())
      .send({
        baseOutputQty: '100.000',
        expectedYieldPct: '98.00',
        tolerancePct: '3.00',
        lines: [
          { rawMaterialId: carneId, quantity: '10.000' },
          { rawMaterialId: tocinoId, quantity: '3.000' },
        ],
      });
    expect(versionTwo.status).toBe(201);
    const detail = versionTwo.body as {
      data: { currentVersion: { version: number }; versions: { version: number; isCurrent: boolean }[] };
    };
    expect(detail.data.currentVersion.version).toBe(2);
    expect(detail.data.versions.map((v) => [v.version, v.isCurrent])).toEqual([
      [2, true],
      [1, false],
    ]);

    const duplicate = await admin
      .post('/api/v1/catalog/recipes')
      .set('Idempotency-Key', randomUUID())
      .send({
        productId,
        baseOutputQty: '100.000',
        lines: [{ rawMaterialId: carneId, quantity: '10.000' }],
      });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { code: string }).code).toBe('RECIPE_EXISTS');
  });

  it('previsualiza el consumo y crea la orden con la versión vigente', async () => {
    const preview = await admin.get(
      `/api/v1/production/availability?productId=${productId}&siteId=${warehouseSiteId}&plannedQty=100.000`,
    );
    expect(preview.status).toBe(200);
    const data = (
      preview.body as {
        data: {
          recipeVersion: number;
          theoreticalConsumption: {
            rawMaterialName: string;
            theoreticalQuantity: string;
            sufficient: boolean;
          }[];
        };
      }
    ).data;
    expect(data.recipeVersion).toBe(2);
    const carne = data.theoreticalConsumption.find((line) => line.rawMaterialName === 'Carne de cerdo magra');
    expect(carne?.theoreticalQuantity).toBe('10.000');
    expect(carne?.sufficient).toBe(true);

    const created = await admin
      .post('/api/v1/production/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ productId, siteId: warehouseSiteId, plannedQty: '100.000' });
    expect(created.status).toBe(201);
    const order = (
      created.body as {
        data: {
          id: string;
          number: string;
          status: string;
          recipeVersion: number;
          theoreticalConsumption: { rawMaterialName: string; availableQuantity: string }[];
          availableLots: { lotId: string; code: string; rawMaterialName: string; locationId: string }[];
        };
      }
    ).data;
    orderId = order.id;
    expect(order.number).toBe('OP-0001');
    expect(order.status).toBe('planned');
    expect(order.recipeVersion).toBe(2);

    const carneLot = order.availableLots.find((lot) => lot.rawMaterialName === 'Carne de cerdo magra');
    const tocinoLot = order.availableLots.find((lot) => lot.rawMaterialName === 'Tocino y grasa');
    expect(carneLot).toBeTruthy();
    expect(tocinoLot).toBeTruthy();
    carneLotId = carneLot?.lotId ?? '';
    carneLocationId = carneLot?.locationId ?? '';
    tocinoLotId = tocinoLot?.lotId ?? '';
    tocinoLocationId = tocinoLot?.locationId ?? '';
  });

  it('consume por lote, descuenta existencias y cierra con lote PT', async () => {
    const consumed = await admin
      .post(`/api/v1/production/orders/${orderId}/consume`)
      .set('Idempotency-Key', randomUUID())
      .send({
        lines: [
          { rawMaterialId: carneId, lotId: carneLotId, locationId: carneLocationId, quantity: '10.000' },
          { rawMaterialId: tocinoId, lotId: tocinoLotId, locationId: tocinoLocationId, quantity: '3.000' },
        ],
      });
    expect(consumed.status).toBe(200);
    const afterConsume = (
      consumed.body as {
        data: { status: string; consumptions: { actualQuantity: string; theoreticalQuantity: string }[] };
      }
    ).data;
    expect(afterConsume.status).toBe('in_progress');
    expect(afterConsume.consumptions).toHaveLength(2);
    expect(afterConsume.consumptions.map((line) => line.theoreticalQuantity).sort()).toEqual([
      '10.000',
      '3.000',
    ]);

    const balances = await db.execute(sql`
      select l.code, b.quantity from inventory.stock_balances b
      join inventory.lots l on l.id = b.lot_id
      where l.id in (${carneLotId}, ${tocinoLotId})
    `);
    const balanceMap = new Map(
      (balances.rows as unknown as { code: string; quantity: string }[]).map((row) => [
        row.code,
        row.quantity,
      ]),
    );
    expect(balanceMap.get('MP-2026-0001')).toBe('70.000');
    expect(balanceMap.get('MP-2026-0002')).toBe('37.000');

    const closed = await admin
      .post(`/api/v1/production/orders/${orderId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({
        outputs: [
          { presentationId: unitPresentationId, quantity: '50.000' },
          { presentationId: packagePresentationId, quantity: '5.000' },
        ],
      });
    expect(closed.status).toBe(200);
    const detail = (
      closed.body as {
        data: {
          status: string;
          actualQty: string;
          yieldPct: string;
          outputLotCode: string;
          outputLotId: string;
        };
      }
    ).data;
    expect(detail.status).toBe('closed');
    expect(detail.actualQty).toBe('100.000');
    expect(detail.yieldPct).toBe('100.00');
    expect(detail.outputLotCode).toMatch(/^PT-\d{4}-\d{4}$/);

    const lot = await db.execute(sql`
      select manufactured_on as "manufacturedOn", expires_on as "expiresOn", unit_cost as "unitCost"
      from inventory.lots where id = ${detail.outputLotId}
    `);
    const lotRow = lot.rows[0] as { manufacturedOn: string; expiresOn: string; unitCost: string | null };
    expect(lotRow.unitCost).toBeNull();
    expect(lotRow.expiresOn).toBeTruthy();

    const outputBalances = await db.execute(sql`
      select pr.name, b.quantity from inventory.stock_balances b
      join catalog.presentations pr on pr.id = b.presentation_id
      where b.lot_id = ${detail.outputLotId}
      order by pr.name
    `);
    expect(outputBalances.rows).toEqual([
      { name: 'Paquete x10', quantity: '5.000' },
      { name: 'Unidad', quantity: '50.000' },
    ]);

    const inputs = await db.execute(sql`
      select count(*)::int as total from inventory.lot_inputs where output_lot_id = ${detail.outputLotId}
    `);
    expect((inputs.rows[0] as { total: number }).total).toBe(2);

    const again = await admin
      .post(`/api/v1/production/orders/${orderId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({ outputs: [{ presentationId: unitPresentationId, quantity: '1.000' }] });
    expect(again.status).toBe(409);
  });

  it('exige motivo cuando el rendimiento sale de tolerancia y no cierra sin consumo', async () => {
    const created = await admin
      .post('/api/v1/production/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ productId, siteId: warehouseSiteId, plannedQty: '100.000' });
    expect(created.status).toBe(201);
    const secondOrderId = (created.body as { data: { id: string } }).data.id;

    const noConsumption = await admin
      .post(`/api/v1/production/orders/${secondOrderId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({ outputs: [{ presentationId: unitPresentationId, quantity: '90.000' }] });
    expect(noConsumption.status).toBe(409);
    expect((noConsumption.body as { code: string }).code).toBe('CONSUMPTION_REQUIRED');

    const consumed = await admin
      .post(`/api/v1/production/orders/${secondOrderId}/consume`)
      .set('Idempotency-Key', randomUUID())
      .send({
        lines: [
          { rawMaterialId: carneId, lotId: carneLotId, locationId: carneLocationId, quantity: '10.000' },
          { rawMaterialId: tocinoId, lotId: tocinoLotId, locationId: tocinoLocationId, quantity: '3.000' },
        ],
      });
    expect(consumed.status).toBe(200);

    const withoutNote = await admin
      .post(`/api/v1/production/orders/${secondOrderId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({ outputs: [{ presentationId: unitPresentationId, quantity: '90.000' }] });
    expect(withoutNote.status).toBe(422);
    expect((withoutNote.body as { code: string }).code).toBe('YIELD_NOTE_REQUIRED');

    const withNote = await admin
      .post(`/api/v1/production/orders/${secondOrderId}/close`)
      .set('Idempotency-Key', randomUUID())
      .send({
        outputs: [{ presentationId: unitPresentationId, quantity: '90.000' }],
        yieldNote: 'Ajuste de humedad en la mezcla',
      });
    expect(withNote.status).toBe(200);
    expect((withNote.body as { data: { yieldNote: string } }).data.yieldNote).toBe(
      'Ajuste de humedad en la mezcla',
    );
  });

  it('un usuario con alcance SITE no ve órdenes de otra sede', async () => {
    const posOrder = await admin
      .post('/api/v1/production/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ productId, siteId: posSiteId, plannedQty: '10.000' });
    expect(posOrder.status).toBe(201);
    const posOrderId = (posOrder.body as { data: { id: string } }).data.id;

    const roleId = await ensureRole('PROD_TEST_SITE', ['prod.order.read'], 'SITE');
    const suffix = randomUUID().slice(0, 8);
    const userId = await createUser(`prod-site-${suffix}@test.example`, roleId);
    await db.insert(userSites).values({ userId, siteId: warehouseSiteId });
    const agent = await signIn(`prod-site-${suffix}@test.example`);

    const list = await agent.get('/api/v1/production/orders?limit=100');
    expect(list.status).toBe(200);
    const ids = (list.body as { data: { id: string }[] }).data.map((order) => order.id);
    expect(ids).toContain(orderId);
    expect(ids).not.toContain(posOrderId);
    expect((await agent.get(`/api/v1/production/orders/${posOrderId}`)).status).toBe(404);
  });
});
