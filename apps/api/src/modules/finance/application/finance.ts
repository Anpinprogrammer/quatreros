import { eq, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import { collections, receivables } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

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

async function nextCollectionNumber(tx: Executor): Promise<string> {
  await tx.insert(documentSequences).values({ docType: 'RC' }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, 'RC'))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `RC-${String(value).padStart(4, '0')}`;
}

export interface ReceivableInput {
  customerId: string;
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
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amount: input.amount,
      balance: input.amount,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
    })
    .returning({ id: receivables.id });
  if (!row) throw new Error('No se pudo crear la obligación');
  return row.id;
}

export interface CollectionInput {
  siteId: string;
  collectorUserId: string;
  customerId: string;
  method: 'cash' | 'transfer';
  amount: string;
  deliveryId?: string | undefined;
  receivableId?: string | undefined;
}

export async function registerCollection(
  tx: Executor,
  input: CollectionInput,
): Promise<{ id: string; number: string }> {
  const methodId = await paymentMethodId(tx, input.method);
  const number = await nextCollectionNumber(tx);
  const [row] = await tx
    .insert(collections)
    .values({
      number,
      siteId: input.siteId,
      collectorType: 'driver',
      collectorUserId: input.collectorUserId,
      customerId: input.customerId,
      paymentMethodId: methodId,
      amount: input.amount,
      deliveryId: input.deliveryId ?? null,
    })
    .returning({ id: collections.id });
  if (!row) throw new Error('No se pudo registrar el recaudo');

  if (input.receivableId) {
    const receivableResult = await tx.execute(sql`
      select amount, balance from finance.receivables where id = ${input.receivableId} for update
    `);
    const receivable = receivableResult.rows[0] as { amount: string; balance: string } | undefined;
    if (receivable) {
      const balance = Decimal.max(new Decimal(receivable.balance).minus(input.amount), 0);
      const status = balance.eq(0) ? 'paid' : balance.eq(receivable.amount) ? 'open' : 'partially_paid';
      await tx
        .update(receivables)
        .set({ balance: balance.toFixed(2), status })
        .where(eq(receivables.id, input.receivableId));
    }
  }
  return { id: row.id, number };
}

export interface ActivePaymentMethod {
  id: string;
  name: string;
  isCash: boolean;
}

/** Medios de pago activos para caja (Q-POS-02: solo los sembrados en el catálogo). */
export async function listActivePaymentMethods(db: Executor): Promise<ActivePaymentMethod[]> {
  const result = await db.execute(sql`
    select id, name, is_cash as "isCash"
    from finance.payment_methods
    where is_active = true
    order by is_cash desc, name asc
  `);
  return result.rows as unknown as ActivePaymentMethod[];
}
