# Matriz de trazabilidad

> Etapa A · v0.1 · 2026-10-29
> Conecta cada decisión del Documento Maestro con los módulos afectados y con los artefactos que se generarán en las etapas siguientes. Los identificadores `BR-`, `RF-`, `RNF-` se asignarán en la Etapa B; aquí se reservan **áreas** para que la numeración sea trazable.
> **Disponibilidad**: ✅ lista para especificar · 🟨 especificable con huecos marcados PENDING · ⛔ especificación conceptual solamente, implementación BLOCKED.

---

## 1. Códigos de módulo

| Código | Módulo                                                           | Código | Módulo                                       |
| ------ | ---------------------------------------------------------------- | ------ | -------------------------------------------- |
| ADM    | Administración (usuarios, roles, sedes, aprobaciones, auditoría) | DIS    | Distribución                                 |
| CAT    | Catálogo y precios                                               | POS    | POS y cocina                                 |
| COMP   | Compras y proveedores                                            | FIN    | Cartera y caja                               |
| PROD   | Producción                                                       | CONT   | Contabilidad                                 |
| INV    | Inventarios                                                      | IA     | Asistente IA                                 |
| COM    | Comercial (clientes y pedidos)                                   | TG     | Telegram                                     |
| MIG    | Migración y piloto                                               | PLAT   | Plataforma (infraestructura, observabilidad) |

## 2. Reserva de rangos de identificadores (Etapa B)

| Módulo | BR         | RF         | Módulo   | BR         | RF         |
| ------ | ---------- | ---------- | -------- | ---------- | ---------- |
| ADM    | BR-001–019 | RF-001–029 | DIS      | BR-120–139 | RF-180–219 |
| CAT    | BR-020–039 | RF-030–049 | POS      | BR-140–169 | RF-220–259 |
| COMP   | BR-040–059 | RF-050–079 | FIN      | BR-170–199 | RF-260–299 |
| PROD   | BR-060–079 | RF-080–109 | CONT     | BR-200–229 | RF-300–339 |
| INV    | BR-080–109 | RF-110–149 | IA       | BR-230–249 | RF-340–369 |
| COM    | BR-110–119 | RF-150–179 | TG / MIG | BR-250–269 | RF-370–399 |

RNF por categoría: Seguridad 001–019 · Privacidad 020–029 · Rendimiento 030–039 · Disponibilidad/Recuperación 040–059 · Escalabilidad 060–069 · Accesibilidad/Usabilidad 070–089 · Auditoría/Observabilidad 090–109 · Costos 110–119 · Mantenibilidad 120–129 · Integraciones 130–139.

## 3. Decisión → módulo → artefactos

