# Especificación — Entrega 4: recetas, órdenes de producción y cierre

> Estado: **APROBADA E IMPLEMENTADA** · 2026-11-02
> Cubre RF-033, RF-081, RF-082 y RF-083. RF-080 (sugerencias) queda fuera por Q-PRO-03; RF-084 (anulación) por P-09.
> Reglas `PROVISIONAL`: BR-066 (tolerancia de rendimiento) aprobada en **DEC-096**; BR-081 (sin negativos) sigue vigente por Q-B-08.
> Costo oficial del lote PT: **BLOCKED** por P-03. Se capturan cantidades y costos de la MP consumida, sin calcular costo de producción.

## 1. Objetivo y alcance

Que el productor convierta materia prima en producto terminado con trazabilidad completa: receta versionada, orden planificada, consumo real por lote de MP, lote PT con fabricación/vencimiento y rendimiento contra lo esperado.

**Incluye:**

- Recetas de producción por producto fabricado, con versiones inmutables.
- Orden de producción con producto, receta vigente, cantidad planificada, sede y responsable.
- Consumo real por lote de materia prima, con sugerencia FEFO y descuento de existencias.
- Cierre con producción real por presentación, lote PT, rendimiento y motivo fuera de tolerancia.
- Trazabilidad N:M: lote PT vinculado a todos los lotes de MP consumidos.
- Pantallas en **04. Producción → Recetas** y **Órdenes de producción**.
- Semilla demo con dos recetas y una orden planificada.

**No incluye:**

| Tema                                                  | Motivo                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| RF-080 sugerencias por punto de reorden               | PENDING Q-PRO-03: no hay criterio aprobado; no se inventan umbrales.   |
| RF-084 anulación/reversión de orden                   | PROPOSED; requiere aprobación (RF-007/P-09).                           |
| Costo oficial del lote PT y valoración                | BLOCKED P-03; se capturan cantidades y costos de MP sin costo de lote. |
| Recetas de platos (`kind = dish`) y consumo de cocina | Entrega 6 / Q-POS-01; solo se implementa `kind = production`.          |
| Subproductos o rendimiento por peso                   | Q-PRO-01 resuelta sin subproductos; cantidades en unidad base.         |
| Mermas y clasificación de desperdicios                | P-07; la diferencia de rendimiento se registra, no se clasifica.       |
| Reservas de MP y planificación automática             | No aprobadas; la orden solo advierte disponibilidad.                   |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                   |
| ------- | --------------------------------------------------------------------------- |
| RF-033  | Receta de producción por producto, versiones e ingredientes (DEC-092)       |
| RF-081  | Orden con producto, cantidad, receta vigente, sede y responsable            |
| RF-082  | Consumo real por lote de MP, FEFO sugerido y vínculo con la orden           |
| RF-083  | Producción real por presentación, lote PT, rendimiento y motivo             |
| BR-060  | Producción para inventario, sin pedido de cliente                           |
| BR-061  | La orden la crea una persona; no hay generación automática                  |
| BR-062  | La orden congela la versión de receta vigente al crearse (DEC-095)          |
| BR-063  | Se registra consumo teórico y real                                          |
| BR-064  | Consumo por lote de MP y enlace N:M con el lote PT (DEC-097)                |
| BR-065  | Producción real, lote PT y rendimiento real/esperado                        |
| BR-066  | `PROVISIONAL` (DEC-096): tolerancia por receta; fuera de rango exige motivo |
| BR-068  | Sin costo oficial de lote hasta P-03                                        |
| BR-081  | Ningún consumo deja existencia negativa (Q-B-08)                            |
| DEC-090 | Vencimiento del lote PT = fabricación + vida útil del producto              |
| DEC-095 | Receta única por producto fabricado y versionada                            |
| DEC-096 | Producción real por presentación y tolerancia configurable                  |
| DEC-097 | Varios lotes de MP por lote PT                                              |
| DEC-044 | Auditoría de recetas, órdenes, consumo y cierre                             |

## 3. Modelo de datos

### 3.1 `catalog.recipes` y versiones

