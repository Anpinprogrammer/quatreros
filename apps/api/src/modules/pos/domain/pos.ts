import { Decimal } from 'decimal.js';

/** Reglas puras de caja y ventas (pos/caja §2). Dinero y cantidades siempre como cadenas. */

export interface PaymentAmount {
  amount: string;
  isCash: boolean;
}

export interface PaymentTotals {
  paid: string;
  cash: string;
  nonCash: string;
  change: string;
}

export type PaymentIssue = 'BELOW_TOTAL' | 'CHANGE_NOT_CASH';

const money = (value: Decimal): string => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const quantity = (value: Decimal): string => value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);

/** Total de una línea: precio unitario × cantidad, redondeado a centavos. */
export function lineTotal(unitPrice: string, amount: string): string {
  return money(new Decimal(unitPrice).times(amount));
}

/** Suma de pagos, efectivo y no efectivo; el cambio es lo pagado por encima del total. */
export function paymentTotals(total: string, payments: PaymentAmount[]): PaymentTotals {
  let paid = new Decimal(0);
  let cash = new Decimal(0);
  let nonCash = new Decimal(0);
  for (const payment of payments) {
    const amount = new Decimal(payment.amount);
    paid = paid.plus(amount);
    if (payment.isCash) cash = cash.plus(amount);
    else nonCash = nonCash.plus(amount);
  }
  return {
    paid: money(paid),
    cash: money(cash),
    nonCash: money(nonCash),
    change: money(paid.minus(total)),
  };
}

/** BR-143: la suma no puede ser menor al total y el cambio solo puede cubrirse con efectivo. */
export function paymentIssue(total: string, payments: PaymentAmount[]): PaymentIssue | null {
  const totals = paymentTotals(total, payments);
  if (new Decimal(totals.paid).lt(total)) return 'BELOW_TOTAL';
  if (new Decimal(totals.change).gt(totals.cash)) return 'CHANGE_NOT_CASH';
  return null;
}

/** BR-144: efectivo esperado = base + pagos en efectivo − cambios. */
export function expectedCash(openingCash: string, cashPayments: string, changeTotal: string): string {
  return money(new Decimal(openingCash).plus(cashPayments).minus(changeTotal));
}

export function difference(counted: string, expected: string): string {
  return money(new Decimal(counted).minus(expected));
}

/** BR-145: una diferencia de efectivo distinta de cero deja el turno pendiente de revisión. */
export function shiftStatusFor(cashDifference: string): 'closed' | 'closed_with_variance' {
  return new Decimal(cashDifference).isZero() ? 'closed' : 'closed_with_variance';
}

/** Consumo teórico de una receta, escalado por la producción base de la versión. */
export function theoreticalQuantity(
  componentQuantity: string,
  baseOutputQty: string,
  soldQuantity: string,
): string {
  return quantity(new Decimal(componentQuantity).times(soldQuantity).div(baseOutputQty));
}

/** Suma de líneas para el total de la venta. */
export function salesTotal(lines: string[]): string {
  return money(lines.reduce((total, line) => total.plus(new Decimal(line)), new Decimal(0)));
}
