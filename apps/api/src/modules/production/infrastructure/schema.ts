import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Esquema `production` (database-design §2, especificación prod/produccion §3).
 * Las FKs hacia admin, catalog e inventory se declaran en SQL en la migración custom.
 */
export const productionSchema = pgSchema('production');

export const ORDER_STATUSES = ['planned', 'in_progress', 'closed'] as const;

export const orders = productionSchema.table(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    productId: uuid().notNull(),
    recipeVersionId: uuid().notNull(),
    plannedQty: numeric({ precision: 14, scale: 3 }).notNull(),
    actualQty: numeric({ precision: 14, scale: 3 }),
    yieldPct: numeric({ precision: 6, scale: 2 }),
    yieldNote: text(),
    outputLotId: uuid().unique(),
    status: text({ enum: ORDER_STATUSES }).notNull().default('planned'),
    responsibleId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('production_orders_planned_chk', sql`${t.plannedQty} > 0`),
    check('production_orders_actual_chk', sql`${t.actualQty} IS NULL OR ${t.actualQty} >= 0`),
    check('production_orders_status_chk', sql`${t.status} IN ('planned','in_progress','closed')`),
    check(
      'production_orders_closed_chk',
      sql`${t.status} <> 'closed' OR (${t.actualQty} IS NOT NULL AND ${t.outputLotId} IS NOT NULL)`,
    ),
    index('production_orders_site_status_idx').on(t.siteId, t.status, t.createdAt),
    index('production_orders_product_idx').on(t.productId),
  ],
);

export const consumptions = productionSchema.table(
  'consumptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    rawMaterialId: uuid().notNull(),
    lotId: uuid().notNull(),
    locationId: uuid().notNull(),
    theoreticalQty: numeric({ precision: 14, scale: 3 }).notNull(),
    actualQty: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    check('production_consumptions_theoretical_chk', sql`${t.theoreticalQty} >= 0`),
    check('production_consumptions_actual_chk', sql`${t.actualQty} > 0`),
    index('production_consumptions_order_idx').on(t.orderId),
    index('production_consumptions_lot_idx').on(t.lotId),
  ],
);

export const outputs = productionSchema.table(
  'outputs',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    presentationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    baseQuantity: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    unique('production_outputs_order_presentation_uq').on(t.orderId, t.presentationId),
    check('production_outputs_quantity_chk', sql`${t.quantity} > 0`),
    check('production_outputs_base_chk', sql`${t.baseQuantity} > 0`),
    index('production_outputs_order_idx').on(t.orderId),
  ],
);