| Decisión             | Resumen                                                 | Módulos              | Artefactos Etapa B/C                                      | Bloqueos                             | Disp. |
| -------------------- | ------------------------------------------------------- | -------------------- | --------------------------------------------------------- | ------------------------------------ | ----- |
| DEC-001              | Una empresa, no SaaS                                    | PLAT, ADM            | ADR monolito single-tenant; RNF escalabilidad             | —                                    | ✅    |
| DEC-002              | Fabricación para inventario                             | PROD, INV            | BR producción; RF órdenes                                 | —                                    | ✅    |
| DEC-003              | Tipos de cliente; distribuidores internos               | COM, DIS, ADM        | RF clientes; roles                                        | —                                    | ✅    |
| DEC-004              | 1 bodega + 1 POS, multi-sede futura                     | INV, ADM, POS        | Modelo sede/ubicación; RBAC por sede                      | —                                    | ✅    |
| DEC-005              | Prototipo con ERP, POS, reparto, contabilidad, IA       | Todos                | Roadmap (Etapa G)                                         | P-01..P-04                           | 🟨    |
| DEC-007              | Pedidos multicanal sin integración                      | COM                  | RF registro de pedido + canal                             | Q-COM-05                             | 🟨    |
| DEC-010              | Producción decidida por humano + sugerencias            | PROD                 | BR sugerencias; RF sugerencia y orden                     | Q-PRO-03                             | 🟨    |
| DEC-011              | Recetas exactas                                         | PROD, CAT            | RF recetas y versiones; data-req receta                   | Q-PRO-01                             | 🟨    |
| DEC-012              | Rendimiento esperado/real, merma                        | PROD                 | BR rendimiento; RF cierre de orden                        | P-03 (costeo)                        | 🟨    |
| DEC-013              | Lote, vencimiento, origen                               | INV, PROD, COMP      | BR trazabilidad; RF consulta de trazabilidad; modelo lote | Q-PRO-04, Q-PRO-05                   | 🟨    |
| DEC-014              | FEFO con excepción autorizada                           | INV, DIS, POS, ADM   | BR FEFO; RF asignación de lotes y excepción               | Q-INV-03                             | ✅    |
| DEC-015              | Unidad/paquete convertible                              | CAT, INV, POS, DIS   | BR conversión; RF apertura de paquete                     | **P-06**                             | 🟨    |
| DEC-016              | MP/PT, ubicaciones, traslados                           | INV                  | BR traslados; RF traslado; kardex                         | —                                    | ✅    |
| DEC-020              | Precio único configurable                               | CAT, ADM             | BR precios; RF gestión de precio + histórico              | P-09, Q-COM-03                       | 🟨    |
| DEC-021              | Cupo y plazo por cliente                                | FIN, COM             | BR crédito; RF configuración de crédito                   | Q-COM-04                             | 🟨    |
| DEC-022              | Autorización por cupo/mora                              | FIN, ADM             | BR autorizaciones excepcionales; RF aprobación            | P-10                                 | 🟨    |
| DEC-023              | Contraentrega y crédito                                 | COM, DIS, FIN        | RF modalidad de pago del pedido                           | —                                    | ✅    |
| DEC-024              | Portal web móvil del distribuidor                       | DIS                  | RF portal; RNF usabilidad móvil                           | —                                    | ✅    |
| DEC-025              | Entrega parcial y reprogramación                        | DIS, COM             | BR entregas parciales; RF entrega/reprogramación          | —                                    | ✅    |
| DEC-026              | Devoluciones inspeccionadas                             | DIS, INV             | BR devoluciones; RF inspección                            | P-01 (contable)                      | 🟨    |
| DEC-027              | Recaudos por punto/distribuidor conciliados             | FIN, DIS             | BR liquidación; RF conciliación                           | **P-08**                             | 🟨    |
| DEC-030              | POS con fabricados y preparados, inventarios separados  | POS, INV             | BR inventarios de cocina; modelo ubicaciones              | Q-POS-01                             | 🟨    |
| DEC-031              | Venta inmediata y pagos mixtos                          | POS, FIN             | BR pagos mixtos; RF venta POS                             | Q-POS-02, **P-02** (doc. fiscal)     | 🟨    |
| DEC-032              | Apertura/cierre por cajero y turno                      | POS, FIN             | BR caja; RF turnos                                        | —                                    | ✅    |
| DEC-033              | Cierre con diferencia justificada                       | POS, FIN, ADM        | BR diferencias; RF revisión supervisor                    | —                                    | ✅    |
| DEC-034              | Conteos cocina y consumo teórico                        | POS, INV             | BR consumo cocina; RF conteos                             | **P-07**                             | 🟨    |
| DEC-040              | Roles editables, permisos por alcance                   | ADM                  | actors-permissions; RNF seguridad; diseño RBAC            | **P-10**                             | 🟨    |
| DEC-041              | Acceso por sede/asignación                              | ADM, todos           | BR aislamiento por sede; pruebas de autorización          | —                                    | ✅    |
| DEC-042              | Autorizaciones por operación/monto en backend           | ADM, todos           | BR autorizaciones; RF motor de aprobaciones               | P-10 (umbrales)                      | 🟨    |
| DEC-043              | Correo/contraseña + MFA sensibles                       | ADM                  | RF autenticación; RNF seguridad                           | Q-SEC-02                             | 🟨    |
| DEC-044              | Auditoría obligatoria en cambios sensibles              | ADM, todos           | RNF auditoría; diseño audit log                           | —                                    | ✅    |
| DEC-050              | Contabilidad formal dentro de Quatreros                 | CONT                 | BR contabilidad (conceptual); domain model                | **P-01..P-04**                       | ⛔    |
| DEC-051              | Contador con acceso                                     | CONT, ADM            | Rol Contador                                              | Q-SEC-03                             | 🟨    |
| DEC-060              | Stack                                                   | PLAT                 | ADRs; preparación del proyecto (Etapa F)                  | —                                    | ✅    |
| DEC-061              | 100 % cloud, sin offline                                | PLAT, POS, DIS       | RNF disponibilidad; contingencia                          | R-INF-03                             | ✅    |
| DEC-062 / DEC-082    | < $100k COP/mes (solo núcleo)                           | PLAT                 | RNF costos; deployment-design                             | Q-INF-02b, P-12                      | 🟨    |
| DEC-063              | 6–15 usuarios                                           | PLAT                 | RNF rendimiento/escalabilidad                             | P-11                                 | 🟨    |
| DEC-064              | Saldos iniciales y piloto paralelo                      | MIG                  | RF carga inicial; plan de piloto                          | P-04, P-16                           | 🟨    |
| DEC-070/071          | IA opcional, ERP sin IA                                 | IA, PLAT             | ai-architecture; feature flags; RNF desacople             | P-14                                 | ✅    |
| DEC-072/074          | Flujo de escritura con resumen y confirmación           | IA, ADM              | BR escrituras asistidas; RF propuesta/confirmación        | **P-10** (para habilitar escrituras) | 🟨    |
| DEC-073              | Consultas/alertas automáticas                           | IA                   | RF consultas IA                                           | Q-IA-01                              | 🟨    |
| DEC-075              | Sin cuotas individuales                                 | IA                   | RNF costos; medición de consumo                           | Q-IA-02                              | ✅    |
| DEC-076/077/078      | Telegram independiente; visión con voz                  | TG                   | telegram-architecture; RF vinculación/comandos            | **P-13**, P-14                       | 🟨    |
| DEC-080 (ex DEC-P01) | Procesos independientes vinculados                      | COMP, PROD, COM, DIS | domain-model; business-workflows                          | —                                    | ✅    |
| DEC-P02              | Costo promedio ponderado                                | INV, CONT            | BR valoración                                             | **P-03**                             | ⛔    |
| DEC-P09              | Partida doble y reversión                               | CONT                 | domain-model contable                                     | P-01                                 | ⛔    |
| DEC-P10              | Sin edición silenciosa                                  | Todos                | BR transversal; DB design                                 | Aprobación                           | 🟨    |
| DEC-P11/P12/P13      | Límites de costo IA, medición, abstracción de proveedor | IA                   | ai-architecture; RNF costos                               | P-14                                 | 🟨    |
| DEC-P14              | Controles de puesta en marcha                           | MIG                  | Plan de migración                                         | P-16                                 | 🟨    |
| DEC-P20/P21          | Eventos económicos y kardex inmutable                   | INV, CONT, todos     | database-design; ADR                                      | Aprobación técnica                   | ✅    |
| DEC-081 (ex DEC-P24) | Contabilidad en dos capas                               | CONT                 | module-boundaries; roadmap                                | Capa (b): P-01..P-04                 | 🟨    |

