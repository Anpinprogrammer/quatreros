import type { Router } from 'express';
import type { AppDeps } from '../app.js';
import { adminRouter } from './admin/http/router.js';

/**
 * Registro de módulos verticales (ADR-001, module-boundaries.md).
 *
 * Cada módulo vive en `modules/<modulo>/` con esta estructura:
 *   domain/          entidades y reglas BR puras (sin E/S)
 *   application/     casos de uso + public.ts (API pública para otros módulos y el ToolGateway)
 *   infrastructure/  repositorios Drizzle y schema.ts del esquema de BD del módulo
 *   http/            router Express, validación con contratos Zod
 */
export function registerModules(api: Router, deps: AppDeps): void {
  if (!deps.db || !deps.provisioner) return;
  api.use(adminRouter({ db: deps.db, provisioner: deps.provisioner, idempotency: deps.idempotency }));
}
