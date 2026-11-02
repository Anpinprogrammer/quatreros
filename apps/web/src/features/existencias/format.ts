/** Formatos de inventario (es-CO): cantidades, fechas y kardex. */

const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

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

export function formatSignedQuantity(value: string): string {
  const amount = Number(value);
  return `${amount > 0 ? '+' : ''}${quantity.format(amount)}`;
}
