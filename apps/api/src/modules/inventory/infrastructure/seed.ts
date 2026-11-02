import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { baseQuantityFor, businessToday } from '../domain/inventory.js';
import { recordMovement } from '../application/movements.js';
import { lots, transferLines, transfers } from './schema.js';

/**
 * Carga inicial de demostración (especificación inv/existencias §9).
 * Cada saldo nace de un movimiento opening_balance; nunca se inserta un saldo a mano.
 * Idempotente por código de lote.
 */

interface DemoLot {
  code: string;
  lotType: 'raw_material' | 'finished_good';
  itemName: string;
  presentationName: string | null;
  locationName: string;
  quantity: string;
  /** Días antes de hoy; null para materia prima (la fecha la define la recepción). */
  manufacturedDaysAgo: number | null;
  /** Días a partir de hoy. */
  expiresInDays: number;
}

const OPENING_SOURCE_ID = '00000000-0000-4000-8000-00000000b2b0';

export const DEMO_INVENTORY_LOTS: DemoLot[] = [
  {
    code: 'PT-2026-0001',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Unidad',
    locationName: 'Principal',
    quantity: '120.000',
    manufacturedDaysAgo: 13,
    expiresInDays: 17,
  },
  {
    code: 'PT-2026-0001',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Paquete x10',
    locationName: 'Principal',
    quantity: '24.000',
    manufacturedDaysAgo: 13,
    expiresInDays: 17,
  },
  {
    code: 'PT-2026-0002',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Unidad',
    locationName: 'Principal',
    quantity: '60.000',
    manufacturedDaysAgo: 5,
    expiresInDays: 25,
  },
  {
    code: 'PT-2026-0002',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Paquete x10',
    locationName: 'Principal',
    quantity: '12.000',
    manufacturedDaysAgo: 5,
    expiresInDays: 25,
  },
  {
    code: 'PT-2026-0003',
    lotType: 'finished_good',
    itemName: 'Rellena Mixta',
    presentationName: 'Unidad',
    locationName: 'Principal',
    quantity: '80.000',
    manufacturedDaysAgo: 8,
    expiresInDays: 22,
  },
  {
    code: 'PT-2026-0003',
    lotType: 'finished_good',
    itemName: 'Rellena Mixta',
    presentationName: 'Paquete x10',
    locationName: 'Principal',
    quantity: '16.000',
    manufacturedDaysAgo: 8,
    expiresInDays: 22,
  },
  {
    code: 'PT-2026-0004',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Unidad',
    locationName: 'Productos del punto',
    quantity: '20.000',
    manufacturedDaysAgo: 18,
    expiresInDays: 3,
  },
  {
    code: 'PT-2026-0004',
    lotType: 'finished_good',
    itemName: 'Chorizo Santarrosano',
    presentationName: 'Paquete x10',
    locationName: 'Productos del punto',
    quantity: '4.000',
    manufacturedDaysAgo: 18,
    expiresInDays: 3,
  },
  {
    code: 'MP-2026-0001',
    lotType: 'raw_material',
    itemName: 'Carne de cerdo magra',
    presentationName: null,
    locationName: 'Principal',
    quantity: '80.000',
    manufacturedDaysAgo: null,
    expiresInDays: 4,
  },
  {
    code: 'MP-2026-0002',
    lotType: 'raw_material',
    itemName: 'Tocino y grasa',
    presentationName: null,
    locationName: 'Principal',
    quantity: '40.000',
    manufacturedDaysAgo: null,
    expiresInDays: 18,
  },
  {
    code: 'MP-2026-0003',
    lotType: 'raw_material',
    itemName: 'Mix de especias',
    presentationName: null,
    locationName: 'Principal',
    quantity: '10.000',
    manufacturedDaysAgo: null,
    expiresInDays: 133,
  },
  {
    code: 'MP-2026-0004',
    lotType: 'raw_material',
    itemName: 'Tripa natural',
    presentationName: null,
    locationName: 'Principal',
    quantity: '500.000',
    manufacturedDaysAgo: null,
    expiresInDays: 150,
  },
];

interface ProductRef {
  productId: string;
  productName: string;
  presentationId: string;
  presentationName: string;
  unitsPer: string;
}

interface RawMaterialRef {
  id: string;
  name: string;
}

interface LocationRef {
  id: string;
  name: string;
  siteName: string;
}

