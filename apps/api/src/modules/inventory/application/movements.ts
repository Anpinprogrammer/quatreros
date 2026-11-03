import type { MovementType } from '@quatreros/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { AppError } from '../../../platform/http/errors.js';
import { movementViolation, nextBalance } from '../domain/inventory.js';
import { stockBalances, stockMovements } from '../infrastructure/schema.js';
import { allocateFefo, type FefoAllocation } from './fefo.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update'>;
type SaleExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface MovementInput {
  movementType: MovementType;
  lotId: string;
  presentationId: string | null;
  locationId: string;
  quantity: string;
  baseQuantity: string;
  sourceType: string;
  sourceId: string;
  createdBy: string;
  reason?: string | undefined;
  reversesId?: number | undefined;
}

function violationError(violation: ReturnType<typeof movementViolation>): AppError {
  switch (violation) {
    case 'INSUFFICIENT_STOCK':
      return AppError.conflict(
        'INSUFFICIENT_STOCK',
        'Existencia insuficiente',
        'El movimiento dejaría una existencia negativa. Revisa el saldo del lote y la ubicación.',
      );
    case 'SIGN_MISMATCH':
      return new AppError(
        422,
        'VALIDATION_FAILED',
        'Movimiento inválido',
        'La cantidad y la cantidad base deben tener el mismo signo.',
      );
    default:
      return new AppError(
        422,
        'VALIDATION_FAILED',
        'Movimiento inválido',
        'La cantidad del movimiento no puede ser cero.',
      );
  }
}

/**
 * Única puerta para cambiar existencias (ADR-009, BR-080): inserta el movimiento inmutable
 * y actualiza el saldo en la misma transacción. Si el saldo quedaría negativo, aborta.
 */
export async function recordMovement(tx: Executor, input: MovementInput): Promise<{ id: number }> {
  const balanceConditions = and(
    eq(stockBalances.lotId, input.lotId),
    input.presentationId === null
      ? isNull(stockBalances.presentationId)
      : eq(stockBalances.presentationId, input.presentationId),
    eq(stockBalances.locationId, input.locationId),
  );

  const [current] = await tx
    .select({ quantity: stockBalances.quantity })
    .from(stockBalances)
    .where(balanceConditions)
    .for('update');

  const violation = movementViolation(input.quantity, input.baseQuantity, current?.quantity);
  if (violation) throw violationError(violation);

  const [movement] = await tx
    .insert(stockMovements)
    .values({
      movementType: input.movementType,
      lotId: input.lotId,
      presentationId: input.presentationId,
      locationId: input.locationId,
      quantity: input.quantity,
      baseQuantity: input.baseQuantity,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason ?? null,
      createdBy: input.createdBy,
      reversesId: input.reversesId ?? null,
    })
    .returning({ id: stockMovements.id });
  if (!movement) throw new Error('No se pudo registrar el movimiento');

  if (current) {
    await tx
      .update(stockBalances)
      .set({ quantity: nextBalance(current.quantity, input.quantity), updatedAt: new Date() })
      .where(balanceConditions);
  } else {
    await tx.insert(stockBalances).values({
      lotId: input.lotId,
      presentationId: input.presentationId,
      locationId: input.locationId,
      quantity: nextBalance('0', input.quantity),
    });
  }

  return movement;
}

export interface SaleIssueInput {
  siteId: string;
  locationId: string;
  presentationId: string;
  quantity: string;
  saleId: string;
  userId: string;
  reason?: string | undefined;
}

/**
 * Salida de una venta POS: asigna FEFO en la ubicación del punto, registra un movimiento
 * `sale` por cada lote y devuelve las asignaciones para que POS guarde la trazabilidad.
 */
export async function issueForSale(tx: SaleExecutor, input: SaleIssueInput): Promise<FefoAllocation[]> {
  const result = await allocateFefo(
    tx,
    { presentationId: input.presentationId, locationId: input.locationId, quantity: input.quantity },
    { lock: true, siteIds: [input.siteId] },
  );
  for (const allocation of result.allocations) {
    await recordMovement(tx, {
      movementType: 'sale',
      lotId: allocation.lotId,
      presentationId: input.presentationId,
      locationId: input.locationId,
      quantity: `-${allocation.quantity}`,
      baseQuantity: `-${allocation.baseQuantity}`,
      sourceType: 'pos.sale',
      sourceId: input.saleId,
      createdBy: input.userId,
      reason: input.reason,
    });
  }
  return result.allocations;
}
