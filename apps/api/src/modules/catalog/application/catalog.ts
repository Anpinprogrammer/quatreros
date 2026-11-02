import {
  CreatePresentationRequest,
  CreateProductRequest,
  CreateRawMaterialRequest,
  ProductListQuery,
  RawMaterialListQuery,
  SetPriceRequest,
  UpdatePresentationRequest,
  UpdateProductRequest,
  UpdateRawMaterialRequest,
  type BaseUnit,
  type PresentationView,
  type PriceList,
  type PriceView,
  type ProductPage,
  type ProductView,
  type RawMaterialPage,
  type RawMaterialView,
} from '@quatreros/contracts';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize } from '../../admin/application/public.js';
import {
  canChangeComposition,
  canChangeUnit,
  priceChangeAt,
  priceEligibility,
  shelfLifeIsValid,
} from '../domain/catalog.js';
import {
  currentPriceRow,
  decodeCursor,
  encodeCursor,
  findPresentationRow,
  findProductRow,
  listPriceRows,
  listProductRows,
  listRawMaterialRows,
  lockPresentationWithProduct,
  lockProductRow,
  lockRawMaterialRow,
  presentationNameInUse,
  presentationsOfProducts,
  productNameInUse,
  rawMaterialNameInUse,
  type PresentationRow,
  type PriceRow,
  type ProductRow,
  type RawMaterialRow,
} from '../infrastructure/repository.js';
import { presentations, priceHistory, products, rawMaterials } from '../infrastructure/schema.js';
import type { InventoryUsage } from './ports.js';

export interface CatalogDeps {
  db: Database;
  inventoryUsage: InventoryUsage;
}

const notFound = () => AppError.notFound();

const invalidCursor = () =>
  new AppError(422, 'VALIDATION_FAILED', 'Cursor inválido', 'El cursor de paginación no es válido.');

const precondition = () =>
  new AppError(
    412,
    'PRECONDITION_FAILED',
    'Registro desactualizado',
    'Otra persona modificó este registro. Recarga para ver la versión actual.',
  );

const nameTaken = (what: string) =>
  AppError.conflict('NAME_TAKEN', 'Nombre en uso', `Ya existe ${what} con ese nombre.`);

const presentationExists = () =>
  AppError.conflict(
    'PRESENTATION_EXISTS',
    'Presentación repetida',
    'Ese producto ya tiene una presentación con ese nombre.',
  );

const productInactive = () =>
  AppError.conflict(
    'PRODUCT_INACTIVE',
    'Producto inactivo',
    'Reactiva el producto antes de agregar presentaciones o precios.',
  );

const presentationInactive = () =>
  AppError.conflict(
    'PRESENTATION_INACTIVE',
    'Presentación inactiva',
    'Reactiva la presentación antes de fijar un precio.',
  );

const unitLocked = () =>
  AppError.conflict(
    'UNIT_LOCKED',
    'Unidad bloqueada',
    'No puedes cambiar la unidad porque ya hay existencias o movimientos.',
  );

const presentationLocked = () =>
  AppError.conflict(
    'PRESENTATION_LOCKED',
    'Composición bloqueada',
    'No puedes cambiar la composición porque ya hay existencias o movimientos. Crea una presentación nueva.',
  );

const validation = (detail: string) => new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);

function toPresentation(row: PresentationRow): PresentationView {
  return {
    id: row.id,
    name: row.name,
    unitsPer: row.unitsPer,
    isActive: row.isActive,
    version: row.version,
    currentPrice: row.price,
  };
}

function toProduct(row: ProductRow, presentationsView: PresentationView[]): ProductView {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    baseUnit: row.baseUnit as BaseUnit,
    shelfLifeDays: row.shelfLifeDays,
    isActive: row.isActive,
    version: row.version,
    presentations: presentationsView,
  };
}