Se implementa el diseño preliminar:

| Tabla                     | Columnas                                                                                                                             | Restricciones                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.recipes`         | `id`, `kind`, `product_id`                                                                                                           | `kind IN ('production','dish')`; único `(kind, product_id)`; solo `production` en esta entrega                                                           |
| `catalog.recipe_versions` | `id`, `recipe_id`, `version`, `base_output_qty`, `expected_yield_pct`, `tolerance_pct`, `is_current`, `published_at`, `published_by` | `version > 0`; único `(recipe_id, version)`; único parcial de `is_current`; `base_output_qty > 0`; `0 < expected_yield_pct <= 100`; `tolerance_pct >= 0` |
| `catalog.recipe_lines`    | `recipe_version_id`, `raw_material_id`, `quantity`                                                                                   | `quantity > 0`; único `(recipe_version_id, raw_material_id)`; solo materias primas en recetas de producción                                              |

- `base_output_qty` está en unidad base del producto (p. ej. 100 unidades de chorizo).
- Los ingredientes son cantidades de MP para esa producción base.
- `expected_yield_pct` por defecto **100** y `tolerance_pct` por defecto **3**; ambos configurables por versión (DEC-096).
- Publicar una versión nueva marca la anterior como no vigente e inserta la siguiente en la misma transacción. No se edita una versión publicada.
- Una receta solo aplica a productos fabricados; un producto preparado no lleva receta de producción.

### 3.2 `production.orders`

| Columna             | Tipo / regla                                                |
| ------------------- | ----------------------------------------------------------- |
| `id`                | `uuid` PK                                                   |
| `number`            | texto único; consecutivo `OP-0001` (DR-005)                 |
| `site_id`           | FK a `admin.sites`                                          |
| `product_id`        | FK a `catalog.products`                                     |
| `recipe_version_id` | FK a `catalog.recipe_versions`; congela la versión (BR-062) |
| `planned_qty`       | `NUMERIC(14,3) > 0`, en unidad base                         |
| `actual_qty`        | `NUMERIC(14,3) >= 0`, nullable hasta cerrar                 |
| `yield_pct`         | `NUMERIC(6,2)`, nullable                                    |
| `yield_note`        | texto, obligatorio si el rendimiento sale de tolerancia     |
| `output_lot_id`     | FK única a `inventory.lots`, nullable hasta cerrar          |
| `status`            | `planned`, `in_progress`, `closed`                          |
| `responsible_id`    | FK a `admin.users`; el creador de la orden                  |
| `created_at`        | `timestamptz`                                               |
| `closed_at`         | `timestamptz`, nullable                                     |

- `closed` exige `actual_qty` y `output_lot_id`.
- No se usan `voided` ni `reversed` en esta entrega.

### 3.3 `production.consumptions`

| Columna           | Tipo / regla                 |
| ----------------- | ---------------------------- |
| `id`              | `uuid` PK                    |
| `order_id`        | FK a `production.orders`     |
| `raw_material_id` | FK a `catalog.raw_materials` |
| `lot_id`          | FK a `inventory.lots`        |
| `theoretical_qty` | `NUMERIC(14,3) >= 0`         |
| `actual_qty`      | `NUMERIC(14,3) > 0`          |

- Una fila por lote consumido; una misma materia prima puede tener varias filas (DEC-097).
- El teórico de cada fila se reparte proporcionalmente al consumo real de esa materia prima, de modo que la suma por materia prima sea el teórico de la receta.
- `actual_qty` descuenta el lote en la ubicación donde está la existencia.

### 3.4 `production.outputs` (nueva)

El diseño preliminar solo guarda `actual_qty` en unidad base, pero RF-083 pide registrar la producción **por presentación**. Se agrega:

| Columna           | Tipo / regla                                        |
| ----------------- | --------------------------------------------------- |
| `id`              | `uuid` PK                                           |
| `order_id`        | FK a `production.orders`                            |
| `presentation_id` | FK a `catalog.presentations`                        |
| `quantity`        | `NUMERIC(14,3) > 0`, en unidades de la presentación |
| `base_quantity`   | `NUMERIC(14,3) > 0`, convertida a unidad base       |

- Único `(order_id, presentation_id)`.
- La suma de `base_quantity` es `actual_qty`.

### 3.5 Enlace con inventario

- Movimiento de consumo: `production_consumption`, cantidad negativa, lote de MP, ubicación donde está el lote, `source_type = 'production.order'`, `source_id = order.id`.
- Movimiento de producción: `production_output`, cantidad positiva, lote PT, presentación producida, ubicación de producción de la sede, mismo `source_type/source_id`.
- Lote PT: `lot_type = 'finished_good'`, `product_id`, `manufactured_on = fecha de negocio`, `expires_on = manufactured_on + shelf_life_days` (DEC-090), `unit_cost = NULL` (BR-068), código `PT-AAAA-####`.
- `inventory.lot_inputs` recibe una fila por lote de MP consumido, con la cantidad total consumida de ese lote.

