# AGENTS.md — Guía para agentes que continúan Quatreros

Quatreros es un ERP a medida para una productora de alimentos de Cali (chorizos y rellenas): compras, producción por lotes, inventario con FEFO, pedidos y reparto, punto de venta (POS), cartera y contabilidad, con IA y Telegram opcionales. Se construye por **Spec-Driven Development** y hoy está en **modo prototipo** (DEC-083): 8 entregas verticales demostrables, una a la vez.

## 1. Lee primero (en este orden)

1. [`docs/HANDOFF.md`](docs/HANDOFF.md): qué está hecho, **cuál es la siguiente tarea** y qué espera respuesta del responsable.
2. [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) y [`docs/03-planning/roadmap-prototipo.md`](docs/03-planning/roadmap-prototipo.md).
3. Procedimientos del proyecto en [`.claude/skills/`](.claude/skills/). Son Markdown legibles por cualquier agente; Claude Code los carga solo:
   - `quatreros-conventions`: reglas no negociables, stack, nombres, diseño y commits.
   - `quatreros-entrega`: cómo construir una entrega de la especificación al PR, verificación incluida.
   - `quatreros-sdd-spec`: plantillas de RF, BR, RNF y especificación de funcionalidad.
   - `quatreros-decision-log`: cómo registrar una respuesta o aprobación del responsable.
4. Fuentes de verdad del negocio:
   - [`docs/Quatreros_Documento_Maestro_v1.0.pdf`](docs/Quatreros_Documento_Maestro_v1.0.pdf)
   - [`decision-register.md`](docs/00-discovery/decision-register.md)
   - [`open-questions.md`](docs/00-discovery/open-questions.md)
   - [`domain-glossary.md`](docs/00-discovery/domain-glossary.md)
   - [`traceability-matrix.md`](docs/00-discovery/traceability-matrix.md)
5. Diseño visual: [`docs/05-design/sistema-de-diseno.md`](docs/05-design/sistema-de-diseno.md) (DEC-086), la **única** base visual permitida.

## 2. Reglas que no se rompen

- **No inventar reglas de negocio.** Sin origen en el Documento Maestro o en una `DEC-###` (CONFIRMED o PROVISIONAL), la regla no se implementa: se agrega una pregunta en `open-questions.md`.
- **Lo bloqueado no se implementa.** Contabilización e impuestos (P-01..P-04), apertura de paquetes (P-06), mermas de cocina (P-07), liquidación de repartidores (P-08) y escrituras de la IA (P-10) quedan detrás de `requireFeature(...)` (`423 FEATURE_BLOCKED`) y en la UI aparecen como "Espera decisión".
- **El servidor manda.** Permisos (RBAC con alcance ALL/SITE/OWN), sede, aprobaciones, validación y auditoría viven en el caso de uso. La UI solo oculta.
- **Inventario y dinero.** Solo cambian con movimientos inmutables, en transacción, con `Idempotency-Key` y auditoría. Los montos van en `NUMERIC` o en cadenas decimales, nunca en `float`.
- **Interfaz:** se usan solo los tokens y componentes del sistema de diseño (`apps/web/src/shared/ui/`). Cada pantalla nueva se agrega a `apps/web/e2e/accesibilidad.spec.ts` (WCAG 2.1 AA).
- **Quatreros AI (`quatreros-ai/`)** es la configuración del agente de Anthropic Managed Agents (DEC-087, ADR-023):
  - **No ejecutes `ant apply`** ni crees recursos remotos sin autorización explícita del responsable.
  - **No edites ni borres `claude-lock.json`.**
  - No cambies el prompt ni el modelo sin justificarlo en el PR.
  - Una herramienta nueva del agente se declara **después** de desplegar su manejador en el backend.
  - `git push` no actualiza el agente.
- **Secretos:** nunca van en el repositorio. Las variables se documentan en `.env.example` sin valores reales.
- **Lo que decide el responsable, lo aprueba él:** fusionar a `main`, los PRs de Dependabot, las decisiones `PROPOSED`, el hosting, `ant apply` del agente y cualquier cosa irreversible.
- **No declarar terminado sin verificar.** Ver la sección 5.

## 3. Puesta en marcha

