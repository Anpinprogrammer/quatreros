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

/** Esquema `sales` (especificación com/pedidos-reparto §3). */
export const salesSchema = pgSchema('sales');

export const CUSTOMER_KINDS = ['restaurant', 'business', 'individual'] as const;
export const ORDER_CHANNELS = ['whatsapp', 'phone', 'in_person', 'other'] as const;
export const PAYMENT_MODES = ['cash_on_delivery', 'credit'] as const;
export const SALES_ORDER_STATUSES = ['confirmed', 'in_dispatch', 'partially_delivered', 'delivered'] as const;

export const customers = salesSchema.table(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text({ enum: CUSTOMER_KINDS }).notNull(),
    name: text().notNull(),
    taxId: text().unique(),
    phone: text(),
    deliveryAddress: text(),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('customers_version_chk', sql`${t.version} > 0`)],
);

export const salesOrders = salesSchema.table(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    channel: text({ enum: ORDER_CHANNELS }).notNull(),
    paymentMode: text({ enum: PAYMENT_MODES }).notNull(),
    requestedDate: date(),
    status: text({ enum: SALES_ORDER_STATUSES }).notNull().default('confirmed'),
    creditWarning: text(),
    confirmedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'sales_orders_status_chk',
      sql`${t.status} IN ('confirmed','in_dispatch','partially_delivered','delivered')`,
    ),
    index('sales_orders_site_status_idx').on(t.siteId, t.status, t.createdAt),
    index('sales_orders_customer_idx').on(t.customerId),
  ],
);

export const salesOrderLines = salesSchema.table(
  'order_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => salesOrders.id),
    presentationId: uuid().notNull(),
    orderedQty: numeric({ precision: 14, scale: 3 }).notNull(),
    reservedQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    deliveredQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    returnedQty: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    unitPrice: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    check('sales_order_lines_ordered_chk', sql`${t.orderedQty} > 0`),
    check(
      'sales_order_lines_reserved_chk',
      sql`${t.reservedQty} >= 0 AND ${t.reservedQty} <= ${t.orderedQty}`,
    ),
    check(
      'sales_order_lines_delivered_chk',
      sql`${t.deliveredQty} >= 0 AND ${t.deliveredQty} <= ${t.orderedQty}`,
    ),
    check(
      'sales_order_lines_returned_chk',
      sql`${t.returnedQty} >= 0 AND ${t.returnedQty} <= ${t.deliveredQty}`,
    ),
    check('sales_order_lines_price_chk', sql`${t.unitPrice} > 0`),
    unique('sales_order_lines_order_presentation_uq').on(t.orderId, t.presentationId),
    index('sales_order_lines_order_idx').on(t.orderId),
  ],
);
