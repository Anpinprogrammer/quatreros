import { Decimal } from 'decimal.js';

/**
 * Reglas puras de inventario (BR-080..086, BR-092). Sin E/S.
 * La aplicación traduce las violaciones a errores HTTP estables.
 */
export type MovementViolation = 'ZERO_QUANTITY' | 'SIGN_MISMATCH' | 'INSUFFICIENT_STOCK';

/** Valida el signo y que un movimiento no deje el saldo por debajo de cero (BR-081 / Q-B-08). */
export function movementViolation(
  quantity: string,
  baseQuantity: string,
  currentBalance?: string,
): MovementViolation | null {
  const qty = new Decimal(quantity);
  const base = new Decimal(baseQuantity);
  if (qty.isZero() || base.isZero()) return 'ZERO_QUANTITY';
  if (qty.isNegative() !== base.isNegative()) return 'SIGN_MISMATCH';
  if (qty.isNegative()) {
    const next = new Decimal(currentBalance ?? '0').plus(qty);
    if (next.isNegative()) return 'INSUFFICIENT_STOCK';
  }
  return null;
}

/** Saldo resultante con 3 decimales; la base también lo valida con CHECK. */
export function nextBalance(current: string, delta: string): string {
  return new Decimal(current).plus(delta).toFixed(3);
}

/** Una presentación convierte su cantidad a unidad base con `unitsPer` (BR-009, DEC-P22). */
export function baseQuantityFor(quantity: string, unitsPer: string): string {
  return new Decimal(quantity).times(unitsPer).toFixed(3);
}

/** Un lote vencido no es vendible (BR-086); la fecha se compara como fecha de negocio ISO. */
export function isExpired(expiresOn: string | null | undefined, today: string): boolean {
  return Boolean(expiresOn && expiresOn < today);
}

/** Vendible = estado disponible y no vencido (BR-085, BR-086). */
export function isSellable(status: string, expiresOn: string | null | undefined, today: string): boolean {
  return status === 'available' && !isExpired(expiresOn, today);
}

/**
 * Orden FEFO: vencimiento más próximo primero; sin vencimiento al final.
 * El desempate es estable por código de lote para que dos corridas den el mismo resultado.
 */
export function compareFefo(
  a: { expiresOn: string | null; code: string },
  b: { expiresOn: string | null; code: string },
): number {
  if (a.expiresOn !== b.expiresOn) {
    if (a.expiresOn === null) return 1;
    if (b.expiresOn === null) return -1;
    return a.expiresOn < b.expiresOn ? -1 : 1;
  }
  return a.code.localeCompare(b.code);
}

/** Fecha de negocio de hoy en America/Bogota, en formato ISO (DR-004). */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