function toPrice(row: PriceRow): PriceView {
  return {
    id: row.id,
    presentationId: row.presentationId,
    price: row.price,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
    setBy: row.setBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRawMaterial(row: RawMaterialRow): RawMaterialView {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit as BaseUnit,
    tracksExpiry: row.tracksExpiry,
    isActive: row.isActive,
    version: row.version,
  };
}

async function productView(deps: CatalogDeps, id: string): Promise<ProductView> {
  const row = await findProductRow(deps.db, id);
  if (!row) throw notFound();
  const pres = await presentationsOfProducts(deps.db, [id]);
  return toProduct(row, pres.filter((p) => p.productId === id).map(toPresentation));
}

/** RF-030: listado paginado por nombre, con presentaciones y precio vigente. */
export async function listProducts(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ProductPage> {
  authorize(ctx, 'cat.product.read');
  const query = ProductListQuery.parse(raw);
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && !cursor) throw invalidCursor();

  const rows = await listProductRows(deps.db, {
    q: query.q,
    kind: query.kind,
    status: query.status,
    limit: query.limit,
    cursor,
  });
  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const pres = await presentationsOfProducts(
    deps.db,
    pageRows.map((r) => r.id),
  );
  const last = pageRows.at(-1);
  return {
    data: pageRows.map((r) => toProduct(r, pres.filter((p) => p.productId === r.id).map(toPresentation))),
    page: {
      nextCursor: hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null,
      limit: query.limit,
    },
  };
}

/** RF-030: ficha de producto con sus presentaciones y precios vigentes. */
export async function getProduct(deps: CatalogDeps, ctx: ExecutionContext, id: string): Promise<ProductView> {
  authorize(ctx, 'cat.product.read');
  return productView(deps, id);
}

export async function createProduct(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ProductView> {
  authorize(ctx, 'cat.product.manage');
  const input = CreateProductRequest.parse(raw);
  if (await productNameInUse(deps.db, input.name)) throw nameTaken('un producto');

  const row = await deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(products)
      .values({
        name: input.name,
        kind: input.kind,
        baseUnit: input.baseUnit,
        shelfLifeDays: input.shelfLifeDays ?? null,
      })
      .returning();
    if (!inserted) throw new Error('No se pudo crear el producto');
    await recordAudit(tx, ctx, {
      action: 'cat.product.create',
      entityType: 'catalog.product',
      entityId: inserted.id,
      after: {
        name: inserted.name,
        kind: inserted.kind,
        baseUnit: inserted.baseUnit,
        shelfLifeDays: inserted.shelfLifeDays,
      },
    });
    return inserted;
  });
  return toProduct(row, []);
}

