import {
  CreateDispatchRequest,
  DeliveryRequest,
  DispatchListQuery,
  InspectReturnRequest,
  ReturnRequest,
  type DispatchDetail,
  type DispatchPage,
  type DispatchSummary,
  type DriverView,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter } from '../../admin/application/public.js';
import { getCreditTerms, createReceivable, registerCollection } from '../../finance/application/public.js';
import {
  activeReservationsForOrders,
  businessToday,
  consumeReservationsForOrders,
  recordMovement,
} from '../../inventory/application/public.js';
import {
  addOrderReturn,
  applyOrderDelivery,
  loadOrdersForDispatch,
  markOrdersInDispatch,
} from '../../sales/application/public.js';
import { deliveries, deliveryLines, dispatchLines, dispatches, returns } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface DistributionDeps {
  db: Database;
}

interface DispatchRow {
  id: string;
  number: string;
  siteId: string;
  siteName: string;
  driverId: string;
  driverName: string;
  dispatchDate: string;
  status: DispatchSummary['status'];
  createdAt: Date | string;
  routeLocationName: string | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

async function locationOfKind(
  db: Executor,
  siteId: string,
  kind: string,
): Promise<{ id: string; name: string } | undefined> {
  const result = await db.execute(sql`
    select id, name from admin.locations
    where site_id = ${siteId} and kind = ${kind} and is_active = true
    order by name limit 1
  `);
  return (result.rows as unknown as { id: string; name: string }[])[0];
}

export async function listDrivers(deps: DistributionDeps, ctx: ExecutionContext): Promise<DriverView[]> {
  authorize(ctx, 'dis.dispatch.create');
  const result = await deps.db.execute(sql`
    select distinct u.id, u.full_name as "fullName", u.email
    from admin.users u
    join admin.user_roles ur on ur.user_id = u.id
    join admin.roles r on r.id = ur.role_id
    where r.code = 'DIST' and u.is_active = true
    order by u.full_name
  `);
  return result.rows as unknown as DriverView[];
}

export async function listDispatches(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<DispatchPage> {
  const filter = listFilter(ctx, 'dis.dispatch.read');
  const query = DispatchListQuery.parse(raw);
  const conditions: ReturnType<typeof sql>[] = [];
  if (filter.kind === 'own') conditions.push(sql`d.driver_id = ${filter.userId}`);
  else if (filter.kind === 'sites') {
    conditions.push(
      filter.siteIds.length
        ? sql`d.site_id in (${sql.join(
            filter.siteIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql`false`,
    );
  }
  if (query.status) conditions.push(sql`d.status = ${query.status}`);
  if (query.driverId) conditions.push(sql`d.driver_id = ${query.driverId}`);
  const result = await deps.db.execute(sql`
    select d.id, d.number, d.site_id as "siteId", site.name as "siteName",
           d.driver_id as "driverId", u.full_name as "driverName",
           d.dispatch_date as "dispatchDate", d.status, d.created_at as "createdAt",
           count(distinct dl.id)::int as "orderCount",
           coalesce(sum(dl.loaded_qty), 0) as "loadedTotal",
           coalesce(sum(dl.delivered_qty), 0) as "deliveredTotal"
    from distribution.dispatches d
    join admin.sites site on site.id = d.site_id
    join admin.users u on u.id = d.driver_id
    left join distribution.dispatch_lines dl on dl.dispatch_id = d.id
    where ${sql.join(conditions.length ? conditions : [sql`true`], sql` and `)}
    group by d.id, site.name, u.full_name
    order by d.dispatch_date desc, d.created_at desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as DispatchSummary[]).map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
    })),
    page: { nextCursor: null, limit: query.limit },
  };
}

async function dispatchRow(db: Executor, id: string): Promise<DispatchRow | undefined> {
  const result = await db.execute(sql`
    select d.id, d.number, d.site_id as "siteId", site.name as "siteName",
           d.driver_id as "driverId", u.full_name as "driverName",
           d.dispatch_date as "dispatchDate", d.status, d.created_at as "createdAt",
           loc.name as "routeLocationName"
    from distribution.dispatches d
    join admin.sites site on site.id = d.site_id
    join admin.users u on u.id = d.driver_id
    left join admin.locations loc on loc.id = d.route_location_id
    where d.id = ${id}
    limit 1
  `);
  return (result.rows as unknown as DispatchRow[])[0];
}

