/** Formatos de producción (es-CO). Cantidades y rendimientos en mono. */

const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function formatQuantity(value: string): string {
  return quantity.format(Number(value));
}

export function formatPercent(value: string): string {
  return `${percent.format(Number(value))} %`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dateOnly.format(new Date(`${value}T12:00:00`));
}

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}
