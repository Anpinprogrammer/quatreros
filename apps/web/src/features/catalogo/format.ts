/** Formatos de presentación del catálogo (es-CO). Montos y cantidades en mono. */

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

export function formatMoney(value: string): string {
  return money.format(Number(value));
}

export function formatQuantity(value: string): string {
  return quantity.format(Number(value));
}

/** "1 unidad base" / "10 unidades base" (sin el incómodo "unidad(es)"). */
export function formatUnits(value: string): string {
  const amount = Number(value);
  return `${quantity.format(amount)} ${amount === 1 ? 'unidad base' : 'unidades base'}`;
}

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

export function formatDate(value: string): string {
  return dateOnly.format(new Date(value));
}
