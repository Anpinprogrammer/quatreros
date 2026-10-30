/**
 * API pública del módulo admin para otros módulos y el ToolGateway (module-boundaries §2).
 * Otros módulos importan SOLO desde aquí.
 */
export { authorize, isAuthUserBlocked, listFilter, loadActor, requireActor } from './authz.js';
export type { AccessTarget, ScopeFilter } from '../domain/access.js';
