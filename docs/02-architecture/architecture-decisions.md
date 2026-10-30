# Registro de decisiones de arquitectura (ADR)

> Etapa C · v0.1 · 2026-10-29
> Formato breve: contexto → decisión → alternativas → consecuencias.
> **Estados:** `ACCEPTED` = decisión técnica reversible tomada por el equipo (PM §15, decisiones autónomas) · `PROPOSED` = requiere aprobación del responsable por costo, alcance o irreversibilidad.
> Versiones verificadas en el registro npm el **2026-10-29** (versión vigente y fecha de última publicación). Se fijan rangos mayores, no versiones exactas; el lockfile congela lo instalado.

---

## Índice

| ADR     | Tema                                                                        | Estado                      |
| ------- | --------------------------------------------------------------------------- | --------------------------- |
| ADR-001 | Monolito modular                                                            | ACCEPTED                    |
| ADR-002 | Monorepo con pnpm workspaces                                                | ACCEPTED                    |
| ADR-003 | Node.js 24 LTS y TypeScript 6.0                                             | ACCEPTED                    |
| ADR-004 | Express 5                                                                   | ACCEPTED                    |
| ADR-005 | Acceso a datos: Drizzle ORM + migraciones SQL                               | ACCEPTED                    |
| ADR-006 | Validación y contratos: Zod 4 compartido + OpenAPI                          | ACCEPTED                    |
| ADR-007 | Autenticación: Better Auth; autorización propia                             | ACCEPTED                    |
| ADR-008 | Dinero y cantidades: `NUMERIC` + aritmética decimal                         | ACCEPTED                    |
| ADR-009 | Inventario: kardex inmutable + saldos con bloqueo                           | ACCEPTED                    |
| ADR-010 | Idempotencia por clave en escrituras críticas                               | ACCEPTED                    |
| ADR-011 | Outbox transaccional y trabajos en PostgreSQL (pg-boss)                     | ACCEPTED                    |
| ADR-012 | Auditoría append-only protegida en BD                                       | ACCEPTED                    |
| ADR-013 | Roles de base de datos de mínimo privilegio                                 | ACCEPTED                    |
| ADR-014 | Frontend: una SPA con tres "shells" (ERP, POS, Portal)                      | ACCEPTED                    |
| ADR-015 | Complementos IA y Telegram como módulos aislados con feature flags          | ACCEPTED                    |
| ADR-016 | Abstracción de proveedor de IA (AI SDK)                                     | **REEMPLAZADO** por ADR-023 |
| ADR-017 | Telegram con grammY y webhook                                               | ACCEPTED (si se contrata)   |
| ADR-018 | Testing: Vitest + Testcontainers + Playwright                               | ACCEPTED                    |
| ADR-019 | Logging y observabilidad: pino                                              | ACCEPTED                    |
| ADR-020 | Hosting y almacenamiento                                                    | **PROPOSED** (P-12, costo)  |
| ADR-021 | Contabilidad en dos capas                                                   | ACCEPTED (aplica DEC-081)   |
| ADR-022 | Lint y formato: ESLint + Prettier; hooks con lefthook                       | ACCEPTED                    |
| ADR-023 | Asistente sobre Anthropic Managed Agents, configurado como código con `ant` | ACCEPTED (DEC-087)          |

---

## ADR-001 — Monolito modular

- **Contexto:** 6–15 usuarios, un desarrollador o equipo pequeño, presupuesto < $100.000 COP/mes, fuerte necesidad de transacciones entre inventario, dinero y cartera (PM §4.F).
- **Decisión:** un único proceso backend con módulos de dominio separados (`compras`, `produccion`, `inventario`…), cada uno con su capa de dominio, aplicación, infraestructura y HTTP. Una sola base PostgreSQL con un **esquema por módulo**.
- **Alternativas:** microservicios (descartado: transacciones distribuidas, costo de operación y despliegue sin beneficio a esta escala).
- **Consecuencias:** transacciones ACID locales entre módulos; fronteras vigiladas con reglas de importación (dependency-cruiser) para poder separar un módulo en el futuro. Resuelve DEC-P03.

## ADR-002 — Monorepo con pnpm workspaces

