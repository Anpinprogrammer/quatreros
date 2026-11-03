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

/** Esquema `finance`: crédito, cartera, recaudos y conciliación (entregas 5 y 7). */
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
    siteId: uuid(),
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
    index('receivables_site_idx').on(t.siteId, t.dueOn),
  ],
);

export const reconciliations = financeSchema.table(
  'reconciliations',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    collectorType: text({ enum: ['driver', 'cash_register', 'office'] }).notNull(),
    collectorUserId: uuid(),
    periodFrom: date().notNull(),
    periodTo: date().notNull(),
    expectedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    receivedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    variance: numeric({ precision: 14, scale: 2 }).notNull(),
    note: text(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('reconciliations_amounts_chk', sql`${t.expectedAmount} >= 0 AND ${t.receivedAmount} >= 0`),
    check('reconciliations_variance_chk', sql`${t.variance} = ${t.receivedAmount} - ${t.expectedAmount}`),
    check('reconciliations_period_chk', sql`${t.periodTo} >= ${t.periodFrom}`),
    index('reconciliations_site_idx').on(t.siteId, t.createdAt),
    index('reconciliations_collector_idx').on(t.collectorType, t.collectorUserId, t.createdAt),
  ],
);

export const reconciliationLines = financeSchema.table(
  'reconciliation_lines',
  {
    reconciliationId: uuid()
      .notNull()
      .references(() => reconciliations.id),
    paymentMethodId: uuid()
      .notNull()
      .references(() => paymentMethods.id),
    expectedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    receivedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    variance: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    unique('reconciliation_lines_method_uq').on(t.reconciliationId, t.paymentMethodId),
    check('reconciliation_lines_amounts_chk', sql`${t.expectedAmount} >= 0 AND ${t.receivedAmount} >= 0`),
    check(
      'reconciliation_lines_variance_chk',
      sql`${t.variance} = ${t.receivedAmount} - ${t.expectedAmount}`,
    ),
  ],
);

export const collections = financeSchema.table(
  'collections',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    siteId: uuid().notNull(),
    kind: text({ enum: ['delivery', 'payment'] })
      .notNull()
      .default('delivery'),
    collectorType: text({ enum: ['driver', 'cash_register', 'office'] }).notNull(),
    collectorUserId: uuid(),
    customerId: uuid(),
    paymentMethodId: uuid()
      .notNull()
      .references(() => paymentMethods.id),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    deliveryId: uuid(),
    reconciliationId: uuid().references(() => reconciliations.id),
    status: text({ enum: ['registered', 'reconciled', 'reconciled_with_variance'] })
      .notNull()
      .default('registered'),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('collections_amount_chk', sql`${t.amount} > 0`),
    index('collections_driver_idx').on(t.collectorUserId, t.createdAt),
    index('collections_delivery_idx').on(t.deliveryId),
    index('collections_status_idx').on(t.status, t.siteId),
    index('collections_reconciliation_idx').on(t.reconciliationId),
  ],
);

export const paymentAllocations = financeSchema.table(
  'payment_allocations',
  {
    id: uuid().primaryKey().defaultRandom(),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id),
    receivableId: uuid()
      .notNull()
      .references(() => receivables.id),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('payment_allocations_collection_receivable_uq').on(t.collectionId, t.receivableId),
    check('payment_allocations_amount_chk', sql`${t.amount} > 0`),
    index('payment_allocations_receivable_idx').on(t.receivableId),
  ],
);
