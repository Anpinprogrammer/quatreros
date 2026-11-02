# Traspaso — estado al 2026-11-02

> Para el siguiente agente o desarrollador. Léelo después de `AGENTS.md` y [`MEMORY.md`](../MEMORY.md). Actualízalo al terminar cada trabajo.

## 1. Dónde está el proyecto

| Etapa                                                                         | Estado                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A–E: descubrimiento, requerimientos, arquitectura, diseño de IA y de Telegram | Completas (`docs/00-discovery` … `docs/02-architecture`)                                                      |
| F: preparación del repositorio, CI/CD, respaldos                              | Completa y verificada                                                                                         |
| G: roadmap del prototipo                                                      | Aprobado (DEC-083). 8 entregas en `docs/03-planning/roadmap-prototipo.md`                                     |
| Sistema de diseño                                                             | Adoptado (DEC-086): `docs/05-design/sistema-de-diseno.md`                                                     |
| **Entrega 1**: ingreso, usuarios, roles y sedes                               | **Terminada** en `main`                                                                                       |
| **Entrega 2**: catálogo e inventario                                          | **Terminada.** 2a, 2b y 2c cerradas                                                                           |
| **Entrega 3**: compras y recepción                                            | **Terminada.**                                                                                                |
| **Entrega 4**: producción                                                     | **Terminada.**                                                                                                |
| **Entrega 5**: pedidos y reparto                                              | **Terminada.** Sigue la entrega 6 (caja POS)                                                                  |
| **Refactorización de la SPA**                                                 | Terminada en la rama `refactor/web-estructura-pages-components-hooks`; pendiente de fusión (ADR-024, DEC-101) |

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
- **Asistente:** burbuja y panel de Quatreros AI implementados como **vista previa** (15 % del ancho en escritorio, pantalla completa con "Volver" en móvil). El compositor está deshabilitado hasta la entrega 8; no hay respuestas simuladas.
- **Ingreso:** rediseño luminoso 52/48, logo oficial, personaje de Los 4 Treros, formulario de 52 px con iconos y control de contraseña integrado. La atmósfera clara se conserva aunque el sistema esté en oscuro.
- **Command Center y header:** dos pestañas accesibles, **Módulos** y **Tablero del día**. Módulos reorganiza los accesos en un grid compacto de tres columnas; el tablero concentra KPI reales de pedidos/producción/FEFO, pedidos recientes, producción, estado de reparto y el estado de caja/cartera/IA. El header agrupa colapso, migas, búsqueda, sedes, notificaciones y menú de usuario; tema y cierre de sesión viven en el menú. Se retiró el panel de plan del dashboard.

### Refactorización de la SPA (2026-11-02)

- **Solo estructura:** no cambió comportamiento, JSX, textos, estilos, URLs, contratos, permisos ni pruebas. Los E2E y las capturas son la línea base.
- **Capas:** `pages/` (pantallas y shells), `components/` (`ui` con el sistema de diseño, `layout`, `auth` y piezas por módulo), `hooks/`, `services/`, `lib/`, `config/` y `app/` para la composición.
- **Divisiones:** `session.tsx` → `hooks/useSession.ts`, `hooks/useSignOut.ts`, `lib/session.ts` y `components/auth/RequireSession.tsx`; `theme.tsx` → `lib/theme.ts`, `hooks/useTheme.ts` y `components/ui/ThemeToggle.tsx`; `UserForm` salió de `UsersPage` a `components/usuarios/UserForm.tsx`.
- **Fronteras:** `apps/web/.dependency-cruiser.cjs` con seis reglas (`components`↛`pages`, `hooks`↛UI, `services`↛UI, `lib` puro, `config` sin presentación y sin ciclos), encadenado a `pnpm lint` / `pnpm check`.
- **Guía:** `apps/web/src/README.md`.
- **Verificación:** `pnpm check` con 80 unitarias y ambas fronteras; integración 76/76 con PostgreSQL real; E2E 67 pasaron y 14 omitidos, igual que la línea base.

## 2. Siguiente tarea: entrega 6, caja (POS)

**Estado al 2026-11-02:** entregas 1, 2a, 2b, 2c, 3, 4 y 5 terminadas y verificadas. Sigue la 6: turnos de caja, venta de mostrador, pagos mixtos y cierre.

### Hecho en 5: pedidos y reparto

