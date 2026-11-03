import type { Router } from 'express';
import type { AppDeps } from '../app.js';
import { accountingRouter } from './accounting/http/router.js';
import { adminRouter } from './admin/http/router.js';
import type { InventoryUsage } from './catalog/application/ports.js';
import { catalogRouter } from './catalog/http/router.js';
import { inventoryRouter } from './inventory/http/router.js';
import { distributionRouter } from './distribution/http/router.js';
import { financeRouter } from './finance/http/router.js';
import { productionRouter } from './production/http/router.js';
import { posRouter } from './pos/http/router.js';
import { purchasingRouter } from './purchasing/http/router.js';
import { salesRouter } from './sales/http/router.js';
import { SqlInventoryUsage } from './inventory/infrastructure/repository.js';

/**
 * Registro de módulos verticales (ADR-001, module-boundaries.md).
 *
 * Cada módulo vive en `modules/<modulo>/` con esta estructura:
 *   domain/          entidades y reglas BR puras (sin E/S)
 *   application/     casos de uso + public.ts (API pública para otros módulos y el ToolGateway)
 *   infrastructure/  repositorios Drizzle y schema.ts del esquema de BD del módulo
 *   http/            router Express, validación con contratos Zod
 */
export interface ModuleOverrides {
  /** Pruebas de la entrega 2a: simulan que ya hay existencias o movimientos. */
  inventoryUsage?: InventoryUsage;
}

export function registerModules(api: Router, deps: AppDeps, overrides: ModuleOverrides = {}): void {
  if (!deps.db || !deps.provisioner) return;
  api.use(adminRouter({ db: deps.db, provisioner: deps.provisioner, idempotency: deps.idempotency }));
  const inventoryUsage = overrides.inventoryUsage ?? new SqlInventoryUsage(deps.db);
  api.use(
    catalogRouter({
      db: deps.db,
      idempotency: deps.idempotency,
      inventoryUsage,
    }),
  );
  api.use(inventoryRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(purchasingRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(productionRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(salesRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(distributionRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(posRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(financeRouter({ db: deps.db, idempotency: deps.idempotency }));
  api.use(accountingRouter({ db: deps.db }));
}
