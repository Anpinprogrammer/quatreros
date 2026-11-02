/**
 * API pública del módulo de compras para otros módulos y el ToolGateway.
 * Otros módulos importan SOLO desde aquí. Las lecturas quedan listas para herramientas de IA.
 */
export {
  createPurchase,
  createSupplier,
  getPurchase,
  listPurchases,
  listSuppliers,
  receivePurchase,
  updateSupplier,
} from './purchasing.js';
export type { PurchasingDeps } from './purchasing.js';
