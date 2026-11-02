/** Formatos de compras (es-CO). Montos y cantidades en mono. */

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const unitCost = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function formatMoney(value: string): string {
  return money.format(Number(value));
}

export function formatUnitCost(value: string): string {
  return unitCost.format(Number(value));
}

export function formatQuantity(value: string): string {
  return quantity.format(Number(value));
}

/** Fecha de negocio (YYYY-MM-DD) sin corrimiento por zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dateOnly.format(new Date(`${value}T12:00:00`));
}

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}
