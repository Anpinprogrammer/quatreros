import type { AgingBucketKey, CollectionStatus, ReceivableStatus } from '@quatreros/contracts';
import { Decimal } from 'decimal.js';

/**
 * Reglas puras de cartera, antigüedad y conciliación (DEC-104).
 * Sin E/S: las usan los casos de uso y las pruebas unitarias.
 */

/** Monto canónico: dos decimales con redondeo comercial, siempre como cadena. */
export function money(value: Decimal | string | number): string {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Diferencia en días calendario entre dos fechas YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((a - b) / 86_400_000);
}

/** Días vencidos a hoy: 0 si aún no vence. */
export function overdueDays(dueOn: string, asOf: string): number {
  return Math.max(daysBetween(asOf, dueOn), 0);
}

/** Rango de antigüedad acordado en D1. */
export function agingBucket(dueOn: string, asOf: string): AgingBucketKey {
  const days = daysBetween(asOf, dueOn);
  if (days <= 0) return 'due';
  if (days <= 30) return 'overdue_1_30';
  if (days <= 60) return 'overdue_31_60';
  if (days <= 90) return 'overdue_61_90';
  return 'overdue_90_plus';
}

/** Estado de una obligación a partir de su monto original y su saldo. */
export function receivableStatus(amount: string, balance: string): ReceivableStatus {
  const pending = new Decimal(balance);
  if (pending.lte(0)) return 'paid';
  if (pending.eq(amount)) return 'open';
  return 'partially_paid';
}

/** Suma de asignaciones de un abono. */
export function allocationSum(allocations: readonly { amount: string }[]): string {
  return money(allocations.reduce((total, item) => total.plus(item.amount), new Decimal(0)));
}

export interface OpenReceivable {
  receivableId: string;
  balance: string;
}

export interface Allocation {
  receivableId: string;
  amount: string;
}

/**
 * Aplica un abono a las obligaciones más antiguas primero (D3, FIFO).
 * Devuelve lo que no alcanzó a cubrirse: si queda remanente, el abono excede el saldo.
 */
export function allocateFifo(
  amount: string,
  open: readonly OpenReceivable[],
): { allocations: Allocation[]; remainder: string } {
  const allocations: Allocation[] = [];
  let remaining = new Decimal(amount);
  for (const item of open) {
    if (remaining.lte(0)) break;
    const take = Decimal.min(remaining, item.balance);
    if (take.lte(0)) continue;
    allocations.push({ receivableId: item.receivableId, amount: take.toFixed(2) });
    remaining = remaining.minus(take);
  }
  return { allocations, remainder: remaining.toFixed(2) };
}

/** Estado del recaudo según la diferencia entre lo esperado y lo recibido. */
export function reconciliationStatus(variance: Decimal | string | number): CollectionStatus {
  return new Decimal(variance).isZero() ? 'reconciled' : 'reconciled_with_variance';
}

/** CSV compatible con Excel: UTF-8 con BOM, separador `;` y comillas solo cuando hacen falta. */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  const escape = (value: string | number | null): string => {
    if (value === null) return '';
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${rows.map((row) => row.map(escape).join(';')).join('\r\n')}\r\n`;
}