export async function updateProduct(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  id: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<ProductView> {
  authorize(ctx, 'cat.product.manage');
  const input = UpdateProductRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const before = await lockProductRow(tx, id);
    if (!before) throw notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) throw precondition();

    if (input.baseUnit !== undefined && input.baseUnit !== before.baseUnit) {
      if (!canChangeUnit(await deps.inventoryUsage.hasStockOrMovementsForProduct(id))) throw unitLocked();
    }

    const nextShelfLife = input.shelfLifeDays !== undefined ? input.shelfLifeDays : before.shelfLifeDays;
    if (!shelfLifeIsValid(before.kind, nextShelfLife))
      throw validation('Un producto fabricado necesita vida útil; uno preparado no la lleva.');

    if (input.name !== undefined && input.name !== before.name) {
      if (await productNameInUse(tx, input.name, id)) throw nameTaken('un producto');
    }

    const [updated] = await tx
      .update(products)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
        ...(input.shelfLifeDays !== undefined ? { shelfLifeDays: input.shelfLifeDays } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        version: sql`${products.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    if (!updated) throw notFound();

    await recordAudit(tx, ctx, {
      action: 'cat.product.update',
      entityType: 'catalog.product',
      entityId: id,
      before: {
        name: before.name,
        baseUnit: before.baseUnit,
        shelfLifeDays: before.shelfLifeDays,
        isActive: before.isActive,
      },
      after: {
        name: updated.name,
        baseUnit: updated.baseUnit,
        shelfLifeDays: updated.shelfLifeDays,
        isActive: updated.isActive,
      },
    });
  });

  return productView(deps, id);
}

export async function createPresentation(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  productId: string,
  raw: unknown,
): Promise<PresentationView> {
  authorize(ctx, 'cat.product.manage');
  const input = CreatePresentationRequest.parse(raw);

  const row = await deps.db.transaction(async (tx) => {
    const product = await lockProductRow(tx, productId);
    if (!product) throw notFound();
    if (!product.isActive) throw productInactive();
    if (await presentationNameInUse(tx, productId, input.name)) throw presentationExists();

    const [inserted] = await tx
      .insert(presentations)
      .values({ productId, name: input.name, unitsPer: input.unitsPer })
      .returning();
    if (!inserted) throw new Error('No se pudo crear la presentación');

    await recordAudit(tx, ctx, {
      action: 'cat.presentation.create',
      entityType: 'catalog.presentation',
      entityId: inserted.id,
      after: { productId, name: inserted.name, unitsPer: inserted.unitsPer },
    });
    return inserted;
  });

  return {
    id: row.id,
    name: row.name,
    unitsPer: row.unitsPer,
    isActive: row.isActive,
    version: row.version,
    currentPrice: null,
  };
}

export async function updatePresentation(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  id: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<PresentationView> {
  authorize(ctx, 'cat.product.manage');
  const input = UpdatePresentationRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const before = await lockPresentationWithProduct(tx, id);
    if (!before) throw notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) throw precondition();

    if (input.unitsPer !== undefined && input.unitsPer !== before.unitsPer) {
      if (!canChangeComposition(await deps.inventoryUsage.hasStockOrMovementsForPresentation(id)))
        throw presentationLocked();
    }

    if (input.name !== undefined && input.name !== before.name) {
      if (await presentationNameInUse(tx, before.productId, input.name, id)) throw presentationExists();
    }

    const [updated] = await tx
      .update(presentations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unitsPer !== undefined ? { unitsPer: input.unitsPer } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        version: sql`${presentations.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(presentations.id, id))
      .returning();
    if (!updated) throw notFound();

    await recordAudit(tx, ctx, {
      action: 'cat.presentation.update',
      entityType: 'catalog.presentation',
      entityId: id,
      before: {
        name: before.name,
        unitsPer: before.unitsPer,
        isActive: before.isActive,
      },
      after: {
        name: updated.name,
        unitsPer: updated.unitsPer,
        isActive: updated.isActive,
      },
    });
  });

  const updated = await findPresentationRow(deps.db, id);
  if (!updated) throw notFound();
  return toPresentation(updated);
}

/** RF-032: histórico completo de precios de una presentación, más reciente primero. */
export async function listPrices(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  presentationId: string,
): Promise<PriceList> {
  authorize(ctx, 'cat.product.read');
  const presentation = await findPresentationRow(deps.db, presentationId);
  if (!presentation) throw notFound();
  const rows = await listPriceRows(deps.db, presentationId);
  return { data: rows.map(toPrice) };
}