Requisitos: Node 22.12+ (24 recomendado, `.nvmrc`), pnpm 12 vía Corepack y PostgreSQL 15+ (17 recomendado).

```bash
corepack enable && pnpm install
cp .env.example .env               # BETTER_AUTH_SECRET: openssl rand -base64 32
```

**Base de datos con Docker:** `docker compose up -d` (PostgreSQL 17 con roles).
**Sin Docker:** sirve cualquier PostgreSQL al que tengas acceso como superusuario.

Con cualquiera de los dos, esto recrea desde cero la base demo (roles, migraciones y 7 usuarios ficticios):

```bash
export PG_ADMIN_URL=postgres://postgres:postgres_local_dev@localhost:5432/postgres   # tu superusuario
export DEMO_PASSWORD="<inventa una de 12+ caracteres>"
pnpm db:reset:demo                 # infrastructure/scripts/reset-demo-db.sh (se niega en staging/producción)
pnpm dev                           # API :3000 + web :5173
```

Usuarios demo y guion de demostración: [`docs/operations/demo-local.md`](docs/operations/demo-local.md). La documentación de la API está en `http://localhost:3000/api/docs`.

## 4. Mapa del código

```
apps/api/src/
  platform/      auth (Better Auth + TOTP), http (actor, mfaGate, errores, Origin), idempotency, audit, flags, db
  modules/<m>/   domain · application (casos de uso; public.ts = API del módulo) · infrastructure (schema Drizzle, repos, seed) · http
  cli/           migrate, seed, seed-demo
apps/api/drizzle/          migraciones SQL versionadas (nunca editar las publicadas)
apps/api/test/             unit/ e integration/ (PostgreSQL real o PGlite)
apps/web/src/
  shells/        erp (encabezado + pestañas por sección + Command Center), pos, ruta
  features/<m>/  pantallas por módulo (acceso, usuarios…)
  shared/        ui (Button, Card, Badge, TextField…), auth (sesión, RequireSession), api (cliente), modules.ts (secciones y estado de módulos)
apps/web/e2e/              Playwright: flujos + accesibilidad (axe) con capturas
packages/contracts/        esquemas Zod compartidos API ↔ web
quatreros-ai/              agente Quatreros AI (Managed Agents) gestionado con `ant`: agents/, environments/, claude-lock.json
infrastructure/            Dockerfile, init de PostgreSQL, roles, respaldo/restauración, reset-demo-db.sh
docs/                      00 descubrimiento · 01 requerimientos · 02 arquitectura · 03 planeación · 04 especificaciones · 05 diseño · operations
```

El módulo de referencia, terminado de punta a punta, es `modules/admin` (usuarios, roles, sedes y permisos), con su especificación en `docs/04-specifications/adm/acceso-usuarios.md`. Para un módulo nuevo, copia su forma.

## 5. Verificación (la misma que corre CI)

```bash
pnpm check                          # formato, ESLint, fronteras de módulos, tipos, unitarias
TEST_DB=pglite pnpm test:integration                  # sin Docker
TEST_DATABASE_URL=... TEST_DATABASE_MIGRATIONS_URL=... pnpm test:integration   # PostgreSQL real, base VACÍA
pnpm build && pnpm db:reset:demo && pnpm test:e2e     # sistema completo + axe + capturas
```

CI (`.github/workflows/ci.yml`) corre todo esto, más gitleaks, `pnpm audit` y la imagen Docker, y siempre publica el reporte de Playwright con las capturas.

## 6. Trampas conocidas (ya nos costaron tiempo)

