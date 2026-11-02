import {
  AvailabilityQuery,
  LotListQuery,
  MovementListQuery,
  StockBalanceQuery,
  type AvailabilityList,
  type BaseUnit,
  type InventorySummary,
  type LotDetail,
  type LotPage,
  type LotSummary,
  type MovementPage,
  type StockBalancePage,
  type StockBalanceView,
  type StockMovementView,
  type TraceabilityView,
} from '@quatreros/contracts';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize } from '../../admin/application/public.js';
import { siteIdsFor } from './access.js';
import {
  findLotRow,
  inventorySummary,
  listAvailabilityRows,
  listForwardMovementRows,
  listLotInputRows,
  listLotRows,
  listMovementRows,
  listStockBalanceRows,
  type AvailabilityRow,
  type LotInputRow,
  type LotRow,
  type MovementRow,
  type StockBalanceRow,
} from '../infrastructure/repository.js';

export interface InventoryDeps {
  db: Database;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBalance(row: StockBalanceRow): StockBalanceView {
  return { ...row, baseUnit: row.baseUnit as BaseUnit };
}

function toLot(row: LotRow): LotSummary {
  return {
    id: row.id,
    code: row.code,
    lotType: row.lotType,
    itemKind: row.itemKind,
    itemId: row.itemId,
    itemName: row.itemName,
    status: row.status,
    manufacturedOn: row.manufacturedOn,
    expiresOn: row.expiresOn,
    isExpired: row.isExpired,
    totalQuantity: row.totalQuantity,
    baseUnit: row.baseUnit as BaseUnit,
    createdAt: iso(row.createdAt),
  };
}

function toMovement(row: MovementRow): StockMovementView {
  return {
    id: row.id,
    movementType: row.movementType,
    lotId: row.lotId,
    lotCode: row.lotCode,
    itemKind: row.itemKind,
    itemId: row.itemId,
    itemName: row.itemName,
    presentationId: row.presentationId,
    presentationName: row.presentationName,
    locationId: row.locationId,
    locationName: row.locationName,
    siteId: row.siteId,
    siteName: row.siteName,
    quantity: row.quantity,
    baseQuantity: row.baseQuantity,
    baseUnit: row.baseUnit as BaseUnit,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    reason: row.reason,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: iso(row.createdAt),
  };
}

function toAvailability(row: AvailabilityRow) {
  return {
    itemKind: row.itemKind,
    itemId: row.itemId,
    itemName: row.itemName,
    presentationId: row.presentationId,
    presentationName: row.presentationName,
    locationId: row.locationId,
    locationName: row.locationName,
    siteId: row.siteId,
    siteName: row.siteName,
    available: row.available,
    nearestExpiry: row.nearestExpiry,
    lotCount: row.lotCount,
  };
}

function toTraceInput(row: LotInputRow) {
  return { lotId: row.lotId, code: row.code, itemName: row.itemName, quantity: row.quantity };
}

/** RF-110: saldos por lote, presentación y ubicación. */
export async function listStockBalances(
  deps: InventoryDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<StockBalancePage> {
  authorize(ctx, 'inv.stock.read');
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const query = StockBalanceQuery.parse(raw);
  const data = await listStockBalanceRows(deps.db, { ...query, siteIds });
  return {
    data: data.map(toBalance),
    page: { nextCursor: null, limit: query.limit },
  };
}

/** RF-110: disponible agregado; en 2b no hay reservas ni traslados en tránsito. */
export async function listAvailability(
  deps: InventoryDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<AvailabilityList> {
  authorize(ctx, 'inv.stock.read');
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const query = AvailabilityQuery.parse(raw);
  const data = await listAvailabilityRows(deps.db, { ...query, siteIds });
  return { data: data.map(toAvailability) };
}

/** RF-110 y RF-118: lotes con su saldo total. */
export async function listLots(deps: InventoryDeps, ctx: ExecutionContext, raw: unknown): Promise<LotPage> {
  authorize(ctx, 'inv.stock.read');
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const query = LotListQuery.parse(raw);
  const data = await listLotRows(deps.db, {
    siteIds,
    q: query.q,
    status: query.status,
    expiresBefore: query.expiresBefore,
    productId: query.productId,
    rawMaterialId: query.rawMaterialId,
    cursor: query.cursor,
    limit: query.limit,
  });
  const hasMore = data.length > query.limit;
  const page = hasMore ? data.slice(0, query.limit) : data;
  const last = page.at(-1);
  return {
    data: page.map(toLot),
    page: { nextCursor: hasMore && last ? last.code : null, limit: query.limit },
  };
}

/** Ficha del lote con saldos y últimos movimientos. */
export async function getLot(deps: InventoryDeps, ctx: ExecutionContext, lotId: string): Promise<LotDetail> {
  authorize(ctx, 'inv.stock.read');
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const lot = await findLotRow(deps.db, lotId, siteIds);
  if (!lot) throw AppError.notFound();
  const [balances, movements] = await Promise.all([
    listStockBalanceRows(deps.db, { lotId, siteIds, limit: 200 }),
    listMovementRows(deps.db, { lotId, siteIds, limit: 20 }),
  ]);
  return {
    ...toLot(lot),
    balances: balances.map(toBalance),
    movements: movements.map(toMovement),
  };
}

/** RF-111: kardex cronológico con filtros. */
export async function listMovements(
  deps: InventoryDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<MovementPage> {
  authorize(ctx, 'inv.stock.read');
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const query = MovementListQuery.parse(raw);
  let cursorId: number | undefined;
  if (query.cursor) {
    const parsed = Number(query.cursor);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Cursor inválido', 'El cursor del kardex no es válido.');
    }
    cursorId = parsed;
  }
  const data = await listMovementRows(deps.db, {
    siteIds,
    q: query.q,
    lotId: query.lotId,
    locationId: query.locationId,
    movementType: query.movementType,
    from: query.from,
    to: query.to,
    cursorId,
    limit: query.limit,
  });
  const hasMore = data.length > query.limit;
  const page = hasMore ? data.slice(0, query.limit) : data;
  const last = page.at(-1);
  return {
    data: page.map(toMovement),
    page: { nextCursor: hasMore && last ? last.id : null, limit: query.limit },
  };
}

/** RF-118: trazabilidad hacia atrás y hacia adelante, con vacíos honestos. */
export async function traceLot(
  deps: InventoryDeps,
  ctx: ExecutionContext,
  lotId: string,
): Promise<TraceabilityView> {
  authorize(ctx, 'inv.traceability.read');
  const siteIds = siteIdsFor(ctx, 'inv.traceability.read');
  const lot = await findLotRow(deps.db, lotId, siteIds);
  if (!lot) throw AppError.notFound();
  const [inputs, forward] = await Promise.all([
    listLotInputRows(deps.db, lotId),
    listForwardMovementRows(deps.db, lotId, siteIds),
  ]);
  return {
    lot: toLot(lot),
    backward: {
      inputs: inputs.map(toTraceInput),
      supplier: null,
      pending: ['Proveedores y lotes de materia prima (entrega 3)'],
    },
    forward: {
      movements: forward.map((row) => ({
        movementId: row.id,
        movementType: row.movementType,
        quantity: row.quantity,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        createdAt: iso(row.createdAt),
      })),
      pending: ['Despachos y ventas (entregas 5 y 6)'],
    },
  };
}

export async function getInventorySummary(
  deps: InventoryDeps,
  ctx: ExecutionContext,
): Promise<InventorySummary> {
  authorize(ctx, 'inv.stock.read');
  return inventorySummary(deps.db, siteIdsFor(ctx, 'inv.stock.read'));
}
