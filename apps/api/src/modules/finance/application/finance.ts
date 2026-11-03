import {
  AgingQuery,
  CollectionListQuery,
  CreatePaymentRequest,
  CreateReconciliationRequest,
  ReceivableListQuery,
  ReconciliationListQuery,
  type AgingBucketKey,
  type AgingResponse,
  type CollectionDetail,
  type CollectionPage,
  type CollectionView,
  type CustomerBalance,
  type FinanceDashboard,
  type ReceivablePage,
  type ReceivableView,
  type ReconciliationPage,
  type ReconciliationView,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { recordEvent } from '../../accounting/application/public.js';
import { authorize, listFilter, requireActor } from '../../admin/application/public.js';
import { businessToday } from '../../inventory/application/public.js';
import {
  agingBucket,
  allocationSum,
  allocateFifo,
  money,
  overdueDays,
  receivableStatus,
  reconciliationStatus,
  toCsv,
} from '../domain/finance.js';
import {
  collections,
  paymentAllocations,
  receivables,
  reconciliationLines,
  reconciliations,
} from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

const currentDate = (): string => businessToday();

interface Scope {
  siteIds: string[] | null;
  ownerId?: string;
}

function scopeFor(ctx: ExecutionContext, permission: string): Scope {
  const filter = listFilter(ctx, permission);
  if (filter.kind === 'all') return { siteIds: null };
  return {
    siteIds: filter.siteIds,
    ...(filter.kind === 'own' ? { ownerId: filter.userId } : {}),
  };
}

function siteCondition(siteIds: string[] | null, alias = 'site'): ReturnType<typeof sql> {
  if (siteIds === null) return sql`true`;
  if (siteIds.length === 0) return sql`false`;
  return sql`${sql.raw(alias)}.id in (${sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

function receivableOwnerCondition(ownerId: string | undefined): ReturnType<typeof sql> {
  if (!ownerId) return sql`true`;
  return sql`exists (
    select 1 from distribution.deliveries d
    join distribution.dispatches dp on dp.id = d.dispatch_id
    where r.source_type = 'distribution.delivery'
      and d.id = r.source_id
      and dp.driver_id = ${ownerId}
  )`;
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

async function nextDocumentNumber(tx: Executor, docType: string, prefix: string): Promise<string> {
  await tx.insert(documentSequences).values({ docType }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, docType))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `${prefix}-${String(value).padStart(4, '0')}`;
}

const nextCollectionNumber = (tx: Executor) => nextDocumentNumber(tx, 'RC', 'RC');
const nextReconciliationNumber = (tx: Executor) => nextDocumentNumber(tx, 'CONC', 'CONC');

export interface CreditSnapshot {
  enabled: boolean;
  creditLimit: string;
  termDays: number;
  openBalance: string;
  overdue: boolean;
}

export async function creditSnapshot(db: Executor, customerId: string): Promise<CreditSnapshot> {
  const termsResult = await db.execute(sql`
    select enabled, credit_limit as "creditLimit", term_days as "termDays"
    from finance.credit_terms where customer_id = ${customerId} limit 1
  `);
  const terms = (
    termsResult.rows as unknown as { enabled: boolean; creditLimit: string; termDays: number }[]
  )[0];
  if (!terms) {
    return { enabled: false, creditLimit: '0', termDays: 0, openBalance: '0', overdue: false };
  }
  const balanceResult = await db.execute(sql`
    select coalesce(sum(balance), 0) as "openBalance",
           count(*) filter (where due_on < current_date)::int as "overdueCount"
    from finance.receivables
    where customer_id = ${customerId} and balance > 0
  `);
  const balance = (balanceResult.rows[0] as { openBalance: string; overdueCount: number } | undefined) ?? {
    openBalance: '0',
    overdueCount: 0,
  };
  return {
    enabled: terms.enabled,
    creditLimit: terms.creditLimit,
    termDays: terms.termDays,
    openBalance: balance.openBalance,
    overdue: balance.overdueCount > 0,
  };
}

export async function getCreditTerms(db: Executor, customerId: string) {
  const result = await db.execute(sql`
    select enabled, credit_limit as "creditLimit", term_days as "termDays"
    from finance.credit_terms where customer_id = ${customerId} limit 1
  `);
  return (result.rows as unknown as { enabled: boolean; creditLimit: string; termDays: number }[])[0];
}

export async function paymentMethodId(tx: Executor, method: 'cash' | 'transfer'): Promise<string> {
  const result = await tx.execute(sql`
    select id from finance.payment_methods where ${method === 'cash' ? sql`is_cash` : sql`not is_cash`}
    and is_active = true limit 1
  `);
  const row = (result.rows as unknown as { id: string }[])[0];
  if (!row) throw new Error(`No hay método de pago para ${method}`);
  return row.id;
}

export interface ActivePaymentMethod {
  id: string;
  name: string;
  isCash: boolean;
}

export async function listPaymentMethodsForActor(
  db: Executor,
  ctx: ExecutionContext,
): Promise<ActivePaymentMethod[]> {
  authorize(ctx, 'fin.receivable_payment.create');
  return listActivePaymentMethods(db);
}

export async function listActivePaymentMethods(db: Executor): Promise<ActivePaymentMethod[]> {
  const result = await db.execute(sql`
    select id, name, is_cash as "isCash"
    from finance.payment_methods
    where is_active = true
    order by is_cash desc, name asc
  `);
  return result.rows as unknown as ActivePaymentMethod[];
}

export interface ReceivableInput {
  customerId: string;
  siteId?: string | undefined;
  sourceType: string;
  sourceId: string;
  amount: string;
  issuedOn: string;
  dueOn: string;
}

export async function createReceivable(tx: Executor, input: ReceivableInput): Promise<string> {
  const [row] = await tx
    .insert(receivables)
    .values({
      customerId: input.customerId,
      siteId: input.siteId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amount: input.amount,
      balance: input.amount,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
    })
    .returning({ id: receivables.id });
  if (!row) throw new Error('No se pudo crear la obligación');
  await recordEvent(tx, {
    type: 'ReceivableCreated',
    sourceType: 'finance.receivable',
    sourceId: row.id,
    ...(input.siteId ? { siteId: input.siteId } : {}),
    amount: input.amount,
    payload: {
      customerId: input.customerId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
    },
  });
  return row.id;
}

export interface CollectionAllocationInput {
  receivableId: string;
  amount: string;
}

export interface CollectionInput {
  siteId: string;
  collectorUserId: string;
  collectorType?: 'driver' | 'cash_register' | 'office' | undefined;
  kind?: 'delivery' | 'payment' | undefined;
  customerId: string;
  method?: 'cash' | 'transfer' | undefined;
  paymentMethodId?: string | undefined;
  amount: string;
  deliveryId?: string | undefined;
  receivableId?: string | undefined;
  allocations?: CollectionAllocationInput[] | undefined;
  note?: string | undefined;
}

export async function registerCollection(
  tx: Executor,
  input: CollectionInput,
): Promise<{ id: string; number: string }> {
  const methodId = input.paymentMethodId ?? (await paymentMethodId(tx, input.method ?? 'cash'));
  const number = await nextCollectionNumber(tx);
  const kind = input.kind ?? 'delivery';
  const [row] = await tx
    .insert(collections)
    .values({
      number,
      siteId: input.siteId,
      kind,
      collectorType: input.collectorType ?? 'driver',
      collectorUserId: input.collectorUserId,
      customerId: input.customerId,
      paymentMethodId: methodId,
      amount: input.amount,
      deliveryId: input.deliveryId ?? null,
      note: input.note ?? null,
    })
    .returning({ id: collections.id });
  if (!row) throw new Error('No se pudo registrar el recaudo');

  const allocations =
    input.allocations ??
    (input.receivableId ? [{ receivableId: input.receivableId, amount: input.amount }] : []);
  let allocated = new Decimal(0);
  for (const allocation of allocations) {
    const result = await tx.execute(sql`
      select id, customer_id as "customerId", site_id as "siteId", amount, balance, due_on as "dueOn"
      from finance.receivables where id = ${allocation.receivableId} for update
    `);
    const receivable = (
      result.rows as unknown as {
        id: string;
        customerId: string;
        siteId: string | null;
        amount: string;
        balance: string;
        dueOn: string;
      }[]
    )[0];
    if (!receivable) throw AppError.notFound();
    if (receivable.customerId !== input.customerId) {
      throw validation('La obligación no pertenece al cliente del recaudo.');
    }
    if (new Decimal(receivable.balance).lt(allocation.amount)) {
      throw new AppError(
        422,
        'ALLOCATION_EXCEEDS_BALANCE',
        'Asignación mayor al saldo',
        'La asignación supera el saldo pendiente de la obligación.',
      );
    }
    allocated = allocated.plus(allocation.amount);
    const balance = new Decimal(receivable.balance).minus(allocation.amount);
    const status = receivableStatus(receivable.amount, balance.toFixed(2));
    await tx.insert(paymentAllocations).values({
      collectionId: row.id,
      receivableId: allocation.receivableId,
      amount: allocation.amount,
    });
    await tx
      .update(receivables)
      .set({ balance: balance.toFixed(2), status })
      .where(eq(receivables.id, allocation.receivableId));
  }

  if (allocated.gt(input.amount)) {
    throw new AppError(
      422,
      'ALLOCATION_SUM_MISMATCH',
      'Asignaciones inconsistentes',
      'La suma de asignaciones no puede superar el monto del recaudo.',
    );
  }
  if (kind === 'payment' && !allocated.eq(input.amount)) {
    throw new AppError(
      422,
      'ALLOCATION_SUM_MISMATCH',
      'Asignaciones incompletas',
      'Un abono debe aplicarse por completo a obligaciones del cliente.',
    );
  }

  await recordEvent(tx, {
    type: 'PaymentReceived',
    sourceType: 'finance.collection',
    sourceId: row.id,
    siteId: input.siteId,
    amount: input.amount,
    payload: {
      number,
      kind,
      customerId: input.customerId,
      collectorType: input.collectorType ?? 'driver',
      paymentMethodId: methodId,
      allocations,
    },
  });
  return { id: row.id, number };
}

interface ReceivableRow {
  id: string;
  customerId: string;
  customerName: string;
  siteId: string | null;
  siteName: string | null;
  sourceType: string;
  sourceId: string;
  amount: string;
  balance: string;
  issuedOn: string;
  dueOn: string;
  status: 'open' | 'partially_paid' | 'paid';
}

function toReceivable(row: ReceivableRow, asOf = currentDate()): ReceivableView {
  const days = overdueDays(row.dueOn, asOf);
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    siteId: row.siteId,
    siteName: row.siteName ?? 'Todas',
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    amount: money(row.amount),
    balance: money(row.balance),
    issuedOn: row.issuedOn,
    dueOn: row.dueOn,
    status: row.status,
    daysOverdue: days,
    bucket: agingBucket(row.dueOn, asOf),
  };
}

async function receivableRows(
  db: Executor,
  ctx: ExecutionContext,
  query: {
    q?: string | undefined;
    status?: ReceivableView['status'] | undefined;
    customerId?: string | undefined;
    siteId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    overdue?: boolean | undefined;
    limit: number;
  },
): Promise<ReceivableRow[]> {
  const scope = scopeFor(ctx, 'fin.receivable.read');
  const conditions = [
    sql`r.balance > 0`,
    siteCondition(scope.siteIds),
    receivableOwnerCondition(scope.ownerId),
    query.status ? sql`r.status = ${query.status}` : sql`true`,
    query.customerId ? sql`r.customer_id = ${query.customerId}` : sql`true`,
    query.siteId ? sql`r.site_id = ${query.siteId}` : sql`true`,
    query.q ? sql`c.name ilike ${`%${query.q}%`}` : sql`true`,
    query.from ? sql`r.due_on >= ${query.from}::date` : sql`true`,
    query.to ? sql`r.due_on <= ${query.to}::date` : sql`true`,
    query.overdue ? sql`r.due_on < current_date` : sql`true`,
  ];
  const result = await db.execute(sql`
    select r.id, r.customer_id as "customerId", c.name as "customerName",
           r.site_id as "siteId", site.name as "siteName", r.source_type as "sourceType",
           r.source_id as "sourceId", r.amount, r.balance, r.issued_on as "issuedOn",
           r.due_on as "dueOn", r.status
    from finance.receivables r
    join sales.customers c on c.id = r.customer_id
    left join admin.sites site on site.id = r.site_id
    where ${sql.join(conditions, sql` and `)}
    order by r.due_on asc, r.created_at asc
    limit ${query.limit}
  `);
  return result.rows as unknown as ReceivableRow[];
}

export async function listReceivables(
  db: Executor,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ReceivablePage> {
  authorize(ctx, 'fin.receivable.read');
  const query = ReceivableListQuery.parse(raw);
  const rows = await receivableRows(db, ctx, query);
  return {
    data: rows.map((row) => toReceivable(row)),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function getReceivable(
  db: Executor,
  ctx: ExecutionContext,
  id: string,
): Promise<ReceivableView> {
  authorize(ctx, 'fin.receivable.read');
  const scope = scopeFor(ctx, 'fin.receivable.read');
  const result = await db.execute(sql`
    select r.id, r.customer_id as "customerId", c.name as "customerName",
           r.site_id as "siteId", site.name as "siteName", r.source_type as "sourceType",
           r.source_id as "sourceId", r.amount, r.balance, r.issued_on as "issuedOn",
           r.due_on as "dueOn", r.status
    from finance.receivables r
    join sales.customers c on c.id = r.customer_id
    left join admin.sites site on site.id = r.site_id
    where r.id = ${id} and ${siteCondition(scope.siteIds)}
      and ${receivableOwnerCondition(scope.ownerId)}
    limit 1
  `);
  const row = (result.rows as unknown as ReceivableRow[])[0];
  if (!row) throw AppError.notFound();
  return toReceivable(row);
}

export async function getCustomerBalance(
  db: Executor,
  ctx: ExecutionContext,
  customerId: string,
): Promise<CustomerBalance> {
  authorize(ctx, 'fin.receivable_payment.create');
  const customerResult = await db.execute(sql`
    select id, name, is_active as "isActive" from sales.customers where id = ${customerId} limit 1
  `);
  const customer = (customerResult.rows as unknown as { id: string; name: string; isActive: boolean }[])[0];
  if (!customer) throw AppError.notFound();
  if (!customer.isActive) {
    throw AppError.conflict('CUSTOMER_INACTIVE', 'Cliente inactivo', 'No se pueden registrar abonos.');
  }
  const scope = scopeFor(ctx, 'fin.receivable_payment.create');
  const conditions = [
    sql`r.customer_id = ${customerId}`,
    sql`r.balance > 0`,
    scope.siteIds === null
      ? sql`true`
      : scope.siteIds.length === 0
        ? sql`false`
        : sql`r.site_id in (${sql.join(
            scope.siteIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
  ];
  const result = await db.execute(sql`
    select r.id, r.customer_id as "customerId", c.name as "customerName",
           r.site_id as "siteId", site.name as "siteName", r.source_type as "sourceType",
           r.source_id as "sourceId", r.amount, r.balance, r.issued_on as "issuedOn",
           r.due_on as "dueOn", r.status
    from finance.receivables r
    join sales.customers c on c.id = r.customer_id
    left join admin.sites site on site.id = r.site_id
    where ${sql.join(conditions, sql` and `)}
    order by r.due_on asc, r.created_at asc
  `);
  const data = (result.rows as unknown as ReceivableRow[]).map((row) => toReceivable(row));
  return {
    customerId,
    customerName: customer.name,
    total: money(data.reduce((sum, row) => sum.plus(row.balance), new Decimal(0))),
    receivables: data,
  };
}

function emptyBuckets(): Record<AgingBucketKey, Decimal> {
  return {
    due: new Decimal(0),
    overdue_1_30: new Decimal(0),
    overdue_31_60: new Decimal(0),
    overdue_61_90: new Decimal(0),
    overdue_90_plus: new Decimal(0),
  };
}

export async function agingReport(db: Executor, ctx: ExecutionContext, raw: unknown): Promise<AgingResponse> {
  authorize(ctx, 'fin.receivable.read');
  const query = AgingQuery.parse(raw);
  const rows = await receivableRows(db, ctx, {
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.siteId ? { siteId: query.siteId } : {}),
    limit: 1000,
  });
  const asOf = query.asOf ?? currentDate();
  const totals = emptyBuckets();
  let open = new Decimal(0);
  let overdue = new Decimal(0);
  let dueSoon = new Decimal(0);
  const customers = new Map<
    string,
    {
      customerName: string;
      total: Decimal;
      overdue: Decimal;
      dueSoon: Decimal;
      buckets: Record<AgingBucketKey, Decimal>;
    }
  >();

  for (const row of rows) {
    const bucket = agingBucket(row.dueOn, asOf);
    const balance = new Decimal(row.balance);
    const entry = customers.get(row.customerId) ?? {
      customerName: row.customerName,
      total: new Decimal(0),
      overdue: new Decimal(0),
      dueSoon: new Decimal(0),
      buckets: emptyBuckets(),
    };
    entry.total = entry.total.plus(balance);
    entry.buckets[bucket] = entry.buckets[bucket].plus(balance);
    totals[bucket] = totals[bucket].plus(balance);
    open = open.plus(balance);
    if (bucket === 'due') {
      entry.dueSoon = entry.dueSoon.plus(balance);
      dueSoon = dueSoon.plus(balance);
    } else {
      entry.overdue = entry.overdue.plus(balance);
      overdue = overdue.plus(balance);
    }
    customers.set(row.customerId, entry);
  }

  return {
    asOf,
    totals: {
      open: money(open),
      overdue: money(overdue),
      dueSoon: money(dueSoon),
      buckets: {
        due: money(totals.due),
        overdue_1_30: money(totals.overdue_1_30),
        overdue_31_60: money(totals.overdue_31_60),
        overdue_61_90: money(totals.overdue_61_90),
        overdue_90_plus: money(totals.overdue_90_plus),
      },
    },
    customers: [...customers.entries()].map(([customerId, entry]) => ({
      customerId,
      customerName: entry.customerName,
      total: money(entry.total),
      overdue: money(entry.overdue),
      dueSoon: money(entry.dueSoon),
      buckets: {
        due: money(entry.buckets.due),
        overdue_1_30: money(entry.buckets.overdue_1_30),
        overdue_31_60: money(entry.buckets.overdue_31_60),
        overdue_61_90: money(entry.buckets.overdue_61_90),
        overdue_90_plus: money(entry.buckets.overdue_90_plus),
      },
    })),
  };
}

export async function createPayment(
  db: Database,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<CollectionDetail> {
  const input = CreatePaymentRequest.parse(raw);
  const actor = authorize(ctx, 'fin.receivable_payment.create', { siteId: input.siteId });
  const scope = scopeFor(ctx, 'fin.receivable_payment.create');

  const id = await db.transaction(async (tx) => {
    const customerResult = await tx.execute(sql`
      select id, name, is_active as "isActive" from sales.customers where id = ${input.customerId} limit 1
    `);
    const customer = (customerResult.rows as unknown as { id: string; name: string; isActive: boolean }[])[0];
    if (!customer) throw AppError.notFound();
    if (!customer.isActive) {
      throw AppError.conflict('CUSTOMER_INACTIVE', 'Cliente inactivo', 'No se pueden registrar abonos.');
    }

    const allocationInputs = input.allocations ?? [];
    if (allocationInputs.length > 0) {
      if (!new Decimal(allocationSum(allocationInputs)).eq(input.amount)) {
        throw new AppError(
          422,
          'ALLOCATION_SUM_MISMATCH',
          'Asignaciones incompletas',
          'La suma de asignaciones debe ser igual al monto del abono.',
        );
      }
      for (const allocation of allocationInputs) {
        const result = await tx.execute(sql`
          select id, customer_id as "customerId", site_id as "siteId", balance
          from finance.receivables where id = ${allocation.receivableId} for update
        `);
        const receivable = (
          result.rows as unknown as {
            id: string;
            customerId: string;
            siteId: string | null;
            balance: string;
          }[]
        )[0];
        if (!receivable) throw AppError.notFound();
        if (receivable.customerId !== input.customerId) {
          throw validation('La obligación no pertenece al cliente.');
        }
        if (scope.siteIds !== null && receivable.siteId && !scope.siteIds.includes(receivable.siteId)) {
          throw AppError.notFound();
        }
        if (new Decimal(receivable.balance).lt(allocation.amount)) {
          throw new AppError(
            422,
            'ALLOCATION_EXCEEDS_BALANCE',
            'Asignación mayor al saldo',
            'La asignación supera el saldo pendiente.',
          );
        }
      }
    } else {
      const siteFilter =
        scope.siteIds === null
          ? sql`true`
          : scope.siteIds.length === 0
            ? sql`false`
            : sql`r.site_id in (${sql.join(
                scope.siteIds.map((siteId) => sql`${siteId}`),
                sql`, `,
              )})`;
      const result = await tx.execute(sql`
        select r.id, r.balance
        from finance.receivables r
        where r.customer_id = ${input.customerId} and r.balance > 0 and ${siteFilter}
        order by r.due_on asc, r.created_at asc
        for update
      `);
      const open = result.rows as unknown as { id: string; balance: string }[];
      const fifo = allocateFifo(
        input.amount,
        open.map((receivable) => ({ receivableId: receivable.id, balance: receivable.balance })),
      );
      allocationInputs.push(...fifo.allocations);
      if (new Decimal(fifo.remainder).gt(0)) {
        throw new AppError(
          409,
          'ABONO_EXCEEDS_BALANCE',
          'Abono mayor al saldo',
          'El abono supera el saldo abierto del cliente.',
        );
      }
    }

    const result = await registerCollection(tx, {
      siteId: input.siteId,
      collectorUserId: actor.userId,
      collectorType: actor.roleCodes.includes('CAJ') ? 'cash_register' : 'office',
      kind: 'payment',
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
      amount: input.amount,
      allocations: allocationInputs,
      ...(input.note ? { note: input.note } : {}),
    });
    await recordAudit(tx, ctx, {
      action: 'fin.collection.create',
      entityType: 'finance.collection',
      entityId: result.id,
      siteId: input.siteId,
      after: { number: result.number, customerId: input.customerId, amount: input.amount },
    });
    return result.id;
  });

  return getCollection(db, ctx, id, 'fin.receivable_payment.create');
}

interface CollectionRow {
  id: string;
  number: string;
  kind: 'delivery' | 'payment';
  siteId: string;
  siteName: string;
  collectorType: 'driver' | 'cash_register' | 'office';
  collectorUserId: string | null;
  collectorName: string | null;
  customerId: string | null;
  customerName: string | null;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: string;
  allocatedAmount: string;
  status: CollectionView['status'];
  deliveryId: string | null;
  createdAt: Date | string;
}

function toCollection(row: CollectionRow): CollectionView {
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    siteId: row.siteId,
    siteName: row.siteName,
    collectorType: row.collectorType,
    collectorUserId: row.collectorUserId,
    collectorName: row.collectorName,
    customerId: row.customerId,
    customerName: row.customerName,
    paymentMethodId: row.paymentMethodId,
    paymentMethodName: row.paymentMethodName,
    amount: money(row.amount),
    allocatedAmount: money(row.allocatedAmount),
    status: row.status,
    deliveryId: row.deliveryId,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
  };
}

async function collectionRows(
  db: Executor,
  ctx: ExecutionContext,
  query: {
    q?: string | undefined;
    siteId?: string | undefined;
    collectorType?: 'driver' | 'cash_register' | 'office' | undefined;
    collectorUserId?: string | undefined;
    customerId?: string | undefined;
    status?: CollectionView['status'] | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit: number;
  },
  permission = 'fin.receivable.read',
): Promise<CollectionRow[]> {
  const scope = scopeFor(ctx, permission);
  const conditions = [
    siteCondition(scope.siteIds),
    scope.ownerId ? sql`col.collector_user_id = ${scope.ownerId}` : sql`true`,
    query.status ? sql`col.status = ${query.status}` : sql`true`,
    query.collectorType ? sql`col.collector_type = ${query.collectorType}` : sql`true`,
    query.collectorUserId ? sql`col.collector_user_id = ${query.collectorUserId}` : sql`true`,
    query.customerId ? sql`col.customer_id = ${query.customerId}` : sql`true`,
    query.siteId ? sql`col.site_id = ${query.siteId}` : sql`true`,
    query.q ? sql`(col.number ilike ${`%${query.q}%`} or c.name ilike ${`%${query.q}%`})` : sql`true`,
    query.from ? sql`col.created_at >= ${query.from}::date` : sql`true`,
    query.to ? sql`col.created_at < (${query.to}::date + interval '1 day')` : sql`true`,
  ];
  const result = await db.execute(sql`
    select col.id, col.number, col.kind, col.site_id as "siteId", site.name as "siteName",
           col.collector_type as "collectorType", col.collector_user_id as "collectorUserId",
           u.full_name as "collectorName", col.customer_id as "customerId", c.name as "customerName",
           col.payment_method_id as "paymentMethodId", pm.name as "paymentMethodName",
           col.amount,
           coalesce((select sum(pa.amount) from finance.payment_allocations pa where pa.collection_id = col.id), 0) as "allocatedAmount",
           col.status, col.delivery_id as "deliveryId", col.created_at as "createdAt"
    from finance.collections col
    join admin.sites site on site.id = col.site_id
    left join admin.users u on u.id = col.collector_user_id
    left join sales.customers c on c.id = col.customer_id
    join finance.payment_methods pm on pm.id = col.payment_method_id
    where ${sql.join(conditions, sql` and `)}
    order by col.created_at desc, col.number desc
    limit ${query.limit}
  `);
  return result.rows as unknown as CollectionRow[];
}

export async function listCollections(
  db: Executor,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<CollectionPage> {
  authorize(ctx, 'fin.receivable.read');
  const query = CollectionListQuery.parse(raw);
  const rows = await collectionRows(db, ctx, query);
  return { data: rows.map(toCollection), page: { nextCursor: null, limit: query.limit } };
}

export async function getCollection(
  db: Executor,
  ctx: ExecutionContext,
  id: string,
  permission = 'fin.receivable.read',
): Promise<CollectionDetail> {
  authorize(ctx, permission);
  const rows = await collectionRows(db, ctx, { limit: 1000 }, permission);
  const row = rows.find((item) => item.id === id);
  if (!row) throw AppError.notFound();
  const allocations = await db.execute(sql`
    select pa.receivable_id as "receivableId", c.name as "customerName",
           r.source_type as "sourceType", r.source_id as "sourceId", r.due_on as "dueOn", pa.amount
    from finance.payment_allocations pa
    join finance.receivables r on r.id = pa.receivable_id
    join sales.customers c on c.id = r.customer_id
    where pa.collection_id = ${id}
    order by r.due_on asc
  `);
  return {
    ...toCollection(row),
    allocations: (
      allocations.rows as unknown as {
        receivableId: string;
        customerName: string;
        sourceType: string;
        sourceId: string;
        dueOn: string;
        amount: string;
      }[]
    ).map((allocation) => ({ ...allocation, amount: money(allocation.amount) })),
  };
}

interface ReconciliationRow {
  id: string;
  number: string;
  siteId: string;
  siteName: string;
  collectorType: 'driver' | 'cash_register' | 'office';
  collectorUserId: string | null;
  collectorName: string | null;
  periodFrom: string;
  periodTo: string;
  expectedAmount: string;
  receivedAmount: string;
  variance: string;
  note: string | null;
  createdAt: Date | string;
}

async function reconciliationRows(
  db: Executor,
  ctx: ExecutionContext,
  query: {
    siteId?: string | undefined;
    collectorType?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit: number;
  },
): Promise<{
  rows: ReconciliationRow[];
  lines: Map<string, ReconciliationView['lines']>;
  collections: Map<string, string[]>;
}> {
  const scope = scopeFor(ctx, 'fin.reconciliation.manage');
  const conditions = [
    siteCondition(scope.siteIds),
    query.siteId ? sql`rc.site_id = ${query.siteId}` : sql`true`,
    query.collectorType ? sql`rc.collector_type = ${query.collectorType}` : sql`true`,
    query.from ? sql`rc.created_at >= ${query.from}::date` : sql`true`,
    query.to ? sql`rc.created_at < (${query.to}::date + interval '1 day')` : sql`true`,
  ];
  const result = await db.execute(sql`
    select rc.id, rc.number, rc.site_id as "siteId", site.name as "siteName",
           rc.collector_type as "collectorType", rc.collector_user_id as "collectorUserId",
           u.full_name as "collectorName", rc.period_from as "periodFrom", rc.period_to as "periodTo",
           rc.expected_amount as "expectedAmount", rc.received_amount as "receivedAmount",
           rc.variance, rc.note, rc.created_at as "createdAt"
    from finance.reconciliations rc
    join admin.sites site on site.id = rc.site_id
    left join admin.users u on u.id = rc.collector_user_id
    where ${sql.join(conditions, sql` and `)}
    order by rc.created_at desc, rc.number desc
    limit ${query.limit}
  `);
  const rows = result.rows as unknown as ReconciliationRow[];
  const ids = rows.map((row) => row.id);
  const lines = new Map<string, ReconciliationView['lines']>();
  const collectionsMap = new Map<string, string[]>();
  if (ids.length > 0) {
    const lineResult = await db.execute(sql`
      select rl.reconciliation_id as "reconciliationId", rl.payment_method_id as "paymentMethodId",
             pm.name as "paymentMethodName", rl.expected_amount as "expectedAmount",
             rl.received_amount as "receivedAmount", rl.variance
      from finance.reconciliation_lines rl
      join finance.payment_methods pm on pm.id = rl.payment_method_id
      where rl.reconciliation_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
      order by pm.name
    `);
    for (const line of lineResult.rows as unknown as {
      reconciliationId: string;
      paymentMethodId: string;
      paymentMethodName: string;
      expectedAmount: string;
      receivedAmount: string;
      variance: string;
    }[]) {
      const current = lines.get(line.reconciliationId) ?? [];
      current.push({
        paymentMethodId: line.paymentMethodId,
        paymentMethodName: line.paymentMethodName,
        expectedAmount: money(line.expectedAmount),
        receivedAmount: money(line.receivedAmount),
        variance: money(line.variance),
      });
      lines.set(line.reconciliationId, current);
    }
    const collectionResult = await db.execute(sql`
      select reconciliation_id as "reconciliationId", id
      from finance.collections
      where reconciliation_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    for (const item of collectionResult.rows as unknown as { reconciliationId: string; id: string }[]) {
      const current = collectionsMap.get(item.reconciliationId) ?? [];
      current.push(item.id);
      collectionsMap.set(item.reconciliationId, current);
    }
  }
  return { rows, lines, collections: collectionsMap };
}

function toReconciliation(
  row: ReconciliationRow,
  lines: ReconciliationView['lines'],
  collectionIds: string[],
): ReconciliationView {
  return {
    id: row.id,
    number: row.number,
    siteId: row.siteId,
    siteName: row.siteName,
    collectorType: row.collectorType,
    collectorUserId: row.collectorUserId,
    collectorName: row.collectorName,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    expectedAmount: money(row.expectedAmount),
    receivedAmount: money(row.receivedAmount),
    variance: money(row.variance),
    note: row.note,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
    lines,
    collectionIds,
  };
}

export async function listReconciliations(
  db: Executor,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ReconciliationPage> {
  authorize(ctx, 'fin.reconciliation.manage');
  const query = ReconciliationListQuery.parse(raw);
  const result = await reconciliationRows(db, ctx, query);
  return {
    data: result.rows.map((row) =>
      toReconciliation(row, result.lines.get(row.id) ?? [], result.collections.get(row.id) ?? []),
    ),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function getReconciliation(
  db: Executor,
  ctx: ExecutionContext,
  id: string,
): Promise<ReconciliationView> {
  authorize(ctx, 'fin.reconciliation.manage');
  const result = await reconciliationRows(db, ctx, { limit: 1000 });
  const row = result.rows.find((item) => item.id === id);
  if (!row) throw AppError.notFound();
  return toReconciliation(row, result.lines.get(row.id) ?? [], result.collections.get(row.id) ?? []);
}

export async function createReconciliation(
  db: Database,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ReconciliationView> {
  const input = CreateReconciliationRequest.parse(raw);
  authorize(ctx, 'fin.reconciliation.manage', { siteId: input.siteId });
  const actor = requireActor(ctx);

  const id = await db.transaction(async (tx) => {
    const collectionResult = await tx.execute(sql`
      select id, number, site_id as "siteId", collector_type as "collectorType",
             collector_user_id as "collectorUserId", payment_method_id as "paymentMethodId",
             amount, status, created_at as "createdAt"
      from finance.collections
      where id in (${sql.join(
        input.collectionIds.map((collectionId) => sql`${collectionId}`),
        sql`, `,
      )})
      for update
    `);
    const rows = collectionResult.rows as unknown as {
      id: string;
      number: string;
      siteId: string;
      collectorType: 'driver' | 'cash_register' | 'office';
      collectorUserId: string | null;
      paymentMethodId: string;
      amount: string;
      status: string;
      createdAt: Date | string;
    }[];
    if (rows.length !== input.collectionIds.length) throw AppError.notFound();
    const collectorIds = new Set(rows.map((row) => row.collectorUserId ?? ''));
    const collectorTypes = new Set(rows.map((row) => row.collectorType));
    if (collectorTypes.size > 1 || collectorIds.size > 1) {
      throw new AppError(
        422,
        'RECONCILIATION_MIXED_COLLECTORS',
        'Responsables mezclados',
        'Los recaudos de una conciliación deben ser del mismo responsable.',
      );
    }
    for (const row of rows) {
      if (row.status !== 'registered') {
        throw AppError.conflict(
          'COLLECTION_NOT_PENDING',
          'Recaudo no pendiente',
          `El recaudo ${row.number} ya fue conciliado.`,
        );
      }
      if (row.siteId !== input.siteId) {
        throw AppError.notFound();
      }
      if (input.collectorUserId && row.collectorUserId !== input.collectorUserId) {
        throw new AppError(
          422,
          'RECONCILIATION_MIXED_COLLECTORS',
          'Responsables mezclados',
          'Los recaudos no pertenecen al responsable indicado.',
        );
      }
    }
    const collectorUserId = rows[0]?.collectorUserId ?? null;
    if (!collectorUserId) {
      throw validation('Los recaudos deben tener un responsable.');
    }

    const expectedByMethod = new Map<string, Decimal>();
    for (const row of rows) {
      expectedByMethod.set(
        row.paymentMethodId,
        (expectedByMethod.get(row.paymentMethodId) ?? new Decimal(0)).plus(row.amount),
      );
    }
    const countByMethod = new Map(input.counts.map((count) => [count.paymentMethodId, count.receivedAmount]));
    for (const methodId of expectedByMethod.keys()) {
      if (!countByMethod.has(methodId)) {
        throw new AppError(
          422,
          'RECONCILIATION_METHOD_MISMATCH',
          'Conteo incompleto',
          'Falta el conteo de un método con recaudos esperados.',
        );
      }
    }
    for (const count of input.counts) {
      if (!expectedByMethod.has(count.paymentMethodId) && new Decimal(count.receivedAmount).gt(0)) {
        throw new AppError(
          422,
          'RECONCILIATION_METHOD_MISMATCH',
          'Método sin recaudos',
          'No hay recaudos esperados para uno de los métodos contados.',
        );
      }
    }

    let expectedTotal = new Decimal(0);
    let receivedTotal = new Decimal(0);
    const lines = [...expectedByMethod.entries()].map(([paymentMethodId, expected]) => {
      const received = new Decimal(countByMethod.get(paymentMethodId) ?? '0');
      expectedTotal = expectedTotal.plus(expected);
      receivedTotal = receivedTotal.plus(received);
      return {
        paymentMethodId,
        expectedAmount: expected.toFixed(2),
        receivedAmount: received.toFixed(2),
        variance: received.minus(expected).toFixed(2),
      };
    });
    const variance = receivedTotal.minus(expectedTotal);
    const dates = rows
      .map((row) => (row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt))
      .sort();
    const periodFrom = (dates[0] ?? new Date().toISOString()).slice(0, 10);
    const periodTo = (dates[dates.length - 1] ?? new Date().toISOString()).slice(0, 10);
    const number = await nextReconciliationNumber(tx);
    const [reconciliation] = await tx
      .insert(reconciliations)
      .values({
        number,
        siteId: input.siteId,
        collectorType: rows[0]?.collectorType ?? input.collectorType,
        collectorUserId,
        periodFrom,
        periodTo,
        expectedAmount: expectedTotal.toFixed(2),
        receivedAmount: receivedTotal.toFixed(2),
        variance: variance.toFixed(2),
        note: input.note ?? null,
        createdBy: actor.userId,
      })
      .returning({ id: reconciliations.id });
    if (!reconciliation) throw new Error('No se pudo crear la conciliación');
    await tx
      .insert(reconciliationLines)
      .values(lines.map((line) => ({ reconciliationId: reconciliation.id, ...line })));
    await tx
      .update(collections)
      .set({
        reconciliationId: reconciliation.id,
        status: reconciliationStatus(variance),
      })
      .where(
        sql`${collections.id} in (${sql.join(
          input.collectionIds.map((collectionId) => sql`${collectionId}`),
          sql`, `,
        )})`,
      );
    await recordAudit(tx, ctx, {
      action: 'fin.reconciliation.create',
      entityType: 'finance.reconciliation',
      entityId: reconciliation.id,
      siteId: input.siteId,
      after: {
        number,
        expectedAmount: expectedTotal.toFixed(2),
        receivedAmount: receivedTotal.toFixed(2),
        variance: variance.toFixed(2),
      },
    });
    await recordEvent(tx, {
      type: 'CollectionReconciled',
      sourceType: 'finance.reconciliation',
      sourceId: reconciliation.id,
      siteId: input.siteId,
      amount: receivedTotal.toFixed(2),
      payload: {
        number,
        expectedAmount: expectedTotal.toFixed(2),
        receivedAmount: receivedTotal.toFixed(2),
        variance: variance.toFixed(2),
        collectionIds: input.collectionIds,
      },
    });
    return reconciliation.id;
  });

  return getReconciliation(db, ctx, id);
}

export async function financeDashboard(db: Executor, ctx: ExecutionContext): Promise<FinanceDashboard> {
  authorize(ctx, 'fin.receivable.read');
  const aging = await agingReport(db, ctx, {});
  const scope = scopeFor(ctx, 'fin.receivable.read');
  const pendingResult = await db.execute(sql`
    select count(*)::int as "count", coalesce(sum(col.amount), 0) as "amount"
    from finance.collections col
    join admin.sites site on site.id = col.site_id
    where col.status = 'registered' and ${siteCondition(scope.siteIds)}
      ${scope.ownerId ? sql`and col.collector_user_id = ${scope.ownerId}` : sql``}
  `);
  const pending = pendingResult.rows[0] as { count: number; amount: string } | undefined;
  const reconciliationScope = scopeFor(ctx, 'fin.reconciliation.manage');
  const reconciliationResult = await db.execute(sql`
    select count(*)::int as "count",
           (select variance from finance.reconciliations rc2
            join admin.sites site2 on site2.id = rc2.site_id
            where ${siteCondition(reconciliationScope.siteIds, 'site2')}
            order by rc2.created_at desc limit 1) as "lastVariance"
    from finance.reconciliations rc
    join admin.sites site on site.id = rc.site_id
    where ${siteCondition(reconciliationScope.siteIds)}
  `);
  const reconciliation = reconciliationResult.rows[0] as
    { count: number; lastVariance: string | null } | undefined;
  return {
    receivables: {
      open: aging.totals.open,
      overdue: aging.totals.overdue,
      dueSoon: aging.totals.dueSoon,
      buckets: aging.totals.buckets,
    },
    collections: {
      pendingCount: pending?.count ?? 0,
      pendingAmount: money(pending?.amount ?? '0'),
    },
    reconciliations: {
      pendingCount: reconciliation?.count ?? 0,
      lastVariance: reconciliation?.lastVariance ? money(reconciliation.lastVariance) : null,
    },
  };
}

export async function carteraCsv(
  db: Executor,
  ctx: ExecutionContext,
  raw: {
    siteId?: string | undefined;
    customerId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  },
): Promise<string> {
  authorize(ctx, 'rep.operational.read');
  const rows = await receivableRows(db, ctx, { ...raw, limit: 1000 });
  return toCsv([
    ['Cliente', 'Obligación', 'Origen', 'Emitida', 'Vence', 'Monto', 'Saldo', 'Estado', 'Días vencida'],
    ...rows.map((row) => [
      row.customerName,
      row.id,
      row.sourceType,
      row.issuedOn,
      row.dueOn,
      money(row.amount),
      money(row.balance),
      row.status,
      overdueDays(row.dueOn, currentDate()),
    ]),
  ]);
}

export async function recaudosCsv(
  db: Executor,
  ctx: ExecutionContext,
  raw: {
    siteId?: string | undefined;
    status?: CollectionView['status'] | undefined;
    from?: string | undefined;
    to?: string | undefined;
  },
): Promise<string> {
  authorize(ctx, 'rep.operational.read');
  const rows = await collectionRows(db, ctx, { ...raw, limit: 1000 });
  return toCsv([
    ['Número', 'Fecha', 'Tipo', 'Sede', 'Responsable', 'Cliente', 'Método', 'Monto', 'Aplicado', 'Estado'],
    ...rows.map((row) => [
      row.number,
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      row.kind,
      row.siteName,
      row.collectorName ?? '',
      row.customerName ?? '',
      row.paymentMethodName,
      money(row.amount),
      money(row.allocatedAmount),
      row.status,
    ]),
  ]);
}

export async function cajaCsv(
  db: Executor,
  ctx: ExecutionContext,
  raw: { siteId?: string | undefined; from?: string | undefined; to?: string | undefined },
): Promise<string> {
  authorize(ctx, 'rep.operational.read');
  const scope = scopeFor(ctx, 'rep.operational.read');
  const conditions = [
    siteCondition(scope.siteIds),
    scope.ownerId ? sql`s.cashier_user_id = ${scope.ownerId}` : sql`true`,
    raw.siteId ? sql`s.site_id = ${raw.siteId}` : sql`true`,
    raw.from ? sql`s.opened_at >= ${raw.from}::date` : sql`true`,
    raw.to ? sql`s.opened_at < (${raw.to}::date + interval '1 day')` : sql`true`,
  ];
  const result = await db.execute(sql`
    select s.id, s.status, site.name as "siteName", u.full_name as "cashierName",
           s.opening_cash as "openingCash", s.cash_expected as "cashExpected",
           s.cash_counted as "cashCounted", s.cash_difference as "cashDifference",
           s.opened_at as "openedAt", s.closed_at as "closedAt"
    from pos.shifts s
    join admin.sites site on site.id = s.site_id
    join admin.users u on u.id = s.cashier_user_id
    where ${sql.join(conditions, sql` and `)}
    order by s.opened_at desc
    limit 1000
  `);
  return toCsv([
    ['Turno', 'Sede', 'Cajero', 'Apertura', 'Cierre', 'Base', 'Esperado', 'Contado', 'Diferencia', 'Estado'],
    ...(
      result.rows as unknown as {
        id: string;
        status: string;
        siteName: string;
        cashierName: string;
        openingCash: string;
        cashExpected: string | null;
        cashCounted: string | null;
        cashDifference: string | null;
        openedAt: Date | string;
        closedAt: Date | string | null;
      }[]
    ).map((row) => [
      row.id,
      row.siteName,
      row.cashierName,
      row.openedAt instanceof Date ? row.openedAt.toISOString() : row.openedAt,
      row.closedAt ? (row.closedAt instanceof Date ? row.closedAt.toISOString() : row.closedAt) : '',
      money(row.openingCash),
      row.cashExpected ? money(row.cashExpected) : '',
      row.cashCounted ? money(row.cashCounted) : '',
      row.cashDifference ? money(row.cashDifference) : '',
      row.status,
    ]),
  ]);
}
