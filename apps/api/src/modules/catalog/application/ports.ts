/**
 * Puerto hacia inventario: el catálogo no puede cambiar la unidad ni la composición
 * de algo que ya tiene existencias o movimientos (BR-021, RF-031).
 * En la entrega 2a devuelve siempre `false`; en 2b se implementa con stock_balances y stock_movements.
 */
export interface InventoryUsage {
  hasStockOrMovementsForProduct(productId: string): Promise<boolean>;
  hasStockOrMovementsForPresentation(presentationId: string): Promise<boolean>;
  hasStockOrMovementsForRawMaterial(rawMaterialId: string): Promise<boolean>;
}

export const noInventoryUsage: InventoryUsage = {
  hasStockOrMovementsForProduct: () => Promise.resolve(false),
  hasStockOrMovementsForPresentation: () => Promise.resolve(false),
  hasStockOrMovementsForRawMaterial: () => Promise.resolve(false),
};
