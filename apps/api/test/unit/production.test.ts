import { describe, expect, it } from 'vitest';
import {
  productionYield,
  proportionalTheoretical,
  theoreticalQuantity,
  yieldOutOfTolerance,
} from '../../src/modules/production/domain/production.js';

describe('consumo teórico (BR-063)', () => {
  it('escala el ingrediente por la cantidad planificada', () => {
    expect(theoreticalQuantity('10.000', '100.000', '100.000')).toBe('10.000');
    expect(theoreticalQuantity('10.000', '100.000', '250.000')).toBe('25.000');
    expect(theoreticalQuantity('0.500', '100.000', '50.000')).toBe('0.250');
  });

  it('reparte el teórico entre lotes según el consumo real', () => {
    expect(proportionalTheoretical('10.000', ['6.000', '4.000'], 0, '0')).toBe('6.000');
    expect(proportionalTheoretical('10.000', ['6.000', '4.000'], 1, '6.000')).toBe('4.000');
  });
});

describe('rendimiento (BR-065, DEC-096)', () => {
  it('calcula real / planificado en porcentaje', () => {
    expect(productionYield('488.000', '500.000')).toBe('97.60');
    expect(productionYield('100.000', '100.000')).toBe('100.00');
    expect(productionYield('110.000', '100.000')).toBe('110.00');
  });

  it('marca fuera de tolerancia solo cuando supera el margen', () => {
    expect(yieldOutOfTolerance('100.00', '98.00', '3.00')).toBe(false);
    expect(yieldOutOfTolerance('90.00', '98.00', '3.00')).toBe(true);
    expect(yieldOutOfTolerance('101.01', '98.00', '3.00')).toBe(true);
  });
});