- **Decisión:** `apps/web`, `apps/api`, `packages/contracts` (esquemas Zod y tipos compartidos), `packages/config` (tsconfig/eslint). pnpm 12 como gestor. **Sin Turborepo** inicialmente: con dos apps, los scripts de pnpm bastan (PM: "no introducir tecnologías innecesarias").
- **Implementado (Etapa F, 2026-10-29):** pnpm 12 aplica por defecto `minimumReleaseAge` (no instala versiones recién publicadas) y exige aprobar scripts de instalación (`allowBuilds` en `pnpm-workspace.yaml`: solo `esbuild` y `lefthook`). No se agregan excepciones: si una versión es demasiado reciente se fija la anterior (así quedaron `express-rate-limit 8.7.1` y `@scalar/express-api-reference 0.10.31`). La SPA consume `@quatreros/contracts` desde el código fuente (alias de Vite); la API lo consume compilado en producción.
- **Alternativa:** repos separados (descartado: duplicación de contratos y versionado entre front y back).
- **Consecuencias:** un solo PR cambia contrato, API y UI de una funcionalidad vertical. Detalle en Etapa F.

## ADR-003 — Node.js 24 LTS y TypeScript 6.0

- **Contexto:** TypeScript 7.0 (compilador nativo) es la versión `latest` desde julio de 2026, pero `typescript-eslint` 8.72 declara compatibilidad `typescript >=4.8.4 <6.1.0`.
- **Decisión:** **TypeScript `~6.0`** en modo `strict`, hasta que el ecosistema de lint soporte 7.x; **Node.js 24 LTS** (pg-boss 12 exige Node ≥ 22.12).
- **Consecuencias:** revisar migración a TS 7 cuando `typescript-eslint` lo soporte (tarea de mantenimiento, no bloqueante).

## ADR-004 — Express 5

- **Decisión:** Express `^5` (5.3.0, publicada 2026-10-09; requiere Node ≥ 18). Manejo nativo de errores en handlers `async`.
- **Middleware:** `helmet` 8, `express-rate-limit` 8, `pino-http` 11.

## ADR-005 — Acceso a datos: Drizzle ORM + migraciones SQL

- **Contexto:** se necesita SQL explícito (bloqueos `SELECT … FOR UPDATE`, restricciones `CHECK`, transacciones), tipos de TypeScript y migraciones versionadas revisables.
- **Decisión:** **Drizzle ORM `^0.45`** con driver `pg` 8 y **drizzle-kit** para generar migraciones **SQL** que se revisan y se versionan en el repositorio. Restricciones y triggers que el generador no cubra se escriben a mano en la migración.
- **Alternativas:** Prisma (descartado: menos control sobre bloqueos y SQL fino; versión 8 en RC); Kysely (válido, pero sin integración nativa con Better Auth); node-pg-migrate + SQL puro (más trabajo de tipado).
- **Riesgo:** Drizzle sigue en 0.x con 1.0 en RC (2026-10-21). **Mitigación:** el dominio no importa Drizzle; los repositorios encapsulan el acceso, de modo que el cambio a 1.0 o a otra herramienta afecta solo `infrastructure/`.

## ADR-006 — Validación y contratos: Zod 4 + OpenAPI

- **Decisión:** **Zod `^4`** en `packages/contracts`, usado por el frontend (formularios) y por el backend (validación de entrada, que es la que manda). Documentación OpenAPI 3.1 generada con `@asteasolutions/zod-to-openapi` 9 (peer `zod ^4`) y publicada con Scalar en `/api/docs` (solo entornos no productivos o con autenticación).
- **Consecuencias:** un solo esquema por operación; los tipos de la API se infieren, no se duplican.

## ADR-007 — Autenticación: Better Auth; autorización propia

- **Contexto:** Lucia, opción habitual, dejó de mantenerse (última publicación 2025-06). Se requiere correo/contraseña, MFA TOTP y sesiones revocables.
- **Decisión:** **Better Auth `^1.7`** (publicada 2026-10-27) con su adaptador de Drizzle, plugin `two-factor` y montaje en Express (`better-auth/node`). Sesiones en base de datos con cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- **Autorización (RBAC + sede + aprobaciones):** **implementación propia** en el módulo `admin`, porque las reglas (alcances `ALL/SITE/OWN`, umbrales, segregación) son de negocio.
- **Alternativas:** Passport + implementación propia de sesiones y TOTP (más superficie de errores de seguridad).

## ADR-008 — Dinero y cantidades

