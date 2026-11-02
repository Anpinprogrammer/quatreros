/**
 * API pública del módulo inventario para otros módulos y el ToolGateway (module-boundaries §2).
 * Las lecturas quedan listas para envolverse como herramientas de IA.
 */
export {
  getInventorySummary,
  getLot,
  listAvailability,
  listLots,
  listMovements,
  listStockBalances,
  traceLot,
} from './inventory.js';
export type { InventoryDeps } from './inventory.js';
export { createTransfer, getTransfer, listTransfers, receiveTransfer, simulateFefo } from './transfers.js';
