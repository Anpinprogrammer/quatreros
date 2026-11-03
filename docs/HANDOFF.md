# Traspaso — estado al 2026-11-02

> Para el siguiente agente o desarrollador. Léelo después de `AGENTS.md` y [`MEMORY.md`](../MEMORY.md). Actualízalo al terminar cada trabajo.

## 1. Dónde está el proyecto

| Etapa                                                                         | Estado                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A–E: descubrimiento, requerimientos, arquitectura, diseño de IA y de Telegram | Completas (`docs/00-discovery` … `docs/02-architecture`)                                                              |
| F: preparación del repositorio, CI/CD, respaldos                              | Completa y verificada                                                                                                 |
| G: roadmap del prototipo                                                      | Aprobado (DEC-083). 8 entregas en `docs/03-planning/roadmap-prototipo.md`                                             |
| Sistema de diseño                                                             | Adoptado (DEC-086): `docs/05-design/sistema-de-diseno.md`                                                             |
| **Entrega 1**: ingreso, usuarios, roles y sedes                               | **Terminada** en `main`                                                                                               |
| **Entrega 2**: catálogo e inventario                                          | **Terminada.** 2a, 2b y 2c cerradas                                                                                   |
| **Entrega 3**: compras y recepción                                            | **Terminada.**                                                                                                        |
| **Entrega 4**: producción                                                     | **Terminada.**                                                                                                        |
| **Entrega 5**: pedidos y reparto                                              | **Terminada.**                                                                                                        |
| **Entrega 6**: caja (POS)                                                     | **Terminada** (rama `feat/pos-caja`, pendiente de fusión)                                                             |
| **Entrega 7**: cartera, recaudos y hechos económicos                          | **Terminada** (rama `feat/fin-cartera-recaudos`, pendiente de fusión)                                                 |
| **Entrega 8**: asistente de IA                                                | **Implementada** (rama `feat/ia-asistente`, pendiente de fusión) · activación real pendiente de `ant apply` (Q-IA-04) |
| **Refactorización de la SPA**                                                 | Terminada en la rama `refactor/web-estructura-pages-components-hooks`; pendiente de fusión (ADR-024, DEC-101)         |

**Entrega 1 en detalle** (spec: `docs/04-specifications/adm/acceso-usuarios.md`):

- **Ingreso en dos pasos con efecto cortina:** el paso 1 se organiza en cabecera con el logo oficial centrado y píldora "Acceso restringido" sobre el kicker, mensaje con las áreas en 2×2, tarjeta "Selecciona tu perfil" (Administrador/Cajero/Distribuidor) y pie. Al elegir, dos paños se cierran al centro: el oscuro presenta el rol y el blanco tiene el formulario. En móvil, el paño blanco baja como persiana. Escape o "Cambiar de rol" abren la cortina y devuelven el foco al perfil. Los E2E eligen perfil antes de autenticarse.
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
- **App Shell nuevo:** barra lateral agrupada y contraíble (248/72 px), oscura (`#191B20`) con activo naranja translúcido; encabezado cálido de 72 px (`#FFF1E7`) con migas, búsqueda ⌘K, sedes, notificaciones y sesión. En tableta y móvil la navegación es un panel deslizante oscuro con foco atrapado. La burbuja del asistente usa fondo oscuro, borde naranja y personaje completo, sin badges ficticios.
- **Producción rediseñada:** resumen con dato real de productos activos y "—" explicado para órdenes, vencimientos y existencias; bento de catálogo, órdenes, existencias y paquetes (P-06 sigue bloqueado).
- **Componentes nuevos:** `PageHeader`, `ModuleCard`, `StatCard`, `EmptyState`, `SearchInput`, `FilterBar`, `DataTable`, `ConfirmDialog`, `LoadingSkeleton`, `ResponsiveDrawer`, `PermissionGate`, `NotificationItem`, `AIActionConfirmation` y toasts. Catálogo, usuarios, POS, Ruta, ingreso y segundo factor usan el mismo lenguaje.
- **Verificación:** `pnpm check`, `pnpm build`, E2E de acceso y catálogo en escritorio/tableta/móvil, y axe AA en claro (tres tamaños) y oscuro (ERP). Capturas de revisión en el reporte de Playwright.
- **Pendiente de decisión:** confirmar DEC-093 en la próxima revisión y definir si el selector de sede debe filtrar por sesión (hoy es solo informativo porque no existe sede activa en el backend).
- **Marca:** isotipo oficial integrado (`public/logo.webp` → `logo-mark.webp`, favicon y apple-touch-icon).
- **Asistente:** burbuja y panel de Quatreros AI implementados como **vista previa** (20 % del ancho en escritorio, pantalla completa con "Volver" en móvil). El compositor está deshabilitado hasta la entrega 8; no hay respuestas simuladas.
- **Ingreso:** rediseño luminoso 52/48. El panel cálido conserva solo el nombre y "LOS 4 TREROS" arriba a la izquierda, el mensaje y el personaje de Los 4 Treros. El logo oficial vuelve a la zona superior del panel cálido, centrado y sin texto al lado, con 140 px en escritorio y 110 px en 1024; el formulario de 52 px con iconos y control de contraseña sigue intacto. En móvil, fondo cálido de marca, formulario en card, CTA de 56 px y robot al pie con chips discretos; sin scroll horizontal y con safe areas. La atmósfera clara se conserva aunque el sistema esté en oscuro.
- **Command Center y header:** dos pestañas accesibles, **Módulos** y **Tablero del día**. Módulos reorganiza los accesos en un grid compacto de tres columnas; el tablero concentra KPI reales de pedidos/producción/FEFO, pedidos recientes, producción, estado de reparto y el estado de caja/cartera/IA. El header agrupa colapso, migas, búsqueda, sedes, notificaciones y menú de usuario; tema y cierre de sesión viven en el menú. Se retiró el panel de plan del dashboard.

