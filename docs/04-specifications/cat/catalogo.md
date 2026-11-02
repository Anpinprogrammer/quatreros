# Especificación — Entrega 2a: catálogo, presentaciones y precios

> Estado: **BORRADOR para revisión del responsable** · 2026-11-02
> Cubre RF-030, RF-031 y RF-032. Decisiones aplicables: DEC-015, DEC-020, DEC-090, DEC-091.
> Reglas `PROVISIONAL` (DEC-083): composición de paquete inmutable (BR-021) y precio de paquete independiente del de unidad (BR-025).
> La implementación no empieza hasta que esta especificación esté aprobada.

## 1. Objetivo y alcance

Que el administrador pueda dejar listo el catálogo que todo lo demás necesita: qué se vende, en qué presentaciones, a qué precio y con qué vida útil; y qué materias primas se compran y en qué unidad se controlan.

**Incluye:**

- Productos fabricados y alimentos preparados, con unidad base, vida útil (solo fabricados) y estado.
- Presentaciones por producto (unidad, paquete × N) con composición fija.
- Materias primas con unidad de inventario y control de vencimiento.
- Precio único vigente por presentación, con histórico y vigencia.
- Consulta y edición desde la pestaña **04. Producción** (DEC-091), con permisos por rol y auditoría.
- Semilla demo con productos, materias primas y precios ficticios.

**No incluye (queda para después):**

| Tema                                                      | Motivo                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| RF-033 recetas y versiones                                | Se propone moverlo a la entrega 4 (producción); ver §10     |
| Precio congelado en pedidos abiertos (BR-024, Q-COM-03)   | No hay pedidos hasta la entrega 5                           |
| Descuentos, listas de precios por cliente (P-09, DEC-020) | Decisiones abiertas                                         |
| Impuestos, facturación y costo de lote (P-01..P-04)       | Bloqueado                                                   |
| Apertura de paquete (P-06)                                | Bloqueado; solo se modela la composición                    |
| Imágenes, códigos de barras y carga masiva                | No están en el Documento Maestro ni en el sistema de diseño |
| Punto de reorden y sugerencias (Q-PRO-03)                 | Regla de negocio sin decisión; no se incluye la columna     |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura en esta entrega                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| RF-030  | Completo: tipo, unidad base, presentaciones, vida útil y estado                                                               |
| RF-031  | Completo: materias primas, unidad y control de vencimiento; sin empaques (ver §9)                                             |
| RF-032  | Completo: precio vigente único, cierre de vigencia anterior, histórico y auditoría                                            |
| BR-020  | Unidad base + una o más presentaciones; paquete con cantidad fija (`units_per > 0`)                                           |
| BR-021  | `PROVISIONAL`: no se cambia la composición si la presentación tiene existencias o movimientos; se crea una presentación nueva |
| BR-022  | Un único precio vigente por presentación (índice único parcial `valid_to IS NULL`)                                            |
| BR-023  | Todo cambio de precio cierra la vigencia anterior y abre una nueva; no toca ventas pasadas                                    |
| BR-025  | `PROVISIONAL`: precio de paquete y de unidad se configuran por separado                                                       |
| DEC-090 | Vida útil fija por producto (`shelf_life_days`), editable con permiso `cat.product.manage`                                    |
| DEC-044 | Auditoría de altas, cambios y precios                                                                                         |

**Fuera de esta entrega:** BR-024 (precio del pedido), BR-090 (apertura de paquete), RF-116 y RF-119.

## 3. Modelo de datos (esquema `catalog`)

Se implementa el diseño de `database-design.md` §2, con estos ajustes justificados:

| Tabla                   | Columnas                                                                                                 | Restricciones                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `catalog.products`      | `id`, `name`, `kind`, `base_unit`, `shelf_life_days`, `is_active`, `version`, `created_at`, `updated_at` | `name` único; `kind IN ('manufactured','prepared')`; `shelf_life_days > 0`; fabricado exige vida útil; `version > 0` |
| `catalog.presentations` | `id`, `product_id`, `name`, `units_per`, `is_active`, `version`, `created_at`, `updated_at`              | FK a producto; `units_per > 0`; único `(product_id, name)`; `version > 0`                                            |
| `catalog.price_history` | `id`, `presentation_id`, `price`, `valid_from`, `valid_to`, `set_by`, `created_at`                       | FK a presentación y a `admin.users`; `price > 0`; `valid_to > valid_from`; índice único parcial de vigente           |
| `catalog.raw_materials` | `id`, `name`, `unit`, `tracks_expiry`, `is_active`, `version`, `created_at`, `updated_at`                | `name` único; `unit` no vacía; `version > 0`                                                                         |

Decisiones de modelo:

- **Cantidades** `NUMERIC(14,3)` y **dinero** `NUMERIC(14,2)`, siempre como cadena decimal en la API (DEC-P22).
- **`base_unit`** es texto validado contra una lista corta de unidades (`unidad`, `kg`, `g`, `l`, `ml`, `m`). La lista vive en `packages/contracts`; ampliarla es un cambio de una línea. Los productos usan `unidad` por defecto; las materias primas usan kg, unidad o metro.
- **`kind` es inmutable.** Cambiar de fabricado a preparado cambia el significado del producto y sus recetas; si se necesita, se crea otro producto y se inactiva el anterior.
- **`base_unit` y `unit` son inmutables cuando hay existencias o movimientos.** La comprobación se hace en el caso de uso a través de un puerto `InventoryUsage` que en 2a devuelve `false` (todavía no existe inventario) y en 2b consulta `stock_balances` y `stock_movements`. Si devuelve `true`, responde `409 UNIT_LOCKED`.
- **`units_per` es inmutable cuando la presentación tiene existencias o movimientos** (BR-021, PROVISIONAL). Mismo puerto, error `409 PRESENTATION_LOCKED`; la alternativa es crear una presentación nueva y desactivar la anterior.
- **No se borra nada:** productos, presentaciones y materias primas se inactivan (`is_active = false`), nunca se eliminan (DR-008).
- **`version`** habilita edición concurrente con `If-Match` (mismo patrón que usuarios).
- **`price_history`**: la fila vigente tiene `valid_to IS NULL`. Un cambio de precio actualiza `valid_to` de la fila vigente e inserta la nueva en la misma transacción, bloqueando la presentación con `FOR UPDATE`. No se edita ni se borra el histórico.
- **`reorder_point` no se incluye** en 2a: depende de Q-PRO-03 (criterio de sugerencias).

## 4. Contrato de API

Prefijo `/api/v1`. Respuestas con sobre `{ data }`; listas con paginación por cursor (`limit`, `cursor`, `nextCursor`). Errores según `api-design.md`.

| Método y ruta                               | Permiso                   | Descripción                                                                     |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `GET /catalog/products`                     | `cat.product.read`        | Lista con filtros `q`, `kind`, `status` y sus presentaciones con precio vigente |
| `POST /catalog/products`                    | `cat.product.manage`      | Crea producto. Idempotente                                                      |
| `PATCH /catalog/products/{id}`              | `cat.product.manage`      | Edita nombre, vida útil o estado (`If-Match`)                                   |
| `POST /catalog/products/{id}/presentations` | `cat.product.manage`      | Crea presentación (`name`, `unitsPer`). Idempotente                             |
| `PATCH /catalog/presentations/{id}`         | `cat.product.manage`      | Edita nombre, composición o estado (`If-Match`)                                 |
| `GET /catalog/presentations/{id}/prices`    | `cat.product.read`        | Histórico de precios, más reciente primero                                      |
| `POST /catalog/presentations/{id}/prices`   | `cat.price.update`        | Fija precio nuevo y cierra el vigente. Idempotente                              |
| `GET /catalog/raw-materials`                | `cat.raw_material.read`   | Lista con filtros `q`, `status`                                                 |
| `POST /catalog/raw-materials`               | `cat.raw_material.manage` | Crea materia prima. Idempotente                                                 |
| `PATCH /catalog/raw-materials/{id}`         | `cat.raw_material.manage` | Edita nombre, unidad, control de vencimiento o estado (`If-Match`)              |

