import { Decimal } from 'decimal.js';

/** Consumo teórico de un ingrediente para la cantidad planificada (BR-063). */
export function theoreticalQuantity(lineQuantity: string, baseOutputQty: string, plannedQty: string): string {
  return new Decimal(lineQuantity).times(plannedQty).div(baseOutputQty).toFixed(3);
}

/** Rendimiento real / planificado en porcentaje (BR-065). */
export function productionYield(actualQty: string, plannedQty: string): string {
  return new Decimal(actualQty).div(plannedQty).times(100).toDecimalPlaces(2).toFixed(2);
}

/** Verdadero si el rendimiento se aleja del esperado más allá de la tolerancia (BR-066). */
export function yieldOutOfTolerance(
  yieldPct: string,
  expectedYieldPct: string,
  tolerancePct: string,
): boolean {
  return new Decimal(yieldPct).minus(expectedYieldPct).abs().gt(tolerancePct);
}

/**
 * Reparte el teórico de una materia prima entre varios lotes, proporcional al consumo real.
 * La última línea recibe el remanente para que la suma no se desvíe por redondeo.
 */
export function proportionalTheoretical(
  totalTheoretical: string,
  actualLines: string[],
  index: number,
  alreadyAssigned: string,
): string {
  const totalActual = actualLines.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (totalActual.lte(0)) return '0.000';
  const total = new Decimal(totalTheoretical);
  const isLast = index === actualLines.length - 1;
  if (isLast) return Decimal.max(total.minus(alreadyAssigned), 0).toFixed(3);
  return total
    .times(actualLines[index] ?? 0)
    .div(totalActual)
    .toDecimalPlaces(3)
    .toFixed(3);
}
