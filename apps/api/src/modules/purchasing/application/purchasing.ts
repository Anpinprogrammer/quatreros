import {
  CreatePurchaseRequest,
  CreateSupplierRequest,
  PurchaseListQuery,
  ReceivePurchaseRequest,
  SupplierListQuery,
  UpdateSupplierRequest,
  type PurchaseDetail,
  type PurchaseLineView,
  type PurchasePage,
  type PurchaseStatus,
  type PurchaseSummary,
  type ReceiptView,
  type SupplierPage,
  type SupplierView,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter } from '../../admin/application/public.js';
import { businessToday, createRawMaterialLot } from '../../inventory/application/public.js';
import { expiryViolation, pendingQuantity, purchaseStatus, purchaseTotal } from '../domain/purchasing.js';
import { purchaseLines, purchases, receiptLines, receipts, suppliers } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface PurchasingDeps {
  db: Database;
}

interface SupplierRow {
  id: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  contactName: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PurchaseRow {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  siteId: string;
  siteName: string;
  purchasedOn: string;
  total: string;
  status: PurchaseStatus;
  createdAt: Date | string;
  lineCount: number;
}

interface PurchaseLineRow {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: PurchaseLineView['unit'];
  tracksExpiry: boolean;
  quantity: string;
  unitCost: string;
  receivedQuantity: string;
  pendingQuantity: string;
}

interface ReceiptRow {
  id: string;
  number: string;
  locationId: string;
  locationName: string;
  receivedAt: Date | string;
  receivedByName: string | null;
}

interface ReceiptLineRow {
  id: string;
  receiptId: string;
  purchaseLineId: string;
  quantity: string;
  lotId: string;
  lotCode: string;
  expiresOn: string | null;
}

function siteIdsFor(ctx: ExecutionContext, permission: string): string[] | null {
  const filter = listFilter(ctx, permission);
  return filter.kind === 'all' ? null : filter.siteIds;
}

function siteCondition(siteIds: string[] | null, alias = 'site'): ReturnType<typeof sql> {
  if (siteIds === null) return sql`true`;
  if (siteIds.length === 0) return sql`false`;
  return sql`${sql.raw(alias)}.id in (${sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSupplier(row: SupplierRow): SupplierView {
  return {
    id: row.id,
    name: row.name,
    taxId: row.taxId,
    phone: row.phone,
    contactName: row.contactName,
    isActive: row.isActive,
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toSummary(row: PurchaseRow): PurchaseSummary {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    siteId: row.siteId,
    siteName: row.siteName,
    purchasedOn: row.purchasedOn,
    total: row.total,
    status: row.status,
    createdAt: iso(row.createdAt),
    lineCount: row.lineCount,
  };
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

function precondition(): AppError {
  return new AppError(
    412,
    'PRECONDITION_FAILED',
    'Registro desactualizado',
    'Otra persona modificó este registro. Recarga para ver la versión actual.',
  );
}

async function nextNumber(tx: Executor, docType: string, prefix: string): Promise<string> {
  await tx.insert(documentSequences).values({ docType }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, docType))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `${prefix}-${String(value).padStart(4, '0')}`;
}

async function supplierExists(tx: Executor, id: string): Promise<SupplierRow | undefined> {
  const result = await tx.execute(sql`
    select id, name, tax_id as "taxId", phone, contact_name as "contactName",
           is_active as "isActive", version, created_at as "createdAt", updated_at as "updatedAt"
    from purchasing.suppliers
    where id = ${id}
    limit 1
  `);
  return (result.rows as unknown as SupplierRow[])[0];
}

async function supplierNameInUse(tx: Executor, name: string, excludeId?: string): Promise<boolean> {
  const result = await tx.execute(sql`
    select 1 from purchasing.suppliers
    where lower(name) = lower(${name}) ${excludeId ? sql`and id <> ${excludeId}` : sql``}
    limit 1
  `);
  return result.rows.length > 0;
}

async function taxIdInUse(tx: Executor, taxId: string, excludeId?: string): Promise<boolean> {
  const result = await tx.execute(sql`
    select 1 from purchasing.suppliers
    where tax_id = ${taxId} ${excludeId ? sql`and id <> ${excludeId}` : sql``}
    limit 1
  `);
  return result.rows.length > 0;
}

export async function listSuppliers(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<SupplierPage> {
  authorize(ctx, 'comp.supplier.read');
  const query = SupplierListQuery.parse(raw);
  const conditions = [];
  if (query.q) conditions.push(sql`name ilike ${`%${query.q}%`}`);
  if (query.status !== 'all') conditions.push(sql`is_active = ${query.status === 'active'}`);
  const result = await deps.db.execute(sql`
    select id, name, tax_id as "taxId", phone, contact_name as "contactName",
           is_active as "isActive", version, created_at as "createdAt", updated_at as "updatedAt"
    from purchasing.suppliers
    where ${sql.join(conditions.length ? conditions : [sql`true`], sql` and `)}
    order by is_active desc, name asc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as SupplierRow[]).map(toSupplier),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function createSupplier(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<SupplierView> {
  authorize(ctx, 'comp.supplier.manage');
  const input = CreateSupplierRequest.parse(raw);

  const id = await deps.db.transaction(async (tx) => {
    if (await supplierNameInUse(tx, input.name)) {
      throw AppError.conflict('NAME_TAKEN', 'Nombre en uso', 'Ya existe un proveedor con ese nombre.');
    }
    if (input.taxId && (await taxIdInUse(tx, input.taxId))) {
      throw AppError.conflict(
        'TAX_ID_TAKEN',
        'Identificación en uso',
        'Ya existe un proveedor con esa identificación.',
      );
    }
    const [row] = await tx
      .insert(suppliers)
      .values({
        name: input.name,
        taxId: input.taxId ?? null,
        phone: input.phone ?? null,
        contactName: input.contactName ?? null,
      })
      .returning({ id: suppliers.id });
    if (!row) throw new Error('No se pudo crear el proveedor');
    await recordAudit(tx, ctx, {
      action: 'comp.supplier.create',
      entityType: 'purchasing.supplier',
      entityId: row.id,
      after: input,
    });
    return row.id;
  });

  const created = await supplierExists(deps.db, id);
  if (!created) throw AppError.notFound();
  return toSupplier(created);
}

export async function updateSupplier(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  id: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<SupplierView> {
  authorize(ctx, 'comp.supplier.manage');
  const input = UpdateSupplierRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const before = await supplierExists(tx, id);
    if (!before) throw AppError.notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) throw precondition();
    if (input.name !== undefined && (await supplierNameInUse(tx, input.name, id))) {
      throw AppError.conflict('NAME_TAKEN', 'Nombre en uso', 'Ya existe un proveedor con ese nombre.');
    }
    if (input.taxId && (await taxIdInUse(tx, input.taxId, id))) {
      throw AppError.conflict(
        'TAX_ID_TAKEN',
        'Identificación en uso',
        'Ya existe un proveedor con esa identificación.',
      );
    }
    await tx
      .update(suppliers)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        version: sql`${suppliers.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id));
    await recordAudit(tx, ctx, {
      action: 'comp.supplier.update',
      entityType: 'purchasing.supplier',
      entityId: id,
      before: toSupplier(before),
      after: input,
    });
  });

  const updated = await supplierExists(deps.db, id);
  if (!updated) throw AppError.notFound();
  return toSupplier(updated);
}

export async function listPurchases(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<PurchasePage> {
  const siteIds = siteIdsFor(ctx, 'comp.purchase.read');
  const query = PurchaseListQuery.parse(raw);
  const conditions = [siteCondition(siteIds)];
  if (query.status) conditions.push(sql`p.status = ${query.status}`);
  if (query.supplierId) conditions.push(sql`p.supplier_id = ${query.supplierId}`);
  if (query.from) conditions.push(sql`p.purchased_on >= ${query.from}`);
  if (query.to) conditions.push(sql`p.purchased_on <= ${query.to}`);
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(sql`(p.number ilike ${term} or s.name ilike ${term})`);
  }

  const result = await deps.db.execute(sql`
    select p.id, p.number,
           p.supplier_id as "supplierId", s.name as "supplierName",
           p.site_id as "siteId", site.name as "siteName",
           p.purchased_on as "purchasedOn", p.total, p.status, p.created_at as "createdAt",
           count(pl.id)::int as "lineCount"
    from purchasing.purchases p
    join purchasing.suppliers s on s.id = p.supplier_id
    join admin.sites site on site.id = p.site_id
    left join purchasing.purchase_lines pl on pl.purchase_id = p.id
    where ${sql.join(conditions, sql` and `)}
    group by p.id, s.name, site.name
    order by p.purchased_on desc, p.number desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as PurchaseRow[]).map(toSummary),
    page: { nextCursor: null, limit: query.limit },
  };
}