- **Decisión:** dinero en `NUMERIC(14,2)` (COP; los decimales cubren costos unitarios prorrateados); cantidades en `NUMERIC(14,3)`; costos unitarios en `NUMERIC(14,4)`. En TypeScript se transportan como **cadenas** en la API y se operan con `decimal.js` en el dominio. Nunca `number` para montos. Resuelve DEC-P22.
- **Redondeo:** reglas de redondeo de valores totales → PENDING con el contador (P-02/P-03); por defecto medio hacia arriba a 0 decimales para precios de venta.

## ADR-009 — Kardex inmutable + saldos con bloqueo de fila

- **Decisión:** `inventory.stock_movements` es append-only (fuente de verdad). `inventory.stock_balances` (producto/MP, presentación, lote, ubicación) es una **proyección** actualizada en la **misma transacción** que el movimiento, con `SELECT … FOR UPDATE` sobre las filas de saldo afectadas y `CHECK (quantity >= 0)` (BR-081, sujeto a Q-B-08: si se rechazara, el `CHECK` se reemplaza por una política configurable).
- **Concurrencia:** los saldos se bloquean en orden determinista (por id) para evitar interbloqueos. Conciliación nocturna saldo vs. suma de movimientos con alerta si difieren.
- **Consecuencias:** consultas de existencias O(1); trazabilidad completa. Resuelve DEC-P21.

## ADR-010 — Idempotencia

- **Decisión:** toda petición de escritura con efecto en inventario, dinero o cartera exige cabecera `Idempotency-Key` (UUID generado por el cliente por intento lógico). Tabla `platform.idempotency_keys` (clave, usuario, ruta, hash del cuerpo, estado, respuesta, expiración 24 h). Misma clave + mismo cuerpo → respuesta guardada; mismo clave + cuerpo distinto → 422. Resuelve DEC-P23, BR-007.

## ADR-011 — Outbox transaccional y trabajos en PostgreSQL

- **Decisión:** los hechos económicos (`accounting.economic_events`) y eventos de integración (`platform.outbox`) se insertan **en la misma transacción** que la operación. Un trabajador en el mismo proceso los procesa con **pg-boss `^12`** (colas sobre PostgreSQL con `SKIP LOCKED`): notificaciones de Telegram, alertas, contabilización (cuando se desbloquee), conciliación nocturna, limpieza de claves.
- **Alternativas:** Redis + BullMQ (descartado: servicio adicional y costo).
- **Consecuencias:** sin pérdida de eventos si falla una integración; reintentos con espera exponencial.

## ADR-012 — Auditoría append-only

- **Decisión:** `audit.audit_log` se escribe desde la capa de aplicación (con contexto de usuario, canal y motivo) dentro de la transacción de la operación. El rol de la aplicación solo tiene `INSERT` y `SELECT` sobre la tabla; un trigger rechaza `UPDATE`/`DELETE`. Particionado mensual cuando el volumen lo justifique.
- **Consecuencias:** la auditoría no puede alterarse desde la aplicación (RNF-090).

## ADR-013 — Roles de base de datos

- **Decisión:** `quatreros_owner` (dueño de esquemas, solo migraciones en CI/CD), `quatreros_app` (DML sobre tablas operativas, sin DDL, sin `UPDATE/DELETE` en auditoría, kardex ni hechos económicos), `quatreros_readonly` (respaldos y soporte). Nunca superusuario en la aplicación. **La IA no tiene rol de base de datos** (RNF-009).

## ADR-014 — Frontend: una SPA con tres shells

- **Decisión:** **React 19 + Vite 8 + Tailwind CSS 4 + React Router 8 + TanStack Query 5**. Una sola aplicación con tres "shells" cargados por ruta y división de código: `/erp` (escritorio/tableta), `/pos` (táctil, venta rápida), `/ruta` (portal móvil del distribuidor). Organización `src/features/<modulo>/`.
- **Alternativas:** tres aplicaciones separadas (más configuración y despliegues sin beneficio a esta escala).
- **Consecuencias:** el usuario entra al shell según su rol; los componentes de dominio se comparten.

## ADR-015 — Complementos IA y Telegram aislados

