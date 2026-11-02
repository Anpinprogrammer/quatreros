import { Decimal } from 'decimal.js';

/**
 * Reglas puras de compras (comp/compras §7).
 * El total no incluye impuestos: el desglose fiscal está bloqueado (P-02, BR-044).
 */

export interface PurchaseLineQuantity {
  quantity: string;
  receivedQuantity: string;
}

/** Total de la compra = Σ(cantidad × costo unitario), redondeado a 2 decimales. */
export function purchaseTotal(lines: { quantity: string; unitCost: string }[]): string {
  let total = new Decimal(0);
  for (const line of lines) {
    total = total.plus(new Decimal(line.quantity).times(line.unitCost));
  }
  return total.toFixed(2);
}

/** Pendiente por recibir de una línea; nunca negativo. */
export function pendingQuantity(quantity: string, receivedQuantity: string): string {
  return Decimal.max(new Decimal(quantity).minus(receivedQuantity), 0).toFixed(3);
}

/**
 * Estado de la compra a partir de sus líneas:
 * - todas completas → received
 * - alguna con recepción → partially_received
 * - ninguna → pending_receipt
 */
export function purchaseStatus(
  lines: PurchaseLineQuantity[],
): 'pending_receipt' | 'partially_received' | 'received' {
  if (lines.length === 0) return 'pending_receipt';
  const complete = lines.every((line) => new Decimal(line.receivedQuantity).eq(line.quantity));
  if (complete) return 'received';
  const anyReceived = lines.some((line) => new Decimal(line.receivedQuantity).gt(0));
  return anyReceived ? 'partially_received' : 'pending_receipt';
}

export type ExpiryViolation = 'EXPIRY_REQUIRED' | 'EXPIRY_IN_PAST' | null;

/** Vencimiento: obligatorio si la materia prima lo controla; nunca anterior a hoy (BR-085). */
export function expiryViolation(
  expiresOn: string | null | undefined,
  tracksExpiry: boolean,
  today: string,
): ExpiryViolation {
  if (!expiresOn) return tracksExpiry ? 'EXPIRY_REQUIRED' : null;
  if (expiresOn < today) return 'EXPIRY_IN_PAST';
  return null;
}
