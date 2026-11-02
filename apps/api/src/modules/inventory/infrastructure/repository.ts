import type { ItemKind, LotStatus, LotType, MovementType } from '@quatreros/contracts';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import type { InventoryUsage } from '../../catalog/application/public.js';

/**
 * Lecturas de inventario. Las consultas cruzan esquemas (catálogo, administración) para
 * construir vistas de solo lectura; las escrituras viven en `recordMovement` y usan Drizzle.
 */

export interface StockBalanceRow {
  lotId: string;
  lotCode: string;
  lotStatus: LotStatus;
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  presentationId: string | null;
  presentationName: string | null;
  locationId: string;
  locationName: string;
  siteId: string;
  siteName: string;
  quantity: string;
  baseUnit: string;
  manufacturedOn: string | null;
  expiresOn: string | null;
  isExpired: boolean;
  isSellable: boolean;
}

export interface AvailabilityRow {
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  presentationId: string | null;
  presentationName: string | null;
  locationId: string;
  locationName: string;
  siteId: string;
  siteName: string;
  available: string;
  nearestExpiry: string | null;
  lotCount: number;
}

export interface LotRow {
  id: string;
  code: string;
  lotType: LotType;
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  status: LotStatus;
  manufacturedOn: string | null;
  expiresOn: string | null;
  isExpired: boolean;
  totalQuantity: string;
  baseUnit: string;
  createdAt: Date | string;
}

export interface MovementRow {
  id: string;
  movementType: MovementType;
  lotId: string;
  lotCode: string;
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  presentationId: string | null;
  presentationName: string | null;
  locationId: string;
  locationName: string;
  siteId: string;
  siteName: string;
  quantity: string;
  baseQuantity: string;
  baseUnit: string;
  sourceType: string;
  sourceId: string;
  reason: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date | string;
}

export interface LotInputRow {
  lotId: string;
  code: string;
  itemName: string;
  quantity: string;
}

export interface SummaryRow {
  productsWithStock: number;
  rawMaterialsWithStock: number;
  lotsNearExpiry: number;
  expiredLots: number;
  locationsWithStock: number;
}

const itemName = sql`coalesce(p.name, rm.name)`;
const itemId = sql`coalesce(p.id, rm.id)`;
const itemKind = sql`case when l.lot_type = 'finished_good' then 'product' else 'raw_material' end`;
const baseUnit = sql`coalesce(p.base_unit, rm.unit)`;
const isExpired = sql`(l.expires_on is not null and l.expires_on < current_date)`;
const isSellable = sql`(l.status = 'available' and (l.expires_on is null or l.expires_on >= current_date))`;

const balanceJoins = sql`
  from inventory.stock_balances b
  join inventory.lots l on l.id = b.lot_id
  left join catalog.presentations pr on pr.id = b.presentation_id
  left join catalog.products p on p.id = l.product_id
  left join catalog.raw_materials rm on rm.id = l.raw_material_id
  join admin.locations loc on loc.id = b.location_id
  join admin.sites s on s.id = loc.site_id
`;

const movementJoins = sql`
  from inventory.stock_movements m
  join inventory.lots l on l.id = m.lot_id
  left join catalog.presentations pr on pr.id = m.presentation_id
  left join catalog.products p on p.id = l.product_id
  left join catalog.raw_materials rm on rm.id = l.raw_material_id
  join admin.locations loc on loc.id = m.location_id
  join admin.sites s on s.id = loc.site_id
  left join admin.users u on u.id = m.created_by
`;

const lotJoins = sql`
  from inventory.lots l
  left join inventory.stock_balances b on b.lot_id = l.id
  left join catalog.presentations pr on pr.id = b.presentation_id
  left join catalog.products p on p.id = l.product_id
  left join catalog.raw_materials rm on rm.id = l.raw_material_id
`;

function where(conditions: SQL[]): SQL {
  return conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;
}

function likeTerm(q: string): string {
  return `%${q}%`;
}

async function rows<T>(db: Database, statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return result.rows as unknown as T[];
}