async function purchaseRow(
  db: Executor,
  id: string,
  siteIds: string[] | null,
): Promise<PurchaseRow | undefined> {
  const result = await db.execute(sql`
    select p.id, p.number,
           p.supplier_id as "supplierId", s.name as "supplierName",
           p.site_id as "siteId", site.name as "siteName",
           p.purchased_on as "purchasedOn", p.total, p.status, p.created_at as "createdAt",
           count(pl.id)::int as "lineCount"
    from purchasing.purchases p
    join purchasing.suppliers s on s.id = p.supplier_id
    join admin.sites site on site.id = p.site_id
    left join purchasing.purchase_lines pl on pl.purchase_id = p.id
    where p.id = ${id} and ${siteCondition(siteIds)}
    group by p.id, s.name, site.name
    limit 1
  `);
  return (result.rows as unknown as PurchaseRow[])[0];
}

async function purchaseLineRows(db: Executor, purchaseId: string): Promise<PurchaseLineRow[]> {
  const result = await db.execute(sql`
    select pl.id, pl.raw_material_id as "rawMaterialId", rm.name as "rawMaterialName",
           rm.unit, rm.tracks_expiry as "tracksExpiry",
           pl.quantity, pl.unit_cost as "unitCost", pl.received_qty as "receivedQuantity",
           (pl.quantity - pl.received_qty) as "pendingQuantity"
    from purchasing.purchase_lines pl
    join catalog.raw_materials rm on rm.id = pl.raw_material_id
    where pl.purchase_id = ${purchaseId}
    order by rm.name asc, pl.id asc
  `);
  return result.rows as unknown as PurchaseLineRow[];
}