**Reglas de contrato:**

- `price`, `unitsPer` y cantidades viajan como cadenas (`"1300.00"`, `"10.000"`), nunca como `number`.
- `POST` de creación y de precio exigen `Idempotency-Key` (UUID). Misma clave y mismo cuerpo → misma respuesta.
- `PATCH` acepta `If-Match: "v<n>"`; si la versión no coincide → `412 PRECONDITION_FAILED`.
- Un producto inactivo no admite presentaciones nuevas ni precios nuevos → `409 PRODUCT_INACTIVE`.
- Una presentación inactiva no admite precios nuevos → `409 PRESENTATION_INACTIVE`.
- Crear precio sobre una presentación sin precio vigente simplemente abre el primero.

**Errores propios:**

| Código                  | HTTP | Cuándo                                                          |
| ----------------------- | ---- | --------------------------------------------------------------- |
| `NAME_TAKEN`            | 409  | Ya existe un producto o materia prima con ese nombre            |
| `PRESENTATION_EXISTS`   | 409  | Ya existe esa presentación en el producto                       |
| `PRODUCT_INACTIVE`      | 409  | Se intenta agregar presentación o precio a un producto inactivo |
| `PRESENTATION_INACTIVE` | 409  | Se intenta fijar precio a una presentación inactiva             |
| `UNIT_LOCKED`           | 409  | Se intenta cambiar la unidad con existencias o movimientos      |
| `PRESENTATION_LOCKED`   | 409  | Se intenta cambiar la composición con existencias o movimientos |

**Permisos efectivos (matriz actual):** ADM puede todo; MGR y COMP gestionan materias primas pero no productos ni precios; CONT lee; CAJ y DIST no entran al shell ERP. El catálogo es dato maestro de la empresa, no por sede: el alcance `SITE` de `cat.raw_material.manage` solo habilita la edición, no filtra registros.

## 5. Pantallas

Módulo **Catálogo y precios** dentro de **04. Producción** (DEC-091), ruta `/erp/catalogo`, permiso de entrada `cat.product.read`.

| Pantalla                                 | Contenido y estados                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo (`/erp/catalogo`)               | Dos pestañas internas: **Productos** y **Materias primas**. Carga (`aria-busy`), vacío con acción "Crear el primero", error con reintento, sin permiso de escritura (solo lectura) |
| Producto (`/erp/catalogo/productos/:id`) | Ficha con tipo, unidad base, vida útil, estado; tarjetas de presentación con precio vigente en mono; histórico de precios; acciones según permiso                                  |
| Formularios                              | Crear/editar producto, presentación, precio y materia prima. Foco al primer campo al abrir; resumen de errores con foco al fallar; cancelar cierra sin guardar                     |

**Diseño:** solo tokens y componentes de `shared/ui/`. Los montos, cantidades y códigos van en `font-mono` alineados a la derecha. Se agrega `SelectField` a `shared/ui/` con los mismos tokens y altura mínima de `TextField` (48 px), porque el kit no trae selección simple; es una extensión del kit, no un lenguaje visual nuevo. Las listas usan tarjetas (`Card`) en rejilla, no tablas.

**Accesibilidad:** cada pantalla se agrega a `apps/web/e2e/accesibilidad.spec.ts` (axe sin hallazgos y sin desplazamiento horizontal) en escritorio, tableta y celular. `useDocumentTitle` en cada una; acciones con nombre accesible; estados anunciados con `aria-live`.

**Command Center:** el catálogo no agrega tarjetas. "Existencias y traslados" se activa en 2b/2c.

## 6. Auditoría