- Especificación `docs/04-specifications/com/pedidos-reparto.md`; DEC-098 reservas por lote, DEC-099 crédito con advertencia y DEC-100 recaudos.
- Clientes con datos de entrega y crédito (cupo/plazo) configurable por el Administrador.
- Pedido confirmado con precio vigente congelado y reserva FEFO por lote; si falta existencia queda el faltante señalado.
- Cupo usado = cartera abierta + pedidos a crédito no entregados; exceso o mora generan advertencia, no bloqueo.
- Despacho con pedidos confirmados, distribuidor y salida a "En ruta"; reservas consumidas.
- Portal móvil del distribuidor con entrega total/parcial, recaudo efectivo/transferencia y devolución.
- Obligación a crédito al entregar, con vencimiento entrega + plazo; abono opcional.
- Devolución a "En inspección" y reincorporación a la bodega; descarte pendiente AP-08.
- Pantallas **03. Distribución → Clientes, pedidos y despachos** y portal **Ruta**.
- Semilla: dos clientes, `P-0001` a crédito y `D-0001` preparado para `reparto@`.
- **RF-153 (cancelación/descuentos) P-09 y RF-186 (liquidación) P-08 siguen fuera.**

### Objetivo demostrable de la entrega 6

- Abrir turno de caja con base de efectivo.
- Vender producto fabricado y platos preparados con precio vigente y pago mixto.
- Descontar inventario de producto terminado desde la ubicación del POS con FEFO.
- Registrar el consumo teórico de platos sin descontar automáticamente cocina (BR-147, Q-B-09).
- Cerrar turno con efectivo esperado, contado y diferencia justificada.
- Dejar fuera la facturación fiscal (P-02), descuentos/anulaciones (P-09) y clasificación de mermas (P-07).

### RF de la entrega 6

| RF     | Tema                     | Estado             | Ojo con                                           |
| ------ | ------------------------ | ------------------ | ------------------------------------------------- |
| RF-220 | Apertura de turno        | CONFIRMED          | Un turno abierto por caja y por cajero            |
| RF-221 | Venta de mostrador       | CONFIRMED          | Precio vigente; producto y plato; FEFO            |
| RF-222 | Pagos mixtos y cambio    | CONFIRMED          | Suma de pagos = total; efectivo y transferencia   |
| RF-223 | Cierre de turno y arqueo | CONFIRMED          | Esperado vs contado; diferencia con justificación |
| RF-224 | Revisión de diferencias  | CONFIRMED          | Supervisor distinto del cajero                    |
| RF-225 | Platos y consumo teórico | CONFIRMED · Q-B-09 | Sin descuento automático de cocina hasta decisión |
| RF-226 | Conteos de cocina        | PENDING (P-07)     | **No implementar** clasificación ni ajustes       |
| RF-227 | Documento al cliente     | BLOCKED (P-02)     | No se emite factura; solo comprobante interno     |

Procedimiento: skill `.claude/skills/quatreros-entrega`. Antes de programar, escribir la especificación `docs/04-specifications/pos/caja.md` y esperar aprobación.

En cada PR: actualizar `config/modules.ts` (módulos `available`), la matriz de trazabilidad, `PROJECT-STATUS.md`, el guion `docs/operations/demo-local.md` y este archivo.

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
| Fusionar el PR de la refactorización de la SPA (`refactor/web-estructura-pages-components-hooks`) cuando el CI esté en verde                                                     | ADR-024, DEC-101                                                                                 |

## 4. Notas de entorno

- **Integración intermitente (preexistente, no de la refactorización):** `inventory.test.ts` puede fallar al confirmar un pedido con `duplicate key … reservations_order_line_lot_uq` cuando FEFO reparte el mismo lote desde dos ubicaciones. Se reproduce igual en `7868e84`; corregir en una tarea aparte (reservar por lote+ubicación o consolidar la asignación), no dentro de un cambio de estructura.
- Contraseña de usuarios demo: la que pongas en `DEMO_PASSWORD`; nunca se guarda en el repositorio. CI usa una propia en su base efímera.
- `pnpm db:reset:demo` deja la base como recién sembrada; el E2E del administrador lo necesita.
- Para probar funcionalidades internas sin configurar TOTP: `AUTH_MFA_ENFORCEMENT_DISABLED=true` en `.env` y reiniciar `pnpm dev`. Solo desarrollo/pruebas (se rechaza en staging/producción); no borra un TOTP ya activado.
- Entornos aislados sin Docker ni descarga de navegadores: PostgreSQL embebido o el que haya, `TEST_DB=pglite` para integración y `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para E2E (ver `AGENTS.md` §6).
