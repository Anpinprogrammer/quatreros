import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Esquema `assistant`: tickets, herramientas, propuestas y consumo (DEC-106). */
export const assistantSchema = pgSchema('assistant');

export const TICKET_STATUSES = ['provisioning', 'active', 'closed', 'archived', 'terminated'] as const;
export const TICKET_RESULT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'cancelled',
  'budget_reached',
] as const;
export const PROPOSAL_STATUSES = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'executed',
  'cancelled',
  'expired',
  'failed',
] as const;

export const tickets = assistantSchema.table(
  'tickets',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull(),
    channel: text({ enum: ['web', 'telegram'] })
      .notNull()
      .default('web'),
    anthropicSessionId: text().unique(),
    agentId: text(),
    agentVersion: text(),
    status: text({ enum: TICKET_STATUSES }).notNull().default('provisioning'),
    requestText: text().notNull(),
    resolutionSummary: text(),
    toolsUsed: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    resultStatus: text({ enum: TICKET_RESULT_STATUSES }).notNull().default('pending'),
    costCents: integer().notNull().default(0),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('tickets_request_text_chk', sql`char_length(${t.requestText}) between 1 and 1000`),
    check('tickets_cost_chk', sql`${t.costCents} >= 0`),
    index('tickets_user_activity_idx').on(t.userId, t.lastActivityAt),
    index('tickets_status_idx').on(t.status, t.lastActivityAt),
  ],
);

export const toolCalls = assistantSchema.table(
  'tool_calls',
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid()
      .notNull()
      .references(() => tickets.id),
    customToolUseId: text().notNull(),
    toolName: text().notNull(),
    arguments: jsonb().notNull().default({}),
    result: jsonb(),
    status: text({ enum: ['running', 'succeeded', 'failed', 'denied'] })
      .notNull()
      .default('running'),
    errorCode: text(),
    durationMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tool_calls_custom_id_uq').on(t.customToolUseId),
    check('tool_calls_duration_chk', sql`${t.durationMs} is null or ${t.durationMs} >= 0`),
    index('tool_calls_ticket_idx').on(t.ticketId, t.createdAt),
  ],
);

export const proposals = assistantSchema.table(
  'proposals',
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid()
      .notNull()
      .references(() => tickets.id),
    toolName: text({ enum: ['prepare_raw_material', 'prepare_recipe'] }).notNull(),
    argumentsHash: text().notNull(),
    arguments: jsonb().notNull(),
    summary: jsonb().notNull(),
    status: text({ enum: PROPOSAL_STATUSES }).notNull().default('pending_confirmation'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    executedEntityType: text(),
    executedEntityId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('proposals_expiry_chk', sql`${t.expiresAt} > ${t.createdAt}`),
    index('proposals_ticket_idx').on(t.ticketId, t.createdAt),
    index('proposals_status_idx').on(t.status, t.expiresAt),
  ],
);

export const requests = assistantSchema.table(
  'requests',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    ticketId: uuid()
      .notNull()
      .references(() => tickets.id),
    userId: uuid().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    cacheReadTokens: integer().notNull().default(0),
    cacheWriteTokens: integer().notNull().default(0),
    listCostCents: integer().notNull().default(0),
    activeSeconds: numeric({ precision: 10, scale: 3 }).notNull().default('0'),
    toolNames: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    operation: text(),
    result: text({ enum: ['completed', 'failed', 'budget_reached', 'interrupted'] })
      .notNull()
      .default('completed'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'requests_tokens_chk',
      sql`${t.inputTokens} >= 0 and ${t.outputTokens} >= 0 and ${t.cacheReadTokens} >= 0 and ${t.cacheWriteTokens} >= 0`,
    ),
    check('requests_cost_chk', sql`${t.listCostCents} >= 0`),
    check('requests_seconds_chk', sql`${t.activeSeconds} >= 0`),
    index('requests_user_created_idx').on(t.userId, t.createdAt),
    index('requests_created_idx').on(t.createdAt),
    index('requests_model_created_idx').on(t.model, t.createdAt),
  ],
);
