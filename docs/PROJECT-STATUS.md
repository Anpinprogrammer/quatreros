# Estado del proyecto Quatreros

> Actualizado: 2026-10-29

| Etapa                         | Entregable                                                                     | Estado                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A — Descubrimiento            | `docs/00-discovery/` (6 documentos)                                            | **Completado y revisado** — DEC-080/081/082 aprobadas el 2026-10-29                                      |
| B — Requerimientos            | `docs/01-requirements/` (7 documentos: 100 BR, 74 RF, 58 RNF)                  | **Completado** — pendiente revisión; decisiones Q-B-01..09                                               |
| Cuestionario al contador      | Q-CON-01..07, Q-POS-04, Q-SEC-03                                               | Enviado al responsable para remitir al contador                                                          |
| C — Arquitectura              | `docs/02-architecture/` (10 documentos + esquema SQL validado)                 | **Completado** — pendiente revisión; decisiones Q-C-01..06                                               |
| D — Diseño IA                 | `docs/02-architecture/ai-architecture.md`                                      | **Completado (diseño)** — benchmark de modelo pendiente antes de la demo                                 |
| E — Telegram                  | `docs/02-architecture/telegram-architecture.md`                                | **Completado (diseño)** — alcance sin IA propuesto, espera Q-C-04                                        |
| F — Preparación del proyecto  | Monorepo, API base, web base, CI/CD, Docker, respaldos (verificado)            | **Completado** — base verificada                                                                         |
| G — Roadmap                   | `docs/03-planning/roadmap-prototipo.md`                                        | **En curso** — entrega 1 terminada (ingreso, usuarios, roles, sedes); sigue la 2 (ver `docs/HANDOFF.md`) |
| Sistema de diseño             | `docs/05-design/sistema-de-diseno.md` (original en `docs/05-design/original/`) | **Adoptado (DEC-086)** — base visual única; entrega 1 rehecha con él; isotipo oficial pendiente          |
| Contabilidad (implementación) | —                                                                              | **Bloqueado** por P-01..P-04                                                                             |

## Prototipo — avance

| Entrega | Contenido                                                                                                                                                                                                                           | Verificación                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 ✅    | Ingreso con correo y contraseña, segundo factor (TOTP) obligatorio para ADM/MGR/CONT, cada rol a su pantalla (ERP, Caja, Ruta), gestión de usuarios con roles y sedes, desactivar/reactivar con protección del último administrador | 49 unitarias, 27 integración (PGlite y PostgreSQL 17), 22 E2E (flujos + accesibilidad axe) en escritorio/tableta/móvil |

Cómo mostrarlo en local: `docs/operations/demo-local.md`.

## Decisiones abiertas que esperan al responsable

| Grupo    | IDs                                                                                           | Bloquea                                                        |
| -------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Etapa B  | Q-B-01..09 (matriz de permisos, umbrales, expiraciones, cocina, crédito, tránsito, negativos) | Escrituras por IA/Telegram; detalle de varias especificaciones |
| Etapa C  | Q-C-01..06 (hosting, RPO/RTO, contingencia, Telegram, lista blanca IA, techo IA)              | Despliegue y demo                                              |
| Contador | Q-CON-01..07 (cuestionario enviado)                                                           | Contabilización, impuestos, costeo                             |

## Orden propuesto de especificación

1. Transversal: actores y permisos (borrador de matriz P-10), reglas de inmutabilidad/auditoría, glosario cerrado.
2. Catálogo e Inventarios (unidad base, presentaciones, ubicaciones, lotes, movimientos, FEFO, traslados).
3. Compras y recepción.
4. Producción (recetas, órdenes, lotes, rendimiento).
5. Comercial y Cartera (clientes, crédito, pedidos).
6. Distribución (despacho, entrega parcial, devolución, recaudo, liquidación).
7. POS y cocina.
8. Finanzas: conciliaciones.
9. Contabilidad — capa genérica; reglas de contabilización tras sesión con contador.
10. IA (consultas → escrituras).
11. Telegram.
12. Migración y piloto.