async function receiptViews(db: Executor, purchaseId: string): Promise<ReceiptView[]> {
  const receiptResult = await db.execute(sql`
    select r.id, r.number, r.location_id as "locationId", loc.name as "locationName",
           r.received_at as "receivedAt", u.full_name as "receivedByName"
    from purchasing.receipts r
    join admin.locations loc on loc.id = r.location_id
    left join admin.users u on u.id = r.received_by
    where r.purchase_id = ${purchaseId} and r.status = 'posted'
    order by r.received_at desc, r.number desc
  `);
  const rows = receiptResult.rows as unknown as ReceiptRow[];
  if (rows.length === 0) return [];
  const lineResult = await db.execute(sql`
    select rl.id, rl.receipt_id as "receiptId", rl.purchase_line_id as "purchaseLineId",
           rl.quantity, l.id as "lotId", l.code as "lotCode", l.expires_on as "expiresOn"
    from purchasing.receipt_lines rl
    join inventory.lots l on l.id = rl.lot_id
    where rl.receipt_id in (${sql.join(
      rows.map((row) => sql`${row.id}`),
      sql`, `,
    )})
    order by l.code asc
  `);
  const lines = lineResult.rows as unknown as ReceiptLineRow[];
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    locationId: row.locationId,
    locationName: row.locationName,
    receivedAt: iso(row.receivedAt),
    receivedByName: row.receivedByName,
    lines: lines
      .filter((line) => line.receiptId === row.id)
      .map((line) => ({
        id: line.id,
        purchaseLineId: line.purchaseLineId,
        quantity: line.quantity,
        lotId: line.lotId,
        lotCode: line.lotCode,
        expiresOn: line.expiresOn,
      })),
  }));
}

async function receptionLocations(
  db: Executor,
  siteId: string,
): Promise<PurchaseDetail['receptionLocations']> {
  const result = await db.execute(sql`
    select id, name, kind
    from admin.locations
    where site_id = ${siteId} and is_active = true
    order by name asc
  `);
  return result.rows as unknown as PurchaseDetail['receptionLocations'];
}

