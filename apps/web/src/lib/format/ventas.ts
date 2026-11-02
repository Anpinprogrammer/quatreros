const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});
const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const formatMoney = (value: string) => money.format(Number(value));
export const formatQuantity = (value: string) => quantity.format(Number(value));
export const formatDate = (value: string | null | undefined) =>
  value ? dateOnly.format(new Date(`${value}T12:00:00`)) : '—';
export const formatDateTime = (value: string) => dateTime.format(new Date(value));