export async function getDispatch(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<DispatchDetail> {
  const filter = listFilter(ctx, 'dis.dispatch.read');
  const row = await dispatchRow(deps.db, id);
  if (!row) throw AppError.notFound();
  if (filter.kind === 'own' && row.driverId !== filter.userId) throw AppError.notFound();
  if (filter.kind === 'sites' && !filter.siteIds.includes(row.siteId)) throw AppError.notFound();

  const linesResult = await deps.db.execute(sql`
    select dl.id as "dispatchLineId", dl.order_line_id as "orderLineId",
           o.id as "orderId", o.number as "orderNumber", c.name as "customerName",
           c.delivery_address as "deliveryAddress", c.phone, o.payment_mode as "paymentMode",
           dl.presentation_id as "presentationId", pr.name as "presentationName",
           p.name as "itemName", dl.lot_id as "lotId", l.code as "lotCode",
           dl.loaded_qty as "loadedQty", dl.delivered_qty as "deliveredQty",
           dl.returned_qty as "returnedQty"
    from distribution.dispatch_lines dl
    join sales.order_lines ol on ol.id = dl.order_line_id
    join sales.orders o on o.id = ol.order_id
    join sales.customers c on c.id = o.customer_id
    join catalog.presentations pr on pr.id = dl.presentation_id
    join catalog.products p on p.id = pr.product_id
    join inventory.lots l on l.id = dl.lot_id
    where dl.dispatch_id = ${id}
    order by o.number, p.name, l.code
  `);
  const lines = linesResult.rows as unknown as {
    dispatchLineId: string;
    orderLineId: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    deliveryAddress: string | null;
    phone: string | null;
    paymentMode: DispatchDetail['orders'][number]['paymentMode'];
    presentationName: string;
    itemName: string;
    lotId: string;
    lotCode: string;
    loadedQty: string;
    deliveredQty: string;
    returnedQty: string;
  }[];
  const priceResult = await deps.db.execute(sql`
    select id, unit_price as "unitPrice" from sales.order_lines
    where id in (${sql.join(
      [...new Set(lines.map((line) => line.orderLineId))].map((lineId) => sql`${lineId}`),
      sql`, `,
    )})
  `);
  const prices = new Map(
    (priceResult.rows as unknown as { id: string; unitPrice: string }[]).map((rowPrice) => [
      rowPrice.id,
      rowPrice.unitPrice,
    ]),
  );
  const orderMap = new Map<
    string,
    {
      orderId: string;
      orderNumber: string;
      customerName: string;
      deliveryAddress: string | null;
      phone: string | null;
      paymentMode: DispatchDetail['orders'][number]['paymentMode'];
      total: Decimal;
      lines: DispatchDetail['orders'][number]['lines'];
    }
  >();
  for (const line of lines) {
    const unitPrice = prices.get(line.orderLineId) ?? '0';
    const current = orderMap.get(line.orderId) ?? {
      orderId: line.orderId,
      orderNumber: line.orderNumber,
      customerName: line.customerName,
      deliveryAddress: line.deliveryAddress,
      phone: line.phone,
      paymentMode: line.paymentMode,
      total: new Decimal(0),
      lines: [],
    };
    current.lines.push({
      dispatchLineId: line.dispatchLineId,
      orderLineId: line.orderLineId,
      presentationName: line.presentationName,
      itemName: line.itemName,
      lotId: line.lotId,
      lotCode: line.lotCode,
      loadedQty: line.loadedQty,
      deliveredQty: line.deliveredQty,
      returnedQty: line.returnedQty,
      unitPrice,
      pendingQty: Decimal.max(new Decimal(line.loadedQty).minus(line.deliveredQty), 0).toFixed(3),
    });
    current.total = current.total.plus(new Decimal(line.loadedQty).times(unitPrice));
    orderMap.set(line.orderId, current);
  }
  const returnsResult = await deps.db.execute(sql`
    select r.id, r.number, l.code as "lotCode", r.quantity, r.reason, r.status
    from distribution.returns r join inventory.lots l on l.id = r.lot_id
    where r.dispatch_id = ${id} order by r.created_at desc
  `);
  return {
    id: row.id,
    number: row.number,
    siteId: row.siteId,
    siteName: row.siteName,
    driverId: row.driverId,
    driverName: row.driverName,
    dispatchDate: row.dispatchDate,
    status: row.status,
    orderCount: orderMap.size,
    loadedTotal: lines.reduce((sum, line) => sum.plus(line.loadedQty), new Decimal(0)).toFixed(3),
    deliveredTotal: lines.reduce((sum, line) => sum.plus(line.deliveredQty), new Decimal(0)).toFixed(3),
    createdAt: iso(row.createdAt),
    routeLocationName: row.routeLocationName,
    orders: [...orderMap.values()].map((order) => ({ ...order, total: order.total.toFixed(2) })),
    returns: returnsResult.rows as unknown as DispatchDetail['returns'],
  };
}

export async function createDispatch(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<DispatchDetail> {
  const actor = authorize(ctx, 'dis.dispatch.create');
  const input = CreateDispatchRequest.parse(raw);
  const dispatchId = await deps.db.transaction(async (tx) => {
    const siteResult = await tx.execute(sql`
      select id, is_active as "isActive" from admin.sites where id = ${input.siteId} limit 1
    `);
    const site = (siteResult.rows as unknown as { id: string; isActive: boolean }[])[0];
    if (!site || !site.isActive) throw AppError.notFound();
    authorize(ctx, 'dis.dispatch.create', { siteId: site.id });

    const driver = await tx.execute(sql`
      select u.id from admin.users u
      join admin.user_roles ur on ur.user_id = u.id
      join admin.roles r on r.id = ur.role_id
      where u.id = ${input.driverId} and r.code = 'DIST' and u.is_active = true
      limit 1
    `);
    if (driver.rows.length === 0) {
      throw AppError.conflict(
        'DRIVER_INVALID',
        'Distribuidor inválido',
        'Selecciona un distribuidor activo.',
      );
    }

    const orders = await loadOrdersForDispatch(tx, input.orderIds);
    if (orders.length !== input.orderIds.length) {
      throw AppError.conflict(
        'ORDER_NOT_CONFIRMED',
        'Pedido no disponible',
        'Todos los pedidos deben estar confirmados y de la misma sede.',
      );
    }
    const activeDispatch = await tx.execute(sql`
      select distinct o.id
      from distribution.dispatch_lines dl
      join distribution.dispatches d on d.id = dl.dispatch_id
      join sales.order_lines ol on ol.id = dl.order_line_id
      join sales.orders o on o.id = ol.order_id
      where d.status in ('prepared','in_route')
        and o.id in (${sql.join(
          input.orderIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      limit 1
    `);
    if (activeDispatch.rows.length > 0) {
      throw AppError.conflict(
        'ORDER_ALREADY_DISPATCHED',
        'Pedido ya despachado',
        'Uno de los pedidos ya está en un despacho activo.',
      );
    }
    const reservations = await activeReservationsForOrders(tx, input.orderIds);
    if (reservations.length === 0) {
      throw AppError.conflict(
        'ORDER_NOT_CONFIRMED',
        'Sin reservas',
        'Los pedidos no tienen reservas activas para cargar.',
      );
    }

    const number = await nextNumber(tx, 'D', 'D');
    const [dispatch] = await tx
      .insert(dispatches)
      .values({
        number,
        siteId: input.siteId,
        driverId: input.driverId,
        dispatchDate: input.dispatchDate,
        createdBy: actor.userId,
      })
      .returning({ id: dispatches.id });
    if (!dispatch) throw new Error('No se pudo crear el despacho');
    await tx.insert(dispatchLines).values(
      reservations.map((reservation) => ({
        dispatchId: dispatch.id,
        orderLineId: reservation.orderLineId,
        lotId: reservation.lotId,
        locationId: reservation.locationId,
        presentationId: reservation.presentationId,
        loadedQty: reservation.quantity,
      })),
    );
    await markOrdersInDispatch(tx, input.orderIds);
    await recordAudit(tx, ctx, {
      action: 'dis.dispatch.create',
      entityType: 'distribution.dispatch',
      entityId: dispatch.id,
      siteId: site.id,
      after: { number, ...input, reservations: reservations.length },
    });
    return dispatch.id;
  });
  return getDispatch(deps, ctx, dispatchId);
}

export async function loadDispatch(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<DispatchDetail> {
  await deps.db.transaction(async (tx) => {
    const dispatchResult = await tx.execute(sql`
      select id, number, site_id as "siteId", status from distribution.dispatches
      where id = ${id} for update
    `);
    const dispatch = (
      dispatchResult.rows as unknown as { id: string; number: string; siteId: string; status: string }[]
    )[0];
    if (!dispatch) throw AppError.notFound();
    authorize(ctx, 'dis.dispatch.create', { siteId: dispatch.siteId });
    if (dispatch.status !== 'prepared') {
      throw AppError.conflict(
        'DISPATCH_NOT_PREPARED',
        'Despacho no preparado',
        'Solo se carga un despacho preparado.',
      );
    }
    const route = await locationOfKind(tx, dispatch.siteId, 'in_route');
    if (!route) {
      throw AppError.conflict(
        'NO_ROUTE_LOCATION',
        'Falta la ubicación en ruta',
        'La sede no tiene una ubicación "En ruta" activa.',
      );
    }
    const linesResult = await tx.execute(sql`
      select dl.id, dl.lot_id as "lotId", dl.location_id as "locationId",
             dl.presentation_id as "presentationId", dl.loaded_qty as "loadedQty",
             pr.units_per as "unitsPer"
      from distribution.dispatch_lines dl
      join catalog.presentations pr on pr.id = dl.presentation_id
      where dl.dispatch_id = ${id}
    `);
    const lines = linesResult.rows as unknown as {
      id: string;
      lotId: string;
      locationId: string;
      presentationId: string;
      loadedQty: string;
      unitsPer: string;
    }[];
    const actor = authorize(ctx, 'dis.dispatch.create', { siteId: dispatch.siteId });
    for (const line of lines) {
      const base = new Decimal(line.loadedQty).times(line.unitsPer).toFixed(3);
      await recordMovement(tx, {
        movementType: 'dispatch_out',
        lotId: line.lotId,
        presentationId: line.presentationId,
        locationId: line.locationId,
        quantity: `-${line.loadedQty}`,
        baseQuantity: `-${base}`,
        sourceType: 'distribution.dispatch',
        sourceId: dispatch.id,
        createdBy: actor.userId,
        reason: `Carga despacho ${dispatch.number}`,
      });
      await recordMovement(tx, {
        movementType: 'dispatch_return',
        lotId: line.lotId,
        presentationId: line.presentationId,
        locationId: route.id,
        quantity: line.loadedQty,
        baseQuantity: base,
        sourceType: 'distribution.dispatch',
        sourceId: dispatch.id,
        createdBy: actor.userId,
        reason: `En ruta despacho ${dispatch.number}`,
      });
    }
    const orderIdsResult = await tx.execute(sql`
      select distinct ol.order_id as "orderId" from distribution.dispatch_lines dl
      join sales.order_lines ol on ol.id = dl.order_line_id where dl.dispatch_id = ${id}
    `);
    await consumeReservationsForOrders(
      tx,
      (orderIdsResult.rows as unknown as { orderId: string }[]).map((row) => row.orderId),
    );
    await tx
      .update(dispatches)
      .set({ status: 'in_route', routeLocationId: route.id, loadedAt: new Date() })
      .where(eq(dispatches.id, id));
    await recordAudit(tx, ctx, {
      action: 'dis.dispatch.load',
      entityType: 'distribution.dispatch',
      entityId: id,
      siteId: dispatch.siteId,
      after: { routeLocationId: route.id, lines: lines.length },
    });
  });
  return getDispatch(deps, ctx, id);
}

interface DeliveryLineRow {
  dispatchLineId: string;
  orderLineId: string;
  orderId: string;
  customerId: string;
  paymentMode: 'cash_on_delivery' | 'credit';
  presentationId: string;
  lotId: string;
  loadedQty: string;
  deliveredQty: string;
  unitPrice: string;
  unitsPer: string;
}

export async function registerDelivery(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  dispatchId: string,
  raw: unknown,
): Promise<DispatchDetail> {
  const input = DeliveryRequest.parse(raw);
  await deps.db.transaction(async (tx) => {
    const dispatchResult = await tx.execute(sql`
      select d.id, d.number, d.site_id as "siteId", d.driver_id as "driverId",
             d.route_location_id as "routeLocationId", d.status
      from distribution.dispatches d where d.id = ${dispatchId} for update
    `);
    const dispatch = (
      dispatchResult.rows as unknown as {
        id: string;
        number: string;
        siteId: string;
        driverId: string;
        routeLocationId: string | null;
        status: string;
      }[]
    )[0];
    if (!dispatch) throw AppError.notFound();
    const actor = authorize(ctx, 'dis.delivery.register', {
      siteId: dispatch.siteId,
      ownerId: dispatch.driverId,
    });
    if (dispatch.status !== 'in_route' || !dispatch.routeLocationId) {
      throw AppError.conflict(
        'DISPATCH_NOT_IN_ROUTE',
        'Despacho no está en ruta',
        'Solo se entrega desde un despacho en ruta.',
      );
    }

    const linesResult = await tx.execute(sql`
      select dl.id as "dispatchLineId", dl.order_line_id as "orderLineId",
             o.id as "orderId", o.customer_id as "customerId", o.payment_mode as "paymentMode",
             dl.presentation_id as "presentationId", dl.lot_id as "lotId",
             dl.loaded_qty as "loadedQty", dl.delivered_qty as "deliveredQty",
             ol.unit_price as "unitPrice", pr.units_per as "unitsPer"
      from distribution.dispatch_lines dl
      join sales.order_lines ol on ol.id = dl.order_line_id
      join sales.orders o on o.id = ol.order_id
      join catalog.presentations pr on pr.id = dl.presentation_id
      where dl.dispatch_id = ${dispatchId}
      order by dl.id
      for update of dl
    `);
    const lines = linesResult.rows as unknown as DeliveryLineRow[];
    const byId = new Map(lines.map((line) => [line.dispatchLineId, line]));
    const seen = new Set<string>();
    let partial = false;
    const deliveredValueByOrder = new Map<string, Decimal>();
    let anyLine = false;

    for (const received of input.lines) {
      if (seen.has(received.dispatchLineId)) {
        throw validation('Una línea de despacho aparece dos veces en la entrega.');
      }
      seen.add(received.dispatchLineId);
      const line = byId.get(received.dispatchLineId);
      if (!line || line.orderId !== input.orderId) {
        throw validation('La línea no pertenece al pedido o al despacho.');
      }
      const pending = new Decimal(line.loadedQty).minus(line.deliveredQty);
      if (new Decimal(received.quantity).gt(pending)) {
        throw new AppError(
          422,
          'DELIVERY_EXCEEDS_LOADED',
          'Entrega mayor a la cargada',
          `Solo quedan ${pending.toFixed(3)} por entregar en esa línea.`,
        );
      }
      if (new Decimal(received.quantity).lt(pending)) partial = true;
      anyLine = true;
      const value = new Decimal(received.quantity).times(line.unitPrice);
      deliveredValueByOrder.set(
        input.orderId,
        (deliveredValueByOrder.get(input.orderId) ?? new Decimal(0)).plus(value),
      );
    }
    if (!anyLine) throw validation('Registra al menos una línea entregada.');
    const orderLines = lines.filter((line) => line.orderId === input.orderId);
    const missing = orderLines.some((line) => {
      const received = input.lines.find((item) => item.dispatchLineId === line.dispatchLineId);
      const delivered = new Decimal(line.deliveredQty).plus(received?.quantity ?? 0);
      return delivered.lt(line.loadedQty);
    });
    if (missing) partial = true;
    if (partial && !input.partialReason?.trim()) {
      throw validation('Si la entrega es parcial, escribe el motivo.');
    }

    const [delivery] = await tx
      .insert(deliveries)
      .values({
        dispatchId,
        orderId: input.orderId,
        isPartial: partial,
        partialReason: partial ? (input.partialReason ?? null) : null,
        registeredBy: actor.userId,
      })
      .returning({ id: deliveries.id });
    if (!delivery) throw new Error('No se pudo registrar la entrega');

    for (const received of input.lines) {
      const line = byId.get(received.dispatchLineId);
      if (!line) throw validation('Línea inválida.');
      const base = new Decimal(received.quantity).times(line.unitsPer).toFixed(3);
      await tx.insert(deliveryLines).values({
        deliveryId: delivery.id,
        dispatchLineId: line.dispatchLineId,
        quantity: received.quantity,
      });
      await recordMovement(tx, {
        movementType: 'sale',
        lotId: line.lotId,
        presentationId: line.presentationId,
        locationId: dispatch.routeLocationId,
        quantity: `-${received.quantity}`,
        baseQuantity: `-${base}`,
        sourceType: 'distribution.delivery',
        sourceId: delivery.id,
        createdBy: actor.userId,
        reason: `Entrega despacho ${dispatch.number}`,
      });
      await tx.execute(sql`
        update distribution.dispatch_lines
        set delivered_qty = delivered_qty + ${received.quantity}
        where id = ${line.dispatchLineId}
      `);
    }

    await applyOrderDelivery(
      tx,
      input.orderId,
      input.lines.map((line) => {
        const dispatchLine = byId.get(line.dispatchLineId);
        if (!dispatchLine) throw validation('Línea inválida.');
        return { orderLineId: dispatchLine.orderLineId, quantity: line.quantity };
      }),
    );

    const deliveredValue = deliveredValueByOrder.get(input.orderId) ?? new Decimal(0);
    const orderHeaderResult = await tx.execute(sql`
      select customer_id as "customerId", payment_mode as "paymentMode"
      from sales.orders where id = ${input.orderId} limit 1
    `);
    const orderHeader = (
      orderHeaderResult.rows as unknown as {
        customerId: string;
        paymentMode: 'cash_on_delivery' | 'credit';
      }[]
    )[0];
    if (!orderHeader) throw AppError.notFound();

    if (orderHeader.paymentMode === 'cash_on_delivery') {
      if (!input.paymentMethod || !input.collectedAmount) {
        throw new AppError(
          422,
          'COLLECTION_REQUIRED',
          'Recaudo requerido',
          'El pedido es contraentrega: registra el recaudo completo de lo entregado.',
        );
      }
      if (!new Decimal(input.collectedAmount).equals(deliveredValue)) {
        throw new AppError(
          422,
          'COLLECTION_REQUIRED',
          'Recaudo incompleto',
          `El recaudo debe ser ${deliveredValue.toFixed(2)} para la mercancía entregada.`,
        );
      }
      await registerCollection(tx, {
        siteId: dispatch.siteId,
        collectorUserId: actor.userId,
        customerId: orderHeader.customerId,
        method: input.paymentMethod,
        amount: deliveredValue.toFixed(2),
        deliveryId: delivery.id,
      });
    } else {
      const terms = await getCreditTerms(tx, orderHeader.customerId);
      if (!terms?.enabled) {
        throw AppError.conflict(
          'CREDIT_NOT_ENABLED',
          'Crédito no habilitado',
          'El cliente no tiene crédito configurado; no se puede crear la obligación.',
        );
      }
      const today = businessToday();
      const due = new Date(`${today}T12:00:00.000Z`);
      due.setUTCDate(due.getUTCDate() + terms.termDays);
      const receivableId = await createReceivable(tx, {
        customerId: orderHeader.customerId,
        sourceType: 'distribution.delivery',
        sourceId: delivery.id,
        amount: deliveredValue.toFixed(2),
        issuedOn: today,
        dueOn: due.toISOString().slice(0, 10),
      });
      if (input.collectedAmount && new Decimal(input.collectedAmount).gt(0)) {
        if (!input.paymentMethod) {
          throw validation('Indica el método del abono.');
        }
        if (new Decimal(input.collectedAmount).gt(deliveredValue)) {
          throw new AppError(
            422,
            'COLLECTION_EXCEEDS_TOTAL',
            'Recaudo mayor al entregado',
            'El abono no puede superar el valor entregado.',
          );
        }
        await registerCollection(tx, {
          siteId: dispatch.siteId,
          collectorUserId: actor.userId,
          customerId: orderHeader.customerId,
          method: input.paymentMethod,
          amount: input.collectedAmount,
          deliveryId: delivery.id,
          receivableId,
        });
      }
    }

    const pendingDispatch = await tx.execute(sql`
      select count(*)::int as total from distribution.dispatch_lines
      where dispatch_id = ${dispatchId} and delivered_qty < loaded_qty
    `);
    if (((pendingDispatch.rows[0] as { total: number } | undefined)?.total ?? 0) === 0) {
      await tx.update(dispatches).set({ status: 'to_settle' }).where(eq(dispatches.id, dispatchId));
    }

    await recordAudit(tx, ctx, {
      action: 'dis.delivery.register',
      entityType: 'distribution.delivery',
      entityId: delivery.id,
      siteId: dispatch.siteId,
      after: {
        dispatchNumber: dispatch.number,
        orderId: input.orderId,
        lines: input.lines,
        partial,
        deliveredValue: deliveredValue.toFixed(2),
      },
    });
  });
  return getDispatch(deps, ctx, dispatchId);
}

export async function registerReturn(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  dispatchId: string,
  raw: unknown,
): Promise<DispatchDetail> {
  const input = ReturnRequest.parse(raw);
  await deps.db.transaction(async (tx) => {
    const dispatchResult = await tx.execute(sql`
      select d.id, d.number, d.site_id as "siteId", d.driver_id as "driverId", d.status
      from distribution.dispatches d where d.id = ${dispatchId} for update
    `);
    const dispatch = (
      dispatchResult.rows as unknown as {
        id: string;
        number: string;
        siteId: string;
        driverId: string;
        status: string;
      }[]
    )[0];
    if (!dispatch) throw AppError.notFound();
    const actor = authorize(ctx, 'dis.return.register', {
      siteId: dispatch.siteId,
      ownerId: dispatch.driverId,
    });
    if (!['in_route', 'to_settle'].includes(dispatch.status)) {
      throw AppError.conflict(
        'DISPATCH_NOT_IN_ROUTE',
        'Despacho no está en ruta',
        'Solo se devuelve mercancía de un despacho en ruta o por liquidar.',
      );
    }
    const lineResult = await tx.execute(sql`
      select dl.id, dl.order_line_id as "orderLineId", dl.lot_id as "lotId",
             dl.presentation_id as "presentationId", dl.delivered_qty as "deliveredQty",
             dl.returned_qty as "returnedQty", o.id as "orderId", o.customer_id as "customerId",
             pr.units_per as "unitsPer"
      from distribution.dispatch_lines dl
      join sales.order_lines ol on ol.id = dl.order_line_id
      join sales.orders o on o.id = ol.order_id
      join catalog.presentations pr on pr.id = dl.presentation_id
      where dl.id = ${input.dispatchLineId} and dl.dispatch_id = ${dispatchId}
      for update of dl
    `);
    const line = (
      lineResult.rows as unknown as {
        id: string;
        orderLineId: string;
        lotId: string;
        presentationId: string;
        deliveredQty: string;
        returnedQty: string;
        orderId: string;
        customerId: string;
        unitsPer: string;
      }[]
    )[0];
    if (!line) throw AppError.notFound();
    const available = new Decimal(line.deliveredQty).minus(line.returnedQty);
    if (new Decimal(input.quantity).gt(available)) {
      throw new AppError(
        422,
        'RETURN_EXCEEDS_DELIVERED',
        'Devolución mayor a lo entregado',
        `Solo se pueden devolver ${available.toFixed(3)} de esa línea.`,
      );
    }
    const inspection = await locationOfKind(tx, dispatch.siteId, 'in_inspection');
    if (!inspection) {
      throw AppError.conflict(
        'NO_INSPECTION_LOCATION',
        'Falta la ubicación de inspección',
        'La sede no tiene una ubicación "En inspección" activa.',
      );
    }
    const number = await nextNumber(tx, 'DV', 'DV');
    let deliveryId = input.deliveryId ?? null;
    if (!deliveryId) {
      const deliveryResult = await tx.execute(sql`
        select delivery_id as "deliveryId" from distribution.delivery_lines
        where dispatch_line_id = ${line.id} order by delivery_id desc limit 1
      `);
      deliveryId = (deliveryResult.rows[0] as { deliveryId: string } | undefined)?.deliveryId ?? null;
    }
    const [row] = await tx
      .insert(returns)
      .values({
        number,
        customerId: line.customerId,
        dispatchId,
        deliveryId,
        orderLineId: line.orderLineId,
        lotId: line.lotId,
        presentationId: line.presentationId,
        quantity: input.quantity,
        reason: input.reason,
        registeredBy: actor.userId,
      })
      .returning({ id: returns.id });
    if (!row) throw new Error('No se pudo registrar la devolución');
    const base = new Decimal(input.quantity).times(line.unitsPer).toFixed(3);
    await recordMovement(tx, {
      movementType: 'customer_return',
      lotId: line.lotId,
      presentationId: line.presentationId,
      locationId: inspection.id,
      quantity: input.quantity,
      baseQuantity: base,
      sourceType: 'distribution.return',
      sourceId: row.id,
      createdBy: actor.userId,
      reason: `Devolución ${number} · ${input.reason}`,
    });
    await tx.execute(sql`
      update distribution.dispatch_lines
      set returned_qty = returned_qty + ${input.quantity}
      where id = ${line.id}
    `);
    await addOrderReturn(tx, line.orderLineId, input.quantity);
    await recordAudit(tx, ctx, {
      action: 'dis.return.register',
      entityType: 'distribution.return',
      entityId: row.id,
      siteId: dispatch.siteId,
      after: { number, ...input },
    });
  });
  return getDispatch(deps, ctx, dispatchId);
}

export async function inspectReturn(
  deps: DistributionDeps,
  ctx: ExecutionContext,
  returnId: string,
  raw: unknown,
): Promise<void> {
  const actor = authorize(ctx, 'dis.return.inspect');
  const input = InspectReturnRequest.parse(raw);
  if (input.decision === 'discard') {
    throw AppError.featureBlocked('AP-08');
  }
  await deps.db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select r.id, r.number, r.dispatch_id as "dispatchId", r.lot_id as "lotId",
             r.presentation_id as "presentationId", r.quantity, r.status,
             d.site_id as "siteId"
      from distribution.returns r
      join distribution.dispatches d on d.id = r.dispatch_id
      where r.id = ${returnId}
      for update of r
    `);
    const row = (
      result.rows as unknown as {
        id: string;
        number: string;
        dispatchId: string;
        lotId: string;
        presentationId: string;
        quantity: string;
        status: string;
        siteId: string;
      }[]
    )[0];
    if (!row) throw AppError.notFound();
    if (row.status !== 'in_inspection') {
      throw AppError.conflict(
        'RETURN_ALREADY_INSPECTED',
        'Devolución ya inspeccionada',
        'Esta devolución ya fue procesada.',
      );
    }
    const inspection = await locationOfKind(tx, row.siteId, 'in_inspection');
    const warehouse = await locationOfKind(tx, row.siteId, 'warehouse');
    if (!inspection || !warehouse) {
      throw AppError.conflict(
        'NO_INSPECTION_LOCATION',
        'Falta una ubicación',
        'La sede necesita ubicaciones de inspección y bodega activas.',
      );
    }
    const presentationResult = await tx.execute(sql`
      select units_per as "unitsPer" from catalog.presentations where id = ${row.presentationId} limit 1
    `);
    const unitsPer = (presentationResult.rows[0] as { unitsPer: string } | undefined)?.unitsPer ?? '1';
    const base = new Decimal(row.quantity).times(unitsPer).toFixed(3);
    await recordMovement(tx, {
      movementType: 'customer_return',
      lotId: row.lotId,
      presentationId: row.presentationId,
      locationId: inspection.id,
      quantity: `-${row.quantity}`,
      baseQuantity: `-${base}`,
      sourceType: 'distribution.return',
      sourceId: row.id,
      createdBy: actor.userId,
      reason: `Reincorporación ${row.number}`,
    });
    await recordMovement(tx, {
      movementType: 'return_reinstated',
      lotId: row.lotId,
      presentationId: row.presentationId,
      locationId: warehouse.id,
      quantity: row.quantity,
      baseQuantity: base,
      sourceType: 'distribution.return',
      sourceId: row.id,
      createdBy: actor.userId,
      reason: `Reincorporación ${row.number}`,
    });
    await tx
      .update(returns)
      .set({ status: 'reinstated', inspectedBy: actor.userId, inspectedAt: new Date() })
      .where(eq(returns.id, returnId));
    await recordAudit(tx, ctx, {
      action: 'dis.return.inspect',
      entityType: 'distribution.return',
      entityId: returnId,
      siteId: row.siteId,
      after: { decision: 'reinstate', warehouseId: warehouse.id },
    });
  });
}
