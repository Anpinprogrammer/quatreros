import {
  EconomicEventListQuery,
  type EconomicEventPage,
  type EconomicEventType,
  type EconomicEventView,
} from '@quatreros/contracts';
import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter } from '../../admin/application/public.js';
import { economicEvents } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'insert' | 'execute'>;

export interface EconomicEventInput {
  type: EconomicEventType;
  sourceType: string;
  sourceId: string;
  siteId?: string | undefined;
  occurredAt?: Date | undefined;
  amount?: string | null | undefined;
  payload: Record<string, unknown>;
}

/**
 * Registra un hecho económico dentro de la transacción del caso de uso (BR-200).
 * Es idempotente por tipo + origen; no contabiliza (P-01..P-04).
 */
export async function recordEvent(tx: Executor, input: EconomicEventInput): Promise<void> {
  await tx
    .insert(economicEvents)
    .values({
      type: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      siteId: input.siteId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      amount: input.amount ?? null,
      payload: input.payload,
    })
    .onConflictDoNothing({
      target: [economicEvents.type, economicEvents.sourceType, economicEvents.sourceId],
    });
}

interface EventRow {
  id: number;
  type: EconomicEventType;
  sourceType: string;
  sourceId: string;
  siteId: string | null;
  occurredAt: Date | string;
  amount: string | null;
  payload: Record<string, unknown>;
  status: EconomicEventView['status'];
  createdAt: Date | string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toView(row: EventRow): EconomicEventView {
  return {
    id: row.id,
    type: row.type,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    siteId: row.siteId,
    occurredAt: iso(row.occurredAt),
    amount: row.amount === null ? null : Number(row.amount).toFixed(2),
    payload: row.payload,
    status: row.status,
    createdAt: iso(row.createdAt),
  };
}

export async function listEconomicEvents(
  db: Database,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<EconomicEventPage> {
  authorize(ctx, 'cont.report.read');
  const query = EconomicEventListQuery.parse(raw);
  const filter = listFilter(ctx, 'cont.report.read');
  const siteIds = filter.kind === 'all' ? null : filter.siteIds;

  const conditions = [
    query.type ? sql`e.type = ${query.type}` : sql`true`,
    query.status ? sql`e.status = ${query.status}` : sql`true`,
    query.sourceType ? sql`e.source_type = ${query.sourceType}` : sql`true`,
    query.from ? sql`e.occurred_at >= ${query.from}::date` : sql`true`,
    query.to ? sql`e.occurred_at < (${query.to}::date + interval '1 day')` : sql`true`,
    siteIds === null
      ? sql`true`
      : siteIds.length === 0
        ? sql`false`
        : sql`e.site_id in (${sql.join(
            siteIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
  ];

  const result = await db.execute(sql`
    select e.id, e.type, e.source_type as "sourceType", e.source_id as "sourceId",
           e.site_id as "siteId", e.occurred_at as "occurredAt", e.amount, e.payload,
           e.status, e.created_at as "createdAt"
    from accounting.economic_events e
    where ${sql.join(conditions, sql` and `)}
    order by e.occurred_at desc, e.id desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as EventRow[]).map(toView),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function getEconomicEvent(
  db: Database,
  ctx: ExecutionContext,
  id: number,
): Promise<EconomicEventView> {
  authorize(ctx, 'cont.report.read');
  const result = await db.execute(sql`
    select e.id, e.type, e.source_type as "sourceType", e.source_id as "sourceId",
           e.site_id as "siteId", e.occurred_at as "occurredAt", e.amount, e.payload,
           e.status, e.created_at as "createdAt"
    from accounting.economic_events e where e.id = ${id} limit 1
  `);
  const row = (result.rows as unknown as EventRow[])[0];
  if (!row) throw AppError.notFound();
  const filter = listFilter(ctx, 'cont.report.read');
  if (filter.kind !== 'all' && row.siteId && !filter.siteIds.includes(row.siteId)) {
    throw AppError.notFound();
  }
  return toView(row);
}
