import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { reservations } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface ReservationInput {
  orderLineId: string;
  productId: string;
  presentationId: string;
  siteId: string;
  quantity: string;
}

export interface ReservationResult {
  reserved: string;
  rows: { lotId: string; locationId: string; quantity: string }[];
}

/**
 * Reserva FEFO por lote para una línea de pedido (BR-093/BR-085, DEC-098).
 * Solo considera ubicaciones vendibles: el stock en tránsito o en ruta no se puede reservar.
 * La restricción `(order_line, lot)` exige una sola reserva por lote: si el lote está en
 * varias ubicaciones del mismo sitio, se elige la de mayor disponibilidad.
 */
export async function reserveOrderLine(tx: Executor, input: ReservationInput): Promise<ReservationResult> {
  const result = await tx.execute(sql`
    select b.lot_id as "lotId", b.location_id as "locationId",
           b.quantity as "balance",
           coalesce(r.reserved, 0) as "reserved",
           l.expires_on as "expiresOn", l.code as "lotCode"
    from inventory.stock_balances b
    join inventory.lots l on l.id = b.lot_id
    join admin.locations loc on loc.id = b.location_id
    left join (
      select lot_id, location_id, sum(quantity) as reserved
      from inventory.reservations
      where status = 'active'
      group by lot_id, location_id
    ) r on r.lot_id = b.lot_id and r.location_id = b.location_id
    where b.presentation_id = ${input.presentationId}
      and l.product_id = ${input.productId}
      and loc.site_id = ${input.siteId}
      and loc.is_active = true
      and loc.kind not in ('in_transit', 'in_route')
      and b.quantity > 0
      and l.status = 'available'
      and (l.expires_on is null or l.expires_on >= current_date)
      and b.quantity > coalesce(r.reserved, 0)
    order by l.expires_on nulls last, l.code, b.location_id
    for update of b
  `);
  const rows = result.rows as unknown as {
    lotId: string;
    locationId: string;
    balance: string;
    reserved: string;
    expiresOn: string | null;
    lotCode: string;
  }[];

  // Una sola fila por lote: la ubicación con más disponibilidad evita sobre-reservar
  // una ubicación pequeña y cumple la restricción única (línea, lote).
  const byLot = new Map<string, { row: (typeof rows)[number]; available: number }>();
  for (const row of rows) {
    const available = Number(row.balance) - Number(row.reserved);
    if (available <= 0) continue;
    const current = byLot.get(row.lotId);
    if (!current || available > current.available) byLot.set(row.lotId, { row, available });
  }
  const candidates = [...byLot.values()].sort((a, b) => {
    const expiry = (a.row.expiresOn ?? '9999-12-31').localeCompare(b.row.expiresOn ?? '9999-12-31');
    if (expiry !== 0) return expiry;
    const code = a.row.lotCode.localeCompare(b.row.lotCode);
    return code !== 0 ? code : a.row.locationId.localeCompare(b.row.locationId);
  });

  let remaining = Number(input.quantity);
  const created: ReservationResult['rows'] = [];
  for (const { row, available } of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(available, remaining);
    if (take <= 0) continue;
    await tx.insert(reservations).values({
      salesOrderLineId: input.orderLineId,
      lotId: row.lotId,
      productId: input.productId,
      presentationId: input.presentationId,
      locationId: row.locationId,
      quantity: take.toFixed(3),
    });
    created.push({ lotId: row.lotId, locationId: row.locationId, quantity: take.toFixed(3) });
    remaining -= take;
  }
  const reserved = created.reduce((sum, row) => sum + Number(row.quantity), 0);
  return { reserved: reserved.toFixed(3), rows: created };
}

export interface ActiveReservation {
  reservationId: string;
  orderId: string;
  orderNumber: string;
  orderLineId: string;
  lotId: string;
  lotCode: string;
  presentationId: string;
  presentationName: string;
  itemName: string;
  locationId: string;
  locationName: string;
  quantity: string;
}

/** Reservas activas de varios pedidos, para armar el despacho. */
export async function activeReservationsForOrders(
  db: Executor,
  orderIds: string[],
): Promise<ActiveReservation[]> {
  if (orderIds.length === 0) return [];
  const result = await db.execute(sql`
    select r.id as "reservationId", o.id as "orderId", o.number as "orderNumber",
           ol.id as "orderLineId", r.lot_id as "lotId", l.code as "lotCode",
           r.presentation_id as "presentationId", pr.name as "presentationName",
           coalesce(p.name, rm.name) as "itemName",
           r.location_id as "locationId", loc.name as "locationName", r.quantity
    from inventory.reservations r
    join sales.order_lines ol on ol.id = r.sales_order_line_id
    join sales.orders o on o.id = ol.order_id
    join inventory.lots l on l.id = r.lot_id
    join catalog.presentations pr on pr.id = r.presentation_id
    left join catalog.products p on p.id = l.product_id
    left join catalog.raw_materials rm on rm.id = l.raw_material_id
    join admin.locations loc on loc.id = r.location_id
    where r.status = 'active'
      and o.id in (${sql.join(
        orderIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    order by o.number, l.expires_on nulls last, l.code
  `);
  return result.rows as unknown as ActiveReservation[];
}

export async function consumeReservations(db: Executor, reservationIds: string[]): Promise<void> {
  if (reservationIds.length === 0) return;
  await db.execute(sql`
    update inventory.reservations set status = 'consumed'
    where id in (${sql.join(
      reservationIds.map((id) => sql`${id}`),
      sql`, `,
    )})
  `);
}

export async function consumeReservationsForOrders(db: Executor, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await db.execute(sql`
    update inventory.reservations set status = 'consumed'
    where status = 'active'
      and sales_order_line_id in (
        select id from sales.order_lines where order_id in (${sql.join(
          orderIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      )
  `);
}