| Síntoma                                                         | Causa y solución                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MINIMUM_RELEASE_AGE_VIOLATION` al instalar                     | pnpm 12 rechaza versiones recién publicadas. Fija una versión anterior; **no agregues excepciones**.                                                                                                                                                          |
| `ERR_PNPM_IGNORED_BUILDS`                                       | Los scripts de instalación solo se permiten en `allowBuilds` de `pnpm-workspace.yaml`.                                                                                                                                                                        |
| typescript-eslint falla con TS 7 ("does not support TS 7.0")    | El proyecto fija TypeScript `~6.0` hasta que typescript-eslint soporte la 7. Dependabot ignora los saltos mayores de `typescript` y `@types/node` (`.github/dependabot.yml`); quitar esa regla cuando haya soporte                                            |
| `zodSchema.openapi is not a function`                           | Con Zod 4 se pasan esquemas planos a zod-to-openapi; no uses el registro con `.openapi()`.                                                                                                                                                                    |
| Logins seguidos fallan en E2E (mensaje genérico)                | Better Auth limita a 3 ingresos cada 10 s por IP. El webServer de Playwright usa `AUTH_RATE_LIMIT_DISABLED=true`, que la configuración **rechaza** en staging y producción.                                                                                   |
| E2E del administrador falla en `/seguridad/segundo-factor`      | El administrador ya activó su segundo factor en una corrida anterior. Ejecuta `pnpm db:reset:demo` antes de `pnpm test:e2e`.                                                                                                                                  |
| Integración: "ya tiene los usuarios demo de otra ejecución"     | Cada corrida usa una contraseña aleatoria. Usa una base vacía o `TEST_DB=pglite`.                                                                                                                                                                             |
| PGlite y concurrencia                                           | Tiene una sola sesión real. Las pruebas de concurrencia y de resiliencia se saltan; córrelas con PostgreSQL real.                                                                                                                                             |
| `CREATE SCHEMA … permission denied` al migrar                   | La base debe ser de `quatreros_owner`. Créala con `db-roles.sql` o con `pnpm db:reset:demo`, no a mano.                                                                                                                                                       |
| La API se caía si PostgreSQL cerraba una conexión inactiva      | Ya está resuelto (`pool.on('error')` en `platform/db/client.ts`, con prueba de regresión). No lo quites.                                                                                                                                                      |
| Scripts o estilos externos bloqueados                           | La CSP no permite scripts inline ni CDNs. Las fuentes van autoalojadas con Fontsource.                                                                                                                                                                        |
| Playwright no puede descargar navegadores (entornos aislados)   | `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chromium pnpm test:e2e`                                                                                                                                                                                               |
| Texto del botón primario "sin contraste" en axe                 | Blanco sobre Ember solo cumple como texto grande en negrita (Anexo A). No cambies `text-action font-bold` del botón primario.                                                                                                                                 |
| CI "Secretos y dependencias" falla por gitleaks                 | Un ejemplo con forma de contraseña en código o documentación cuenta como secreto. Usa marcadores (`<12+ caracteres>`) y valores `*_local_dev` o `*_ci`. Antes de subir: `gitleaks git --config .gitleaks.toml`                                                |
| Workflow "Deploy" en rojo o saltado en `main`                   | El despliegue está apagado hasta contratar hosting (DEC-084, Q-C-01). Se activa con la variable de repositorio `DEPLOY_ENABLED=true` y los secretos `RENDER_DEPLOY_HOOK_*` (ver `deployment-design.md`)                                                       |
| Sesión de IA "colgada" en `requires_action`                     | El agente pidió una herramienta `custom` que el backend no respondió (sin manejador o reinicio a mitad de turno). Desplegar el manejador antes de `ant apply`, responder `is_error` por defecto y recuperar pendientes con `events.list` (ai-architecture §8) |
| `ant apply` dice `refusing to apply` o rechaza las credenciales | Alguien editó el agente en la consola, o las credenciales son de otro espacio de trabajo distinto al del lockfile. No uses `--force` sin aprobación: revisa con `ant apply --dry-run .` desde `quatreros-ai/` (ai-architecture §11)                           |
| `pkill -f "...main.js"` mata tu propia shell                    | Usa un patrón anclado: `pkill -f "^node apps/api/dist/main.js"`.                                                                                                                                                                                              |

## 7. Commits y PRs

- Conventional Commits en español: `feat(inv): traslado entre ubicaciones con FEFO`. El hook `commit-msg` de lefthook lo valida.
- Alcances: `adm, cat, comp, prod, inv, com, dis, pos, fin, cont, ia, tg, mig, plat, docs`.
- Una rama y un PR por entrega: `feat/<alcance>-<descripción>`. El PR cita los RF, BR y DEC que cubre y las pruebas ejecutadas (`.github/pull_request_template.md`).
- Al terminar, actualiza `docs/HANDOFF.md` para el siguiente agente.
