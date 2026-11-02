const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});
const quantity = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const formatMoney = (value: string | number) => money.format(Number(value));
export const formatQuantity = (value: string | number) => quantity.format(Number(value));
export const formatDateTime = (value: string) => dateTime.format(new Date(value));
export const toAmount = (value: string | number) => Number(value).toFixed(2);