export async function getPurchase(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<PurchaseDetail> {
  const siteIds = siteIdsFor(ctx, 'comp.purchase.read');
  const row = await purchaseRow(deps.db, id, siteIds);
  if (!row) throw AppError.notFound();
  const [lines, receiptList, locations] = await Promise.all([
    purchaseLineRows(deps.db, id),
    receiptViews(deps.db, id),
    receptionLocations(deps.db, row.siteId),
  ]);
  return {
    ...toSummary(row),
    lines: lines.map((line) => ({
      id: line.id,
      rawMaterialId: line.rawMaterialId,
      rawMaterialName: line.rawMaterialName,
      unit: line.unit,
      tracksExpiry: line.tracksExpiry,
      quantity: line.quantity,
      unitCost: line.unitCost,
      receivedQuantity: line.receivedQuantity,
      pendingQuantity: pendingQuantity(line.quantity, line.receivedQuantity),
    })),
    receipts: receiptList,
    receptionLocations: locations,
  };
}

export async function createPurchase(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<PurchaseDetail> {
  const actor = authorize(ctx, 'comp.purchase.create');
  const input = CreatePurchaseRequest.parse(raw);
  const purchasedOn = input.purchasedOn ?? businessToday();
  const materialIds = input.lines.map((line) => line.rawMaterialId);
  if (new Set(materialIds).size !== materialIds.length) {
    throw validation('Cada materia prima debe aparecer una sola vez en la compra.');
  }

  const purchaseId = await deps.db.transaction(async (tx) => {
    const supplier = await supplierExists(tx, input.supplierId);
    if (!supplier) throw AppError.notFound();
    if (!supplier.isActive) {
      throw AppError.conflict(
        'SUPPLIER_INACTIVE',
        'Proveedor inactivo',
        'Reactiva el proveedor antes de registrar una compra.',
      );
    }

    const siteResult = await tx.execute(sql`
      select id, name, is_active as "isActive" from admin.sites where id = ${input.siteId} limit 1
    `);
    const site = (siteResult.rows as unknown as { id: string; name: string; isActive: boolean }[])[0];
    if (!site || !site.isActive) throw AppError.notFound();
    authorize(ctx, 'comp.purchase.create', { siteId: site.id });

    const materialResult = await tx.execute(sql`
      select id, name, is_active as "isActive"
      from catalog.raw_materials
      where id in (${sql.join(
        materialIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    const materials = materialResult.rows as unknown as { id: string; name: string; isActive: boolean }[];
    if (materials.length !== materialIds.length) throw AppError.notFound();
    const inactive = materials.find((material) => !material.isActive);
    if (inactive) {
      throw AppError.conflict(
        'RAW_MATERIAL_INACTIVE',
        'Materia prima inactiva',
        `Reactiva ${inactive.name} antes de registrar la compra.`,
      );
    }

    const total = purchaseTotal(input.lines);
    const number = await nextNumber(tx, 'C', 'C');
    const [purchase] = await tx
      .insert(purchases)
      .values({
        number,
        supplierId: input.supplierId,
        siteId: input.siteId,
        purchasedOn,
        total,
        createdBy: actor.userId,
      })
      .returning({ id: purchases.id });
    if (!purchase) throw new Error('No se pudo crear la compra');

    await tx.insert(purchaseLines).values(
      input.lines.map((line) => ({
        purchaseId: purchase.id,
        rawMaterialId: line.rawMaterialId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    );

    await recordAudit(tx, ctx, {
      action: 'comp.purchase.create',
      entityType: 'purchasing.purchase',
      entityId: purchase.id,
      siteId: site.id,
      after: {
        number,
        supplierId: input.supplierId,
        siteId: site.id,
        purchasedOn,
        total,
        lines: input.lines,
      },
    });
    return purchase.id;
  });

  return getPurchase(deps, ctx, purchaseId);
}

async function locationInSite(
  tx: Executor,
  locationId: string,
): Promise<{ id: string; siteId: string; isActive: boolean } | undefined> {
  const result = await tx.execute(sql`
    select id, site_id as "siteId", is_active as "isActive"
    from admin.locations where id = ${locationId} limit 1
  `);
  return (result.rows as unknown as { id: string; siteId: string; isActive: boolean }[])[0];
}

export async function receivePurchase(
  deps: PurchasingDeps,
  ctx: ExecutionContext,
  purchaseId: string,
  raw: unknown,
): Promise<PurchaseDetail> {
  const actor = authorize(ctx, 'comp.receipt.create');
  const input = ReceivePurchaseRequest.parse(raw);
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (seen.has(line.purchaseLineId)) {
      throw validation('Una línea de compra aparece dos veces en la recepción.');
    }
    seen.add(line.purchaseLineId);
  }

  await deps.db.transaction(async (tx) => {
    const purchaseResult = await tx.execute(sql`
      select id, number, supplier_id as "supplierId", site_id as "siteId", status
      from purchasing.purchases where id = ${purchaseId}
      for update
    `);
    const purchase = (
      purchaseResult.rows as unknown as {
        id: string;
        number: string;
        supplierId: string;
        siteId: string;
        status: PurchaseStatus;
      }[]
    )[0];
    if (!purchase) throw AppError.notFound();
    authorize(ctx, 'comp.receipt.create', { siteId: purchase.siteId });
    if (purchase.status === 'received') {
      throw AppError.conflict(
        'PURCHASE_ALREADY_RECEIVED',
        'Compra ya recibida',
        'Esta compra ya está completa y no admite otra recepción.',
      );
    }

    const lineResult = await tx.execute(sql`
      select id, raw_material_id as "rawMaterialId", quantity, unit_cost as "unitCost",
             received_qty as "receivedQuantity"
      from purchasing.purchase_lines
      where purchase_id = ${purchaseId}
      order by id
      for update
    `);
    const lines = lineResult.rows as unknown as {
      id: string;
      rawMaterialId: string;
      quantity: string;
      unitCost: string;
      receivedQuantity: string;
    }[];
    const byId = new Map(lines.map((line) => [line.id, line]));

    const location = await locationInSite(tx, input.locationId);
    if (!location || !location.isActive) throw AppError.notFound();
    if (location.siteId !== purchase.siteId) {
      throw new AppError(
        422,
        'LOCATION_NOT_IN_PURCHASE_SITE',
        'Ubicación inválida',
        'La ubicación de recepción debe pertenecer a la sede de la compra.',
      );
    }

    const materialResult = await tx.execute(sql`
      select id, name, tracks_expiry as "tracksExpiry"
      from catalog.raw_materials
      where id in (${sql.join(
        [...new Set(lines.map((line) => line.rawMaterialId))].map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    const materials = new Map(
      (materialResult.rows as unknown as { id: string; name: string; tracksExpiry: boolean }[]).map(
        (material) => [material.id, material],
      ),
    );

    const today = businessToday();
    for (const received of input.lines) {
      const line = byId.get(received.purchaseLineId);
      if (!line) throw validation('La línea no pertenece a esta compra.');
      const pending = new Decimal(line.quantity).minus(line.receivedQuantity);
      const amount = new Decimal(received.quantity);
      if (amount.gt(pending)) {
        throw new AppError(
          422,
          'RECEIPT_EXCEEDS_PENDING',
          'Cantidad mayor a la pendiente',
          `Solo quedan ${pending.toFixed(3)} por recibir en esa línea.`,
        );
      }
      const material = materials.get(line.rawMaterialId);
      if (!material) throw AppError.notFound();
      const expiry = expiryViolation(received.expiresOn, material.tracksExpiry, today);
      if (expiry === 'EXPIRY_REQUIRED') {
        throw validation(`Indica el vencimiento de ${material.name}.`);
      }
      if (expiry === 'EXPIRY_IN_PAST') {
        throw new AppError(
          422,
          'EXPIRY_IN_PAST',
          'Vencimiento inválido',
          `El vencimiento de ${material.name} no puede ser anterior a hoy.`,
        );
      }
    }

    const number = await nextNumber(tx, 'R', 'R');
    const [receipt] = await tx
      .insert(receipts)
      .values({
        number,
        purchaseId,
        locationId: location.id,
        receivedBy: actor.userId,
      })
      .returning({ id: receipts.id });
    if (!receipt) throw new Error('No se pudo crear la recepción');

    const createdLots: { purchaseLineId: string; lotCode: string; quantity: string }[] = [];
    for (const received of input.lines) {
      const line = byId.get(received.purchaseLineId);
      if (!line) throw validation('La línea no pertenece a esta compra.');
      const lot = await createRawMaterialLot(tx, {
        receiptId: receipt.id,
        supplierId: purchase.supplierId,
        rawMaterialId: line.rawMaterialId,
        locationId: location.id,
        quantity: received.quantity,
        unitCost: line.unitCost,
        expiresOn: received.expiresOn ?? null,
        createdBy: actor.userId,
        reason: `Recepción ${number} · compra ${purchase.number}`,
      });
      await tx.insert(receiptLines).values({
        receiptId: receipt.id,
        purchaseLineId: line.id,
        quantity: received.quantity,
        lotId: lot.lotId,
      });
      line.receivedQuantity = new Decimal(line.receivedQuantity).plus(received.quantity).toFixed(3);
      await tx
        .update(purchaseLines)
        .set({ receivedQty: line.receivedQuantity })
        .where(eq(purchaseLines.id, line.id));
      createdLots.push({
        purchaseLineId: line.id,
        lotCode: lot.code,
        quantity: received.quantity,
      });
    }

    const status = purchaseStatus(
      lines.map((line) => ({ quantity: line.quantity, receivedQuantity: line.receivedQuantity })),
    );
    await tx.update(purchases).set({ status }).where(eq(purchases.id, purchaseId));

    await recordAudit(tx, ctx, {
      action: 'comp.receipt.create',
      entityType: 'purchasing.receipt',
      entityId: receipt.id,
      siteId: purchase.siteId,
      after: {
        number,
        purchaseNumber: purchase.number,
        locationId: location.id,
        lines: input.lines,
        lots: createdLots,
        status,
      },
    });
  });

  return getPurchase(deps, ctx, purchaseId);
}
