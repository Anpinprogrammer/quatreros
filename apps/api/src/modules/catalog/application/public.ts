/**
 * API pública del módulo catálogo para otros módulos y el ToolGateway (module-boundaries §2).
 * Otros módulos importan SOLO desde aquí. Las lecturas quedan listas para envolverse como herramientas de IA.
 */
export { getProduct, listProducts, listRawMaterials } from './catalog.js';
export type { CatalogDeps } from './catalog.js';
export type { InventoryUsage } from './ports.js';
export {
  createRecipe,
  createRecipeVersion,
  getRecipe,
  listRecipes,
  loadCurrentProductionRecipe,
  loadProductionRecipeVersion,
} from './recipes.js';
export type { ProductionRecipe, RecipeDeps } from './recipes.js';