- **Decisión:** módulos `assistant` y `telegram` en el mismo proceso, **sin que ningún módulo del núcleo los importe**. Interactúan con el núcleo solo a través de un **catálogo de herramientas** (`ToolGateway`) que invoca los mismos casos de uso de la capa de aplicación con el contexto del usuario. Activación por `platform.addon_settings`; con el complemento apagado sus rutas responden 404 y sus trabajos no se programan.
- **Consecuencias:** pueden extraerse a otro proceso más adelante sin tocar el núcleo (PM §4.A–D).

## ADR-016 — Abstracción del proveedor de IA (REEMPLAZADO por ADR-023)

> 2026-10-30: el responsable entregó el agente Quatreros AI sobre Anthropic Managed Agents (DEC-087). Este ADR queda como antecedente; la independencia del núcleo frente al proveedor se conserva por el `ToolGateway` (ADR-015), no por una capa de abstracción de modelos.

- **Decisión propuesta:** **AI SDK (`ai` v7)** como capa de abstracción para llamadas con herramientas, con proveedores intercambiables (p. ej. OpenRouter vía `@openrouter/ai-sdk-provider` 3, o un proveedor directo). El modelo se elige tras el **benchmark** de la Etapa D (DEC-P13).
- **Pendiente de aprobación:** costo del proveedor (P-14).

## ADR-017 — Telegram con grammY

- **Decisión:** **grammY `^1.46`** en modo webhook sobre la misma API (ruta `/integrations/telegram/webhook/:secret`), con verificación de `X-Telegram-Bot-Api-Secret-Token` e idempotencia por `update_id`.

## ADR-018 — Testing

- **Decisión:** **Vitest `^5`** (unitarias e integración); **Testcontainers `^12`** con PostgreSQL real para pruebas de integración (las reglas transaccionales no se prueban contra mocks); **Playwright `^1.64`** para E2E de flujos críticos (venta POS, entrega parcial, cierre de caja). PGlite (`@electric-sql/pglite`) solo para validaciones rápidas de SQL en desarrollo.
- **Implementado (Etapa F):** tres modos de base para integración: `TEST_DATABASE_URL` (+ `TEST_DATABASE_MIGRATIONS_URL` para migrar con el rol dueño y probar con el rol de aplicación, validando permisos), Testcontainers por defecto, y `TEST_DB=pglite` (PGlite con servidor de red) para equipos sin Docker — este último no sirve para pruebas de concurrencia. CI usa un _service container_ PostgreSQL 17 con roles separados.

## ADR-019 — Logging y observabilidad

- **Decisión:** **pino `^10`** + `pino-http`, JSON con `requestId`, `userId`, `siteId`; redacción de cabeceras de autenticación, contraseñas y tokens. Endpoint `/health` (vida) y `/ready` (BD). Seguimiento de errores con un servicio de plan gratuito (a elegir en Etapa F) y monitor de disponibilidad externo gratuito.

## ADR-020 — Hosting y almacenamiento (PROPOSED — requiere aprobación, P-12)

