# Traspaso — estado al 2026-11-02

> Para el siguiente agente o desarrollador. Léelo después de `AGENTS.md` y [`MEMORY.md`](../MEMORY.md). Actualízalo al terminar cada trabajo.

## 1. Dónde está el proyecto

| Etapa                                                                         | Estado                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A–E: descubrimiento, requerimientos, arquitectura, diseño de IA y de Telegram | Completas (`docs/00-discovery` … `docs/02-architecture`)                  |
| F: preparación del repositorio, CI/CD, respaldos                              | Completa y verificada                                                     |
| G: roadmap del prototipo                                                      | Aprobado (DEC-083). 8 entregas en `docs/03-planning/roadmap-prototipo.md` |
| Sistema de diseño                                                             | Adoptado (DEC-086): `docs/05-design/sistema-de-diseno.md`                 |
| **Entrega 1**: ingreso, usuarios, roles y sedes                               | **Terminada** en `main`                                                   |
| **Entrega 2**: catálogo e inventario                                          | **En curso.** 2a y 2b terminadas; sigue 2c (FEFO y traslados)             |

**Entrega 1 en detalle** (spec: `docs/04-specifications/adm/acceso-usuarios.md`):

- **Ingreso:** correo y contraseña (Better Auth) y segundo factor TOTP obligatorio para Administrador, Manager y Contador, con códigos de respaldo.
- **Pantalla por rol:** cada rol entra a la suya (ERP, Caja o Distribución).
- **Gestión de usuarios:** crear (idempotente y auditado), editar roles y sedes con control de versión, desactivar y reactivar. Protege al último administrador e impide desactivarse a sí mismo.
- **Permisos:** RBAC con alcance ALL/SITE/OWN; responde 403 sin permiso y 404 fuera de alcance.
- **Interfaz:** rehecha con el sistema de diseño: encabezado con pestañas por sección y un Command Center con estados vacíos honestos.

**Verificación al cierre:**

- 49 pruebas unitarias.
- 27 de integración: PGlite y PostgreSQL 17 real.
- 22 E2E: flujos más accesibilidad axe en escritorio, tableta y celular.
- CI en verde.

**Entrega 2a en detalle** (spec: `docs/04-specifications/cat/catalogo.md`, DEC-090..092):

- Productos fabricados y preparados, presentaciones y materias primas, con unidad base y vida útil.
- Precio único vigente por presentación, con histórico, cierre de vigencia y auditoría.
- Permisos por rol: el administrador gestiona productos y precios; manager y comprador gestionan materias primas; el resto lee.
- Pantalla en **04. Producción → Catálogo y precios**, con pestañas de productos y materias primas, formularios, estados vacíos y ficha con histórico.
- Semilla demo: chorizo, rellena, picada, cuatro materias primas y un precio anterior para mostrar el histórico.

**Verificación al cierre de 2a:** 59 pruebas unitarias; 41 de integración (incluida concurrencia de precios en PostgreSQL 17 real); 32 E2E con axe en escritorio, tableta y móvil; `pnpm check`, `pnpm build` y `pnpm test:e2e` en verde.

### Entrega 2a en detalle técnico

- Módulo `modules/catalog`: `domain/catalog.ts` (reglas puras), `application/catalog.ts` (casos de uso), `infrastructure/{schema,repository,seed}.ts`, `http/router.ts` y `application/public.ts` para el ToolGateway.
- Puerto `InventoryUsage` (en 2a devuelve `false`): en 2b se implementa contra `stock_balances` y `stock_movements` para bloquear cambios de unidad o composición.
- Migraciones `0004` (esquema `catalog`) y `0005` (permisos y FK lógica `price_history.set_by → admin.users`). La FK se declara en SQL para no importar el esquema de otro módulo.
- Contratos en `packages/contracts/src/catalog.ts`; montos y cantidades como cadenas decimales.

### Entrega 2b en detalle (spec: `docs/04-specifications/inv/existencias.md`)

