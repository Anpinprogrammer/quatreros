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

/** Esquema `finance` mínimo para crédito y recaudos (com/pedidos-reparto §3). */
export const financeSchema = pgSchema('finance');

export const paymentMethods = financeSchema.table('payment_methods', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  isCash: boolean().notNull(),
  isActive: boolean().notNull().default(true),
});

export const creditTerms = financeSchema.table('credit_terms', {
  customerId: uuid().primaryKey(),
  enabled: boolean().notNull().default(false),
  creditLimit: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
  termDays: integer().notNull().default(0),
  updatedBy: uuid().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const receivables = financeSchema.table(
  'receivables',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid().notNull(),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    balance: numeric({ precision: 14, scale: 2 }).notNull(),
    issuedOn: date().notNull(),
    dueOn: date().notNull(),
    status: text({ enum: ['open', 'partially_paid', 'paid'] })
      .notNull()
      .default('open'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'receivables_amount_chk',
      sql`${t.amount} > 0 AND ${t.balance} >= 0 AND ${t.balance} <= ${t.amount}`,
    ),
    check('receivables_dates_chk', sql`${t.dueOn} >= ${t.issuedOn}`),
    unique('receivables_source_uq').on(t.sourceType, t.sourceId),
    index('receivables_open_idx')
      .on(t.customerId, t.dueOn)
      .where(sql`${t.balance} > 0`),
  ],
);

export const collections = financeSchema.table(
  'collections',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    collectorType: text({ enum: ['driver', 'cash_register', 'office'] }).notNull(),
    collectorUserId: uuid(),
    customerId: uuid(),
    paymentMethodId: uuid()
      .notNull()
      .references(() => paymentMethods.id),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    deliveryId: uuid(),
    status: text({ enum: ['registered', 'reconciled', 'reconciled_with_variance'] })
      .notNull()
      .default('registered'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('collections_amount_chk', sql`${t.amount} > 0`),
    index('collections_driver_idx').on(t.collectorUserId, t.createdAt),
    index('collections_delivery_idx').on(t.deliveryId),
  ],
);
