import {
  CreateCustomerRequest,
  CreateSalesOrderRequest,
  CustomerListQuery,
  SalesOrderListQuery,
  UpdateCreditRequest,
  UpdateCustomerRequest,
  type CustomerPage,
  type CustomerView,
  type PaymentMode,
  type SalesOrderDetail,
  type SalesOrderPage,
  type SalesOrderStatus,
  type SalesOrderSummary,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter } from '../../admin/application/public.js';
import { loadSalePresentation } from '../../catalog/application/public.js';
import { creditSnapshot } from '../../finance/application/public.js';
import { reserveOrderLine } from '../../inventory/application/public.js';
import { customers, salesOrderLines, salesOrders } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface SalesDeps {
  db: Database;
}

interface CustomerRow {
  id: string;
  kind: CustomerView['kind'];
  name: string;
  taxId: string | null;
  phone: string | null;
  deliveryAddress: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  creditEnabled: boolean | null;
  creditLimit: string | null;
  termDays: number | null;
}

interface OrderRow {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  channel: SalesOrderSummary['channel'];
  paymentMode: PaymentMode;
  requestedDate: string | null;
  status: SalesOrderStatus;
  total: string;
  creditWarning: string | null;
  confirmedAt: Date | string;
  lineCount: number;
}

interface OrderLineRow {
  id: string;
  presentationId: string;
  presentationName: string;
  itemName: string;
  orderedQty: string;
  reservedQty: string;
  deliveredQty: string;
  returnedQty: string;
  unitPrice: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function siteIdsFor(ctx: ExecutionContext, permission: string): string[] | null {
  const filter = listFilter(ctx, permission);
  return filter.kind === 'all' ? null : filter.siteIds;
}

function siteCondition(siteIds: string[] | null, alias = 'site'): ReturnType<typeof sql> {
  if (siteIds === null) return sql`true`;
  if (siteIds.length === 0) return sql`false`;
  return sql`${sql.raw(alias)}.id in (${sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

async function nextNumber(tx: Executor, docType: string, prefix: string): Promise<string> {
  await tx.insert(documentSequences).values({ docType }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, docType))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `${prefix}-${String(value).padStart(4, '0')}`;
}

function toCustomer(row: CustomerRow): CustomerView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    taxId: row.taxId,
    phone: row.phone,
    deliveryAddress: row.deliveryAddress,
    isActive: row.isActive,
    version: row.version,
    credit:
      row.creditEnabled === null
        ? null
        : {
            enabled: row.creditEnabled,
            creditLimit: row.creditLimit ?? '0',
            termDays: row.termDays ?? 0,
          },
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function customerRow(db: Executor, id: string): Promise<CustomerRow | undefined> {
  const result = await db.execute(sql`
    select c.id, c.kind, c.name, c.tax_id as "taxId", c.phone,
           c.delivery_address as "deliveryAddress", c.is_active as "isActive", c.version,
           c.created_at as "createdAt", c.updated_at as "updatedAt",
           ct.enabled as "creditEnabled", ct.credit_limit as "creditLimit", ct.term_days as "termDays"
    from sales.customers c
    left join finance.credit_terms ct on ct.customer_id = c.id
    where c.id = ${id}
    limit 1
  `);
  return (result.rows as unknown as CustomerRow[])[0];
}

export async function listCustomers(
  deps: SalesDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<CustomerPage> {
  authorize(ctx, 'com.customer.read');
  const query = CustomerListQuery.parse(raw);
  const conditions: ReturnType<typeof sql>[] = [];
  if (query.q) conditions.push(sql`c.name ilike ${`%${query.q}%`}`);
  if (query.status !== 'all') conditions.push(sql`c.is_active = ${query.status === 'active'}`);
  const result = await deps.db.execute(sql`
    select c.id, c.kind, c.name, c.tax_id as "taxId", c.phone,
           c.delivery_address as "deliveryAddress", c.is_active as "isActive", c.version,
           c.created_at as "createdAt", c.updated_at as "updatedAt",
           ct.enabled as "creditEnabled", ct.credit_limit as "creditLimit", ct.term_days as "termDays"
    from sales.customers c
    left join finance.credit_terms ct on ct.customer_id = c.id
    where ${sql.join(conditions.length ? conditions : [sql`true`], sql` and `)}
    order by c.is_active desc, c.name
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as CustomerRow[]).map(toCustomer),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function createCustomer(
  deps: SalesDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<CustomerView> {
  authorize(ctx, 'com.customer.manage');
  const input = CreateCustomerRequest.parse(raw);
  const id = await deps.db.transaction(async (tx) => {
    const duplicate = await tx.execute(sql`
      select 1 from sales.customers where lower(name) = lower(${input.name}) limit 1
    `);
    if (duplicate.rows.length > 0) {
      throw AppError.conflict('NAME_TAKEN', 'Nombre en uso', 'Ya existe un cliente con ese nombre.');
    }
    if (input.taxId) {
      const tax = await tx.execute(sql`select 1 from sales.customers where tax_id = ${input.taxId} limit 1`);
      if (tax.rows.length > 0) {
        throw AppError.conflict(
          'TAX_ID_TAKEN',
          'Identificación en uso',
          'Ya existe un cliente con esa identificación.',
        );
      }
    }
    const [row] = await tx
      .insert(customers)
      .values({
        kind: input.kind,
        name: input.name,
        taxId: input.taxId ?? null,
        phone: input.phone ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
      })
      .returning({ id: customers.id });
    if (!row) throw new Error('No se pudo crear el cliente');
    await recordAudit(tx, ctx, {
      action: 'com.customer.create',
      entityType: 'sales.customer',
      entityId: row.id,
      after: input,
    });
    return row.id;
  });
  const created = await customerRow(deps.db, id);
  if (!created) throw AppError.notFound();
  return toCustomer(created);
}

export async function updateCustomer(
  deps: SalesDeps,
  ctx: ExecutionContext,
  id: string,
  expectedVersion: number | undefined,
  raw: unknown,
): Promise<CustomerView> {
  authorize(ctx, 'com.customer.manage');
  const input = UpdateCustomerRequest.parse(raw);
  await deps.db.transaction(async (tx) => {
    const before = await customerRow(tx, id);
    if (!before) throw AppError.notFound();
    if (expectedVersion !== undefined && expectedVersion !== before.version) {
      throw new AppError(
        412,
        'PRECONDITION_FAILED',
        'Registro desactualizado',
        'Recarga e inténtalo de nuevo.',
      );
    }
    await tx
      .update(customers)
      .set({
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.deliveryAddress !== undefined ? { deliveryAddress: input.deliveryAddress } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        version: sql`${customers.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));
    await recordAudit(tx, ctx, {
      action: 'com.customer.update',
      entityType: 'sales.customer',
      entityId: id,
      before: toCustomer(before),
      after: input,
    });
  });
  const updated = await customerRow(deps.db, id);
  if (!updated) throw AppError.notFound();
  return toCustomer(updated);
}

export async function updateCredit(
  deps: SalesDeps,
  ctx: ExecutionContext,
  customerId: string,
  raw: unknown,
): Promise<CustomerView> {
  const actor = authorize(ctx, 'fin.credit.configure');
  const input = UpdateCreditRequest.parse(raw);
  await deps.db.transaction(async (tx) => {
    const customer = await customerRow(tx, customerId);
    if (!customer) throw AppError.notFound();
    await tx.execute(sql`
      insert into finance.credit_terms (customer_id, enabled, credit_limit, term_days, updated_by, updated_at)
      values (${customerId}, ${input.enabled}, ${input.creditLimit}, ${input.termDays}, ${actor.userId}, now())
      on conflict (customer_id) do update
      set enabled = excluded.enabled, credit_limit = excluded.credit_limit,
          term_days = excluded.term_days, updated_by = excluded.updated_by, updated_at = now()
    `);
    await recordAudit(tx, ctx, {
      action: 'fin.credit.configure',
      entityType: 'sales.customer',
      entityId: customerId,
      after: input,
    });
  });
  const updated = await customerRow(deps.db, customerId);
  if (!updated) throw AppError.notFound();
  return toCustomer(updated);
}

function toOrderSummary(row: OrderRow): SalesOrderSummary {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customerId,
    customerName: row.customerName,
    siteId: row.siteId,
    siteName: row.siteName,
    channel: row.channel,
    paymentMode: row.paymentMode,
    requestedDate: row.requestedDate,
    status: row.status,
    total: row.total,
    creditWarning: row.creditWarning,
    confirmedAt: iso(row.confirmedAt),
    lineCount: row.lineCount,
  };
}

async function orderLines(db: Executor, orderId: string) {
  const result = await db.execute(sql`
    select ol.id, ol.presentation_id as "presentationId", pr.name as "presentationName",
           p.name as "itemName", ol.ordered_qty as "orderedQty", ol.reserved_qty as "reservedQty",
           ol.delivered_qty as "deliveredQty", ol.returned_qty as "returnedQty",
           ol.unit_price as "unitPrice"
    from sales.order_lines ol
    join catalog.presentations pr on pr.id = ol.presentation_id
    join catalog.products p on p.id = pr.product_id
    where ol.order_id = ${orderId}
    order by p.name, pr.name
  `);
  return result.rows as unknown as OrderLineRow[];
}

async function orderRow(db: Executor, id: string, siteIds: string[] | null): Promise<OrderRow | undefined> {
  const result = await db.execute(sql`
    select o.id, o.number, o.customer_id as "customerId", c.name as "customerName",
           o.site_id as "siteId", site.name as "siteName", o.channel,
           o.payment_mode as "paymentMode", o.requested_date as "requestedDate",
           o.status, o.credit_warning as "creditWarning", o.confirmed_at as "confirmedAt",
           coalesce(sum(ol.ordered_qty * ol.unit_price), 0)::numeric(14,2) as total,
           count(ol.id)::int as "lineCount"
    from sales.orders o
    join sales.customers c on c.id = o.customer_id
    join admin.sites site on site.id = o.site_id
    left join sales.order_lines ol on ol.order_id = o.id
    where o.id = ${id} and ${siteCondition(siteIds)}
    group by o.id, c.name, site.name
    limit 1
  `);
  return (result.rows as unknown as OrderRow[])[0];
}

export async function listOrders(
  deps: SalesDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<SalesOrderPage> {
  const siteIds = siteIdsFor(ctx, 'com.order.read');
  const query = SalesOrderListQuery.parse(raw);
  const conditions = [siteCondition(siteIds)];
  if (query.status) conditions.push(sql`o.status = ${query.status}`);
  if (query.customerId) conditions.push(sql`o.customer_id = ${query.customerId}`);
  if (query.from) conditions.push(sql`o.confirmed_at::date >= ${query.from}`);
  if (query.to) conditions.push(sql`o.confirmed_at::date <= ${query.to}`);
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(sql`(o.number ilike ${term} or c.name ilike ${term})`);
  }
  const result = await deps.db.execute(sql`
    select o.id, o.number, o.customer_id as "customerId", c.name as "customerName",
           o.site_id as "siteId", site.name as "siteName", o.channel,
           o.payment_mode as "paymentMode", o.requested_date as "requestedDate",
           o.status, o.credit_warning as "creditWarning", o.confirmed_at as "confirmedAt",
           coalesce(sum(ol.ordered_qty * ol.unit_price), 0)::numeric(14,2) as total,
           count(ol.id)::int as "lineCount"
    from sales.orders o
    join sales.customers c on c.id = o.customer_id
    join admin.sites site on site.id = o.site_id
    left join sales.order_lines ol on ol.order_id = o.id
    where ${sql.join(conditions, sql` and `)}
    group by o.id, c.name, site.name
    order by o.confirmed_at desc, o.number desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as OrderRow[]).map(toOrderSummary),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function getOrder(
  deps: SalesDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<SalesOrderDetail> {
  const siteIds = siteIdsFor(ctx, 'com.order.read');
  const row = await orderRow(deps.db, id, siteIds);
  if (!row) throw AppError.notFound();
  const lines = await orderLines(deps.db, id);
  return {
    ...toOrderSummary(row),
    lines: lines.map((line) => ({
      id: line.id,
      presentationId: line.presentationId,
      presentationName: line.presentationName,
      itemName: line.itemName,
      orderedQty: line.orderedQty,
      reservedQty: line.reservedQty,
      deliveredQty: line.deliveredQty,
      returnedQty: line.returnedQty,
      pendingQty: Decimal.max(new Decimal(line.orderedQty).minus(line.deliveredQty), 0).toFixed(3),
      unitPrice: line.unitPrice,
      lineTotal: new Decimal(line.orderedQty).times(line.unitPrice).toFixed(2),
    })),
  };
}

export async function createOrder(
  deps: SalesDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<SalesOrderDetail> {
  const actor = authorize(ctx, 'com.order.create');
  const input = CreateSalesOrderRequest.parse(raw);
  const presentationIds = input.lines.map((line) => line.presentationId);
  if (new Set(presentationIds).size !== presentationIds.length) {
    throw validation('Cada presentación debe aparecer una sola vez en el pedido.');
  }

  const orderId = await deps.db.transaction(async (tx) => {
    const customer = await customerRow(tx, input.customerId);
    if (!customer) throw AppError.notFound();
    if (!customer.isActive) {
      throw AppError.conflict('CUSTOMER_INACTIVE', 'Cliente inactivo', 'Reactiva el cliente antes de pedir.');
    }
    const siteResult = await tx.execute(sql`
      select id, is_active as "isActive" from admin.sites where id = ${input.siteId} limit 1
    `);
    const site = (siteResult.rows as unknown as { id: string; isActive: boolean }[])[0];
    if (!site || !site.isActive) throw AppError.notFound();
    authorize(ctx, 'com.order.create', { siteId: site.id });

    const presentations = [];
    for (const line of input.lines) {
      const presentation = await loadSalePresentation(tx, line.presentationId);
      if (!presentation) throw AppError.notFound();
      if (!presentation.presentationActive || !presentation.productActive) {
        throw AppError.conflict(
          'PRESENTATION_INACTIVE',
          'Presentación inactiva',
          'Reactiva el producto o la presentación antes de pedir.',
        );
      }
      presentations.push({ line, presentation });
    }

    let total = new Decimal(0);
    for (const item of presentations) {
      total = total.plus(new Decimal(item.line.quantity).times(item.presentation.price));
    }

    let creditWarning: string | null = null;
    if (input.paymentMode === 'credit') {
      const snapshot = await creditSnapshot(tx, input.customerId);
      if (!snapshot.enabled) {
        throw AppError.conflict(
          'CREDIT_NOT_ENABLED',
          'Crédito no habilitado',
          'El cliente no tiene crédito configurado. Usa contraentrega o configura el cupo.',
        );
      }
      const pendingResult = await tx.execute(sql`
        select coalesce(sum((ol.ordered_qty - ol.delivered_qty) * ol.unit_price), 0) as "pending"
        from sales.orders o
        join sales.order_lines ol on ol.order_id = o.id
        where o.customer_id = ${input.customerId}
          and o.payment_mode = 'credit'
          and o.status in ('confirmed','in_dispatch','partially_delivered')
      `);
      const pending = (pendingResult.rows[0] as { pending: string } | undefined)?.pending ?? '0';
      const used = new Decimal(snapshot.openBalance).plus(pending);
      const messages: string[] = [];
      if (used.plus(total).gt(snapshot.creditLimit)) {
        messages.push(`Cupo excedido: usado ${used.plus(total).toFixed(2)} de ${snapshot.creditLimit}.`);
      }
      if (snapshot.overdue) messages.push('El cliente tiene cartera vencida.');
      creditWarning = messages.length > 0 ? messages.join(' ') : null;
    }

    const number = await nextNumber(tx, 'P', 'P');
    const [order] = await tx
      .insert(salesOrders)
      .values({
        number,
        siteId: input.siteId,
        customerId: input.customerId,
        channel: input.channel,
        paymentMode: input.paymentMode,
        requestedDate: input.requestedDate ?? null,
        creditWarning,
        createdBy: actor.userId,
      })
      .returning({ id: salesOrders.id });
    if (!order) throw new Error('No se pudo crear el pedido');

    let shortage = false;
    for (const item of presentations) {
      const [line] = await tx
        .insert(salesOrderLines)
        .values({
          orderId: order.id,
          presentationId: item.line.presentationId,
          orderedQty: item.line.quantity,
          unitPrice: item.presentation.price,
        })
        .returning({ id: salesOrderLines.id });
      if (!line) throw new Error('No se pudo crear la línea del pedido');
      const reservation = await reserveOrderLine(tx, {
        orderLineId: line.id,
        productId: item.presentation.productId,
        presentationId: item.line.presentationId,
        siteId: input.siteId,
        quantity: item.line.quantity,
      });
      if (new Decimal(reservation.reserved).lt(item.line.quantity)) shortage = true;
      await tx
        .update(salesOrderLines)
        .set({ reservedQty: reservation.reserved })
        .where(eq(salesOrderLines.id, line.id));
    }
    if (shortage) {
      creditWarning = [creditWarning, 'Existencia insuficiente: el pedido queda con faltante por producir.']
        .filter(Boolean)
        .join(' ');
      await tx.update(salesOrders).set({ creditWarning }).where(eq(salesOrders.id, order.id));
    }

    await recordAudit(tx, ctx, {
      action: 'com.order.create',
      entityType: 'sales.order',
      entityId: order.id,
      siteId: site.id,
      after: { number, ...input, total: total.toFixed(2), creditWarning },
    });
    return order.id;
  });

  return getOrder(deps, ctx, orderId);
}

export interface DispatchableOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  deliveryAddress: string | null;
  phone: string | null;
  paymentMode: PaymentMode;
  total: string;
  lines: {
    orderLineId: string;
    presentationId: string;
    presentationName: string;
    itemName: string;
    orderedQty: string;
    deliveredQty: string;
    unitPrice: string;
  }[];
}

export async function loadOrdersForDispatch(db: Executor, orderIds: string[]): Promise<DispatchableOrder[]> {
  if (orderIds.length === 0) return [];
  const ordersResult = await db.execute(sql`
    select o.id as "orderId", o.number as "orderNumber", o.customer_id as "customerId",
           c.name as "customerName", c.delivery_address as "deliveryAddress", c.phone,
           o.payment_mode as "paymentMode",
           coalesce(sum((ol.ordered_qty - ol.delivered_qty) * ol.unit_price), 0)::numeric(14,2) as total
    from sales.orders o
    join sales.customers c on c.id = o.customer_id
    join sales.order_lines ol on ol.order_id = o.id
    where o.id in (${sql.join(
      orderIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      and o.status = 'confirmed'
    group by o.id, c.name, c.delivery_address, c.phone, o.payment_mode
  `);
  const orders = ordersResult.rows as unknown as Omit<DispatchableOrder, 'lines'>[];
  if (orders.length === 0) return [];
  const linesResult = await db.execute(sql`
    select ol.order_id as "orderId", ol.id as "orderLineId", ol.presentation_id as "presentationId",
           pr.name as "presentationName", p.name as "itemName",
           ol.ordered_qty as "orderedQty", ol.delivered_qty as "deliveredQty",
           ol.unit_price as "unitPrice"
    from sales.order_lines ol
    join catalog.presentations pr on pr.id = ol.presentation_id
    join catalog.products p on p.id = pr.product_id
    where ol.order_id in (${sql.join(
      orderIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by p.name, pr.name
  `);
  const lines = linesResult.rows as unknown as {
    orderId: string;
    orderLineId: string;
    presentationId: string;
    presentationName: string;
    itemName: string;
    orderedQty: string;
    deliveredQty: string;
    unitPrice: string;
  }[];
  return orders.map((order) => ({
    ...order,
    lines: lines
      .filter((line) => line.orderId === order.orderId)
      .map((line) => ({
        orderLineId: line.orderLineId,
        presentationId: line.presentationId,
        presentationName: line.presentationName,
        itemName: line.itemName,
        orderedQty: line.orderedQty,
        deliveredQty: line.deliveredQty,
        unitPrice: line.unitPrice,
      })),
  }));
}

export async function markOrdersInDispatch(db: Executor, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await db.execute(sql`
    update sales.orders set status = 'in_dispatch'
    where id in (${sql.join(
      orderIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      and status = 'confirmed'
  `);
}

export async function applyOrderDelivery(
  db: Executor,
  orderId: string,
  lines: { orderLineId: string; quantity: string }[],
): Promise<SalesOrderStatus> {
  for (const line of lines) {
    await db.execute(sql`
      update sales.order_lines
      set delivered_qty = delivered_qty + ${line.quantity}
      where id = ${line.orderLineId} and order_id = ${orderId}
    `);
  }
  const result = await db.execute(sql`
    select ordered_qty as "orderedQty", delivered_qty as "deliveredQty"
    from sales.order_lines where order_id = ${orderId}
  `);
  const rows = result.rows as unknown as { orderedQty: string; deliveredQty: string }[];
  const complete = rows.every((row) => new Decimal(row.deliveredQty).gte(row.orderedQty));
  const any = rows.some((row) => new Decimal(row.deliveredQty).gt(0));
  const status: SalesOrderStatus = complete ? 'delivered' : any ? 'partially_delivered' : 'confirmed';
  await db.execute(sql`update sales.orders set status = ${status} where id = ${orderId}`);
  return status;
}

export async function addOrderReturn(db: Executor, orderLineId: string, quantity: string): Promise<void> {
  await db.execute(sql`
    update sales.order_lines
    set returned_qty = returned_qty + ${quantity}
    where id = ${orderLineId}
  `);
}

export async function getOrderLinePrice(db: Executor, orderLineId: string): Promise<string> {
  const result = await db.execute(sql`
    select unit_price from sales.order_lines where id = ${orderLineId} limit 1
  `);
  return (result.rows[0] as { unit_price: string } | undefined)?.unit_price ?? '0';
}
