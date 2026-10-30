---
name: 'quatreros-entrega'
description: 'Usar al construir una entrega vertical del prototipo de Quatreros (roadmap-prototipo.md): de la especificación al PR con CI en verde, incluida la verificación visual y de accesibilidad.'
---

# Construir una entrega vertical de Quatreros

Una entrega = una funcionalidad completa y mostrable (ver `docs/03-planning/roadmap-prototipo.md`). Antes de empezar, leer `quatreros-conventions` y `docs/HANDOFF.md`.

## 0. Preparar

1. Confirmar en `roadmap-prototipo.md` qué RF cubre la entrega y de qué decisiones depende (matriz de trazabilidad).
2. Listar lo BLOCKED (P-xx) y lo PROVISIONAL (Q-B, DEC-083) que toca. Lo bloqueado no se implementa: queda detrás de `requireFeature(...)` y se muestra como "Espera decisión" en la UI.
3. Rama `feat/<alcance>-<descripcion>` desde `main`.

## 1. Especificación (skill `quatreros-sdd-spec`)

`docs/04-specifications/<modulo>/<feature>.md` con RF/BR, modelo de datos, contrato de API, pantallas y estados, auditoría, criterios Gherkin y pruebas. Ejemplo de referencia: `docs/04-specifications/adm/acceso-usuarios.md`. Si aparece una regla sin origen → pregunta en `open-questions.md`, no supuesto.

## 2. Backend (orden)

1. Contratos Zod en `packages/contracts/src/<modulo>.ts` (+ export en `index.ts`); dinero y cantidades como cadenas decimales.
2. Esquema Drizzle en `apps/api/src/modules/<modulo>/infrastructure/schema.ts` (esquema de BD propio del módulo); agregarlo a `platform/db/schema/index.ts` y a `schemaFilter` de `drizzle.config.ts`.
3. `pnpm db:generate` → revisar el SQL. Permisos/triggers con migración `--custom` (ver `0003_admin_grants`). Nunca editar migraciones ya publicadas.
4. Dominio puro (`domain/`) → casos de uso (`application/`, con `requireActor`/`authorize`/`listFilter` de `modules/admin/application/authz.ts`) → repositorio → router (`http/`). Escrituras de inventario/dinero: transacción + `requireIdempotency` + auditoría.
5. Permisos nuevos en `modules/admin/domain/permission-catalog.ts` (y roles que los tienen, según `docs/01-requirements/actors-permissions.md`).
6. Semilla demo del módulo (datos ficticios realistas) en su `infrastructure/seed.ts`, llamada desde `src/cli/seed-demo.ts`.

## 3. Frontend

1. `apps/web/src/features/<modulo>/` (api.ts con TanStack Query + páginas).
2. Solo componentes de `shared/ui/` y tokens del sistema de diseño (DEC-086). Estados: carga, vacío, error, sin permiso.
3. Registrar la ruta en el shell (`shells/erp/ErpShell.tsx`, `pos`, `ruta`) y marcar el módulo `available` en `shared/modules.ts`; si alimenta una tarjeta del Command Center, reemplazar su estado vacío por datos reales.
4. `useDocumentTitle` en cada pantalla; foco al abrir formularios y tras errores; acciones con nombre accesible.

## 4. Pruebas (mínimo por caso de uso de escritura)

- Unitarias de dominio (Vitest).
- Integración con PostgreSQL real (`apps/api/test/integration/`): éxito, validación 422, permiso 403, sede ajena 404, duplicado (misma Idempotency-Key), concurrencia si aplica. Correr con `TEST_DB=pglite` y, si hay PostgreSQL, con `TEST_DATABASE_URL`.
- E2E del flujo principal en `apps/web/e2e/` y cada pantalla nueva en `accesibilidad.spec.ts`.

## 5. Verificar (no declarar terminado sin esto)

```bash
pnpm check                         # formato, lint, fronteras, tipos, unitarias
TEST_DB=pglite pnpm test:integration
pnpm build && pnpm db:reset:demo   # requiere PG_ADMIN_URL y DEMO_PASSWORD
pnpm test:e2e                      # incluye axe y capturas (reporte HTML)
```

Revisar las capturas del reporte de Playwright en escritorio, tableta y celular.

## 6. Cerrar

1. `docs/PROJECT-STATUS.md`, `roadmap-prototipo.md` (estado de la entrega), matriz de trazabilidad (RF implementados) y `docs/operations/demo-local.md` (guion de la demo).
2. Commit convencional en español, push, PR con IDs y pruebas ejecutadas; esperar CI en verde.
3. Actualizar `docs/HANDOFF.md` (qué quedó, qué sigue). La fusión a `main` la aprueba el responsable.