- Esquema `inventory`: `lots`, `stock_movements` (trigger append-only), `stock_balances` (`CHECK quantity >= 0`) y `lot_inputs` para trazabilidad.
- `recordMovement` es la única vía de cambio de saldo; la semilla usa movimientos `opening_balance` y fechas relativas a hoy para que el demo no envejezca.
- `InventoryUsage` real implementado con SQL y conectado al catálogo: bloquea cambios de unidad o composición cuando hay movimientos.
- API de existencias, disponibilidad, lotes, kardex, trazabilidad y resumen. Pantallas en **04. Producción → Existencias y traslados** con pestañas Existencias, Lotes y Kardex, y ficha de lote con saldos, movimientos y trazabilidad.
- Permisos: `inv.stock.read` para consultar; `inv.traceability.read` para ADM, MGR, PROD y CONT. El Comprador consulta existencias y kardex, pero no trazabilidad.
- Verificación: 71 unitarias; 55 de integración (PGlite y PostgreSQL 17 real, incluida concurrencia); 47 E2E con axe en escritorio, tableta y móvil; migraciones 0006/0007 desde base vacía.

### Quatreros AI (asistente, 2026-10-30)

- El agente ya existe en Anthropic Console y su configuración está versionada en `quatreros-ai/` (DEC-087, ADR-023). Diseño de la integración: `docs/02-architecture/ai-architecture.md` v0.2.
- **No está integrado funcionalmente.** No hay módulo `assistant` en el backend ni `ToolGateway`, y el agente no tiene herramientas: hoy solo puede conversar. La lista de lo que falta está en ai-architecture §15. Se construye en la entrega 8.
- Desde la entrega 2, cada módulo nuevo debe dejar su caso de uso de lectura listo para envolverlo como herramienta (ai-architecture §2.1). **No declares herramientas en el agente ni ejecutes `ant apply`** sin autorización.

### Rediseño visual v1.1 (DEC-093, 2026-11-02)

- **Solo presentación:** no se tocaron reglas de negocio, esquema PostgreSQL, contratos, rutas, autenticación ni permisos. Las escrituras siguen validándose en el servidor.
- **App Shell nuevo:** barra lateral agrupada y contraíble (248/72 px), encabezado de 72 px con migas, búsqueda ⌘K, notificaciones honestas, tema claro/oscuro y sesión. En tableta y móvil la navegación es un panel deslizante.
- **Producción rediseñada:** resumen con dato real de productos activos y "—" explicado para órdenes, vencimientos y existencias; bento de catálogo, órdenes, existencias y paquetes (P-06 sigue bloqueado).
- **Componentes nuevos:** `PageHeader`, `ModuleCard`, `StatCard`, `EmptyState`, `SearchInput`, `FilterBar`, `DataTable`, `ConfirmDialog`, `LoadingSkeleton`, `ResponsiveDrawer`, `PermissionGate`, `NotificationItem`, `AIActionConfirmation` y toasts. Catálogo, usuarios, POS, Ruta, ingreso y segundo factor usan el mismo lenguaje.
- **Verificación:** `pnpm check`, `pnpm build`, E2E de acceso y catálogo en escritorio/tableta/móvil, y axe AA en claro (tres tamaños) y oscuro (ERP). Capturas de revisión en el reporte de Playwright.
- **Pendiente de decisión:** confirmar DEC-093 en la próxima revisión y definir si el selector de sede debe filtrar por sesión (hoy es solo informativo porque no existe sede activa en el backend).
- **Marca:** isotipo oficial integrado (`public/logo.webp` → `logo-mark.webp`, favicon y apple-touch-icon).

## 2. Siguiente tarea: entrega 2c, FEFO y traslados

**Estado al 2026-11-02:** 2a y 2b terminadas y verificadas. Sigue la 2c, que cierra la entrega 2 y permite demostrar el recorrido completo del inventario.

**Objetivo demostrable de 2c:**

- Asignación FEFO de lotes por vencimiento más próximo en toda salida.
- Excepción FEFO con motivo y aprobación (AP-03, Q-INV-03).
- Traslado bodega → punto de venta con salida, estado en tránsito y recepción en destino.
- Novedad cuando lo recibido difiere de lo enviado (BR-089, PROVISIONAL).
- Tarjeta "Alertas FEFO" del Command Center con datos reales.

Procedimiento: skill `.claude/skills/quatreros-entrega`.

### RF que quedan en la entrega 2

| RF     | Tema                       | Estado                                    | Ojo con                                                       |
| ------ | -------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| RF-112 | Asignación FEFO            | CONFIRMED                                 | Orden por vencimiento y bloqueo determinista                  |
| RF-113 | Excepción FEFO             | CONFIRMED                                 | Q-INV-03; usa el motor de aprobaciones (RF-007)               |
| RF-114 | Traslado entre ubicaciones | CONFIRMED · tránsito PROVISIONAL (Q-B-07) | Q-POS-01; recepción y novedad                                 |
| RF-117 | Bloqueo de lotes           | PROPOSED                                  | Depende de P-05: **no implementar** más allá de lo conceptual |