export interface StockBalanceFilters {
  q?: string | undefined;
  productId?: string | undefined;
  rawMaterialId?: string | undefined;
  presentationId?: string | undefined;
  lotId?: string | undefined;
  locationId?: string | undefined;
  status?: LotStatus | undefined;
  expiresBefore?: string | undefined;
  limit: number;
}

export async function listStockBalanceRows(
  db: Database,
  filters: StockBalanceFilters,
): Promise<StockBalanceRow[]> {
  const conditions: SQL[] = [sql`b.quantity > 0`];
  if (filters.q) {
    const term = likeTerm(filters.q);
    conditions.push(sql`(${itemName} ilike ${term} or l.code ilike ${term})`);
  }
  if (filters.productId) conditions.push(sql`l.product_id = ${filters.productId}`);
  if (filters.rawMaterialId) conditions.push(sql`l.raw_material_id = ${filters.rawMaterialId}`);
  if (filters.presentationId) conditions.push(sql`b.presentation_id = ${filters.presentationId}`);
  if (filters.lotId) conditions.push(sql`b.lot_id = ${filters.lotId}`);
  if (filters.locationId) conditions.push(sql`b.location_id = ${filters.locationId}`);
  if (filters.status) conditions.push(sql`l.status = ${filters.status}`);
  if (filters.expiresBefore) conditions.push(sql`l.expires_on <= ${filters.expiresBefore}`);

  return rows<StockBalanceRow>(
    db,
    sql`
      select b.lot_id as "lotId", l.code as "lotCode", l.status as "lotStatus",
             ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             pr.id as "presentationId", pr.name as "presentationName",
             loc.id as "locationId", loc.name as "locationName",
             s.id as "siteId", s.name as "siteName",
             b.quantity as "quantity", ${baseUnit} as "baseUnit",
             l.manufactured_on as "manufacturedOn", l.expires_on as "expiresOn",
             ${isExpired} as "isExpired", ${isSellable} as "isSellable"
      ${balanceJoins}
      ${where(conditions)}
      order by "itemName", "presentationName" nulls last, "expiresOn" nulls last, "lotCode"
      limit ${filters.limit}
    `,
  );
}

export interface AvailabilityFilters {
  q?: string | undefined;
  productId?: string | undefined;
  rawMaterialId?: string | undefined;
  presentationId?: string | undefined;
  locationId?: string | undefined;
  limit: number;
}

export async function listAvailabilityRows(
  db: Database,
  filters: AvailabilityFilters,
): Promise<AvailabilityRow[]> {
  const conditions: SQL[] = [
    sql`b.quantity > 0`,
    sql`l.status = 'available'`,
    sql`(l.expires_on is null or l.expires_on >= current_date)`,
  ];
  if (filters.q) {
    const term = likeTerm(filters.q);
    conditions.push(sql`(${itemName} ilike ${term} or l.code ilike ${term})`);
  }
  if (filters.productId) conditions.push(sql`l.product_id = ${filters.productId}`);
  if (filters.rawMaterialId) conditions.push(sql`l.raw_material_id = ${filters.rawMaterialId}`);
  if (filters.presentationId) conditions.push(sql`b.presentation_id = ${filters.presentationId}`);
  if (filters.locationId) conditions.push(sql`b.location_id = ${filters.locationId}`);

  return rows<AvailabilityRow>(
    db,
    sql`
      select ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             pr.id as "presentationId", pr.name as "presentationName",
             loc.id as "locationId", loc.name as "locationName",
             s.id as "siteId", s.name as "siteName",
             round(sum(b.quantity), 3) as "available",
             min(l.expires_on) as "nearestExpiry",
             count(distinct l.id)::int as "lotCount"
      ${balanceJoins}
      ${where(conditions)}
      group by 1,2,3,4,5,6,7,8,9
      order by 3, 5 nulls last, 7
      limit ${filters.limit}
    `,
  );
}

