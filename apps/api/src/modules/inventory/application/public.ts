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
export { recordMovement } from './movements.js';
export { createRawMaterialLot } from './receipts.js';
export type { RawMaterialLotInput, RawMaterialLotResult } from './receipts.js';
export { businessToday } from '../domain/inventory.js';
export { createFinishedGoodLot } from './receipts.js';
export type {
  FinishedGoodInput,
  FinishedGoodLotInput,
  FinishedGoodLotResult,
  FinishedGoodOutput,
} from './receipts.js';
export {
  activeReservationsForOrders,
  consumeReservations,
  consumeReservationsForOrders,
  reserveOrderLine,
} from './reservations.js';
export type { ActiveReservation, ReservationInput, ReservationResult } from './reservations.js';
