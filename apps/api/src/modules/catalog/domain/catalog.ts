import type { ProductKind } from '@quatreros/contracts';

/**
 * Reglas puras del catálogo (BR-020..025, DEC-090). Sin E/S.
 * La aplicación traduce estos resultados a errores HTTP estables.
 */

/** Un producto fabricado siempre declara vida útil; uno preparado no la lleva (DEC-090). */
export function shelfLifeIsValid(kind: ProductKind, shelfLifeDays: number | null | undefined): boolean {
  if (kind === 'manufactured') return shelfLifeDays != null && shelfLifeDays > 0;
  return shelfLifeDays == null;
}

/** BR-021 (PROVISIONAL): la composición de un paquete no cambia si ya tiene existencias o movimientos. */
export function canChangeComposition(hasStockOrMovements: boolean): boolean {
  return !hasStockOrMovements;
}

/** RF-031 y BR-021: la unidad no cambia si ya hay existencias o movimientos. */
export function canChangeUnit(hasStockOrMovements: boolean): boolean {
  return !hasStockOrMovements;
}

export type PriceEligibility = 'ok' | 'product_inactive' | 'presentation_inactive';

/** RF-032: solo se fija precio sobre un producto y una presentación activos. */
export function priceEligibility(productActive: boolean, presentationActive: boolean): PriceEligibility {
  if (!productActive) return 'product_inactive';
  if (!presentationActive) return 'presentation_inactive';
  return 'ok';
}

/**
 * Un cambio de precio cierra la vigencia anterior y abre la nueva en el mismo instante.
 * El histórico nunca se edita: solo se cierra su `valid_to` una vez.
 * Si el precio anterior se abrió en este mismo instante, la nueva vigencia arranca 1 ms después
 * para que `valid_to > valid_from` siempre se cumpla y no haya dos precios vigentes.
 */
export function priceChangeAt(
  now: Date,
  previousValidFrom?: Date | null,
): { closedAt: Date; openedAt: Date } {
  const openedAt =
    previousValidFrom && previousValidFrom.getTime() >= now.getTime()
      ? new Date(previousValidFrom.getTime() + 1)
      : now;
  return { closedAt: openedAt, openedAt };
}
