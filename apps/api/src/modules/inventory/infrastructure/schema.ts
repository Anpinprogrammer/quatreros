import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Esquema `inventory` (database-design §2 y §4, especificación inv/existencias §3).
 * Las FKs hacia catálogo y administración se declaran en SQL en la migración custom
 * para respetar la frontera de módulos; aquí solo viven las FK internas.
 */
export const inventorySchema = pgSchema('inventory');

export const LOT_TYPES = ['raw_material', 'finished_good'] as const;
export const LOT_STATUSES = ['available', 'in_inspection', 'blocked', 'expired', 'written_off'] as const;
export const MOVEMENT_TYPES = [
  'receipt',
  'production_consumption',
  'production_output',
  'transfer_out',
  'transfer_in',
  'dispatch_out',
  'dispatch_return',
  'sale',
  'customer_return',
  'return_reinstated',
  'write_off',
  'adjustment',
  'package_open_out',
  'package_open_in',
  'opening_balance',
  'reversal',
] as const;

export const lots = inventorySchema.table(
  'lots',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull().unique(),
    lotType: text({ enum: LOT_TYPES }).notNull(),
    productId: uuid(),
    rawMaterialId: uuid(),
    supplierId: uuid(),
    receiptId: uuid(),
    productionOrderId: uuid(),
    unitCost: numeric({ precision: 14, scale: 4 }),
    manufacturedOn: date(),
    expiresOn: date(),
    status: text({ enum: LOT_STATUSES }).notNull().default('available'),
    isOpeningBalance: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('lots_type_chk', sql`${t.lotType} IN ('raw_material','finished_good')`),
    check(
      'lots_status_chk',
      sql`${t.status} IN ('available','in_inspection','blocked','expired','written_off')`,
    ),
    check(
      'lots_type_consistency_chk',
      sql`((${t.lotType} = 'finished_good' AND ${t.productId} IS NOT NULL AND ${t.rawMaterialId} IS NULL)
        OR (${t.lotType} = 'raw_material' AND ${t.rawMaterialId} IS NOT NULL AND ${t.productId} IS NULL))`,
    ),
    check(
      'lots_expiry_chk',
      sql`${t.expiresOn} IS NULL OR ${t.manufacturedOn} IS NULL OR ${t.expiresOn} >= ${t.manufacturedOn}`,
    ),
    index('lots_fefo_idx')
      .on(t.productId, t.expiresOn)
      .where(sql`${t.status} = 'available'`),
  ],
);

export const stockMovements = inventorySchema.table(
  'stock_movements',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    movementType: text({ enum: MOVEMENT_TYPES }).notNull(),
    lotId: uuid()
      .notNull()
      .references(() => lots.id),
    presentationId: uuid(),
    locationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    baseQuantity: numeric({ precision: 14, scale: 3 }).notNull(),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
    reversesId: bigint({ mode: 'number' }),
    reason: text(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'stock_movements_type_chk',
      sql`${t.movementType} IN ('receipt','production_consumption','production_output','transfer_out','transfer_in','dispatch_out','dispatch_return','sale','customer_return','return_reinstated','write_off','adjustment','package_open_out','package_open_in','opening_balance','reversal')`,
    ),
    check('stock_movements_quantity_chk', sql`${t.quantity} <> 0 AND ${t.baseQuantity} <> 0`),
    check('stock_movements_sign_chk', sql`sign(${t.quantity}) = sign(${t.baseQuantity})`),
    index('stock_movements_lot_loc_idx').on(t.lotId, t.locationId, t.createdAt),
    index('stock_movements_source_idx').on(t.sourceType, t.sourceId),
  ],
);

export const stockBalances = inventorySchema.table(
  'stock_balances',
  {
    lotId: uuid()
      .notNull()
      .references(() => lots.id),
    presentationId: uuid(),
    locationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('stock_balances_lot_presentation_location_uq')
      .on(t.lotId, t.presentationId, t.locationId)
      .nullsNotDistinct(),
    check('stock_balances_quantity_chk', sql`${t.quantity} >= 0`),
    index('stock_balances_location_idx')
      .on(t.locationId)
      .where(sql`${t.quantity} > 0`),
  ],
);

export const lotInputs = inventorySchema.table(
  'lot_inputs',
  {
    outputLotId: uuid()
      .notNull()
      .references(() => lots.id),
    inputLotId: uuid()
      .notNull()
      .references(() => lots.id),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.outputLotId, t.inputLotId] }),
    check('lot_inputs_distinct_chk', sql`${t.outputLotId} <> ${t.inputLotId}`),
    check('lot_inputs_quantity_chk', sql`${t.quantity} > 0`),
  ],
);

export const transfers = inventorySchema.table(
  'transfers',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    fromLocationId: uuid().notNull(),
    toLocationId: uuid().notNull(),
    transitLocationId: uuid().notNull(),
    status: text({ enum: ['in_transit', 'received', 'received_with_variance'] })
      .notNull()
      .default('in_transit'),
    sentBy: uuid().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    receivedBy: uuid(),
    receivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('transfers_locations_chk', sql`${t.fromLocationId} <> ${t.toLocationId}`),
    check('transfers_status_chk', sql`${t.status} IN ('in_transit','received','received_with_variance')`),
    index('transfers_status_idx').on(t.status, t.sentAt),
  ],
);

export const transferLines = inventorySchema.table(
  'transfer_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    transferId: uuid()
      .notNull()
      .references(() => transfers.id),
    lotId: uuid()
      .notNull()
      .references(() => lots.id),
    presentationId: uuid().notNull(),
    sentQty: numeric({ precision: 14, scale: 3 }).notNull(),
    receivedQty: numeric({ precision: 14, scale: 3 }),
  },
  (t) => [
    check('transfer_lines_sent_qty_chk', sql`${t.sentQty} > 0`),
    check(
      'transfer_lines_received_qty_chk',
      sql`${t.receivedQty} IS NULL OR (${t.receivedQty} >= 0 AND ${t.receivedQty} <= ${t.sentQty})`,
    ),
    index('transfer_lines_transfer_idx').on(t.transferId),
  ],
);