### Refactorización de la SPA (2026-11-02)

- **Solo estructura:** no cambió comportamiento, JSX, textos, estilos, URLs, contratos, permisos ni pruebas. Los E2E y las capturas son la línea base.
- **Capas:** `pages/` (pantallas y shells), `components/` (`ui` con el sistema de diseño, `layout`, `auth` y piezas por módulo), `hooks/`, `services/`, `lib/`, `config/` y `app/` para la composición.
- **Divisiones:** `session.tsx` → `hooks/useSession.ts`, `hooks/useSignOut.ts`, `lib/session.ts` y `components/auth/RequireSession.tsx`; `theme.tsx` → `lib/theme.ts`, `hooks/useTheme.ts` y `components/ui/ThemeToggle.tsx`; `UserForm` salió de `UsersPage` a `components/usuarios/UserForm.tsx`.
- **Fronteras:** `apps/web/.dependency-cruiser.cjs` con seis reglas (`components`↛`pages`, `hooks`↛UI, `services`↛UI, `lib` puro, `config` sin presentación y sin ciclos), encadenado a `pnpm lint` / `pnpm check`.
- **Guía:** `apps/web/src/README.md`.
- **Verificación:** `pnpm check` con 80 unitarias y ambas fronteras; integración 76/76 con PostgreSQL real; E2E 67 pasaron y 14 omitidos, igual que la línea base.

## 2. Siguiente tarea: entrega 8, asistente de IA (demo)

**Estado al 2026-11-02:** entregas 1, 2a, 2b, 2c, 3, 4, 5, 6 y 7 terminadas y verificadas. Sigue la 8: preguntas en lenguaje natural y un registro con resumen y confirmación (RF-340–345), con el agente Quatreros AI ya creado (DEC-087, ai-architecture §15).

### Hecho en 7: cartera, recaudos, conciliación y hechos económicos

- Especificaciones aprobadas: `docs/04-specifications/fin/cartera-recaudos.md` (DEC-104, D1..D9) y `docs/04-specifications/cont/hechos-economicos.md` (DEC-105, E1..E7).
- Cartera por antigüedad con cinco rangos (por vencer, 1–30, 31–60, 61–90 y +90), alcance por sede y sin intereses de mora.
- Abonos FIFO por defecto o asignación manual; un abono mayor al saldo se rechaza con `409 ABONO_EXCEEDS_BALANCE`.
- Recaudos por responsable y sede, conciliación con conteo por método y diferencia registrada. No liquida al distribuidor ni crea cuenta por cobrar (P-08).
- Los pagos del POS no se duplican en `finance.collections`; la caja se consulta desde `pos`.
- Exportación CSV UTF-8 con BOM y separador `;` para cartera, recaudos y caja.
- Hechos económicos desde compras, producción, POS y finanzas en `accounting.economic_events`: catálogo cerrado, tabla inmutable (trigger append-only), `amount` nullable y bandeja de solo lectura.
- Pantallas **Gestión → Cartera y recaudos** y **Sistema → Hechos económicos**; acción **Cobrar cartera** en el POS para CAJ.
- Semilla demo: cuatro rangos de antigüedad, recaudos pendientes y una conciliación con diferencia.
- **Siguen bloqueados:** contabilización e impuestos (P-01..P-04, RF-304/RF-305) y liquidación de distribuidores (P-08).

