import type { Router } from 'express';
import type { AppDeps } from '../app.js';

/**
 * Registro de módulos verticales (ADR-001, module-boundaries.md).
 *
 * Cada módulo vive en `modules/<modulo>/` con esta estructura:
 *   domain/          entidades y reglas BR puras (sin E/S)
 *   application/     casos de uso + public.ts (API pública para otros módulos y el ToolGateway)
 *   infrastructure/  repositorios Drizzle y schema.ts del esquema de BD del módulo
 *   http/            router Express, validación con contratos Zod
 *
 * Al construir una funcionalidad vertical, se monta su router aquí, p. ej.:
 *   api.use('/inventory', inventoryRouter(deps));
 *
 * Todavía no hay módulos de negocio: se construyen uno por uno según el roadmap aprobado.
 */
export function registerModules(_api: Router, _deps: AppDeps): void {
  // Sin módulos de negocio todavía (Etapa F: solo base técnica).
}
