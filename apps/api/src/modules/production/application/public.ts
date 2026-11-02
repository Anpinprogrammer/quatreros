/**
 * API pública del módulo de producción para otros módulos y el ToolGateway.
 * Otros módulos importan SOLO desde aquí.
 */
export { closeOrder, consumeOrder, createOrder, getOrder, listOrders, previewOrder } from './production.js';
export type { ProductionDeps } from './production.js';