### 3.6 Consecutivos y ubicaciones

- Consecutivos `OP` y `PT` en `platform.document_sequences`; la primera orden/lote sincroniza con los existentes de la semilla.
- La ubicación de salida del PT es la ubicación activa `kind = 'production'` de la sede de la orden; si no existe, `409 NO_PRODUCTION_LOCATION`.
- El consumo puede tomar lotes de cualquier ubicación activa de la misma sede; se valida que el lote tenga existencia y no esté vencido ni bloqueado.

## 4. Contrato de API

| Método y ruta                            | Permiso              | Descripción                                                   |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `GET /production/recipes`                | `prod.recipe.read`   | Lista recetas de producción con versión vigente y líneas      |
| `GET /production/recipes/{id}`           | `prod.recipe.read`   | Detalle con historial de versiones                            |
| `POST /production/recipes`               | `prod.recipe.manage` | Crea receta y versión 1. Idempotente                          |
| `POST /production/recipes/{id}/versions` | `prod.recipe.manage` | Publica una versión nueva. Idempotente                        |
| `GET /production/orders`                 | `prod.order.read`    | Lista órdenes por sede, estado y fechas                       |
| `POST /production/orders`                | `prod.order.create`  | Crea orden planificada con la versión vigente. Idempotente    |
| `GET /production/orders/{id}`            | `prod.order.read`    | Detalle con consumo teórico, disponibilidad, lotes y avance   |
| `POST /production/orders/{id}/consume`   | `prod.order.execute` | Inicia y registra consumo real por lote. Idempotente          |
| `POST /production/orders/{id}/close`     | `prod.order.execute` | Cierra con producción por presentación y lote PT. Idempotente |

**Reglas:**

- Las recetas viven en el esquema `catalog` y se exponen en `/catalog/recipes`; la producción las consume como versión congelada.
- `POST /recipes` recibe `{ productId, baseOutputQty, expectedYieldPct?, tolerancePct?, lines: [{ rawMaterialId, quantity }] }`.
- Solo productos fabricados activos; materias primas activas; al menos un ingrediente; sin duplicados.
- `POST /recipes/{id}/versions` recibe el mismo cuerpo sin `productId`; la versión se calcula como máximo + 1.
- `POST /orders` recibe `{ productId, siteId, plannedQty }`. El servidor toma la versión vigente de la receta del producto; si no hay receta, `409 RECIPE_REQUIRED`. La sede debe estar en el alcance del actor.
- La orden nace `planned` y con `responsibleId = actor.userId`.
- `POST /orders/{id}/consume` recibe `{ lines: [{ rawMaterialId, lotId, locationId, quantity }] }`; al menos una línea. Cambia a `in_progress`.
  - Cada lote debe existir, ser de la materia prima, estar disponible, no vencido, pertenecer a una ubicación de la sede de la orden y tener existencia suficiente.
  - El consumo descuenta en la ubicación del lote y registra `theoretical_qty` proporcional.
  - Si la orden no está `planned`, `409 ORDER_NOT_PLANNED`.
