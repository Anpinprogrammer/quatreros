import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Esquema `distribution` (especificación com/pedidos-reparto §3). */
export const distributionSchema = pgSchema('distribution');

export const DISPATCH_STATUSES = ['prepared', 'in_route', 'to_settle'] as const;

export const dispatches = distributionSchema.table(
  'dispatches',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    driverId: uuid().notNull(),
    routeLocationId: uuid(),
    dispatchDate: date().notNull(),
    status: text({ enum: DISPATCH_STATUSES }).notNull().default('prepared'),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    loadedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('dispatches_status_chk', sql`${t.status} IN ('prepared','in_route','to_settle')`),
    index('dispatches_driver_idx').on(t.driverId, t.status),
    index('dispatches_site_idx').on(t.siteId, t.status),
  ],
);

export const dispatchLines = distributionSchema.table(
  'dispatch_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    dispatchId: uuid()
      .notNull()
      .references(() => dispatches.id),
    orderLineId: uuid().notNull(),
    lotId: uuid().notNull(),
    locationId: uuid().notNull(),
    presentationId: uuid().notNull(),
    loadedQty: numeric({ precision: 14, scale: 3 }).notNull(),
    deliveredQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    returnedQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
  },
  (t) => [
    check('dispatch_lines_loaded_chk', sql`${t.loadedQty} > 0`),
    check(
      'dispatch_lines_delivered_chk',
      sql`${t.deliveredQty} >= 0 AND ${t.deliveredQty} <= ${t.loadedQty}`,
    ),
    check(
      'dispatch_lines_returned_chk',
      sql`${t.returnedQty} >= 0 AND ${t.returnedQty} <= ${t.deliveredQty}`,
    ),
    index('dispatch_lines_dispatch_idx').on(t.dispatchId),
    index('dispatch_lines_order_line_idx').on(t.orderLineId),
  ],
);

export const deliveries = distributionSchema.table(
  'deliveries',
  {
    id: uuid().primaryKey().defaultRandom(),
    dispatchId: uuid()
      .notNull()
      .references(() => dispatches.id),
    orderId: uuid().notNull(),
    isPartial: boolean().notNull(),
    partialReason: text(),
    deliveredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    registeredBy: uuid().notNull(),
  },
  (t) => [
    check('deliveries_partial_chk', sql`NOT ${t.isPartial} OR ${t.partialReason} IS NOT NULL`),
    index('deliveries_dispatch_idx').on(t.dispatchId),
    index('deliveries_order_idx').on(t.orderId),
  ],
);

export const deliveryLines = distributionSchema.table(
  'delivery_lines',
  {
    deliveryId: uuid()
      .notNull()
      .references(() => deliveries.id),
    dispatchLineId: uuid()
      .notNull()
      .references(() => dispatchLines.id),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    check('delivery_lines_quantity_chk', sql`${t.quantity} > 0`),
    unique('delivery_lines_delivery_line_uq').on(t.deliveryId, t.dispatchLineId),
  ],
);

export const returns = distributionSchema.table(
  'returns',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    customerId: uuid().notNull(),
    dispatchId: uuid().notNull(),
    deliveryId: uuid(),
    orderLineId: uuid().notNull(),
    lotId: uuid().notNull(),
    presentationId: uuid().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    reason: text().notNull(),
    status: text({ enum: ['in_inspection', 'reinstated'] })
      .notNull()
      .default('in_inspection'),
    inspectedBy: uuid(),
    inspectedAt: timestamp({ withTimezone: true }),
    registeredBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('returns_quantity_chk', sql`${t.quantity} > 0`),
    check('returns_status_chk', sql`${t.status} IN ('in_inspection','reinstated')`),
    index('returns_dispatch_idx').on(t.dispatchId, t.status),
  ],
);