| Acción                    | Entidad                | Antes/después                                                |
| ------------------------- | ---------------------- | ------------------------------------------------------------ |
| `cat.product.create`      | `catalog.product`      | `name`, `kind`, `baseUnit`, `shelfLifeDays`                  |
| `cat.product.update`      | `catalog.product`      | campos modificados y `isActive`                              |
| `cat.presentation.create` | `catalog.presentation` | `productId`, `name`, `unitsPer`                              |
| `cat.presentation.update` | `catalog.presentation` | campos modificados y `isActive`                              |
| `cat.raw_material.create` | `catalog.raw_material` | `name`, `unit`, `tracksExpiry`                               |
| `cat.raw_material.update` | `catalog.raw_material` | campos modificados y `isActive`                              |
| `cat.price.create`        | `catalog.price`        | `presentationId`, precio anterior, precio nuevo, `validFrom` |

El actor sale de la sesión, nunca del cuerpo de la petición. Los cambios de precio son auditables por DEC-044 y DEC-P07.

## 7. Criterios de aceptación

```gherkin
Escenario: crear un producto fabricado
  Dado un administrador con sesión y segundo factor
  Cuando crea "Chorizo Santarrosano" tipo fabricado, unidad base "unidad" y vida útil 30 días
  Entonces el producto queda activo y visible en el catálogo
  Y queda un evento de auditoría cat.product.create

Escenario: vida útil obligatoria en fabricados
  Cuando intenta crear un producto fabricado sin vida útil
  Entonces recibe 422 VALIDATION_FAILED

Escenario: producto preparado sin vida útil
  Cuando crea "Picada Quatreros XL" tipo preparado sin vida útil
  Entonces se acepta y no exige vencimiento

Escenario: crear presentaciones
  Dado "Chorizo Santarrosano" activo
  Cuando agrega "Unidad" con 1 unidad base y "Paquete x10" con 10
  Entonces ambas quedan disponibles con precio pendiente
  Y no se permite "Paquete x10" dos veces (409 PRESENTATION_EXISTS)

Escenario: composición inválida
  Cuando intenta crear una presentación con 0 unidades base
  Entonces recibe 422 VALIDATION_FAILED

Escenario: fijar precio
  Dado "Paquete x10" activo y sin precio
  Cuando el administrador fija 12.000,00
  Entonces queda un precio vigente
  Y el histórico muestra una entrada con vigencia abierta

Escenario: cambiar precio
  Dado "Paquete x10" con precio vigente de 12.000,00
  Cuando el administrador fija 13.000,00
  Entonces el precio anterior queda cerrado
  Y queda un único precio vigente de 13.000,00
  Y la auditoría registra el valor anterior y el nuevo

Escenario: precio inválido
  Cuando el administrador fija 0 o un valor negativo
  Entonces recibe 422 VALIDATION_FAILED

Escenario: dos cambios de precio simultáneos
  Cuando dos administradores fijan precios distintos al mismo tiempo
  Entonces la base conserva un solo precio vigente
  Y el histórico contiene ambas vigencias, sin huecos

Escenario: precio de paquete independiente
  Dado "Unidad" a 1.300,00 y "Paquete x10" a 12.000,00
  Entonces ambos precios se conservan y el sistema no deriva uno del otro

Escenario: permiso de productos
  Dado un manager con sesión
  Cuando intenta crear un producto
  Entonces recibe 403 FORBIDDEN

Escenario: materia prima por manager
  Dado un manager con sesión
  Cuando crea "Carne de cerdo magra" en kg con control de vencimiento
  Entonces se crea y queda auditada

Escenario: materia prima por comprador
  Dado un comprador con sesión
  Cuando crea una materia prima
  Entonces se crea
  Y si intenta cambiar un precio recibe 403 FORBIDDEN

Escenario: unidad bloqueada por movimientos
  Dado un producto con existencias o movimientos
  Cuando alguien intenta cambiar su unidad base
  Entonces recibe 409 UNIT_LOCKED

Escenario: composición bloqueada por movimientos
  Dado un paquete con existencias o movimientos
  Cuando alguien intenta cambiar sus unidades base por paquete
  Entonces recibe 409 PRESENTATION_LOCKED
  Y la alternativa es crear una presentación nueva

Escenario: alta duplicada
  Cuando se envía dos veces la misma creación con la misma Idempotency-Key
  Entonces se crea un solo registro y la segunda respuesta es la misma

Escenario: edición concurrente
  Dado un producto en versión 1
  Cuando dos personas lo editan con If-Match "v1"
  Entonces la segunda recibe 412 PRECONDITION_FAILED
```