- `POST /orders/{id}/close` recibe `{ outputs: [{ presentationId, quantity }], yieldNote? }`; al menos una presentación.
  - Solo desde `in_progress`; sin consumo, `409 CONSUMPTION_REQUIRED`.
  - Cada presentación debe pertenecer al producto y estar activa.
  - `actualQty = Σ(quantity × unitsPer)`; `yieldPct = actualQty / plannedQty × 100`.
  - Si `|yieldPct − expectedYieldPct| > tolerancePct`, `yieldNote` es obligatorio (`422 YIELD_NOTE_REQUIRED`).
  - Crea lote PT y movimientos, vincula `lot_inputs`, actualiza la orden y audita en una transacción.
  - No crea costo de lote; `unit_cost` queda `NULL`.
- **Alcance:** listado/detalle de órdenes filtran por sede; ejecutar exige que la orden sea del actor (`OWN`). Las recetas son globales.
- `Idempotency-Key` obligatoria en las cuatro escrituras.

**Errores propios:**

| Código                   | HTTP | Cuándo                                          |
| ------------------------ | ---- | ----------------------------------------------- |
| `RECIPE_REQUIRED`        | 409  | Producto sin receta de producción vigente       |
| `RECIPE_EXISTS`          | 409  | Ya existe receta de producción para el producto |
| `NO_PRODUCTION_LOCATION` | 409  | La sede no tiene ubicación de producción activa |
| `ORDER_NOT_PLANNED`      | 409  | Consumo sobre una orden que no está planificada |
| `CONSUMPTION_REQUIRED`   | 409  | Cierre sin consumo registrado                   |
| `ORDER_NOT_IN_PROGRESS`  | 409  | Cierre de una orden que no está en proceso      |
| `LOT_NOT_AVAILABLE`      | 422  | Lote vencido, bloqueado o de otra materia prima |
| `YIELD_NOTE_REQUIRED`    | 422  | Rendimiento fuera de tolerancia sin motivo      |
| `INSUFFICIENT_STOCK`     | 409  | Consumo mayor a la existencia del lote          |

## 5. Pantallas

La sección **04. Producción** gana el módulo **Órdenes de producción** (`/erp/produccion`) con pestañas:

- **Órdenes:**
  - Lista con número, producto, cantidad planificada, sede, estado y rendimiento.
  - Filtro por estado; botón **Nueva orden** si `prod.order.create`.
  - Formulario: producto fabricado, sede, cantidad planificada. Muestra receta vigente, consumo teórico y disponibilidad; si falta MP, advierte pero permite crear (RF-081).
  - Estados vacío/carga/error/sin permiso.
- **Detalle de orden:**
  - Cabecera con número, producto, receta/versión, sede, estado y fechas.
  - Consumo teórico por materia prima y disponibilidad.
  - Formulario de consumo por lote con lotes sugeridos en orden FEFO; cantidades reales editables.
  - Formulario de cierre con producción por presentación, rendimiento calculado en vivo y motivo si sale de tolerancia.
  - Resultado: lote PT, rendimiento y enlaces al lote y al kardex.
- **Recetas:**
  - Lista de recetas con producto, versión vigente, rendimiento esperado, tolerancia y líneas.
  - Detalle con historial de versiones y botón **Nueva versión** si `prod.recipe.manage`.
  - Formulario de receta/versión con ingredientes y cantidades.
- **Existencias:** el lote PT aparece con su fabricación/vencimiento y la trazabilidad hacia atrás muestra los lotes de MP.
- Cada pantalla nueva se agrega a `apps/web/e2e/accesibilidad.spec.ts`.

## 6. Auditoría

- `prod.recipe.create` y `prod.recipe.version` con producto, versión y líneas.
- `prod.order.create` con número, producto, receta/versión, sede y cantidad.
- `prod.order.consume` con líneas, lotes, teórico y real.
- `prod.order.close` con producción por presentación, lote PT, rendimiento y motivo.
- El kardex conserva `source_type = 'production.order'`; la trazabilidad enlaza lote PT → lotes MP.

## 7. Criterios de aceptación

