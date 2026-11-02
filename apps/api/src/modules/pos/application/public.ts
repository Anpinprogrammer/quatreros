/**
 * API pública del módulo caja para el ToolGateway y otros módulos (module-boundaries §2).
 * Las lecturas quedan listas para envolverse como herramientas de IA.
 */
export { getSale, getShift, listPosCatalog } from './pos.js';
export type { PosDeps } from './pos.js';
