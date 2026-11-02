import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { businessToday } from '../../inventory/application/public.js';
import { purchaseTotal } from '../domain/purchasing.js';
import { purchaseLines, purchases, suppliers } from './schema.js';

/**
 * Proveedores y una compra pendiente de demostración (comp/compras §9). Idempotente por nombre
 * y número. No siembra recepciones: la demo las registra para crear el primer lote MP.
 */
export async function seedDemoPurchasing(db: Database, setByUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const demoSuppliers = [
      {
        name: 'Cárnicos del Valle S.A.S.',
        taxId: '900123456-7',
        phone: '602 555 0101',
        contactName: 'Lucía Ramírez',
      },
      {
        name: 'Distribuidora La Especia',
        taxId: '900987654-3',
        phone: '602 555 0202',
        contactName: 'Jorge Salcedo',
      },
    ];
    for (const supplier of demoSuppliers) {
      await tx.insert(suppliers).values(supplier).onConflictDoNothing({ target: suppliers.name });
    }

    const [existing] = await tx
      .select({ id: purchases.id })
      .from(purchases)
      .where(eq(purchases.number, 'C-0001'))
      .limit(1);
    if (!existing) {
      const refs = await tx.execute(sql`
        select s.id as "supplierId", site.id as "siteId",
               carne.id as "carneId", tocino.id as "tocinoId"
        from purchasing.suppliers s
        join admin.sites site on site.name = 'Bodega principal'
        join catalog.raw_materials carne on carne.name = 'Carne de cerdo magra'
        join catalog.raw_materials tocino on tocino.name = 'Tocino y grasa'
        where s.name = 'Cárnicos del Valle S.A.S.'
        limit 1
      `);
      const ref = refs.rows[0] as
        { supplierId: string; siteId: string; carneId: string; tocinoId: string } | undefined;
      if (!ref) throw new Error('La semilla de compras necesita proveedores, sede y materias primas');

      const lines = [
        { rawMaterialId: ref.carneId, quantity: '40.000', unitCost: '18000.0000' },
        { rawMaterialId: ref.tocinoId, quantity: '20.000', unitCost: '14000.0000' },
      ];
      const [purchase] = await tx
        .insert(purchases)
        .values({
          number: 'C-0001',
          supplierId: ref.supplierId,
          siteId: ref.siteId,
          purchasedOn: businessToday(),
          total: purchaseTotal(lines),
          createdBy: setByUserId,
        })
        .returning({ id: purchases.id });
      if (!purchase) throw new Error('No se pudo crear la compra demo');
      await tx.insert(purchaseLines).values(
        lines.map((line) => ({
          purchaseId: purchase.id,
          rawMaterialId: line.rawMaterialId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      );
    }

    // El consecutivo nunca queda por debajo del último C-#### existente.
    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('C', 1), ('R', 1)
      on conflict (doc_type) do nothing
    `);
    const maxC = await tx.execute(sql`
      select coalesce(max((regexp_match(number, '^C-([0-9]+)$'))[1]::int), 0) as "maxValue"
      from purchasing.purchases
      where number ~ '^C-[0-9]+$'
    `);
    const nextC = ((maxC.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0) + 1;
    await tx.execute(sql`
      update platform.document_sequences
      set next_value = greatest(next_value, ${nextC})
      where doc_type = 'C'
    `);
  });
}
