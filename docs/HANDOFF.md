# Traspaso — estado al 2026-10-29

> Para el siguiente agente o desarrollador. Léelo después de `AGENTS.md`. Actualízalo al terminar cada trabajo.

## 1. Dónde está el proyecto

| Etapa                                                                         | Estado                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A–E: descubrimiento, requerimientos, arquitectura, diseño de IA y de Telegram | Completas (`docs/00-discovery` … `docs/02-architecture`)                  |
| F: preparación del repositorio, CI/CD, respaldos                              | Completa y verificada                                                     |
| G: roadmap del prototipo                                                      | Aprobado (DEC-083). 8 entregas en `docs/03-planning/roadmap-prototipo.md` |
| Sistema de diseño                                                             | Adoptado (DEC-086): `docs/05-design/sistema-de-diseno.md`                 |
| **Entrega 1**: ingreso, usuarios, roles y sedes                               | **Terminada** en `main`                                                   |
| **Entrega 2**: catálogo e inventario                                          | **Siguiente.** No iniciada                                                |

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

## 2. Siguiente tarea: entrega 2, catálogo e inventario

**Objetivo demostrable:**

- Productos en unidad y paquete, materias primas y precios.
- Existencias por lote y vencimiento, con salida FEFO.
- Traslado bodega → punto de venta y trazabilidad de un lote.

Procedimiento: skill `.claude/skills/quatreros-entrega`.

### RF incluidos y su estado

| RF     | Tema                       | Estado                                    | Ojo con                                                                                                                          |
| ------ | -------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| RF-030 | Productos y presentaciones | CONFIRMED                                 | Q-PRO-04                                                                                                                         |
| RF-031 | Materias primas            | CONFIRMED                                 | Empaques como insumo no alimentario: confirmar término en el glosario                                                            |
| RF-032 | Precios con histórico      | CONFIRMED                                 | Q-COM-03 (efecto en pedidos abiertos)                                                                                            |
| RF-033 | Recetas con versiones      | CONFIRMED                                 | Q-PRO-01 (subproductos). Puede pasar a la entrega 4 si alarga la 2                                                               |
| RF-110 | Consulta de existencias    | CONFIRMED                                 | —                                                                                                                                |
| RF-111 | Kardex                     | PROPOSED                                  | El mecanismo inmutable ya está aprobado (DEC-P21 / ADR-009); la **pantalla** de consulta necesita el visto bueno del responsable |
| RF-112 | Asignación FEFO            | CONFIRMED                                 | —                                                                                                                                |
| RF-113 | Excepción FEFO             | CONFIRMED                                 | Q-INV-03; usa aprobaciones (RF-007)                                                                                              |
| RF-114 | Traslado entre ubicaciones | CONFIRMED · tránsito PROVISIONAL (Q-B-07) | Q-POS-01                                                                                                                         |
| RF-117 | Bloqueo de lotes           | PROPOSED                                  | Depende de P-05: **no implementar** más allá de lo conceptual                                                                    |
| RF-118 | Trazabilidad de lote       | CONFIRMED                                 | —                                                                                                                                |

**Fuera de la entrega 2 (bloqueado):**

- RF-116, apertura de paquetes (P-06).
- RF-119, vencidos y retiros (P-05).

**Reglas provisionales aplicables (DEC-083):**

- Q-B-07: estados "en tránsito" y "en ruta".
- Q-B-08: no se permiten existencias negativas.

Impleméntalas configurables y señalizadas.

### Orden sugerido (tres PRs)

1. **2a. Catálogo:** RF-030 a RF-032 (y RF-033 si cabe).
   - Especificación en `docs/04-specifications/cat/catalogo.md`.
   - Módulo `modules/catalog`, contratos y semilla demo con productos reales de la empresa según el Documento Maestro: chorizo, rellena, paquete x10…
   - Pantallas bajo la pestaña "04. Producción" o una sección de catálogo; acordarlo con el sistema de diseño.
2. **2b. Lotes, existencias y kardex:** RF-110, RF-111 y RF-118.
   - Especificación en `docs/04-specifications/inv/existencias.md`.
   - Movimientos inmutables y saldos derivados (ADR-009); las cantidades en unidad base (DEC-P22).
3. **2c. FEFO y traslados:** RF-112 a RF-114.
   - Activa la tarjeta "Alertas FEFO" del Command Center con datos reales.
   - Muestra las existencias en Caja (solo lectura hasta la entrega 6).

En cada PR: actualizar `shared/modules.ts` (módulos `available`), la matriz de trazabilidad, `PROJECT-STATUS.md`, el guion `docs/operations/demo-local.md` y este archivo.

## 3. Pendientes que dependen del responsable (no los resuelvas por tu cuenta)

| Pendiente                                                                                                             | Dónde                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Archivo del **isotipo** oficial para reemplazar el logotipo provisional (`shared/ui/Brand.tsx`, `public/favicon.svg`) | Sistema de diseño, Anexo B                                                                       |
| Confirmar las reglas provisionales Q-B-01..09 **antes del piloto**                                                    | `open-questions.md`                                                                              |
| Hosting y operación: Q-C-01..06                                                                                       | `open-questions.md`                                                                              |
| Cuestionario del contador: Q-CON-01..07, Q-POS-04, Q-SEC-03                                                           | Bloquea contabilidad e impuestos                                                                 |
| PRs de Dependabot #5 y #6: no fusionar sin aprobación                                                                 | GitHub                                                                                           |
| Texto de una línea por rol en "Crear usuario" (qué puede hacer cada uno)                                              | Recomendación de la crítica de diseño; redactar desde `actors-permissions.md` y pedir aprobación |
| Descripción pendiente: pestañas extra del ERP (Compras, Cartera, Administración) y ajustes AA                         | Sistema de diseño, Anexos A y B; el responsable puede pedir cambios                              |

## 4. Notas de entorno

- Contraseña de usuarios demo: la que pongas en `DEMO_PASSWORD`; nunca se guarda en el repositorio. CI usa una propia en su base efímera.
- `pnpm db:reset:demo` deja la base como recién sembrada; el E2E del administrador lo necesita.
- Entornos aislados sin Docker ni descarga de navegadores: PostgreSQL embebido o el que haya, `TEST_DB=pglite` para integración y `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para E2E (ver `AGENTS.md` §6).
