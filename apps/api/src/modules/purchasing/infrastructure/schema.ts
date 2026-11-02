import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Esquema `purchasing` (database-design §2, especificación comp/compras §3).
 * Las FKs hacia admin, catalog e inventory se declaran en SQL en la migración custom
 * para respetar la frontera de módulos; aquí solo viven las FK internas.
 * El total no incluye impuestos: el desglose fiscal está bloqueado (P-02, BR-044).
 */
export const purchasingSchema = pgSchema('purchasing');

export const suppliers = purchasingSchema.table(
  'suppliers',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    taxId: text().unique(),
    phone: text(),
    contactName: text(),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('suppliers_version_chk', sql`${t.version} > 0`)],
);

export const purchases = purchasingSchema.table(
  'purchases',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    supplierId: uuid().notNull(),
    siteId: uuid().notNull(),
    purchasedOn: date().notNull(),
    total: numeric({ precision: 14, scale: 2 }).notNull(),
    status: text({ enum: ['pending_receipt', 'partially_received', 'received'] })
      .notNull()
      .default('pending_receipt'),
    attachmentKey: text(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('purchases_total_chk', sql`${t.total} >= 0`),
    check('purchases_status_chk', sql`${t.status} IN ('pending_receipt','partially_received','received')`),
    index('purchases_site_status_idx').on(t.siteId, t.status, t.purchasedOn),
    index('purchases_supplier_idx').on(t.supplierId),
  ],
);

export const purchaseLines = purchasingSchema.table(
  'purchase_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    purchaseId: uuid()
      .notNull()
      .references(() => purchases.id),
    rawMaterialId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    unitCost: numeric({ precision: 14, scale: 4 }).notNull(),
    receivedQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
  },
  (t) => [
    check('purchase_lines_quantity_chk', sql`${t.quantity} > 0`),
    check('purchase_lines_unit_cost_chk', sql`${t.unitCost} > 0`),
    check('purchase_lines_received_chk', sql`${t.receivedQty} >= 0 AND ${t.receivedQty} <= ${t.quantity}`),
    index('purchase_lines_purchase_idx').on(t.purchaseId),
    index('purchase_lines_material_idx').on(t.rawMaterialId),
  ],
);

export const receipts = purchasingSchema.table(
  'receipts',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    purchaseId: uuid()
      .notNull()
      .references(() => purchases.id),
    locationId: uuid().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: ['posted', 'reversed'] })
      .notNull()
      .default('posted'),
    receivedBy: uuid().notNull(),
  },
  (t) => [
    check('receipts_status_chk', sql`${t.status} IN ('posted','reversed')`),
    index('receipts_purchase_idx').on(t.purchaseId, t.receivedAt),
  ],
);

export const receiptLines = purchasingSchema.table(
  'receipt_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    receiptId: uuid()
      .notNull()
      .references(() => receipts.id),
    purchaseLineId: uuid()
      .notNull()
      .references(() => purchaseLines.id),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    lotId: uuid().notNull(),
  },
  (t) => [
    unique('receipt_lines_receipt_purchase_line_uq').on(t.receiptId, t.purchaseLineId),
    check('receipt_lines_quantity_chk', sql`${t.quantity} > 0`),
    index('receipt_lines_receipt_idx').on(t.receiptId),
    index('receipt_lines_lot_idx').on(t.lotId),
  ],
);
