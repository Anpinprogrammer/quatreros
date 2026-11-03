import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { recordEvent } from '../../accounting/application/public.js';
import { businessToday } from '../../inventory/application/public.js';
import { createReceivable } from '../application/finance.js';

/** Cartera y recaudos demo de la entrega 7 (idempotente por origen/número). */
export async function seedDemoFinance(db: Database, createdBy: string): Promise<void> {
  await db.transaction(async (tx) => {
    const today = businessToday();
    const addDays = (date: string, days: number): string => {
      const value = new Date(`${date}T12:00:00.000Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };

    const refsResult = await tx.execute(sql`
      select
        (select id from admin.sites where name = 'Bodega principal') as "warehouseId",
        (select id from admin.sites where name = 'Punto de asados') as "posSiteId",
        (select id from sales.customers where name = 'Restaurante La Brasa') as "laBrasaId",
        (select id from sales.customers where name = 'Tienda Doña Rosa') as "donaRosaId",
        (select id from admin.users where email = 'reparto@quatreros.example') as "driverId",
        (select id from admin.users where email = 'manager@quatreros.example') as "managerId",
        (select id from finance.payment_methods where name = 'Efectivo') as "cashId",
        (select id from finance.payment_methods where name = 'Transferencia') as "transferId"
    `);
    const refs = refsResult.rows[0] as
      | {
          warehouseId: string;
          posSiteId: string;
          laBrasaId: string;
          donaRosaId: string;
          driverId: string;
          managerId: string;
          cashId: string;
          transferId: string;
        }
      | undefined;
    if (
      !refs?.warehouseId ||
      !refs.posSiteId ||
      !refs.laBrasaId ||
      !refs.donaRosaId ||
      !refs.driverId ||
      !refs.managerId ||
      !refs.cashId ||
      !refs.transferId
    ) {
      throw new Error('La semilla de cartera necesita clientes, sedes, usuarios y medios de pago');
    }

    const obligations = [
      {
        sourceId: '00000000-0000-4000-8000-00000000f101',
        customerId: refs.laBrasaId,
        siteId: refs.warehouseId,
        amount: '150000.00',
        dueIn: 5,
      },
      {
        sourceId: '00000000-0000-4000-8000-00000000f102',
        customerId: refs.laBrasaId,
        siteId: refs.warehouseId,
        amount: '200000.00',
        dueIn: -10,
      },
      {
        sourceId: '00000000-0000-4000-8000-00000000f103',
        customerId: refs.laBrasaId,
        siteId: refs.warehouseId,
        amount: '250000.00',
        dueIn: -45,
      },
      {
        sourceId: '00000000-0000-4000-8000-00000000f104',
        customerId: refs.laBrasaId,
        siteId: refs.warehouseId,
        amount: '300000.00',
        dueIn: -100,
      },
      {
        sourceId: '00000000-0000-4000-8000-00000000f105',
        customerId: refs.donaRosaId,
        siteId: refs.posSiteId,
        amount: '120000.00',
        dueIn: -20,
      },
    ];

    const receivableIds = new Map<string, string>();
    for (const obligation of obligations) {
      const existing = await tx.execute(sql`
        select id from finance.receivables
        where source_type = 'seed.receivable' and source_id = ${obligation.sourceId}
        limit 1
      `);
      let id = (existing.rows[0] as { id: string } | undefined)?.id;
      if (!id) {
        id = await createReceivable(tx, {
          customerId: obligation.customerId,
          siteId: obligation.siteId,
          sourceType: 'seed.receivable',
          sourceId: obligation.sourceId,
          amount: obligation.amount,
          issuedOn: addDays(today, obligation.dueIn - 15),
          dueOn: addDays(today, obligation.dueIn),
        });
      }
      receivableIds.set(obligation.sourceId, id);
      await recordEvent(tx, {
        type: 'ReceivableCreated',
        sourceType: 'finance.receivable',
        sourceId: id,
        siteId: obligation.siteId,
        amount: obligation.amount,
        payload: {
          customerId: obligation.customerId,
          sourceType: 'seed.receivable',
          sourceId: obligation.sourceId,
          dueOn: addDays(today, obligation.dueIn),
        },
      });
    }

    const collectionDefs = [
      {
        number: 'RC-0001',
        kind: 'delivery' as const,
        collectorType: 'driver' as const,
        collectorUserId: refs.driverId,
        customerId: refs.laBrasaId,
        siteId: refs.posSiteId,
        paymentMethodId: refs.cashId,
        amount: '100000.00',
        status: 'registered' as const,
        allocationSourceId: null as string | null,
      },
      {
        number: 'RC-0002',
        kind: 'payment' as const,
        collectorType: 'office' as const,
        collectorUserId: refs.managerId,
        customerId: refs.laBrasaId,
        siteId: refs.warehouseId,
        paymentMethodId: refs.transferId,
        amount: '50000.00',
        status: 'registered' as const,
        allocationSourceId: '00000000-0000-4000-8000-00000000f104',
      },
      {
        number: 'RC-0003',
        kind: 'delivery' as const,
        collectorType: 'driver' as const,
        collectorUserId: refs.driverId,
        customerId: refs.donaRosaId,
        siteId: refs.posSiteId,
        paymentMethodId: refs.cashId,
        amount: '80000.00',
        status: 'registered' as const,
        allocationSourceId: null as string | null,
      },
    ];

    const collectionIds = new Map<string, string>();
    for (const collection of collectionDefs) {
      const existing = await tx.execute(sql`
        select id from finance.collections where number = ${collection.number} limit 1
      `);
      let id = (existing.rows[0] as { id: string } | undefined)?.id;
      if (!id) {
        const inserted = await tx.execute(sql`
          insert into finance.collections
            (number, site_id, kind, collector_type, collector_user_id, customer_id,
             payment_method_id, amount, status)
          values
            (${collection.number}, ${collection.siteId}, ${collection.kind}, ${collection.collectorType},
             ${collection.collectorUserId}, ${collection.customerId}, ${collection.paymentMethodId},
             ${collection.amount}, ${collection.status})
          returning id
        `);
        id = (inserted.rows[0] as { id: string }).id;
      }
      collectionIds.set(collection.number, id);
      await recordEvent(tx, {
        type: 'PaymentReceived',
        sourceType: 'finance.collection',
        sourceId: id,
        siteId: collection.siteId,
        amount: collection.amount,
        payload: {
          number: collection.number,
          kind: collection.kind,
          customerId: collection.customerId,
          collectorType: collection.collectorType,
          paymentMethodId: collection.paymentMethodId,
        },
      });

      if (collection.allocationSourceId) {
        const receivableId = receivableIds.get(collection.allocationSourceId);
        if (!receivableId) continue;
        const existingAllocation = await tx.execute(sql`
          select 1 from finance.payment_allocations
          where collection_id = ${id} and receivable_id = ${receivableId} limit 1
        `);
        if (existingAllocation.rows.length === 0) {
          await tx.execute(sql`
            insert into finance.payment_allocations (collection_id, receivable_id, amount)
            values (${id}, ${receivableId}, ${collection.amount})
          `);
          await tx.execute(sql`
            update finance.receivables
            set balance = greatest(balance - ${collection.amount}::numeric, 0),
                status = case
                  when balance - ${collection.amount}::numeric <= 0 then 'paid'
                  else 'partially_paid'
                end
            where id = ${receivableId}
          `);
        }
      }
    }

    const reconciliationExists = await tx.execute(sql`
      select id from finance.reconciliations where number = 'CONC-0001' limit 1
    `);
    if (reconciliationExists.rows.length === 0) {
      const collectionId = collectionIds.get('RC-0003');
      if (!collectionId) return;
      const inserted = await tx.execute(sql`
        insert into finance.reconciliations
          (number, site_id, collector_type, collector_user_id, period_from, period_to,
           expected_amount, received_amount, variance, note, created_by)
        values
          ('CONC-0001', ${refs.posSiteId}, 'driver', ${refs.driverId}, ${today}, ${today},
           '80000.00', '70000.00', '-10000.00',
           'Faltante de $10.000 en efectivo', ${createdBy})
        returning id
      `);
      const reconciliationId = (inserted.rows[0] as { id: string }).id;
      await tx.execute(sql`
        insert into finance.reconciliation_lines
          (reconciliation_id, payment_method_id, expected_amount, received_amount, variance)
        values (${reconciliationId}, ${refs.cashId}, '80000.00', '70000.00', '-10000.00')
      `);
      await tx.execute(sql`
        update finance.collections
        set reconciliation_id = ${reconciliationId}, status = 'reconciled_with_variance'
        where id = ${collectionId}
      `);
      await recordEvent(tx, {
        type: 'CollectionReconciled',
        sourceType: 'finance.reconciliation',
        sourceId: reconciliationId,
        siteId: refs.posSiteId,
        amount: '70000.00',
        payload: {
          number: 'CONC-0001',
          expectedAmount: '80000.00',
          receivedAmount: '70000.00',
          variance: '-10000.00',
          collectionIds: [collectionId],
        },
      });
    }

    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('RC', 4), ('CONC', 2)
      on conflict (doc_type) do update
        set next_value = greatest(platform.document_sequences.next_value, excluded.next_value)
    `);
  });
}