## 8. Pruebas

- **Unitarias (dominio):** vida útil obligatoria en fabricados; `units_per > 0`; nombre único; una sola vigencia; cierre de vigencia anterior; `kind` inmutable; unidad bloqueada cuando el puerto dice que hay uso; independencia de precios unidad/paquete.
- **Integración (PostgreSQL real y PGlite):** crear producto, presentaciones y precios con auditoría; 422 de validación; 403 por rol (manager/productos, comprador/precios); 409 de duplicados, producto inactivo y unidad bloqueada (con puerto simulado); 404 de presentación inexistente; idempotencia; concurrencia de dos precios; `If-Match` 412.
- **E2E (Playwright):** administrador entra a 04. Producción → Catálogo → crea "Chorizo Santarrosano" con dos presentaciones → fija precios → ve el histórico. Manager entra, crea una materia prima y no ve acciones de producto. Cada pantalla en `accesibilidad.spec.ts` en tres tamaños.

## 9. Datos de demostración

Ficticios, cargados por `modules/catalog/infrastructure/seed.ts` desde `cli/seed-demo.ts` (nunca en producción):

| Producto             | Tipo      | Unidad base | Vida útil | Presentaciones y precio vigente (COP)   |
| -------------------- | --------- | ----------- | --------- | --------------------------------------- |
| Chorizo Santarrosano | Fabricado | unidad      | 30 días   | Unidad 1.300,00 · Paquete x10 12.000,00 |
| Rellena Mixta        | Fabricado | unidad      | 30 días   | Unidad 1.200,00 · Paquete x10 11.000,00 |
| Picada Quatreros XL  | Preparado | unidad      | —         | Porción 45.000,00                       |

| Materia prima        | Unidad | Controla vencimiento |
| -------------------- | ------ | -------------------- |
| Carne de cerdo magra | kg     | Sí                   |
| Tocino y grasa       | kg     | Sí                   |
| Mix de especias      | kg     | Sí                   |
| Tripa natural        | metro  | Sí                   |

El histórico de "Chorizo Santarrosano · Unidad" conserva un precio anterior (1.200,00 vigente hasta el 2026-10-01) para mostrar la pantalla de histórico. Los empaques **no** se siembran: el glosario aún no confirma si son materia prima (`Insumo` PROPOSED).

## 10. Alcance pendiente de aprobación

**RF-033 (recetas).** Se propone moverlo a la entrega 4 (producción): las recetas solo se usan al crear órdenes, y en 2a no hay materias primas con lote ni forma de probarlas de punta a punta. Si el responsable prefiere mantenerlo en 2a, se agregan `recipes`, `recipe_versions` y `recipe_lines` con versión vigente única y pruebas propias; no cambia el resto de esta especificación.

**Empaques como materia prima.** Queda fuera de la semilla hasta confirmar el término en el glosario (`Insumo` PROPOSED). El modelo lo admite sin cambios: sería una materia prima con `tracks_expiry = false`.

## 11. Condiciones de inicio y definición de terminado

**Antes de programar:** esta especificación aprobada; RF-033 decidido (incluir o mover); glosario de empaques sin bloqueo para 2a.

**Terminado cuando:**

- Contratos, esquema y migración revisados; `catalog` agregado a `schemaFilter` y al índice de esquemas.
- Casos de uso con permisos, transacción, auditoría e idempotencia; `InventoryUsage` como puerto con implementación vacía.
- Semilla demo y pantallas en `/erp/catalogo`; módulo `available` en `shared/modules.ts`.
- `pnpm check`, integración con PGlite y PostgreSQL real, `pnpm build && pnpm db:reset:demo && pnpm test:e2e` en verde.
- `PROJECT-STATUS.md`, roadmap, matriz de trazabilidad, `demo-local.md` y `HANDOFF.md` actualizados.
