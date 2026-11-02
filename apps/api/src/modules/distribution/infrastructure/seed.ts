import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { activeReservationsForOrders } from '../../inventory/application/public.js';
import { markOrdersInDispatch } from '../../sales/application/public.js';
import { dispatchLines, dispatches } from './schema.js';

/**
 * Despacho preparado de demostración (D-0001) con el pedido P-0001.
 * No mueve inventario: la carga se confirma desde la pantalla.
 */
export async function seedDemoDispatch(db: Database, createdBy: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: dispatches.id })
      .from(dispatches)
      .where(eq(dispatches.number, 'D-0001'))
      .limit(1);
    if (existing) return;

    const refs = await tx.execute(sql`
      select o.id as "orderId", o.site_id as "siteId", u.id as "driverId"
      from sales.orders o
      join admin.users u on u.email = 'reparto@quatreros.example'
      where o.number = 'P-0001' and o.status = 'confirmed'
      limit 1
    `);
    const ref = refs.rows[0] as { orderId: string; siteId: string; driverId: string } | undefined;
    if (!ref) return;
    const reservations = await activeReservationsForOrders(tx, [ref.orderId]);
    if (reservations.length === 0) return;

    const [dispatch] = await tx
      .insert(dispatches)
      .values({
        number: 'D-0001',
        siteId: ref.siteId,
        driverId: ref.driverId,
        dispatchDate: new Date().toISOString().slice(0, 10),
        createdBy,
      })
      .returning({ id: dispatches.id });
    if (!dispatch) throw new Error('No se pudo crear el despacho demo');
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
    await markOrdersInDispatch(tx, [ref.orderId]);

    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('D', 1) on conflict (doc_type) do nothing
    `);
    const max = await tx.execute(sql`
      select coalesce(max((regexp_match(number, '^D-([0-9]+)$'))[1]::int), 0) as "maxValue"
      from distribution.dispatches where number ~ '^D-[0-9]+$'
    `);
    const next = ((max.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0) + 1;
    await tx.execute(sql`
      update platform.document_sequences set next_value = greatest(next_value, ${next})
      where doc_type = 'D'
    `);
  });
}
