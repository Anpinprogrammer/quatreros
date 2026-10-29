import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tablas transversales de plataforma (ADR-010, ADR-011, ADR-012, database-design §2).
 * Primera migración: no dependen de ningún módulo de negocio.
 * Nota: `actor_id` referencia la identidad de autenticación (auth.user.id). Las tablas de negocio
 * usarán `admin.users` cuando se construya la funcionalidad vertical de Administración.
 */
export const platformSchema = pgSchema('platform');
export const auditSchema = pgSchema('audit');

/** Idempotencia de escrituras críticas (ADR-010, BR-007). */
export const idempotencyKeys = platformSchema.table(
  'idempotency_keys',
  {
    actorId: text().notNull(),
    key: uuid().notNull(),
    route: text().notNull(),
    requestHash: text().notNull(),
    status: text({ enum: ['in_progress', 'completed'] }).notNull(),
    responseCode: integer(),
    responseBody: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.key] }), index('idempotency_keys_expires_idx').on(t.expiresAt)],
);

/** Outbox transaccional (ADR-011). */
export const outbox = platformSchema.table(
  'outbox',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    topic: text().notNull(),
    payload: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('outbox_unpublished_idx')
      .on(t.id)
      .where(sql`${t.publishedAt} IS NULL`),
  ],
);

/** Funcionalidades bloqueadas por decisiones pendientes (module-boundaries §5). */
export const featureFlags = platformSchema.table('feature_flags', {
  key: text().primaryKey(),
  isEnabled: boolean().notNull().default(false),
  blockedBy: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Activación de complementos opcionales (ADR-015). */
export const addonSettings = platformSchema.table(
  'addon_settings',
  {
    addon: text().primaryKey(),
    isEnabled: boolean().notNull().default(false),
    settings: jsonb().notNull().default({}),
    updatedBy: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('addon_settings_addon_chk', sql`${t.addon} IN ('assistant','telegram')`)],
);

/** Consecutivos legibles por tipo de documento (DR-005). */
export const documentSequences = platformSchema.table(
  'document_sequences',
  {
    docType: text().primaryKey(),
    nextValue: bigint({ mode: 'number' }).notNull().default(1),
  },
  (t) => [check('document_sequences_positive_chk', sql`${t.nextValue} > 0`)],
);

/** Auditoría append-only (ADR-012, BR-005). El trigger que impide UPDATE/DELETE está en la migración. */
export const auditLog = auditSchema.table(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorId: text(),
    roleCodes: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    siteId: uuid(),
    channel: text({ enum: ['web', 'assistant', 'telegram', 'system'] }).notNull(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    beforeData: jsonb(),
    afterData: jsonb(),
    reason: text(),
    approvalId: uuid(),
    proposalId: uuid(),
    requestId: text(),
    ipAddress: inet(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId, t.occurredAt.desc()),
    index('audit_log_actor_idx').on(t.actorId, t.occurredAt.desc()),
    check('audit_log_channel_chk', sql`${t.channel} IN ('web','assistant','telegram','system')`),
  ],
);