async function loadRefs(db: Database) {
  const productsResult = await db.execute(sql`
    select p.id as product_id, p.name as product_name,
           pr.id as presentation_id, pr.name as presentation_name, pr.units_per
    from catalog.products p
    join catalog.presentations pr on pr.product_id = p.id
  `);
  const materialsResult = await db.execute(sql`
    select id, name from catalog.raw_materials
  `);
  const locationsResult = await db.execute(sql`
    select l.id, l.name, s.name as site_name
    from admin.locations l
    join admin.sites s on s.id = l.site_id
  `);

  const products = new Map<string, ProductRef>();
  for (const row of productsResult.rows as unknown as {
    product_id: string;
    product_name: string;
    presentation_id: string;
    presentation_name: string;
    units_per: string;
  }[]) {
    products.set(`${row.product_name}::${row.presentation_name}`, {
      productId: row.product_id,
      productName: row.product_name,
      presentationId: row.presentation_id,
      presentationName: row.presentation_name,
      unitsPer: row.units_per,
    });
  }
  const materials = new Map<string, RawMaterialRef>();
  for (const row of materialsResult.rows as unknown as { id: string; name: string }[]) {
    materials.set(row.name, { id: row.id, name: row.name });
  }
  const locations = new Map<string, LocationRef>();
  for (const row of locationsResult.rows as unknown as {
    id: string;
    name: string;
    site_name: string;
  }[]) {
    locations.set(row.name, { id: row.id, name: row.name, siteName: row.site_name });
  }
  return { products, materials, locations };
}

export async function seedDemoInventory(db: Database, setByUserId: string): Promise<void> {
  const { products, materials, locations } = await loadRefs(db);

  // Un lote puede tener varias presentaciones (unidad y paquete): se agrupan por código.
  const byCode = new Map<string, DemoLot[]>();
  for (const demo of DEMO_INVENTORY_LOTS) {
    const entries = byCode.get(demo.code) ?? [];
    entries.push(demo);
    byCode.set(demo.code, entries);
  }

  await db.transaction(async (tx) => {
    for (const [code, entries] of byCode) {
      const [existing] = await tx.select({ id: lots.id }).from(lots).where(eq(lots.code, code)).limit(1);
      if (existing) continue; // semilla idempotente: el lote y sus movimientos ya existen

      const first = entries[0];
      if (!first) continue;
      const product =
        first.lotType === 'finished_good'
          ? products.get(`${first.itemName}::${first.presentationName ?? ''}`)
          : null;
      const material = first.lotType === 'raw_material' ? materials.get(first.itemName) : null;
      if (first.lotType === 'finished_good' && !product) {
        throw new Error(
          `La semilla de inventario necesita ${first.itemName} en el catálogo demo (ejecuta seedDemoCatalog antes)`,
        );
      }
      if (first.lotType === 'raw_material' && !material) {
        throw new Error(
          `La semilla de inventario necesita la materia prima ${first.itemName} (ejecuta seedDemoCatalog antes)`,
        );
      }

      const today = businessToday();
      const addDays = (date: string, days: number): string => {
        const value = new Date(`${date}T12:00:00.000Z`);
        value.setUTCDate(value.getUTCDate() + days);
        return value.toISOString().slice(0, 10);
      };
      const manufacturedOn =
        first.manufacturedDaysAgo == null ? null : addDays(today, -first.manufacturedDaysAgo);
      const expiresOn = addDays(today, first.expiresInDays);

      const [lot] = await tx
        .insert(lots)
        .values({
          code,
          lotType: first.lotType,
          productId: product?.productId ?? null,
          rawMaterialId: material?.id ?? null,
          manufacturedOn,
          expiresOn,
          status: 'available',
          isOpeningBalance: true,
        })
        .returning({ id: lots.id });
      if (!lot) throw new Error(`No se pudo crear el lote ${code}`);

      for (const demo of entries) {
        const location = locations.get(demo.locationName);
        if (!location) {
          throw new Error(`La semilla de inventario necesita la ubicación ${demo.locationName}`);
        }
        const entryProduct =
          demo.lotType === 'finished_good'
            ? products.get(`${demo.itemName}::${demo.presentationName ?? ''}`)
            : null;
        if (demo.lotType === 'finished_good' && !entryProduct) {
          throw new Error(
            `La semilla de inventario necesita ${demo.itemName} · ${demo.presentationName ?? ''}`,
          );
        }
        const presentationId = entryProduct?.presentationId ?? null;
        const unitsPer = entryProduct?.unitsPer ?? '1';
        const baseQuantity = baseQuantityFor(demo.quantity, unitsPer);

        await recordMovement(tx, {
          movementType: 'opening_balance',
          lotId: lot.id,
          presentationId,
          locationId: location.id,
          quantity: demo.quantity,
          baseQuantity,
          sourceType: 'migration.opening_balance',
          sourceId: OPENING_SOURCE_ID,
          createdBy: setByUserId,
          reason: 'Carga inicial de demostración',
        });
      }
    }
  });
}

