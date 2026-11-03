import { describe, expect, it } from 'vitest';
import {
  difference,
  expectedCash,
  lineTotal,
  paymentIssue,
  paymentTotals,
  salesTotal,
  shiftStatusFor,
  theoreticalQuantity,
} from '../../src/modules/pos/domain/pos.js';

describe('caja y ventas (pos/caja §2, BR-143..147)', () => {
  it('calcula líneas, totales y cambio con dos decimales', () => {
    expect(lineTotal('1300.00', '3.000')).toBe('3900.00');
    expect(lineTotal('0.10', '3.000')).toBe('0.30');
    expect(salesTotal(['3900.00', '45000.00'])).toBe('48900.00');
    expect(
      paymentTotals('30000.00', [
        { amount: '20000.00', isCash: true },
        { amount: '15000.00', isCash: false },
      ]).change,
    ).toBe('5000.00');
  });

  it('rechaza pagos incompletos y cambio que no sale de efectivo', () => {
    expect(paymentIssue('30000.00', [{ amount: '20000.00', isCash: true }])).toBe('BELOW_TOTAL');
    expect(
      paymentIssue('30000.00', [
        { amount: '35000.00', isCash: false },
        { amount: '0.00', isCash: true },
      ]),
    ).toBe('CHANGE_NOT_CASH');
    expect(
      paymentIssue('30000.00', [
        { amount: '40000.00', isCash: true },
        { amount: '5000.00', isCash: false },
      ]),
    ).toBeNull();
  });

  it('calcula el efectivo esperado y la diferencia de arqueo', () => {
    expect(expectedCash('100000.00', '30000.00', '0.00')).toBe('130000.00');
    expect(expectedCash('100000.00', '40000.00', '15000.00')).toBe('125000.00');
    expect(difference('125000.00', '130000.00')).toBe('-5000.00');
    expect(shiftStatusFor('0.00')).toBe('closed');
    expect(shiftStatusFor('-5000.00')).toBe('closed_with_variance');
  });

  it('escala el consumo teórico por la producción base de la receta', () => {
    expect(theoreticalQuantity('2.000', '1.000', '1.000')).toBe('2.000');
    expect(theoreticalQuantity('2.000', '4.000', '2.000')).toBe('1.000');
    expect(theoreticalQuantity('0.500', '1.000', '3.000')).toBe('1.500');
  });
});