## 4. Proceso → decisiones → bloqueos (vista por flujo de negocio)

| Flujo de negocio                                   | Decisiones                | Bloqueos de implementación                      | Disp. global |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------- | ------------ |
| Gestión de usuarios, roles, sedes, auditoría       | DEC-040..044              | P-10 (solo matriz final; motor construible)     | 🟨           |
| Catálogo, presentaciones y precios                 | DEC-015, DEC-020          | P-06 (apertura), P-09 (descuentos)              | 🟨           |
| Compra → recepción de MP                           | DEC-013, DEC-016, DEC-080 | Impuestos en compras P-02                       | 🟨           |
| Receta → orden de producción → lote                | DEC-010..013              | P-03 (solo costeo)                              | 🟨           |
| Movimientos, traslados, ajustes, FEFO              | DEC-014, DEC-016, DEC-P21 | P-05 (vencidos)                                 | ✅           |
| Pedido → despacho → entrega (parcial) → devolución | DEC-023..026              | Q-COM-04                                        | 🟨           |
| Recaudo y liquidación de distribuidor              | DEC-027                   | **P-08**                                        | 🟨           |
| Crédito, cartera, abonos                           | DEC-021, DEC-022          | Q-COM-04                                        | 🟨           |
| POS: turno → venta → pagos mixtos → cierre         | DEC-031..033              | **P-02** (documento fiscal), P-09 (anulaciones) | 🟨           |
| Cocina: conteos y consumo teórico                  | DEC-034                   | **P-07**                                        | 🟨           |
| Contabilidad — capa (a) motor genérico             | DEC-050, DEC-081          | P-04 (plan de cuentas para cargar datos)        | 🟨           |
| Contabilidad — capa (b) reglas de contabilización  | DEC-050, DEC-P09, DEC-081 | **P-01..P-04**                                  | ⛔           |
| Asistente IA (consultas)                           | DEC-070, DEC-071, DEC-073 | Q-IA-01                                         | ✅           |
| Asistente IA (escrituras)                          | DEC-072, DEC-074          | **P-10**                                        | 🟨           |
| Telegram                                           | DEC-076..078              | **P-13**                                        | 🟨           |
| Carga inicial y piloto                             | DEC-064, DEC-P14          | P-04, P-16                                      | 🟨           |