Tasa de referencia: **≈ $3.150 COP/USD** (dólar del 28-oct-2026 según [Infobae](https://www.infobae.com/colombia/2026/10/28/dolar-hoy-en-colombia-cotizacion-de-apertura-del-28-de-octubre/)). Techo del núcleo: **$100.000 COP ≈ USD 31,7/mes**.

| Opción                      | Componentes                                                                                   | Costo estimado/mes                   | Respaldo                                      | Operación                                                   | Fuente de precios                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A. Render (recomendada)** | Web Service Starter (API + SPA estática) USD 7 + Postgres Basic-256mb USD 6 + 5 GB a USD 0,30 | **≈ USD 15 ≈ $47.000 COP**           | PITR incluido: 3 días (Hobby)                 | Mínima: PaaS gestionado                                     | [jwatte.com, ago-2026](https://jwatte.com/blog/render-com-platform-review/)                       |
| B. Railway                  | Plan Hobby USD 5 (crédito de uso) + consumo API + Postgres                                    | **≈ USD 15–30 ≈ $47.000–95.000 COP** | Respaldos cobrados por almacenamiento         | Mínima                                                      | [servercompass, mar-2026](https://servercompass.app/blog/railway-pricing-what-youll-actually-pay) |
| C. VPS Hetzner              | CX22 (2 vCPU, 4 GB) USD 5,60 + respaldos del proveedor + Docker Compose con PostgreSQL propio | **≈ USD 7–10 ≈ $22.000–32.000 COP**  | Propio (pg_dump/WAL a almacenamiento externo) | **Alta**: parches, seguridad y respaldos a cargo del equipo | [cloudpricecheck, oct-2026](https://cloudpricecheck-com.pages.dev/hetzner/cloud-servers-pricing)  |

**Complementos comunes a todas las opciones:**

- Archivos privados y copia externa de respaldos: **Cloudflare R2**, 10 GB-mes gratis y sin costo de egreso; luego USD 0,015/GB-mes ([Filebase, 2026](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/)).
- Dominio y correo transaccional: aparte (Q-INF-02b).

**Recomendación:** opción **A** por tener PITR incluido, costo ≈ 47 % del techo y operación mínima para un equipo pequeño. Mitigaciones de sus límites: el plan Hobby incluye solo **5 GB de egreso** (suficiente para 15 usuarios con SPA comprimida, pero se monitorea) y PITR de 3 días se complementa con **copia diaria externa a R2** (RNF-043/044). Todo se empaqueta en **Docker** para poder mudarse a B o C sin rediseño.

- **Descartado:** Neon plan gratuito (1 GB y bloqueo de escrituras al superarlo; historial 6 h), insuficiente para datos contables.
- **Requiere:** aprobación del responsable y **verificación de precios al momento de contratar** (los precios citados son de fuentes de terceros con fecha).

## ADR-021 — Contabilidad en dos capas

- **Decisión:** el esquema `accounting` incluye desde el inicio `economic_events` (capa de hechos) y la estructura genérica `accounts / vouchers / journal_entries / journal_lines / periods` (capa a). Las **reglas de contabilización** (capa b) se implementan como una tabla de mapeo + servicio `PostingService` que permanece **deshabilitado** hasta P-01..P-04. Aplica DEC-081.
- **Migraciones:** la estructura genérica se crea; **no** se crean migraciones de reglas, impuestos ni plan de cuentas (PM §8.4).

## ADR-022 — Lint, formato y hooks

- **Decisión:** **ESLint 10 + typescript-eslint 8** (reglas de tipos) y **Prettier 3**; **dependency-cruiser** para fronteras entre módulos; **lefthook** para ejecutar lint y pruebas rápidas antes de commit (más liviano que husky + lint-staged). Biome se evaluó pero su chequeo de tipos es menor que typescript-eslint.

## ADR-023 — Asistente sobre Anthropic Managed Agents, configurado como código

- **Contexto:** el agente **Quatreros AI** ya existe en Anthropic Console y fue exportado a `quatreros-ai/` (agente, entorno y `claude-lock.json`). DEC-087 lo adopta como el asistente oficial.
- **Decisión:**
  1. El backend Express usa la API de Managed Agents con el SDK oficial `@anthropic-ai/sdk` (`client.beta.sessions`, encabezado beta `managed-agents-2026-04-01`, que el SDK agrega solo). Usa sesiones (`/v1/sessions`), eventos (`/v1/sessions/{id}/events`) y el flujo SSE (`/events/stream`).
  2. Las herramientas de negocio se declaran en el agente como herramientas **`custom`**. Claude solo **solicita** la ejecución (`agent.custom_tool_use`). El backend la resuelve contra el `ToolGateway`, con la identidad y los permisos del empleado dueño de la sesión, y devuelve `user.custom_tool_result`.
  3. El conjunto de herramientas integrado (`agent_toolset_20260401`) queda **apagado** (`default_config.enabled: false`). El entorno es `cloud` con red `limited` y sin hosts permitidos. El agente no puede ejecutar comandos ni conectarse al backend ni a la base de datos.
  4. La configuración del agente se versiona en `quatreros-ai/` y se sincroniza con `ant apply` desde esa carpeta. `git push` no actualiza el agente y `ant apply` no despliega el backend.
- **Consecuencias:**
  - Proveedor único (Anthropic). La dependencia queda contenida en `src/addons/assistant/infrastructure/anthropic/`; el núcleo no la ve (dependency-cruiser).
  - El costo incluye tokens **y** tiempo de ejecución de la sesión (`usage.active_seconds`); se mide con `session.usage` y `usage.list_cost` (ai-architecture §6).
  - Managed Agents está en beta y no es elegible para Zero Data Retention (riesgos R-IA-08..12).
- **Alternativas descartadas:** AI SDK con proveedores intercambiables (ADR-016) y orquestadores de terceros (Hermes, CrewAI, Mastra), por DEC-087.