/** RF-032: fija el precio vigente; cierra la vigencia anterior en la misma transacción. */
export async function setPrice(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  presentationId: string,
  raw: unknown,
): Promise<PriceView> {
  const actor = authorize(ctx, 'cat.price.update');
  const input = SetPriceRequest.parse(raw);

  const row = await deps.db.transaction(async (tx) => {
    const presentation = await lockPresentationWithProduct(tx, presentationId);
    if (!presentation) throw notFound();

    const eligibility = priceEligibility(presentation.productActive, presentation.isActive);
    if (eligibility === 'product_inactive') throw productInactive();
    if (eligibility === 'presentation_inactive') throw presentationInactive();

    const previous = await currentPriceRow(tx, presentationId);
    const { closedAt, openedAt } = priceChangeAt(new Date(), previous?.validFrom ?? null);

    if (previous) {
      await tx.update(priceHistory).set({ validTo: closedAt }).where(eq(priceHistory.id, previous.id));
    }

    const [inserted] = await tx
      .insert(priceHistory)
      .values({
        presentationId,
        price: input.price,
        validFrom: openedAt,
        setBy: actor.userId,
      })
      .returning();
    if (!inserted) throw new Error('No se pudo fijar el precio');

    await recordAudit(tx, ctx, {
      action: 'cat.price.create',
      entityType: 'catalog.price',
      entityId: inserted.id,
      before: previous ? { price: previous.price, validFrom: previous.validFrom.toISOString() } : null,
      after: {
        presentationId,
        price: inserted.price,
        validFrom: inserted.validFrom.toISOString(),
      },
    });
    return inserted;
  });

  return toPrice(row);
}

/** RF-031: listado paginado de materias primas. */
export async function listRawMaterials(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<RawMaterialPage> {
  authorize(ctx, 'cat.raw_material.read');
  const query = RawMaterialListQuery.parse(raw);
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && !cursor) throw invalidCursor();

  const rows = await listRawMaterialRows(deps.db, {
    q: query.q,
    status: query.status,
    limit: query.limit,
    cursor,
  });
  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const last = pageRows.at(-1);
  return {
    data: pageRows.map(toRawMaterial),
    page: {
      nextCursor: hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null,
      limit: query.limit,
    },
  };
}

export async function createRawMaterial(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<RawMaterialView> {
  authorize(ctx, 'cat.raw_material.manage');
  const input = CreateRawMaterialRequest.parse(raw);
  if (await rawMaterialNameInUse(deps.db, input.name)) throw nameTaken('una materia prima');

  const row = await deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(rawMaterials)
      .values({
        name: input.name,
        unit: input.unit,
        tracksExpiry: input.tracksExpiry,
      })
      .returning();
    if (!inserted) throw new Error('No se pudo crear la materia prima');

    await recordAudit(tx, ctx, {
      action: 'cat.raw_material.create',
      entityType: 'catalog.raw_material',
      entityId: inserted.id,
      after: {
        name: inserted.name,
        unit: inserted.unit,
        tracksExpiry: inserted.tracksExpiry,
      },
    });
    return inserted;
  });

  return toRawMaterial(row);
}

export async function updateRawMaterial(
  deps: CatalogDeps,
  ctx: ExecutionContext,
  id: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<RawMaterialView> {
  authorize(ctx, 'cat.raw_material.manage');
  const input = UpdateRawMaterialRequest.parse(raw);

  const row = await deps.db.transaction(async (tx) => {
    const before = await lockRawMaterialRow(tx, id);
    if (!before) throw notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) throw precondition();

    if (input.unit !== undefined && input.unit !== before.unit) {
      if (!canChangeUnit(await deps.inventoryUsage.hasStockOrMovementsForRawMaterial(id))) throw unitLocked();
    }

    if (input.name !== undefined && input.name !== before.name) {
      if (await rawMaterialNameInUse(tx, input.name, id)) throw nameTaken('una materia prima');
    }

    const [updated] = await tx
      .update(rawMaterials)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.tracksExpiry !== undefined ? { tracksExpiry: input.tracksExpiry } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        version: sql`${rawMaterials.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(rawMaterials.id, id))
      .returning();
    if (!updated) throw notFound();

    await recordAudit(tx, ctx, {
      action: 'cat.raw_material.update',
      entityType: 'catalog.raw_material',
      entityId: id,
      before: {
        name: before.name,
        unit: before.unit,
        tracksExpiry: before.tracksExpiry,
        isActive: before.isActive,
      },
      after: {
        name: updated.name,
        unit: updated.unit,
        tracksExpiry: updated.tracksExpiry,
        isActive: updated.isActive,
      },
    });
    return updated;
  });

  return toRawMaterial(row);
}
