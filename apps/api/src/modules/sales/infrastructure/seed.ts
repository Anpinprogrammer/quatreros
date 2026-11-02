import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { reserveOrderLine } from '../../inventory/application/public.js';
import { customers, salesOrderLines, salesOrders } from './schema.js';

/**
 * Clientes y pedido confirmado de demostración (com/pedidos-reparto §9).
 * Idempotente por nombre y número.
 */
export async function seedDemoSales(db: Database, createdBy: string): Promise<void> {
  await db.transaction(async (tx) => {
    const demoCustomers = [
      {
        kind: 'restaurant' as const,
        name: 'Restaurante La Brasa',
        taxId: '901111222-3',
        phone: '310 555 0101',
        deliveryAddress: 'Av. 6N # 23-45, Granada',
      },
      {
        kind: 'business' as const,
        name: 'Tienda Doña Rosa',
        taxId: '901333444-5',
        phone: '315 555 0202',
        deliveryAddress: 'Calle 45 # 12-30, San Fernando',
      },
    ];
    for (const customer of demoCustomers) {
      const exists = await tx.execute(sql`
        select 1 from sales.customers where name = ${customer.name} limit 1
      `);
      if (exists.rows.length === 0) await tx.insert(customers).values(customer);
    }
    const restaurant = await tx.execute(sql`
      select id from sales.customers where name = 'Restaurante La Brasa' limit 1
    `);
    const customerId = (restaurant.rows[0] as { id: string } | undefined)?.id;
    if (!customerId) return;

    await tx.execute(sql`
      insert into finance.credit_terms (customer_id, enabled, credit_limit, term_days, updated_by)
      values (${customerId}, true, 2000000.00, 15, ${createdBy})
      on conflict (customer_id) do nothing
    `);

    const [existing] = await tx
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .where(eq(salesOrders.number, 'P-0001'))
      .limit(1);
    if (!existing) {
      const refs = await tx.execute(sql`
        select site.id as "siteId", pr.id as "presentationId", p.id as "productId",
               ph.price
        from catalog.presentations pr
        join catalog.products p on p.id = pr.product_id
        join catalog.price_history ph on ph.presentation_id = pr.id and ph.valid_to is null
        join admin.sites site on site.name = 'Bodega principal'
        where p.name = 'Chorizo Santarrosano' and pr.name = 'Paquete x10'
        limit 1
      `);
      const ref = refs.rows[0] as
        { siteId: string; presentationId: string; productId: string; price: string } | undefined;
      if (ref) {
        const quantity = '10.000';
        const [order] = await tx
          .insert(salesOrders)
          .values({
            number: 'P-0001',
            siteId: ref.siteId,
            customerId,
            channel: 'whatsapp',
            paymentMode: 'credit',
            requestedDate: null,
            createdBy,
          })
          .returning({ id: salesOrders.id });
        if (order) {
          const [line] = await tx
            .insert(salesOrderLines)
            .values({
              orderId: order.id,
              presentationId: ref.presentationId,
              orderedQty: quantity,
              unitPrice: ref.price,
            })
            .returning({ id: salesOrderLines.id });
          if (line) {
            const reservation = await reserveOrderLine(tx, {
              orderLineId: line.id,
              productId: ref.productId,
              presentationId: ref.presentationId,
              siteId: ref.siteId,
              quantity,
            });
            await tx
              .update(salesOrderLines)
              .set({ reservedQty: reservation.reserved })
              .where(eq(salesOrderLines.id, line.id));
          }
        }
      }
    }

    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('P', 1) on conflict (doc_type) do nothing
    `);
    const max = await tx.execute(sql`
      select coalesce(max((regexp_match(number, '^P-([0-9]+)$'))[1]::int), 0) as "maxValue"
      from sales.orders where number ~ '^P-[0-9]+$'
    `);
    const next = ((max.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0) + 1;
    await tx.execute(sql`
      update platform.document_sequences set next_value = greatest(next_value, ${next})
      where doc_type = 'P'
    `);
  });
}