```gherkin
Escenario: publicar una receta versionada
  Dado un producto fabricado activo
  Cuando el manager crea una receta con ingredientes y cantidades
  Entonces queda la versión 1 vigente
  Y una segunda publicación crea la versión 2 sin editar la 1

Escenario: crear una orden congela la versión
  Dada una receta vigente
  Cuando el productor crea una orden de 100 unidades
  Entonces la orden queda planned con esa versión
  Y publicar otra versión después no cambia la orden

Escenario: la orden advierte pero no bloquea por falta de MP
  Cuando se crea una orden cuya disponibilidad teórica no alcanza
  Entonces la orden se crea planned con advertencia
  Y el inicio/consumo sí falla si el lote no tiene existencia

Escenario: consumo real por varios lotes
  Dada una orden planificada con dos lotes vendibles de la misma MP
  Cuando se registran 6 kg del lote A y 4 kg del lote B
  Entonces se descuentan ambos lotes
  Y la orden queda in_progress
  Y el consumo teórico y real quedan registrados

Escenario: cierre y lote PT
  Dada una orden in_progress con consumo
  Cuando se registran 60 unidades y 4 paquetes x10
  Entonces se crea el lote PT con fabricación y vencimiento
  Y el rendimiento es 100 %
  Y el lote PT queda vinculado a los lotes de MP

Escenario: rendimiento fuera de tolerancia
  Dada una receta con tolerancia 3 %
  Cuando el rendimiento real difiere más de 3 puntos
  Entonces el cierre exige motivo
  Y sin motivo responde 422 YIELD_NOTE_REQUIRED

Escenario: no cerrar sin consumo
  Cuando se intenta cerrar una orden planificada
  Entonces responde 409 CONSUMPTION_REQUIRED

Escenario: permisos y sede
  Dado un usuario con alcance SITE en Bodega principal
  Cuando consulta órdenes
  Entonces no ve órdenes de Punto de asados
  Y un usuario sin prod.order.execute no puede consumir ni cerrar

Escenario: duplicado idempotente
  Cuando se repite la misma orden o cierre con la misma Idempotency-Key
  Entonces devuelve el mismo resultado y no duplica lote ni movimiento
```

## 8. Pruebas

- **Unitarias:** consumo teórico proporcional, rendimiento, tolerancia y motivo, conversión de presentaciones a unidad base, transiciones de estado.
- **Integración (PostgreSQL real):** receta versionada; orden congela versión; consumo con dos lotes; stock descontado; cierre con lote PT; vínculo `lot_inputs`; rendimiento fuera de tolerancia; cierre sin consumo; sede ajena; permisos; idempotencia.
- **E2E:** el productor crea/abre una orden, registra consumo y cierra; ve el lote PT y la trazabilidad; accesibilidad de órdenes, detalle y recetas en tres tamaños.

## 9. Datos de demostración

- Receta **Chorizo Santarrosano** v1: 100 unidades base; carne 10 kg, tocino 3 kg, especias 0,5 kg, tripa 20 m; rendimiento esperado 98 %, tolerancia 3 %.
- Receta **Rellena Mixta** v1: 100 unidades base; carne 8 kg, tocino 4 kg, especias 0,4 kg, tripa 15 m; rendimiento esperado 98 %, tolerancia 3 %.
- Orden `OP-0001` planificada para 100 unidades de Chorizo en Bodega principal, responsable `produccion@`. No mueve inventario hasta el consumo.
- La semilla de inventario ya tiene MP suficiente en Bodega principal para la demo.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:** especificación aprobada y DEC-095/096/097 registradas. RF-080 y RF-084 siguen fuera.

**Terminado cuando:**

- Esquema `catalog.recipes*` y `production.*`, migración y permisos aplicados.
- Casos de uso de recetas, órdenes, consumo y cierre con transacciones, bloqueos, idempotencia y auditoría.
- Lote PT creado con movimientos por presentación y enlaces de trazabilidad.
- Pantallas de recetas y órdenes; módulo `available`.
- Semilla demo idempotente.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.
