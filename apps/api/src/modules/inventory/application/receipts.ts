import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import { businessToday } from '../domain/inventory.js';
import { lotInputs, lots } from '../infrastructure/schema.js';
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
async function nextLotCode(tx: Executor, prefix: 'MP' | 'PT'): Promise<string> {
  const year = businessToday().slice(0, 4);
  const pattern = `^${prefix}-[0-9]{4}-([0-9]+)$`;
  await tx.insert(documentSequences).values({ docType: prefix }).onConflictDoNothing();
  const [sequence] = await tx
    .select({ nextValue: documentSequences.nextValue })
    .from(documentSequences)
    .where(eq(documentSequences.docType, prefix))
    .for('update');
  if (!sequence) throw new Error('No se pudo obtener el consecutivo de lotes');

  let current = sequence.nextValue;
  if (current === 1) {
    const existing = await tx.execute(sql`
      select coalesce(max((regexp_match(code, ${pattern}))[1]::int), 0) as "maxValue"
      from inventory.lots
      where code ~ ${`^${prefix}-[0-9]{4}-[0-9]+$`}
    `);
    const maxValue = (existing.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0;
    if (maxValue > 0) {
      current = maxValue + 1;
      await tx
        .update(documentSequences)
        .set({ nextValue: current })
        .where(eq(documentSequences.docType, prefix));
    }
  }

  const [updated] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, prefix))
    .returning({ nextValue: documentSequences.nextValue });
  if (!updated) throw new Error('No se pudo avanzar el consecutivo de lotes');
  const value = updated.nextValue - 1;
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}

/**
 * Crea el lote de materia prima de una recepción y su movimiento `receipt` en la misma
 * transacción (BR-042, DEC-094). Es la única puerta para que compras entre al inventario.
 */
export async function createRawMaterialLot(
  tx: Executor,
  input: RawMaterialLotInput,
): Promise<RawMaterialLotResult> {
  const code = await nextLotCode(tx, 'MP');
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

export interface FinishedGoodOutput {
  presentationId: string;
  quantity: string;
  baseQuantity: string;
}

export interface FinishedGoodInput {
  lotId: string;
  quantity: string;
}

export interface FinishedGoodLotInput {
  orderId: string;
  productId: string;
  locationId: string;
  manufacturedOn: string;
  expiresOn: string | null;
  createdBy: string;
  reason: string;
  outputs: FinishedGoodOutput[];
  inputs: FinishedGoodInput[];
}

export interface FinishedGoodLotResult {
  lotId: string;
  code: string;
}

/**
 * Crea el lote PT de una orden cerrada, sus entradas por presentación y los vínculos
 * con los lotes de MP consumidos (BR-064, BR-065, DEC-090, DEC-097).
 */
export async function createFinishedGoodLot(
  tx: Executor,
  input: FinishedGoodLotInput,
): Promise<FinishedGoodLotResult> {
  const code = await nextLotCode(tx, 'PT');
  const [lot] = await tx
    .insert(lots)
    .values({
      code,
      lotType: 'finished_good',
      productId: input.productId,
      manufacturedOn: input.manufacturedOn,
      expiresOn: input.expiresOn,
      status: 'available',
      isOpeningBalance: false,
    })
    .returning({ id: lots.id });
  if (!lot) throw new Error('No se pudo crear el lote de producto terminado');

  for (const output of input.outputs) {
    await recordMovement(tx, {
      movementType: 'production_output',
      lotId: lot.id,
      presentationId: output.presentationId,
      locationId: input.locationId,
      quantity: output.quantity,
      baseQuantity: output.baseQuantity,
      sourceType: 'production.order',
      sourceId: input.orderId,
      createdBy: input.createdBy,
      reason: input.reason,
    });
  }

  const byInput = new Map<string, Decimal>();
  for (const item of input.inputs) {
    byInput.set(item.lotId, (byInput.get(item.lotId) ?? new Decimal(0)).plus(item.quantity));
  }
  if (byInput.size > 0) {
    await tx.insert(lotInputs).values(
      [...byInput].map(([inputLotId, quantity]) => ({
        outputLotId: lot.id,
        inputLotId,
        quantity: quantity.toFixed(3),
      })),
    );
  }

  return { lotId: lot.id, code };
}