export interface LotFilters {
  q?: string | undefined;
  status?: LotStatus | undefined;
  expiresBefore?: string | undefined;
  productId?: string | undefined;
  rawMaterialId?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

export async function listLotRows(db: Database, filters: LotFilters): Promise<LotRow[]> {
  const conditions: SQL[] = [];
  if (filters.q) {
    const term = likeTerm(filters.q);
    conditions.push(sql`(${itemName} ilike ${term} or l.code ilike ${term})`);
  }
  if (filters.status) conditions.push(sql`l.status = ${filters.status}`);
  if (filters.expiresBefore) conditions.push(sql`l.expires_on <= ${filters.expiresBefore}`);
  if (filters.productId) conditions.push(sql`l.product_id = ${filters.productId}`);
  if (filters.rawMaterialId) conditions.push(sql`l.raw_material_id = ${filters.rawMaterialId}`);
  if (filters.cursor) conditions.push(sql`l.code > ${filters.cursor}`);

  return rows<LotRow>(
    db,
    sql`
      select l.id, l.code, l.lot_type as "lotType",
             ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             l.status, l.manufactured_on as "manufacturedOn", l.expires_on as "expiresOn",
             ${isExpired} as "isExpired",
             round(coalesce(sum(b.quantity * coalesce(pr.units_per, 1)), 0), 3) as "totalQuantity",
             ${baseUnit} as "baseUnit", l.created_at as "createdAt"
      ${lotJoins}
      ${where(conditions)}
      group by l.id, p.id, p.name, p.base_unit, rm.id, rm.name, rm.unit
      order by l.code
      limit ${filters.limit + 1}
    `,
  );
}

export async function findLotRow(db: Database, id: string): Promise<LotRow | undefined> {
  const result = await rows<LotRow>(
    db,
    sql`
      select l.id, l.code, l.lot_type as "lotType",
             ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             l.status, l.manufactured_on as "manufacturedOn", l.expires_on as "expiresOn",
             ${isExpired} as "isExpired",
             round(coalesce(sum(b.quantity * coalesce(pr.units_per, 1)), 0), 3) as "totalQuantity",
             ${baseUnit} as "baseUnit", l.created_at as "createdAt"
      ${lotJoins}
      where l.id = ${id}
      group by l.id, p.id, p.name, p.base_unit, rm.id, rm.name, rm.unit
    `,
  );
  return result[0];
}

export interface MovementFilters {
  q?: string | undefined;
  lotId?: string | undefined;
  locationId?: string | undefined;
  movementType?: MovementType | undefined;
  from?: string | undefined;
  to?: string | undefined;
  cursorId?: number | undefined;
  limit: number;
}

export async function listMovementRows(db: Database, filters: MovementFilters): Promise<MovementRow[]> {
  const conditions: SQL[] = [];
  if (filters.q) {
    const term = likeTerm(filters.q);
    conditions.push(sql`(l.code ilike ${term} or ${itemName} ilike ${term})`);
  }
  if (filters.lotId) conditions.push(sql`m.lot_id = ${filters.lotId}`);
  if (filters.locationId) conditions.push(sql`m.location_id = ${filters.locationId}`);
  if (filters.movementType) conditions.push(sql`m.movement_type = ${filters.movementType}`);
  if (filters.from) conditions.push(sql`m.created_at::date >= ${filters.from}`);
  if (filters.to) conditions.push(sql`m.created_at::date <= ${filters.to}`);
  if (filters.cursorId !== undefined) conditions.push(sql`m.id < ${filters.cursorId}`);

  return rows<MovementRow>(
    db,
    sql`
      select m.id::text as "id", m.movement_type as "movementType",
             m.lot_id as "lotId", l.code as "lotCode",
             ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             m.presentation_id as "presentationId", pr.name as "presentationName",
             m.location_id as "locationId", loc.name as "locationName",
             s.id as "siteId", s.name as "siteName",
             m.quantity, m.base_quantity as "baseQuantity", ${baseUnit} as "baseUnit",
             m.source_type as "sourceType", m.source_id as "sourceId", m.reason,
             m.created_by as "createdBy", u.full_name as "createdByName",
             m.created_at as "createdAt"
      ${movementJoins}
      ${where(conditions)}
      order by m.created_at desc, m.id desc
      limit ${filters.limit + 1}
    `,
  );
}

export async function listLotInputRows(db: Database, outputLotId: string): Promise<LotInputRow[]> {
  return rows<LotInputRow>(
    db,
    sql`
      select li.input_lot_id as "lotId", l.code, ${itemName} as "itemName", li.quantity
      from inventory.lot_inputs li
      join inventory.lots l on l.id = li.input_lot_id
      left join catalog.products p on p.id = l.product_id
      left join catalog.raw_materials rm on rm.id = l.raw_material_id
      where li.output_lot_id = ${outputLotId}
      order by l.code
    `,
  );
}

export async function listForwardMovementRows(db: Database, lotId: string): Promise<MovementRow[]> {
  return rows<MovementRow>(
    db,
    sql`
      select m.id::text as "id", m.movement_type as "movementType",
             m.lot_id as "lotId", l.code as "lotCode",
             ${itemKind} as "itemKind", ${itemId} as "itemId", ${itemName} as "itemName",
             m.presentation_id as "presentationId", pr.name as "presentationName",
             m.location_id as "locationId", loc.name as "locationName",
             s.id as "siteId", s.name as "siteName",
             m.quantity, m.base_quantity as "baseQuantity", ${baseUnit} as "baseUnit",
             m.source_type as "sourceType", m.source_id as "sourceId", m.reason,
             m.created_by as "createdBy", u.full_name as "createdByName",
             m.created_at as "createdAt"
      ${movementJoins}
      where m.lot_id = ${lotId}
        and m.movement_type in ('dispatch_out','sale','transfer_out')
      order by m.created_at desc, m.id desc
      limit 50
    `,
  );
}

export async function inventorySummary(db: Database): Promise<SummaryRow> {
  const result = await rows<SummaryRow>(
    db,
    sql`
      select
        (select count(distinct l.product_id)::int
           from inventory.lots l join inventory.stock_balances b on b.lot_id = l.id
          where b.quantity > 0 and l.product_id is not null) as "productsWithStock",
        (select count(distinct l.raw_material_id)::int
           from inventory.lots l join inventory.stock_balances b on b.lot_id = l.id
          where b.quantity > 0 and l.raw_material_id is not null) as "rawMaterialsWithStock",
        (select count(*)::int from inventory.lots l
          where l.status = 'available'
            and l.expires_on between current_date and current_date + 7) as "lotsNearExpiry",
        (select count(*)::int from inventory.lots l
          where l.expires_on < current_date and l.status <> 'written_off') as "expiredLots",
        (select count(distinct b.location_id)::int from inventory.stock_balances b
          where b.quantity > 0) as "locationsWithStock"
    `,
  );
  const row = result[0];
  if (!row) {
    return {
      productsWithStock: 0,
      rawMaterialsWithStock: 0,
      lotsNearExpiry: 0,
      expiredLots: 0,
      locationsWithStock: 0,
    };
  }
  return row;
}

async function exists(db: Database, statement: SQL): Promise<boolean> {
  const result = await rows<{ present: boolean }>(db, statement);
  return result[0]?.present ?? false;
}

/** Implementación real del puerto que consulta el catálogo (BR-021, RF-031). */
export class SqlInventoryUsage implements InventoryUsage {
  constructor(private readonly db: Database) {}

  hasStockOrMovementsForProduct(productId: string): Promise<boolean> {
    return exists(
      this.db,
      sql`select exists(
        select 1 from inventory.stock_movements m
        join inventory.lots l on l.id = m.lot_id
        where l.product_id = ${productId}
      ) as present`,
    );
  }

  hasStockOrMovementsForPresentation(presentationId: string): Promise<boolean> {
    return exists(
      this.db,
      sql`select exists(
        select 1 from inventory.stock_movements m
        where m.presentation_id = ${presentationId}
      ) as present`,
    );
  }

  hasStockOrMovementsForRawMaterial(rawMaterialId: string): Promise<boolean> {
    return exists(
      this.db,
      sql`select exists(
        select 1 from inventory.stock_movements m
        join inventory.lots l on l.id = m.lot_id
        where l.raw_material_id = ${rawMaterialId}
      ) as present`,
    );
  }
}