/**
 * Traslado de demostración ya recibido (T-0001): 2 paquetes de PT-2026-0001 de Bodega
 * a Productos del punto. Deja la pantalla de traslados con un caso real e idempotente.
 */
export async function seedDemoTransfer(db: Database, setByUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: transfers.id })
      .from(transfers)
      .where(eq(transfers.number, 'T-0001'))
      .limit(1);
    if (existing) return;

    const refResult = await tx.execute(sql`
      select l.id as "lotId", pr.id as "presentationId", pr.units_per as "unitsPer",
             fl.id as "fromId", tl.id as "toId", tr.id as "transitId"
      from inventory.lots l
      join catalog.products p on p.id = l.product_id
      join catalog.presentations pr on pr.product_id = p.id and pr.name = 'Paquete x10'
      join admin.locations fl on fl.name = 'Principal'
      join admin.locations tl on tl.name = 'Productos del punto'
      join admin.locations tr on tr.site_id = fl.site_id and tr.kind = 'in_transit'
      where l.code = 'PT-2026-0001'
      limit 1
    `);
    const ref = refResult.rows[0] as
      | {
          lotId: string;
          presentationId: string;
          unitsPer: string;
          fromId: string;
          toId: string;
          transitId: string;
        }
      | undefined;
    if (!ref) return;

    const quantity = '2.000';
    const baseQuantity = baseQuantityFor(quantity, ref.unitsPer);
    const [transfer] = await tx
      .insert(transfers)
      .values({
        number: 'T-0001',
        fromLocationId: ref.fromId,
        toLocationId: ref.toId,
        transitLocationId: ref.transitId,
        sentBy: setByUserId,
      })
      .returning({ id: transfers.id });
    if (!transfer) throw new Error('No se pudo crear el traslado demo');

    const [line] = await tx
      .insert(transferLines)
      .values({
        transferId: transfer.id,
        lotId: ref.lotId,
        presentationId: ref.presentationId,
        sentQty: quantity,
      })
      .returning({ id: transferLines.id });
    if (!line) throw new Error('No se pudo crear la línea del traslado demo');

    await recordMovement(tx, {
      movementType: 'transfer_out',
      lotId: ref.lotId,
      presentationId: ref.presentationId,
      locationId: ref.fromId,
      quantity: `-${quantity}`,
      baseQuantity: `-${baseQuantity}`,
      sourceType: 'inventory.transfer',
      sourceId: transfer.id,
      createdBy: setByUserId,
      reason: 'Traslado T-0001',
    });
    await recordMovement(tx, {
      movementType: 'transfer_in',
      lotId: ref.lotId,
      presentationId: ref.presentationId,
      locationId: ref.transitId,
      quantity,
      baseQuantity,
      sourceType: 'inventory.transfer',
      sourceId: transfer.id,
      createdBy: setByUserId,
      reason: 'Traslado T-0001 en tránsito',
    });

    await recordMovement(tx, {
      movementType: 'transfer_out',
      lotId: ref.lotId,
      presentationId: ref.presentationId,
      locationId: ref.transitId,
      quantity: `-${quantity}`,
      baseQuantity: `-${baseQuantity}`,
      sourceType: 'inventory.transfer',
      sourceId: transfer.id,
      createdBy: setByUserId,
      reason: 'Recepción T-0001',
    });
    await recordMovement(tx, {
      movementType: 'transfer_in',
      lotId: ref.lotId,
      presentationId: ref.presentationId,
      locationId: ref.toId,
      quantity,
      baseQuantity,
      sourceType: 'inventory.transfer',
      sourceId: transfer.id,
      createdBy: setByUserId,
      reason: 'Recepción T-0001',
    });

    await tx.update(transferLines).set({ receivedQty: quantity }).where(eq(transferLines.id, line.id));
    await tx
      .update(transfers)
      .set({ status: 'received', receivedBy: setByUserId, receivedAt: new Date() })
      .where(eq(transfers.id, transfer.id));
    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('T', 2)
      on conflict (doc_type) do update
        set next_value = greatest(platform.document_sequences.next_value, 2)
    `);
  });
}
