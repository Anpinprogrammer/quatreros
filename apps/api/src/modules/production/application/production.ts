import {
  CloseProductionOrderRequest,
  ConsumeProductionOrderRequest,
  CreateProductionOrderRequest,
  ProductionOrderListQuery,
  ProductionPreviewQuery,
  type ProductionPreview,
  type AvailableLot,
  type ConsumptionView,
  type ProductionOrderDetail,
  type ProductionOrderPage,
  type ProductionOrderStatus,
  type ProductionOrderSummary,
  type TheoreticalConsumption,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import { recordEvent } from '../../accounting/application/public.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter } from '../../admin/application/public.js';
import {
  loadCurrentProductionRecipe,
  loadProductionRecipeVersion,
  type ProductionRecipe,
} from '../../catalog/application/public.js';
import { businessToday, createFinishedGoodLot, recordMovement } from '../../inventory/application/public.js';
import { productionYield, theoreticalQuantity, yieldOutOfTolerance } from '../domain/production.js';
import { consumptions, orders, outputs } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface ProductionDeps {
  db: Database;
}

interface OrderRow {
  id: string;
  number: string;
  productId: string;
  productName: string;
  siteId: string;
  siteName: string;
  recipeVersionId: string;
  recipeVersion: number;
  plannedQty: string;
  actualQty: string | null;
  yieldPct: string | null;
  yieldNote: string | null;
  status: ProductionOrderStatus;
  responsibleId: string;
  responsibleName: string | null;
  createdAt: Date | string;
  closedAt: Date | string | null;
  outputLotId: string | null;
  outputLotCode: string | null;
  expectedYieldPct: string;
  tolerancePct: string;
}

interface ConsumptionRow {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: ConsumptionView['unit'];
  lotId: string;
  lotCode: string;
  locationId: string;
  locationName: string;
  theoreticalQuantity: string;
  actualQuantity: string;
}

interface OutputRow {
  id: string;
  presentationId: string;
  presentationName: string;
  quantity: string;
  baseQuantity: string;
}

interface LotRow {
  lotId: string;
  code: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: AvailableLot['unit'];
  locationId: string;
  locationName: string;
  available: string;
  expiresOn: string | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
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

function theoreticalConsumption(recipe: ProductionRecipe, plannedQty: string): TheoreticalConsumption[] {
  return recipe.lines.map((line) => {
    const quantity = theoreticalQuantity(line.quantity, recipe.baseOutputQty, plannedQty);
    return {
      rawMaterialId: line.rawMaterialId,
      rawMaterialName: line.rawMaterialName,
      unit: line.unit,
      theoreticalQuantity: quantity,
      availableQuantity: '0',
      sufficient: false,
    };
  });
}

async function availabilityByMaterial(db: Executor, siteId: string): Promise<Map<string, string>> {
  const result = await db.execute(sql`
    select l.raw_material_id as "rawMaterialId", coalesce(sum(b.quantity), 0) as quantity
    from inventory.stock_balances b
    join inventory.lots l on l.id = b.lot_id
    join admin.locations loc on loc.id = b.location_id
    where loc.site_id = ${siteId}
      and b.presentation_id is null
      and b.quantity > 0
      and l.status = 'available'
      and (l.expires_on is null or l.expires_on >= current_date)
    group by l.raw_material_id
  `);
  return new Map(
    (result.rows as unknown as { rawMaterialId: string; quantity: string }[]).map((row) => [
      row.rawMaterialId,
      row.quantity,
    ]),
  );
}

async function orderRow(db: Executor, id: string, siteIds: string[] | null): Promise<OrderRow | undefined> {
  const result = await db.execute(sql`
    select o.id, o.number, p.id as "productId", p.name as "productName",
           o.site_id as "siteId", site.name as "siteName",
           o.recipe_version_id as "recipeVersionId", rv.version as "recipeVersion",
           rv.expected_yield_pct as "expectedYieldPct", rv.tolerance_pct as "tolerancePct",
           o.planned_qty as "plannedQty", o.actual_qty as "actualQty",
           o.yield_pct as "yieldPct", o.yield_note as "yieldNote", o.status,
           o.responsible_id as "responsibleId", u.full_name as "responsibleName",
           o.created_at as "createdAt", o.closed_at as "closedAt",
           o.output_lot_id as "outputLotId", l.code as "outputLotCode"
    from production.orders o
    join catalog.products p on p.id = o.product_id
    join admin.sites site on site.id = o.site_id
    join catalog.recipe_versions rv on rv.id = o.recipe_version_id
    left join admin.users u on u.id = o.responsible_id
    left join inventory.lots l on l.id = o.output_lot_id
    where o.id = ${id} and ${siteCondition(siteIds)}
    limit 1
  `);
  return (result.rows as unknown as OrderRow[])[0];
}

function toSummary(row: OrderRow): ProductionOrderSummary {
  return {
    id: row.id,
    number: row.number,
    productId: row.productId,
    productName: row.productName,
    siteId: row.siteId,
    siteName: row.siteName,
    recipeVersionId: row.recipeVersionId,
    recipeVersion: row.recipeVersion,
    plannedQty: row.plannedQty,
    actualQty: row.actualQty,
    yieldPct: row.yieldPct,
    status: row.status,
    responsibleId: row.responsibleId,
    responsibleName: row.responsibleName,
    createdAt: iso(row.createdAt),
    closedAt: row.closedAt ? iso(row.closedAt) : null,
  };
}

async function consumptionRows(db: Executor, orderId: string): Promise<ConsumptionRow[]> {
  const result = await db.execute(sql`
    select c.id, c.raw_material_id as "rawMaterialId", rm.name as "rawMaterialName", rm.unit,
           c.lot_id as "lotId", l.code as "lotCode",
           c.theoretical_qty as "theoreticalQuantity", c.actual_qty as "actualQuantity",
           c.location_id as "locationId", loc.name as "locationName"
    from production.consumptions c
    join catalog.raw_materials rm on rm.id = c.raw_material_id
    join inventory.lots l on l.id = c.lot_id
    join admin.locations loc on loc.id = c.location_id
    where c.order_id = ${orderId}
    order by rm.name, l.code
  `);
  return result.rows as unknown as ConsumptionRow[];
}

async function outputRows(db: Executor, orderId: string): Promise<OutputRow[]> {
  const result = await db.execute(sql`
    select o.id, o.presentation_id as "presentationId", pr.name as "presentationName",
           o.quantity, o.base_quantity as "baseQuantity"
    from production.outputs o
    join catalog.presentations pr on pr.id = o.presentation_id
    where o.order_id = ${orderId}
    order by pr.name
  `);
  return result.rows as unknown as OutputRow[];
}

async function availableLotRows(db: Executor, siteId: string): Promise<LotRow[]> {
  const result = await db.execute(sql`
    select l.id as "lotId", l.code, l.raw_material_id as "rawMaterialId",
           rm.name as "rawMaterialName", rm.unit,
           b.location_id as "locationId", loc.name as "locationName",
           b.quantity as available, l.expires_on as "expiresOn"
    from inventory.stock_balances b
    join inventory.lots l on l.id = b.lot_id
    join catalog.raw_materials rm on rm.id = l.raw_material_id
    join admin.locations loc on loc.id = b.location_id
    where loc.site_id = ${siteId}
      and b.presentation_id is null
      and b.quantity > 0
      and l.status = 'available'
      and (l.expires_on is null or l.expires_on >= current_date)
    order by l.expires_on nulls last, l.code
    limit 200
  `);
  return result.rows as unknown as LotRow[];
}

async function productionLocation(
  db: Executor,
  siteId: string,
): Promise<{ id: string; name: string } | undefined> {
  const result = await db.execute(sql`
    select id, name from admin.locations
    where site_id = ${siteId} and kind = 'production' and is_active = true
    limit 1
  `);
  return (result.rows as unknown as { id: string; name: string }[])[0];
}

async function detailFrom(
  db: Executor,
  row: OrderRow,
  recipe: ProductionRecipe | undefined,
): Promise<ProductionOrderDetail> {
  const [cons, outs, lots, location] = await Promise.all([
    consumptionRows(db, row.id),
    outputRows(db, row.id),
    availableLotRows(db, row.siteId),
    productionLocation(db, row.siteId),
  ]);
  const availability = await availabilityByMaterial(db, row.siteId);
  const theoretical = recipe
    ? theoreticalConsumption(recipe, row.plannedQty).map((line) => {
        const available = availability.get(line.rawMaterialId) ?? '0';
        return {
          ...line,
          availableQuantity: available,
          sufficient: new Decimal(available).gte(line.theoreticalQuantity),
        };
      })
    : [];
  return {
    ...toSummary(row),
    expectedYieldPct: row.expectedYieldPct,
    tolerancePct: row.tolerancePct,
    theoreticalConsumption: theoretical,
    consumptions: cons.map((line) => ({
      id: line.id,
      rawMaterialId: line.rawMaterialId,
      rawMaterialName: line.rawMaterialName,
      unit: line.unit,
      lotId: line.lotId,
      lotCode: line.lotCode,
      locationId: line.locationId,
      locationName: line.locationName,
      theoreticalQuantity: line.theoreticalQuantity,
      actualQuantity: line.actualQuantity,
    })),
    outputs: outs.map((line) => ({
      id: line.id,
      presentationId: line.presentationId,
      presentationName: line.presentationName,
      quantity: line.quantity,
      baseQuantity: line.baseQuantity,
    })),
    availableLots: lots.map((lot) => ({
      lotId: lot.lotId,
      code: lot.code,
      rawMaterialId: lot.rawMaterialId,
      rawMaterialName: lot.rawMaterialName,
      unit: lot.unit,
      locationId: lot.locationId,
      locationName: lot.locationName,
      available: lot.available,
      expiresOn: lot.expiresOn,
    })),
    outputLocation: location ?? null,
    outputLotId: row.outputLotId,
    outputLotCode: row.outputLotCode,
    yieldNote: row.yieldNote,
  };
}

export async function listOrders(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ProductionOrderPage> {
  const siteIds = siteIdsFor(ctx, 'prod.order.read');
  const query = ProductionOrderListQuery.parse(raw);
  const conditions = [siteCondition(siteIds)];
  if (query.status) conditions.push(sql`o.status = ${query.status}`);
  if (query.from) conditions.push(sql`o.created_at::date >= ${query.from}`);
  if (query.to) conditions.push(sql`o.created_at::date <= ${query.to}`);
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(sql`(o.number ilike ${term} or p.name ilike ${term})`);
  }
  const result = await deps.db.execute(sql`
    select o.id, o.number, p.id as "productId", p.name as "productName",
           o.site_id as "siteId", site.name as "siteName",
           o.recipe_version_id as "recipeVersionId", rv.version as "recipeVersion",
           rv.expected_yield_pct as "expectedYieldPct", rv.tolerance_pct as "tolerancePct",
           o.planned_qty as "plannedQty", o.actual_qty as "actualQty",
           o.yield_pct as "yieldPct", o.yield_note as "yieldNote", o.status,
           o.responsible_id as "responsibleId", u.full_name as "responsibleName",
           o.created_at as "createdAt", o.closed_at as "closedAt",
           o.output_lot_id as "outputLotId", l.code as "outputLotCode"
    from production.orders o
    join catalog.products p on p.id = o.product_id
    join admin.sites site on site.id = o.site_id
    join catalog.recipe_versions rv on rv.id = o.recipe_version_id
    left join admin.users u on u.id = o.responsible_id
    left join inventory.lots l on l.id = o.output_lot_id
    where ${sql.join(conditions, sql` and `)}
    order by o.created_at desc, o.number desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as OrderRow[]).map(toSummary),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function previewOrder(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ProductionPreview> {
  authorize(ctx, 'prod.order.create');
  const input = ProductionPreviewQuery.parse(raw);
  const siteResult = await deps.db.execute(sql`
    select id, is_active as "isActive" from admin.sites where id = ${input.siteId} limit 1
  `);
  const site = (siteResult.rows as unknown as { id: string; isActive: boolean }[])[0];
  if (!site || !site.isActive) throw AppError.notFound();
  authorize(ctx, 'prod.order.create', { siteId: site.id });
  const productResult = await deps.db.execute(sql`
    select id, kind, is_active as "isActive" from catalog.products where id = ${input.productId} limit 1
  `);
  const product = (productResult.rows as unknown as { id: string; kind: string; isActive: boolean }[])[0];
  if (!product) throw AppError.notFound();
  if (product.kind !== 'manufactured' || !product.isActive) {
    throw validation('Solo se producen productos fabricados activos.');
  }
  const recipe = await loadCurrentProductionRecipe(deps.db, input.productId);
  if (!recipe) {
    throw AppError.conflict(
      'RECIPE_REQUIRED',
      'Receta requerida',
      'El producto no tiene una receta de producción vigente.',
    );
  }
  const availability = await availabilityByMaterial(deps.db, input.siteId);
  return {
    recipeVersionId: recipe.recipeVersionId,
    recipeVersion: recipe.recipeVersion,
    baseOutputQty: recipe.baseOutputQty,
    expectedYieldPct: recipe.expectedYieldPct,
    tolerancePct: recipe.tolerancePct,
    theoreticalConsumption: theoreticalConsumption(recipe, input.plannedQty).map((line) => {
      const available = availability.get(line.rawMaterialId) ?? '0';
      return {
        ...line,
        availableQuantity: available,
        sufficient: new Decimal(available).gte(line.theoreticalQuantity),
      };
    }),
  };
}

export async function getOrder(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<ProductionOrderDetail> {
  const siteIds = siteIdsFor(ctx, 'prod.order.read');
  const row = await orderRow(deps.db, id, siteIds);
  if (!row) throw AppError.notFound();
  const recipe = await loadProductionRecipeVersion(deps.db, row.recipeVersionId);
  return detailFrom(deps.db, row, recipe);
}

export async function createOrder(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ProductionOrderDetail> {
  const actor = authorize(ctx, 'prod.order.create');
  const input = CreateProductionOrderRequest.parse(raw);

  const id = await deps.db.transaction(async (tx) => {
    const productResult = await tx.execute(sql`
      select id, name, kind, is_active as "isActive" from catalog.products
      where id = ${input.productId} limit 1
    `);
    const product = (
      productResult.rows as unknown as { id: string; name: string; kind: string; isActive: boolean }[]
    )[0];
    if (!product) throw AppError.notFound();
    if (product.kind !== 'manufactured') {
      throw validation('Solo se producen productos fabricados.');
    }
    if (!product.isActive) {
      throw AppError.conflict(
        'PRODUCT_INACTIVE',
        'Producto inactivo',
        'Reactiva el producto antes de crear una orden.',
      );
    }
    const siteResult = await tx.execute(sql`
      select id, is_active as "isActive" from admin.sites where id = ${input.siteId} limit 1
    `);
    const site = (siteResult.rows as unknown as { id: string; isActive: boolean }[])[0];
    if (!site || !site.isActive) throw AppError.notFound();
    authorize(ctx, 'prod.order.create', { siteId: site.id });

    const recipe = await loadCurrentProductionRecipe(tx, input.productId);
    if (!recipe) {
      throw AppError.conflict(
        'RECIPE_REQUIRED',
        'Receta requerida',
        'El producto no tiene una receta de producción vigente.',
      );
    }
    const number = await nextNumber(tx, 'OP', 'OP');
    const [order] = await tx
      .insert(orders)
      .values({
        number,
        siteId: input.siteId,
        productId: input.productId,
        recipeVersionId: recipe.recipeVersionId,
        plannedQty: input.plannedQty,
        responsibleId: actor.userId,
      })
      .returning({ id: orders.id });
    if (!order) throw new Error('No se pudo crear la orden');
    await recordAudit(tx, ctx, {
      action: 'prod.order.create',
      entityType: 'production.order',
      entityId: order.id,
      siteId: site.id,
      after: {
        number,
        productId: input.productId,
        recipeVersionId: recipe.recipeVersionId,
        plannedQty: input.plannedQty,
        siteId: site.id,
      },
    });
    return order.id;
  });

  return getOrder(deps, ctx, id);
}

export async function consumeOrder(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<ProductionOrderDetail> {
  const input = ConsumeProductionOrderRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const orderResult = await tx.execute(sql`
      select id, number, site_id as "siteId", product_id as "productId",
             recipe_version_id as "recipeVersionId", planned_qty as "plannedQty",
             status, responsible_id as "responsibleId"
      from production.orders where id = ${id}
      for update
    `);
    const order = (
      orderResult.rows as unknown as {
        id: string;
        number: string;
        siteId: string;
        productId: string;
        recipeVersionId: string;
        plannedQty: string;
        status: ProductionOrderStatus;
        responsibleId: string;
      }[]
    )[0];
    if (!order) throw AppError.notFound();
    const actor = authorize(ctx, 'prod.order.execute', {
      siteId: order.siteId,
      ownerId: order.responsibleId,
    });
    if (order.status !== 'planned') {
      throw AppError.conflict(
        'ORDER_NOT_PLANNED',
        'Orden no planificada',
        'Solo una orden planificada puede iniciar el consumo.',
      );
    }

    const recipe = await loadProductionRecipeVersion(tx, order.recipeVersionId);
    if (!recipe) {
      throw AppError.conflict(
        'RECIPE_REQUIRED',
        'Receta requerida',
        'La versión de receta de la orden ya no está disponible.',
      );
    }
    const theoretical = new Map(
      theoreticalConsumption(recipe, order.plannedQty).map((line) => [
        line.rawMaterialId,
        new Decimal(line.theoreticalQuantity),
      ]),
    );

    const seen = new Set<string>();
    const actualByMaterial = new Map<string, Decimal>();
    const lotRows: {
      lotId: string;
      rawMaterialId: string;
      quantity: string;
      locationId: string;
    }[] = [];

    for (const line of input.lines) {
      const key = `${line.rawMaterialId}:${line.lotId}`;
      if (seen.has(key)) throw validation('El mismo lote aparece dos veces en el consumo.');
      seen.add(key);
      if (!theoretical.has(line.rawMaterialId)) {
        throw validation('La materia prima no pertenece a la receta de la orden.');
      }
      const lotResult = await tx.execute(sql`
        select l.id as "lotId", l.raw_material_id as "rawMaterialId", l.status,
               l.expires_on as "expiresOn", b.quantity, b.location_id as "locationId",
               loc.site_id as "siteId", loc.is_active as "isActive"
        from inventory.lots l
        join inventory.stock_balances b on b.lot_id = l.id and b.presentation_id is null
        join admin.locations loc on loc.id = b.location_id
        where l.id = ${line.lotId} and b.location_id = ${line.locationId} and b.quantity > 0
        for update of b
      `);
      const lot = (
        lotResult.rows as unknown as {
          lotId: string;
          rawMaterialId: string;
          status: string;
          expiresOn: string | null;
          quantity: string;
          locationId: string;
          siteId: string;
          isActive: boolean;
        }[]
      )[0];
      if (!lot || lot.rawMaterialId !== line.rawMaterialId) throw AppError.notFound();
      if (lot.status !== 'available' || !lot.isActive) {
        throw new AppError(
          422,
          'LOT_NOT_AVAILABLE',
          'Lote no disponible',
          'El lote está bloqueado, vencido o su ubicación no está activa.',
        );
      }
      if (lot.expiresOn && lot.expiresOn < businessToday()) {
        throw new AppError(
          422,
          'LOT_NOT_AVAILABLE',
          'Lote no disponible',
          'No se puede consumir un lote vencido.',
        );
      }
      if (lot.siteId !== order.siteId) {
        throw validation('El lote debe estar en una ubicación de la sede de la orden.');
      }
      if (new Decimal(line.quantity).gt(lot.quantity)) {
        throw AppError.conflict(
          'INSUFFICIENT_STOCK',
          'Existencia insuficiente',
          'La cantidad consumida supera la existencia del lote.',
        );
      }
      lotRows.push({
        lotId: lot.lotId,
        rawMaterialId: lot.rawMaterialId,
        quantity: line.quantity,
        locationId: lot.locationId,
      });
      const current = actualByMaterial.get(line.rawMaterialId) ?? new Decimal(0);
      actualByMaterial.set(line.rawMaterialId, current.plus(line.quantity));
    }

    // Reparte el teórico de cada materia prima entre sus lotes, proporcional al consumo real.
    const theoreticalAssigned = new Map<string, Decimal>();
    for (let index = 0; index < lotRows.length; index += 1) {
      const line = lotRows[index];
      if (!line) continue;
      const totalActual = actualByMaterial.get(line.rawMaterialId) ?? new Decimal(0);
      const totalTheoretical = theoretical.get(line.rawMaterialId) ?? new Decimal(0);
      const isLastForMaterial = !lotRows
        .slice(index + 1)
        .some((next) => next.rawMaterialId === line.rawMaterialId);
      const already = theoreticalAssigned.get(line.rawMaterialId) ?? new Decimal(0);
      const share = isLastForMaterial
        ? Decimal.max(totalTheoretical.minus(already), 0)
        : totalTheoretical.times(line.quantity).div(totalActual).toDecimalPlaces(3);
      theoreticalAssigned.set(line.rawMaterialId, already.plus(share));

      await tx.insert(consumptions).values({
        orderId: order.id,
        rawMaterialId: line.rawMaterialId,
        lotId: line.lotId,
        locationId: line.locationId,
        theoreticalQty: share.toFixed(3),
        actualQty: line.quantity,
      });
      await recordMovement(tx, {
        movementType: 'production_consumption',
        lotId: line.lotId,
        presentationId: null,
        locationId: line.locationId,
        quantity: `-${line.quantity}`,
        baseQuantity: `-${line.quantity}`,
        sourceType: 'production.order',
        sourceId: order.id,
        createdBy: actor.userId,
        reason: `Consumo orden ${order.number}`,
      });
    }

    await tx.update(orders).set({ status: 'in_progress' }).where(eq(orders.id, order.id));
    await recordAudit(tx, ctx, {
      action: 'prod.order.consume',
      entityType: 'production.order',
      entityId: order.id,
      siteId: order.siteId,
      after: { lines: input.lines },
    });
  });

  return getOrder(deps, ctx, id);
}

export async function closeOrder(
  deps: ProductionDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<ProductionOrderDetail> {
  const input = CloseProductionOrderRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const orderResult = await tx.execute(sql`
      select o.id, o.number, o.site_id as "siteId", o.product_id as "productId",
             o.recipe_version_id as "recipeVersionId", o.planned_qty as "plannedQty",
             o.status, o.responsible_id as "responsibleId",
             rv.expected_yield_pct as "expectedYieldPct", rv.tolerance_pct as "tolerancePct",
             p.shelf_life_days as "shelfLifeDays"
      from production.orders o
      join catalog.recipe_versions rv on rv.id = o.recipe_version_id
      join catalog.products p on p.id = o.product_id
      where o.id = ${id}
      for update of o
    `);
    const order = (
      orderResult.rows as unknown as {
        id: string;
        number: string;
        siteId: string;
        productId: string;
        recipeVersionId: string;
        plannedQty: string;
        status: ProductionOrderStatus;
        responsibleId: string;
        expectedYieldPct: string;
        tolerancePct: string;
        shelfLifeDays: number;
      }[]
    )[0];
    if (!order) throw AppError.notFound();
    const actor = authorize(ctx, 'prod.order.execute', {
      siteId: order.siteId,
      ownerId: order.responsibleId,
    });
    if (order.status === 'planned') {
      throw AppError.conflict(
        'CONSUMPTION_REQUIRED',
        'Consumo requerido',
        'No se puede cerrar una orden sin consumo real registrado.',
      );
    }
    if (order.status !== 'in_progress') {
      throw AppError.conflict(
        'ORDER_NOT_IN_PROGRESS',
        'Orden no está en proceso',
        'La orden ya fue cerrada o no admite cierre.',
      );
    }

    const consumptionResult = await tx.execute(sql`
      select lot_id as "lotId", actual_qty as "actualQuantity"
      from production.consumptions where order_id = ${id}
    `);
    const consumptionLines = consumptionResult.rows as unknown as {
      lotId: string;
      actualQuantity: string;
    }[];
    if (consumptionLines.length === 0) {
      throw AppError.conflict(
        'CONSUMPTION_REQUIRED',
        'Consumo requerido',
        'No se puede cerrar una orden sin consumo real registrado.',
      );
    }

    const presentationIds = input.outputs.map((output) => output.presentationId);
    if (new Set(presentationIds).size !== presentationIds.length) {
      throw validation('Una presentación aparece dos veces en la producción.');
    }
    const presentationsResult = await tx.execute(sql`
      select pr.id, pr.name, pr.units_per as "unitsPer", pr.is_active as "isActive"
      from catalog.presentations pr
      where pr.product_id = ${order.productId}
        and pr.id in (${sql.join(
          presentationIds.map((presentationId) => sql`${presentationId}`),
          sql`, `,
        )})
    `);
    const presentations = presentationsResult.rows as unknown as {
      id: string;
      name: string;
      unitsPer: string;
      isActive: boolean;
    }[];
    if (presentations.length !== presentationIds.length) {
      throw validation('La presentación no pertenece al producto de la orden.');
    }
    const inactive = presentations.find((presentation) => !presentation.isActive);
    if (inactive) {
      throw AppError.conflict(
        'PRESENTATION_INACTIVE',
        'Presentación inactiva',
        `Reactiva ${inactive.name} antes de registrar producción.`,
      );
    }

    const location = await productionLocation(tx, order.siteId);
    if (!location) {
      throw AppError.conflict(
        'NO_PRODUCTION_LOCATION',
        'Falta la ubicación de producción',
        'La sede de la orden no tiene una ubicación de producción activa.',
      );
    }

    const outputRowsToInsert = input.outputs.map((output) => {
      const presentation = presentations.find((row) => row.id === output.presentationId);
      if (!presentation) throw validation('Presentación inválida.');
      return {
        presentationId: output.presentationId,
        quantity: output.quantity,
        baseQuantity: new Decimal(output.quantity).times(presentation.unitsPer).toFixed(3),
      };
    });
    const actualQty = outputRowsToInsert.reduce(
      (sum, output) => sum.plus(output.baseQuantity),
      new Decimal(0),
    );
    const yieldPct = productionYield(actualQty.toFixed(3), order.plannedQty);
    const outOfTolerance = yieldOutOfTolerance(yieldPct, order.expectedYieldPct, order.tolerancePct);
    const yieldNote = input.yieldNote?.trim() ?? '';
    if (outOfTolerance && !yieldNote) {
      throw new AppError(
        422,
        'YIELD_NOTE_REQUIRED',
        'Motivo de rendimiento requerido',
        `El rendimiento ${yieldPct} % está fuera de la tolerancia de ${order.tolerancePct} puntos.`,
      );
    }

    if (!order.shelfLifeDays) {
      throw AppError.conflict(
        'SHELF_LIFE_REQUIRED',
        'Vida útil requerida',
        'El producto no tiene vida útil configurada; no se puede calcular el vencimiento del lote.',
      );
    }
    const manufacturedOn = businessToday();
    const expiryDate = new Date(`${manufacturedOn}T12:00:00.000Z`);
    expiryDate.setUTCDate(expiryDate.getUTCDate() + order.shelfLifeDays);
    const expiresOn = expiryDate.toISOString().slice(0, 10);

    const lot = await createFinishedGoodLot(tx, {
      orderId: order.id,
      productId: order.productId,
      locationId: location.id,
      manufacturedOn,
      expiresOn,
      createdBy: actor.userId,
      reason: `Orden de producción ${order.number}`,
      outputs: outputRowsToInsert,
      inputs: consumptionLines.map((line) => ({
        lotId: line.lotId,
        quantity: line.actualQuantity,
      })),
    });

    await tx.insert(outputs).values(
      outputRowsToInsert.map((output) => ({
        orderId: order.id,
        presentationId: output.presentationId,
        quantity: output.quantity,
        baseQuantity: output.baseQuantity,
      })),
    );
    await tx
      .update(orders)
      .set({
        actualQty: actualQty.toFixed(3),
        yieldPct,
        yieldNote: outOfTolerance ? yieldNote : null,
        outputLotId: lot.lotId,
        status: 'closed',
        closedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await recordEvent(tx, {
      type: 'ProductionCompleted',
      sourceType: 'production.order',
      sourceId: order.id,
      siteId: order.siteId,
      amount: null,
      payload: {
        number: order.number,
        productId: order.productId,
        actualQty: actualQty.toFixed(3),
        yieldPct,
        lotId: lot.lotId,
        lotCode: lot.code,
        outputs: outputRowsToInsert,
      },
    });
    await recordAudit(tx, ctx, {
      action: 'prod.order.close',
      entityType: 'production.order',
      entityId: order.id,
      siteId: order.siteId,
      after: {
        outputs: outputRowsToInsert,
        actualQty: actualQty.toFixed(3),
        yieldPct,
        yieldNote: outOfTolerance ? yieldNote : null,
        lotId: lot.lotId,
        lotCode: lot.code,
      },
    });
  });

  return getOrder(deps, ctx, id);
}