**Hecho en 2a:** RF-030, RF-031 y RF-032 (`cat/catalogo.md`).
**Hecho en 2b:** RF-110, RF-111 (DEC-089) y RF-118 (`inv/existencias.md`).
**Movido:** RF-033 (recetas) a la entrega 4 por DEC-092.

**Fuera de la entrega 2 (bloqueado):**

- RF-116, apertura de paquetes (P-06).
- RF-119, vencidos y retiros (P-05).

**Reglas provisionales aplicables (DEC-083):**

- Q-B-07: estados "en tránsito" y "en ruta".
- Q-B-08: no se permiten existencias negativas.

Impleméntalas configurables y señalizadas.

### Orden sugerido

1. ✅ **2a. Catálogo:** RF-030 a RF-032. Spec `docs/04-specifications/cat/catalogo.md`.
2. ✅ **2b. Lotes, existencias y kardex:** RF-110, RF-111 y RF-118. Spec `docs/04-specifications/inv/existencias.md`.
3. **2c. FEFO y traslados:** RF-112 a RF-114.
   - Especificación en `docs/04-specifications/inv/fefo-traslados.md`.
   - Implementar `allocateFefo()` con `FOR UPDATE` en orden determinista, `transfer()` con ubicación en tránsito y `receive()` con recepción y novedad.
   - La excepción FEFO usa el motor de aprobaciones; no inventar umbrales.
   - Pantallas: traslado desde existencias, recepción en destino, existencias en Caja (solo lectura hasta la entrega 6) y tarjeta de alertas FEFO en el Command Center.
   - Semilla: un traslado de ejemplo bodega → punto de venta.

En cada PR: actualizar `shared/modules.ts` (módulos `available`), la matriz de trazabilidad, `PROJECT-STATUS.md`, el guion `docs/operations/demo-local.md` y este archivo.

## 3. Pendientes que dependen del responsable (no los resuelvas por tu cuenta)

| Pendiente                                                                                                                                                                        | Dónde                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Confirmar las reglas provisionales Q-B-01..09 **antes del piloto**                                                                                                               | `open-questions.md`                                                                              |
| Hosting y operación: Q-C-01..06                                                                                                                                                  | `open-questions.md`                                                                              |
| Cuestionario del contador: Q-CON-01..07, Q-POS-04, Q-SEC-03                                                                                                                      | Bloquea contabilidad e impuestos                                                                 |
| ~~PR de Dependabot #6~~: cerrado; Dependabot ignora TypeScript 7 y `@types/node` mayores hasta que haya soporte                                                                  | —                                                                                                |
| Texto de una línea por rol en "Crear usuario" (qué puede hacer cada uno)                                                                                                         | Recomendación de la crítica de diseño; redactar desde `actors-permissions.md` y pedir aprobación |
| Descripción pendiente: pestañas extra del ERP (Compras, Cartera, Administración) y ajustes AA                                                                                    | Sistema de diseño, Anexos A y B; el responsable puede pedir cambios                              |
| **Quatreros AI:** autorizar la primera sincronización con `ant apply` (adopta el agente y el entorno existentes); definir quién la ejecuta y el espacio de trabajo de producción | Q-IA-04, ai-architecture §11                                                                     |
| **Quatreros AI:** retención de conversaciones en Anthropic y confirmación del modelo `claude-haiku-5-5`                                                                          | Q-IA-05, Q-IA-06                                                                                 |

## 4. Notas de entorno

- Contraseña de usuarios demo: la que pongas en `DEMO_PASSWORD`; nunca se guarda en el repositorio. CI usa una propia en su base efímera.
- `pnpm db:reset:demo` deja la base como recién sembrada; el E2E del administrador lo necesita.
- Para probar funcionalidades internas sin configurar TOTP: `AUTH_MFA_ENFORCEMENT_DISABLED=true` en `.env` y reiniciar `pnpm dev`. Solo desarrollo/pruebas (se rechaza en staging/producción); no borra un TOTP ya activado.
- Entornos aislados sin Docker ni descarga de navegadores: PostgreSQL embebido o el que haya, `TEST_DB=pglite` para integración y `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para E2E (ver `AGENTS.md` §6).
