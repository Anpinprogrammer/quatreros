import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { recordEvent } from '../application/events.js';

/**
 * Hechos económicos demo de los módulos ya sembrados (POS y compras).
 * Es idempotente por tipo + origen; no contabiliza.
 */
export async function seedDemoAccounting(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const sales = await tx.execute(sql`
      select sa.id, sa.number, sa.total, sa.site_id as "siteId", sa.sold_at as "soldAt",
             (select json_agg(json_build_object('presentationId', sl.presentation_id, 'quantity', sl.quantity))
              from pos.sale_lines sl where sl.sale_id = sa.id) as lines,
             (select json_agg(json_build_object('paymentMethodId', p.payment_method_id, 'amount', p.amount))
              from pos.payments p where p.sale_id = sa.id) as payments
      from pos.sales sa
    `);
    for (const sale of sales.rows as unknown as {
      id: string;
      number: string;
      total: string;
      siteId: string;
      soldAt: Date | string;
      lines: unknown;
      payments: unknown;
    }[]) {
      await recordEvent(tx, {
        type: 'SaleCompleted',
        sourceType: 'pos.sale',
        sourceId: sale.id,
        siteId: sale.siteId,
        occurredAt: sale.soldAt instanceof Date ? sale.soldAt : new Date(sale.soldAt),
        amount: sale.total,
        payload: { number: sale.number, lines: sale.lines, payments: sale.payments },
      });
    }

    const shifts = await tx.execute(sql`
      select id, site_id as "siteId", status, cash_expected as "cashExpected",
             cash_counted as "cashCounted", cash_difference as "cashDifference",
             closed_at as "closedAt"
      from pos.shifts where status in ('closed','closed_with_variance','reviewed')
    `);
    for (const shift of shifts.rows as unknown as {
      id: string;
      siteId: string;
      status: string;
      cashExpected: string | null;
      cashCounted: string | null;
      cashDifference: string | null;
      closedAt: Date | string | null;
    }[]) {
      await recordEvent(tx, {
        type: 'ShiftClosed',
        sourceType: 'pos.shift',
        sourceId: shift.id,
        siteId: shift.siteId,
        ...(shift.closedAt
          ? { occurredAt: shift.closedAt instanceof Date ? shift.closedAt : new Date(shift.closedAt) }
          : {}),
        amount: shift.cashDifference ?? '0.00',
        payload: {
          status: shift.status,
          cashExpected: shift.cashExpected,
          cashCounted: shift.cashCounted,
          cashDifference: shift.cashDifference,
        },
      });
    }

    const receipts = await tx.execute(sql`
      select r.id, r.number, p.number as "purchaseNumber", p.total, p.site_id as "siteId",
             r.received_at as "receivedAt"
      from purchasing.receipts r
      join purchasing.purchases p on p.id = r.purchase_id
    `);
    for (const receipt of receipts.rows as unknown as {
      id: string;
      number: string;
      purchaseNumber: string;
      total: string;
      siteId: string;
      receivedAt: Date | string;
    }[]) {
      await recordEvent(tx, {
        type: 'PurchaseReceived',
        sourceType: 'purchasing.receipt',
        sourceId: receipt.id,
        siteId: receipt.siteId,
        occurredAt: receipt.receivedAt instanceof Date ? receipt.receivedAt : new Date(receipt.receivedAt),
        amount: receipt.total,
        payload: { number: receipt.number, purchaseNumber: receipt.purchaseNumber },
      });
    }

    const orders = await tx.execute(sql`
      select id, number, site_id as "siteId", actual_qty as "actualQty", yield_pct as "yieldPct",
             output_lot_id as "outputLotId", closed_at as "closedAt"
      from production.orders where status = 'closed'
    `);
    for (const order of orders.rows as unknown as {
      id: string;
      number: string;
      siteId: string;
      actualQty: string | null;
      yieldPct: string | null;
      outputLotId: string | null;
      closedAt: Date | string | null;
    }[]) {
      await recordEvent(tx, {
        type: 'ProductionCompleted',
        sourceType: 'production.order',
        sourceId: order.id,
        siteId: order.siteId,
        ...(order.closedAt
          ? { occurredAt: order.closedAt instanceof Date ? order.closedAt : new Date(order.closedAt) }
          : {}),
        amount: null,
        payload: {
          number: order.number,
          actualQty: order.actualQty,
          yieldPct: order.yieldPct,
          outputLotId: order.outputLotId,
        },
      });
    }
  });
}
