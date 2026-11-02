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
| **Entrega 2**: catálogo e inventario                                          | **Terminada.** 2a, 2b y 2c cerradas                                       |
| **Entrega 3**: compras y recepción                                            | **Terminada.**                                                            |
| **Entrega 4**: producción                                                     | **Terminada.** Sigue la entrega 5 (pedidos y reparto)                     |

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

## 2. Siguiente tarea: entrega 5, pedidos y reparto

**Estado al 2026-11-02:** entregas 1, 2a, 2b, 2c, 3 y 4 terminadas y verificadas. Sigue la 5: clientes, pedidos, despachos, entregas, recaudos y devoluciones.

### Hecho en 4: producción

- Especificación en `docs/04-specifications/prod/produccion.md`; DEC-095/096/097 resuelven recetas versionadas, rendimiento con tolerancia y trazabilidad N:M.
- Recetas de producción por producto fabricado, versionadas e inmutables; la orden congela la versión vigente al crearse.
- Orden planificada con consumo teórico y disponibilidad; si falta MP advierte, pero no bloquea crearla.
- Consumo real por lote, con lotes sugeridos por FEFO; descuenta existencias y registra teórico/real.
- Cierre por presentación: lote PT `PT-AAAA-####` con fabricación, vencimiento (DEC-090) y movimientos `production_output`.
- Rendimiento real/esperado y motivo obligatorio fuera de la tolerancia configurable (BR-066, DEC-096).
- Trazabilidad `inventory.lot_inputs`: lote PT vinculado a todos los lotes de MP (DEC-097).
- Pantallas **04. Producción → Órdenes de producción** y **Recetas**.
- Semilla: dos recetas y `OP-0001` planificada para 100 unidades de chorizo.
- **RF-080 (sugerencias) queda fuera por Q-PRO-03; RF-084 (anulación) por P-09. Costo oficial del lote BLOCKED (P-03).**

### Objetivo demostrable de la entrega 5

- Clientes con datos de entrega y crédito (cupo/plazo) cuando aplique.
- Pedido con líneas, precio vigente, canal y modalidad de pago; reserva de cantidades al confirmar.
- Despacho que agrupa pedidos, asigna distribuidor y sales FEFO a la ubicación "En ruta".
- Portal móvil del distribuidor: despachos, direcciones, entrega total/parcial, recaudo y devolución.
- Devolución a "En inspección" y su reincorporación/descarte (AP-08 si aplica).
- Dejar fuera la liquidación del distribuidor (RF-186) y la anulación/descuentos (RF-153) hasta resolver P-08/P-09.

### RF de la entrega 5

| RF     | Tema                              | Estado                          | Ojo con                                               |
| ------ | --------------------------------- | ------------------------------- | ----------------------------------------------------- |
| RF-150 | Gestión de clientes               | CONFIRMED                       | Datos de entrega; inactivar, no borrar                |
| RF-151 | Registro de pedido                | CONFIRMED                       | Precio vigente; reserva; crédito según BR-171         |
| RF-152 | Seguimiento de pedidos            | CONFIRMED                       | Estados y pendientes por línea                        |
| RF-153 | Cancelación y descuentos          | PENDING (P-09)                  | **No implementar** sin decisión                       |
| RF-180 | Despacho y asignación             | CONFIRMED                       | Agrupa pedidos confirmados con pendiente              |
| RF-181 | Salida del despacho               | CONFIRMED · en ruta PROVISIONAL | FEFO y ubicación "En ruta" (Q-B-07)                   |
| RF-182 | Portal móvil del distribuidor     | CONFIRMED                       | Solo sus despachos; una columna en celular            |
| RF-183 | Entrega total o parcial           | CONFIRMED                       | Parcial deja saldo y motivo; obligación si es crédito |
| RF-184 | Recaudo en ruta                   | CONFIRMED                       | Métodos y pendiente de conciliación                   |
| RF-185 | Devolución e inspección           | CONFIRMED                       | En inspección; reincorporar/descartar con AP-08       |
| RF-186 | Liquidación del distribuidor      | PENDING (P-08)                  | **No implementar** sin decisión                       |
| RF-260 | Crédito por cliente               | CONFIRMED                       | Cupo y plazo; auditoría                               |
| RF-261 | Control de cupo y cartera vencida | CONFIRMED                       | Aprobación si excede; no inventar umbrales            |

Procedimiento: skill `.claude/skills/quatreros-entrega`. Antes de programar, escribir la especificación `docs/04-specifications/com/pedidos-reparto.md` y esperar aprobación. Resolver en ella las reglas PROPOSED/PENDING de crédito, reservas, entrega parcial y devolución.

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
