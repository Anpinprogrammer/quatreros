import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import { businessToday } from '../domain/inventory.js';
import { lots } from '../infrastructure/schema.js';
import { recordMovement } from './movements.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface RawMaterialLotInput {
  receiptId: string;
  supplierId: string;
  rawMaterialId: string;
  locationId: string;
  quantity: string;
  unitCost: string;
  expiresOn: string | null;
  createdBy: string;
  reason: string;
}

export interface RawMaterialLotResult {
  lotId: string;
  code: string;
}

/**
 * Consecutivo de lote MP-AAAA-####. La primera vez sincroniza con los lotes MP que ya existan
 * (semilla) para no chocar; luego avanza con `FOR UPDATE` para serializar recepciones concurrentes.
 */
async function nextLotCode(tx: Executor): Promise<string> {
  const year = businessToday().slice(0, 4);
  await tx.insert(documentSequences).values({ docType: 'MP' }).onConflictDoNothing();
  const [sequence] = await tx
    .select({ nextValue: documentSequences.nextValue })
    .from(documentSequences)
    .where(eq(documentSequences.docType, 'MP'))
    .for('update');
  if (!sequence) throw new Error('No se pudo obtener el consecutivo de lotes');

  let current = sequence.nextValue;
  if (current === 1) {
    const existing = await tx.execute(sql`
      select coalesce(max((regexp_match(code, '^MP-[0-9]{4}-([0-9]+)$'))[1]::int), 0) as "maxValue"
      from inventory.lots
      where code ~ '^MP-[0-9]{4}-[0-9]+$'
    `);
    const maxValue = (existing.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0;
    if (maxValue > 0) {
      current = maxValue + 1;
      await tx
        .update(documentSequences)
        .set({ nextValue: current })
        .where(eq(documentSequences.docType, 'MP'));
    }
  }

  const [updated] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, 'MP'))
    .returning({ nextValue: documentSequences.nextValue });
  if (!updated) throw new Error('No se pudo avanzar el consecutivo de lotes');
  const value = updated.nextValue - 1;
  return `MP-${year}-${String(value).padStart(4, '0')}`;
}

/**
 * Crea el lote de materia prima de una recepción y su movimiento `receipt` en la misma
 * transacción (BR-042, DEC-094). Es la única puerta para que compras entre al inventario.
 */
export async function createRawMaterialLot(
  tx: Executor,
  input: RawMaterialLotInput,
): Promise<RawMaterialLotResult> {
  const code = await nextLotCode(tx);
  const [lot] = await tx
    .insert(lots)
    .values({
      code,
      lotType: 'raw_material',
      rawMaterialId: input.rawMaterialId,
      supplierId: input.supplierId,
      receiptId: input.receiptId,
      unitCost: input.unitCost,
      expiresOn: input.expiresOn,
      status: 'available',
      isOpeningBalance: false,
    })
    .returning({ id: lots.id });
  if (!lot) throw new Error('No se pudo crear el lote de materia prima');

  await recordMovement(tx, {
    movementType: 'receipt',
    lotId: lot.id,
    presentationId: null,
    locationId: input.locationId,
    quantity: input.quantity,
    baseQuantity: input.quantity,
    sourceType: 'purchasing.receipt',
    sourceId: input.receiptId,
    createdBy: input.createdBy,
    reason: input.reason,
  });

  return { lotId: lot.id, code };
}