## 5. Artefactos generados en Etapa B (2026-10-29)

| Módulo   | BR                     | RF                     | Bloqueados / pendientes                          |
| -------- | ---------------------- | ---------------------- | ------------------------------------------------ |
| ADM      | BR-001–010             | RF-001–008             | Umbrales AP (P-10)                               |
| CAT      | BR-020–025             | RF-030–033             | BR-024 (Q-COM-03)                                |
| COMP     | BR-040–044             | RF-050–053             | BR-044 (P-02)                                    |
| PROD     | BR-060–068             | RF-080–084             | BR-067 (Q-PRO-03), BR-068 (P-03)                 |
| INV      | BR-080–093             | RF-110–119             | BR-087/RF-119 (P-05), BR-090/RF-116 (P-06)       |
| COM      | BR-110–114             | RF-150–153             | BR-113/114, RF-153 (P-09)                        |
| DIS      | BR-120–128             | RF-180–186             | BR-127/RF-186 (P-08), BR-128 (Q-DIS-02)          |
| POS      | BR-140–150             | RF-220–227             | BR-149/RF-227 (P-07), BR-150 (P-02)              |
| FIN      | BR-170–178             | RF-260–266             | BR-173 (Q-COM-04); rentabilidad en RF-266 (P-03) |
| CONT     | BR-200–207             | RF-300–305             | BR-203–206, RF-304 (P-01..P-04)                  |
| IA       | BR-230–237             | RF-340–345             | RF-343 habilitación (P-10)                       |
| TG / MIG | BR-250–253, BR-260–261 | RF-370–372, RF-375–376 | BR-253/RF-372 (P-13)                             |
| RNF      | —                      | RNF-001–134 (58)       | Valores numéricos PENDING                        |

Flujos: `business-workflows.md` WF-01..WF-11 · Datos: `data-requirements.md` DR-001..025 · Integraciones: `integrations.md` INT-01..09 · Permisos: `actors-permissions.md` (AP-01..AP-10).

## 6. Artefactos generados en Etapa C (2026-10-29)

| Documento                     | Cubre                                                                       | Decisiones/requerimientos de origen         |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `system-overview.md`          | Componentes, capas, flujos, entornos                                        | DEC-060, DEC-071, PM §4                     |
| `module-boundaries.md`        | 13 módulos, dependencias, transacciones cruzadas, flags de bloqueos         | DEC-080, DEC-081, ADR-001                   |
| `domain-model.md`             | Agregados, invariantes, estados, correspondencia proceso↔entidad            | BR-001..261, WF-01..11                      |
| `database-design.md` + `sql/` | 79 tablas en 14 esquemas, restricciones, estrategia transaccional; validado | DR-001..025, BR-081, BR-201/202             |
| `api-design.md`               | Convenciones, errores, paginación, idempotencia, mapa de endpoints          | RF-001..376, BR-007                         |
| `security-design.md`          | Autenticación, RBAC+sede+canal, aprobaciones, auditoría, secretos           | DEC-040..044, RNF-001..023                  |
| `ai-architecture.md`          | Herramientas, flujo de 10 pasos, costos, errores                            | DEC-070..075, BR-230..237                   |
| `telegram-architecture.md`    | Vinculación, comandos, voz, clasificación con/sin IA                        | DEC-076..078, BR-250..253                   |
| `deployment-design.md`        | Topología, CI/CD, respaldos, contingencia, costos                           | DEC-061/062/082, RNF-040..047, RNF-110..113 |
| `architecture-decisions.md`   | ADR-001..022                                                                | DEC-P03, P05, P06, P13, P20–P23             |

## 7. Mantenimiento de la matriz

- Al crear un `BR-`/`RF-`/`RNF-` en la Etapa B, se agrega a la columna "Artefactos" de su decisión de origen.
- Cuando una pregunta de `open-questions.md` se responde, la decisión resultante se registra en `decision-register.md` con nuevo `DEC-###` y esta matriz se actualiza (disponibilidad y bloqueos).
- Ningún requerimiento puede existir sin al menos una fila de origen en esta matriz.
