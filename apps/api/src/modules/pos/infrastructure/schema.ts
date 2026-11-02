import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Esquema `pos` (especificación pos/caja §3). */
export const posSchema = pgSchema('pos');

export const SHIFT_STATUSES = ['open', 'closed', 'closed_with_variance', 'reviewed'] as const;
export const PRODUCT_KINDS = ['manufactured', 'prepared'] as const;

export const shifts = posSchema.table(
  'shifts',
  {
    id: uuid().primaryKey().defaultRandom(),
    siteId: uuid().notNull(),
    cashierUserId: uuid().notNull(),
    status: text({ enum: SHIFT_STATUSES }).notNull().default('open'),
    openingCash: numeric({ precision: 14, scale: 2 }).notNull(),
    openedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
    cashExpected: numeric({ precision: 14, scale: 2 }),
    cashCounted: numeric({ precision: 14, scale: 2 }),
    cashDifference: numeric({ precision: 14, scale: 2 }),
    closingNote: text(),
    reviewedBy: uuid(),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewNote: text(),
  },
  (t) => [
    check('shifts_status_chk', sql`${t.status} IN ('open','closed','closed_with_variance','reviewed')`),
    check('shifts_opening_cash_chk', sql`${t.openingCash} >= 0`),
    uniqueIndex('shifts_open_site_uq')
      .on(t.siteId)
      .where(sql`${t.status} = 'open'`),
    uniqueIndex('shifts_open_cashier_uq')
      .on(t.cashierUserId)
      .where(sql`${t.status} = 'open'`),
    index('shifts_site_status_idx').on(t.siteId, t.status, t.openedAt),
    index('shifts_cashier_idx').on(t.cashierUserId, t.openedAt),
  ],
);

export const sales = posSchema.table(
  'sales',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    shiftId: uuid()
      .notNull()
      .references(() => shifts.id),
    siteId: uuid().notNull(),
    cashierUserId: uuid().notNull(),
    status: text({ enum: ['completed'] })
      .notNull()
      .default('completed'),
    total: numeric({ precision: 14, scale: 2 }).notNull(),
    paidTotal: numeric({ precision: 14, scale: 2 }).notNull(),
    changeAmount: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    soldAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('sales_status_chk', sql`${t.status} = 'completed'`),
    check('sales_total_chk', sql`${t.total} > 0`),
    check('sales_paid_total_chk', sql`${t.paidTotal} >= ${t.total}`),
    check('sales_change_chk', sql`${t.changeAmount} = ${t.paidTotal} - ${t.total}`),
    index('sales_shift_idx').on(t.shiftId, t.soldAt),
    index('sales_site_idx').on(t.siteId, t.soldAt),
  ],
);

export const saleLines = posSchema.table(
  'sale_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    saleId: uuid()
      .notNull()
      .references(() => sales.id),
    lineNo: integer().notNull(),
    productId: uuid().notNull(),
    presentationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric({ precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric({ precision: 14, scale: 2 }).notNull(),
    productKind: text({ enum: PRODUCT_KINDS }).notNull(),
    recipeVersionId: uuid(),
  },
  (t) => [
    unique('sale_lines_sale_line_uq').on(t.saleId, t.lineNo),
    check('sale_lines_kind_chk', sql`${t.productKind} IN ('manufactured','prepared')`),
    check('sale_lines_quantity_chk', sql`${t.quantity} > 0`),
    check('sale_lines_price_chk', sql`${t.unitPrice} >= 0 AND ${t.lineTotal} >= 0`),
    check('sale_lines_recipe_chk', sql`(${t.productKind} = 'prepared') = (${t.recipeVersionId} IS NOT NULL)`),
    index('sale_lines_sale_idx').on(t.saleId),
  ],
);

export const saleLineLots = posSchema.table(
  'sale_line_lots',
  {
    saleLineId: uuid()
      .notNull()
      .references(() => saleLines.id),
    lotId: uuid().notNull(),
    locationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    unique('sale_line_lots_line_lot_location_uq').on(t.saleLineId, t.lotId, t.locationId),
    check('sale_line_lots_quantity_chk', sql`${t.quantity} > 0`),
  ],
);

export const saleLineConsumptions = posSchema.table(
  'sale_line_consumptions',
  {
    saleLineId: uuid()
      .notNull()
      .references(() => saleLines.id),
    rawMaterialId: uuid(),
    presentationId: uuid(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    check(
      'sale_line_consumptions_component_chk',
      sql`num_nonnulls(${t.rawMaterialId}, ${t.presentationId}) = 1`,
    ),
    check('sale_line_consumptions_quantity_chk', sql`${t.quantity} > 0`),
    uniqueIndex('sale_line_consumptions_material_uq')
      .on(t.saleLineId, t.rawMaterialId)
      .where(sql`${t.rawMaterialId} IS NOT NULL`),
    uniqueIndex('sale_line_consumptions_presentation_uq')
      .on(t.saleLineId, t.presentationId)
      .where(sql`${t.presentationId} IS NOT NULL`),
  ],
);

export const payments = posSchema.table(
  'payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    saleId: uuid()
      .notNull()
      .references(() => sales.id),
    paymentMethodId: uuid().notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    check('payments_amount_chk', sql`${t.amount} > 0`),
    index('payments_sale_idx').on(t.saleId),
    index('payments_method_idx').on(t.paymentMethodId),
  ],
);

export const shiftCounts = posSchema.table(
  'shift_counts',
  {
    shiftId: uuid()
      .notNull()
      .references(() => shifts.id),
    paymentMethodId: uuid().notNull(),
    expectedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    countedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    difference: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    unique('shift_counts_shift_method_uq').on(t.shiftId, t.paymentMethodId),
    check('shift_counts_amounts_chk', sql`${t.expectedAmount} >= 0 AND ${t.countedAmount} >= 0`),
  ],
);