### Verificación al cierre de 7

- `pnpm check` en verde (67 unitarias de API, 13 de web y contratos).
- Integración PGlite: 86 pasaron, 2 omitidas por concurrencia.
- PostgreSQL real: el test de finanzas pasa 5/5 y la suite completa 88/88; el fallo de reservas de `inventory.test.ts` quedó corregido.
- `pnpm build` en verde y E2E 78 pasaron, 15 omitidos y 0 fallos en escritorio, tableta y móvil (con axe AA).
- El E2E de cierre usó el ingreso original: el rediseño de `LoginPage.tsx` sin commitear tiene un contraste pendiente en la pantalla `ingreso` y debe corregirse antes de fusionarlo.

### Entrega 8 implementada (DEC-106)

- Especificación aprobada: `docs/04-specifications/ia/asistente-demo.md`.
- Backend: esquema `assistant` (`tickets`, `tool_calls`, `proposals`, `requests`), migraciones `0027`–`0028`, `ToolGateway` con 9 lecturas y 2 escrituras preparadas, servicio de turnos, propuestas, consumo y configuración.
- Frontend: burbuja funcional, panel de chat con streaming SSE, tarjeta de confirmación reutilizada, pestaña de tickets y pantalla de consumo/configuración.
- Tickets por sesión con petición inicial y resumen de resolución; no se guarda la transcripción completa.
- Techos: USD 3/día, USD 10/semana y USD 30/mes; presupuesto por sesión USD 0,25; alertas 80/100.
- Otras escrituras siguen bloqueadas por P-10 y responden `423 FEATURE_BLOCKED`.
- **Herramientas declaradas:** 9 lecturas y 2 escrituras preparadas en `quatreros-ai/agents/tools/`; el agente las incluye con `./tools/*.json`.
- **Activación real pendiente:** ejecutar `ant apply` con autorización (Q-IA-04) para publicar las herramientas y configurar las credenciales; sin eso el agente solo conversa. No ejecutar `ant apply` sin autorización (DEC-087).
- Quedan abiertas Q-IA-04 (`ant apply`), Q-IA-05 (retención) y Q-IA-06 (modelo).

### Verificación al cierre de 8

- `pnpm check` en verde.
- Integración PGlite: 92/94 (2 omitidas por concurrencia).
- PostgreSQL real: 94/94.
- `pnpm build` en verde y E2E 81 pasaron, 15 omitidos y 0 fallos (axe AA en escritorio, tableta y móvil).
- El E2E del asistente cubre la bandeja de tickets; las conversaciones reales se prueban con el proveedor simulado hasta que se autorice `ant apply`.

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

- **Reservas corregidas (2026-11-03):** `reserveOrderLine` ya excluye ubicaciones en tránsito/ruta y consolida una sola reserva por lote, eligiendo la ubicación con mayor disponibilidad. `inventory.test.ts` y la suite completa de PostgreSQL pasan 88/88.
- Contraseña de usuarios demo: la que pongas en `DEMO_PASSWORD`; nunca se guarda en el repositorio. CI usa una propia en su base efímera.
- `pnpm db:reset:demo` deja la base como recién sembrada; el E2E del administrador lo necesita.
- Para probar funcionalidades internas sin configurar TOTP: `AUTH_MFA_ENFORCEMENT_DISABLED=true` en `.env` y reiniciar `pnpm dev`. Solo desarrollo/pruebas (se rechaza en staging/producción); no borra un TOTP ya activado.
- Entornos aislados sin Docker ni descarga de navegadores: PostgreSQL embebido o el que haya, `TEST_DB=pglite` para integración y `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para E2E (ver `AGENTS.md` §6).
