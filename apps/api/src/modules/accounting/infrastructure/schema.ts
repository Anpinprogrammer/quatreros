import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Esquema `accounting`: hechos económicos inmutables (RF-303, DEC-081 capa a). */
export const accountingSchema = pgSchema('accounting');

export const ECONOMIC_EVENT_TYPES = [
  'PurchaseReceived',
  'ProductionCompleted',
  'SaleCompleted',
  'ShiftClosed',
  'ReceivableCreated',
  'PaymentReceived',
  'CollectionReconciled',
] as const;

export const ECONOMIC_EVENT_STATUSES = ['pending', 'posted', 'void'] as const;

export const economicEvents = accountingSchema.table(
  'economic_events',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    type: text({ enum: ECONOMIC_EVENT_TYPES }).notNull(),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
    siteId: uuid(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    amount: numeric({ precision: 14, scale: 2 }),
    payload: jsonb().notNull().default({}),
    status: text({ enum: ECONOMIC_EVENT_STATUSES }).notNull().default('pending'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('economic_events_source_uq').on(t.type, t.sourceType, t.sourceId),
    check('economic_events_status_chk', sql`${t.status} IN ('pending','posted','void')`),
    index('economic_events_status_idx').on(t.status, t.occurredAt),
    index('economic_events_source_idx').on(t.sourceType, t.sourceId),
    index('economic_events_site_idx').on(t.siteId, t.occurredAt),
  ],
);
