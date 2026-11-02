# Especificación — Entrega 2b: lotes, existencias y kardex

> Estado: **BORRADOR para revisión del responsable** · 2026-11-02
> Cubre RF-110, RF-111 y RF-118. Decisiones aplicables: DEC-P21, ADR-009, DEC-089, DEC-090.
> Reglas `PROVISIONAL` (DEC-083): Q-B-08 (sin existencias negativas) y la definición de disponible de BR-085.
> La implementación no empieza hasta que esta especificación esté aprobada.

## 1. Objetivo y alcance

Que el sistema tenga una única fuente de verdad del inventario: **lotes**, **movimientos inmutables** y **saldos derivados**, y que cualquier persona autorizada pueda responder dónde está cada cosa, cuánto queda y de dónde vino.

**Incluye:**

- Lotes de materia prima y producto terminado, con fabricación, vencimiento y estado.
- Movimientos inmutables del kardex con documento de origen, usuario y fecha.
- Saldos por lote, presentación y ubicación, derivados de los movimientos.
- Consulta de existencias y disponibilidad (RF-110).
- Kardex filtrable con enlace al documento de origen (RF-111, aprobado por DEC-089).
- Trazabilidad de lote hacia atrás y hacia adelante, con estados honestos cuando aún no hay datos (RF-118).
- Carga inicial demo mediante movimientos `opening_balance`.
- Implementación real de `InventoryUsage` para que el catálogo bloquee cambios de unidad o composición cuando ya hay movimientos.

**No incluye (queda para después):**

| Tema                                                  | Motivo                                         |
| ----------------------------------------------------- | ---------------------------------------------- |
| Compras y recepción que crean lotes MP (RF-050–052)   | Entrega 3                                      |
| Producción y lote PT con consumo real (RF-080–083)    | Entrega 4                                      |
| FEFO automático y traslados (RF-112–114)              | Entrega 2c                                     |
| Reservas de pedidos (RF-181)                          | Entrega 5                                      |
| Conteos físicos y ajustes (RF-115)                    | Q-INV-04 / P-05; no hay flujo aprobado         |
| Bloqueo y desbloqueo de lotes (RF-117)                | PROPOSED y depende de P-05; **no implementar** |
| Vencidos, descarte y retiro de lote (RF-119)          | P-05                                           |
| Apertura de paquetes (RF-116)                         | P-06                                           |
| Costo de lote y valoración (P-03)                     | Contador; `unit_cost` queda `NULL`             |
| Ubicaciones "en tránsito"/"en ruta" y sus movimientos | Entrega 2c (Q-B-07)                            |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura en esta entrega                                                                    |
| ------- | -------------------------------------------------------------------------------------------- |
| RF-110  | Existencias y disponible por producto, presentación, lote y ubicación, con vencimientos      |
| RF-111  | Kardex cronológico con filtros y documento de origen                                         |
| RF-118  | Trazabilidad de lote: insumos/proveedores hacia atrás y despachos/ventas hacia adelante      |
| BR-080  | Las existencias solo cambian con movimientos; el saldo no se edita a mano                    |
| BR-081  | Ningún movimiento deja saldo negativo (Q-B-08, PROVISIONAL)                                  |
| BR-082  | Saldos por producto, presentación, lote y ubicación                                          |
| BR-083  | Preparar el orden FEFO por vencimiento (la asignación automática es 2c)                      |
| BR-085  | Disponible = saldos vendibles − reservas − no vendibles (PROVISIONAL; en 2b no hay reservas) |
| BR-086  | Un lote vencido no cuenta como disponible (PROPOSED; no se ejecuta retiro, P-05)             |
| BR-092  | Trazabilidad de un lote de PT hacia atrás y hacia adelante                                   |
| DEC-P21 | Kardex inmutable como única forma de cambiar existencias (ADR-009)                           |
| DEC-P22 | Cantidades en unidad base, `NUMERIC`, nunca `float`                                          |
| DEC-089 | Pantalla de kardex aprobada                                                                  |

**Fuera de 2b:** BR-084 (excepción FEFO), BR-088/089 (tránsito y novedad), BR-090 (apertura), BR-091 (ajustes).

## 3. Modelo de datos (esquema `inventory`)

Se implementa el diseño de `database-design.md` §2 y §4, con las tablas estrictamente necesarias para 2b:

### 3.1 `inventory.lots`

| Columna               | Tipo / regla                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| `id`                  | `uuid` PK                                                                              |
| `code`                | texto único; convención `MP-2026-0001` / `PT-2026-0001`                                |
| `lot_type`            | `raw_material` \| `finished_good`                                                      |
| `product_id`          | FK a `catalog.products`; obligatorio si es PT                                          |
| `raw_material_id`     | FK a `catalog.raw_materials`; obligatorio si es MP                                     |
| `supplier_id`         | FK lógica a `purchasing.suppliers`; `NULL` en 2b                                       |
| `receipt_id`          | FK lógica a `purchasing.receipts`; `NULL` en 2b                                        |
| `production_order_id` | FK lógica a `production.orders`; `NULL` en 2b                                          |
| `unit_cost`           | `NUMERIC(14,4)`; `NULL` hasta P-03                                                     |
| `manufactured_on`     | `date`; obligatorio en PT                                                              |
| `expires_on`          | `date`; en PT se calcula con `shelf_life_days` (DEC-090); en MP lo define la recepción |
| `status`              | `available`, `in_inspection`, `blocked`, `expired`, `written_off`                      |
| `is_opening_balance`  | booleano; `true` solo en la carga inicial demo                                         |
| `created_at`          | `timestamptz`                                                                          |

Restricciones:

- `expires_on >= manufactured_on`.
- PT: `product_id` no nulo y `raw_material_id` nulo.
- MP: `raw_material_id` no nulo y `product_id` nulo.
- Índice FEFO: `(product_id, expires_on) WHERE status = 'available'`.

### 3.2 `inventory.stock_movements` (kardex inmutable)

| Columna           | Tipo / regla                                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `bigserial` PK (alto volumen, solo inserción)                                                                                                                                                                                                                               |
| `movement_type`   | `receipt`, `production_consumption`, `production_output`, `transfer_out`, `transfer_in`, `dispatch_out`, `dispatch_return`, `sale`, `customer_return`, `return_reinstated`, `write_off`, `adjustment`, `package_open_out`, `package_open_in`, `opening_balance`, `reversal` |
| `lot_id`          | FK a `inventory.lots`                                                                                                                                                                                                                                                       |
| `presentation_id` | FK a `catalog.presentations`; `NULL` para MP                                                                                                                                                                                                                                |
| `location_id`     | FK a `admin.locations`                                                                                                                                                                                                                                                      |
| `quantity`        | `NUMERIC(14,3)`; positivo entra, negativo sale; en unidad de la presentación (MP: unidad base)                                                                                                                                                                              |
| `base_quantity`   | `NUMERIC(14,3)`; convertida a unidad base; mismo signo que `quantity`                                                                                                                                                                                                       |
| `source_type`     | texto: `migration.opening_balance`, `inventory.transfer`, `pos.sale`…                                                                                                                                                                                                       |
| `source_id`       | `uuid` del documento de origen                                                                                                                                                                                                                                              |
| `reverses_id`     | `bigint` autorreferencia; `NULL` en 2b                                                                                                                                                                                                                                      |
| `reason`          | texto; obligatorio en ajustes y reversiones (no en 2b)                                                                                                                                                                                                                      |
| `created_by`      | FK a `admin.users`                                                                                                                                                                                                                                                          |
| `created_at`      | `timestamptz`                                                                                                                                                                                                                                                               |

Restricciones:

- `quantity <> 0`, `base_quantity <> 0`, `sign(quantity) = sign(base_quantity)`.
- **Trigger `stock_movements_append_only`** que rechaza `UPDATE` y `DELETE` (función `platform.forbid_mutation()`).
- Índices: `(lot_id, location_id, created_at)` y `(source_type, source_id)`.

### 3.3 `inventory.stock_balances` (saldo derivado)

| Columna           | Tipo / regla                                               |
| ----------------- | ---------------------------------------------------------- |
| `lot_id`          | FK a `inventory.lots`                                      |
| `presentation_id` | FK a `catalog.presentations`; `NULL` para MP               |
| `location_id`     | FK a `admin.locations`                                     |
| `quantity`        | `NUMERIC(14,3)`, `CHECK (quantity >= 0)` (BR-081 / Q-B-08) |
| `updated_at`      | `timestamptz`                                              |

- Clave única `(lot_id, presentation_id, location_id)` con `NULLS NOT DISTINCT`.
- El saldo **solo** cambia junto con un movimiento, en la misma transacción: insertar/actualizar el saldo con `quantity = quantity + delta` y dejar que el `CHECK` aborte si queda negativo.
- Índice `(location_id) WHERE quantity > 0`.

### 3.4 `inventory.lot_inputs` (trazabilidad N:M)

Se crea la tabla `(output_lot_id, input_lot_id, quantity)` con PK compuesta, pero **en 2b no se escribe**: la producción la alimenta en la entrega 4. La trazabilidad hacia atrás mostrará vacío hasta entonces.

### 3.5 Lo que no se crea todavía

`reservations`, `transfers`, `transfer_lines` y `adjustments` se crean en sus entregas (5, 2c y P-05/Q-INV-04). La disponibilidad de 2b no descuenta reservas porque no existen.

### 3.6 Permisos y migraciones

- Esquema `inventory` con migración generada y migración `--custom` para permisos de rol y trigger de solo-inserción.
- `quatreros_app`: `USAGE` del esquema y DML; `quatreros_readonly`: `SELECT`.
- El trigger de solo-inserción se crea en la migración custom (no la genera Drizzle).

## 4. Contrato de API

Prefijo `/api/v1`. Lecturas con `inv.stock.read`, salvo trazabilidad que exige `inv.traceability.read`. Cantidades como cadenas decimales. Listas paginadas por cursor.

| Método y ruta                           | Permiso                 | Descripción                                                                                                                          |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /inventory/stock-balances`         | `inv.stock.read`        | Saldos por lote/presentación/ubicación; filtros `q`, `productId`, `presentationId`, `lotId`, `locationId`, `status`, `expiresBefore` |
| `GET /inventory/availability`           | `inv.stock.read`        | Disponible agregado por producto/presentación/ubicación y vencimiento más próximo                                                    |
| `GET /inventory/lots`                   | `inv.stock.read`        | Lotes con estado, vencimiento y saldo total; filtros `q`, `status`, `expiresBefore`, `productId`                                     |
| `GET /inventory/lots/{id}`              | `inv.stock.read`        | Ficha del lote con sus saldos y últimos movimientos                                                                                  |
| `GET /inventory/lots/{id}/traceability` | `inv.traceability.read` | Árbol hacia atrás (MP y proveedor) y hacia adelante (despachos/ventas), con vacíos honestos                                          |
| `GET /inventory/movements`              | `inv.stock.read`        | Kardex cronológico; filtros `productId`, `lotId`, `locationId`, `movementType`, `from`, `to`                                         |

**Reglas de contrato:**

- `GET` sin cuerpo; `limit` por defecto 50, máximo 200; `cursor` opaco.
- Un `cursor` inválido → `422 VALIDATION_FAILED`.
- Recurso inexistente o fuera de alcance → `404 NOT_FOUND`.
- Sin permiso → `403 FORBIDDEN`.
- El kardex se ordena por `created_at DESC, id DESC` (más reciente primero).
- La trazabilidad devuelve `{ lot, backward: { inputs, supplier }, forward: { dispatches, sales }, pending: [...] }`; los bloques sin datos traen `pending` con la entrega que los activa.
- En 2b no hay escrituras de inventario: la semilla es la única fuente de movimientos.

**Permisos efectivos:** `inv.stock.read` lo tienen ADM, MGR, COMP, PROD, CAJ (su POS), CONT y DIST (su carga). `inv.traceability.read` lo tienen ADM, MGR, PROD y CONT.

## 5. Pantallas

Módulo **Existencias y traslados** dentro de **04. Producción**, ruta `/erp/existencias`, permiso `inv.stock.read`. En 2b se activa como **Existencias**; los traslados llegan en 2c.

| Pantalla                                     | Contenido y estados                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Existencias (`/erp/existencias`)             | Indicadores (productos con saldo, lotes próximos a vencer, lotes vencidos, ubicaciones); pestañas **Existencias**, **Lotes** y **Kardex**   |
| Saldos                                       | Tabla con producto, presentación, lote, ubicación, cantidad, vencimiento y estado; filtros por búsqueda, ubicación, estado y vencimiento    |
| Lotes                                        | Tarjetas/tabla con código, producto/materia prima, fabricación, vencimiento, estado y saldo total; enlace a la ficha                        |
| Ficha de lote (`/erp/existencias/lotes/:id`) | Datos del lote, saldos por ubicación, últimos movimientos y trazabilidad; estados vacíos para lo que llega en 3, 4 y 5                      |
| Kardex (`/erp/existencias/kardex`)           | Tabla cronológica con fecha, tipo, lote, ubicación, cantidad, documento de origen y usuario; filtros por producto, lote, ubicación y fechas |

**Estados:** carga con `LoadingSkeleton`, vacío con `EmptyState`, error con `Alert` y reintento, sin permiso con mensaje claro. Los lotes vencidos se muestran con badge de peligro y se excluyen de disponible; no hay acciones de retiro (P-05).

**Diseño:** sistema de diseño v1.1 (DEC-093), `PageHeader`, `StatCard`, `DataTable`, `FilterBar`, `SearchInput`, `Badge`, `EmptyState` y `LoadingSkeleton`; cantidades y fechas en `font-mono`/números tabulares. Cada pantalla se agrega a `accesibilidad.spec.ts` en escritorio, tableta y móvil.

**Command Center:** la tarjeta "Alertas FEFO" se activa en 2c, no en 2b. En 2b la pantalla de Producción puede mostrar "Lotes próximos a vencer" con datos reales de existencias.

## 6. Auditoría y trazabilidad

- Las lecturas no generan auditoría; el kardex es el registro operativo.
- Cada movimiento guarda `created_by`, `created_at`, `source_type` y `source_id`; la trazabilidad se reconstruye desde ahí y desde `lot_inputs` (cuando exista).
- La semilla usa `source_type = 'migration.opening_balance'` y un `source_id` determinista por corrida; el motivo queda en `reason`.
- No se edita ni se borra un movimiento (trigger). Una corrección futura será un movimiento de `reversal`.

## 7. Criterios de aceptación

```gherkin
Escenario: saldo por lote y ubicación
  Dado un lote PT-2026-0001 de Chorizo Santarrosano
  Cuando se registra una entrada inicial de 120 unidades en Bodega principal
  Entonces existe un movimiento opening_balance de +120
  Y el saldo del lote, presentación Unidad y Bodega principal es 120

Escenario: paquete y unidad son saldos separados
  Dado el mismo lote con 24 paquetes ×10 en Bodega principal
  Entonces el saldo de la presentación Paquete x10 es 24
  Y su base_quantity en el movimiento es 240

Escenario: no se permiten negativos
  Cuando un movimiento intenta dejar el saldo por debajo de cero
  Entonces la transacción se aborta
  Y el saldo no cambia

Escenario: kardex inmutable
  Cuando alguien intenta actualizar o borrar un movimiento
  Entonces la base de datos lo rechaza

Escenario: disponible excluye no vendibles
  Dado un lote vencido con 10 unidades
  Cuando se consulta la disponibilidad
  Entonces esas 10 unidades no se cuentan
  Y el lote sigue visible en existencias con su estado

Escenario: FEFO preparado
  Dados dos lotes vendibles con vencimientos 10/11 y 15/11
  Cuando se consultan los candidatos FEFO de una presentación y ubicación
  Entonces el primero es el del 10/11

Escenario: kardex filtrable
  Dado un lote con movimientos de entrada y salida
  Cuando se consulta el kardex por ese lote
  Entonces aparecen del más reciente al más antiguo
  Y cada fila muestra su documento de origen

Escenario: trazabilidad con vacíos honestos
  Dado un lote de PT sin orden de producción asociada
  Cuando se consulta su trazabilidad
  Entonces ve el lote y sus movimientos
  Y las secciones de insumos y despachos indican qué entrega las activa

Escenario: permisos
  Dado un usuario sin inv.stock.read
  Cuando consulta existencias
  Entonces recibe 403
  Y un usuario con inv.stock.read pero sin inv.traceability.read no puede abrir la trazabilidad

Escenario: catálogo bloqueado por movimientos
  Dado un producto con movimientos de inventario
  Cuando se intenta cambiar su unidad base o la composición de una presentación
  Entonces el catálogo responde 409 UNIT_LOCKED o PRESENTATION_LOCKED

Escenario: carga inicial idempotente
  Cuando se ejecuta dos veces la semilla demo
  Entonces no se duplican lotes, movimientos ni saldos
```

## 8. Pruebas

- **Unitarias (dominio):** signo coherente, saldo nunca negativo, disponible por estado/vencimiento, orden FEFO, transición de estado del lote, cálculo de `base_quantity` para presentaciones.
- **Integración (PostgreSQL real):** semilla idempotente; movimiento + saldo atómicos; `CHECK` de negativo; trigger de solo-inserción; filtros y paginación; 403/404/422; trazabilidad; `InventoryUsage` contra movimientos reales.
- **E2E:** comprador/productor abren Existencias, ven lotes y saldos reales, filtran el kardex y abren la ficha de un lote; cada pantalla en `accesibilidad.spec.ts` en tres tamaños.

## 9. Datos de demostración

Fechas relativas al 2026-11-02. Todos los costos quedan `NULL` (P-03).

| Lote         | Ítem                 | Tipo | Ubicación        | Fabricado  | Vence      | Saldos                      |
| ------------ | -------------------- | ---- | ---------------- | ---------- | ---------- | --------------------------- |
| PT-2026-0001 | Chorizo Santarrosano | PT   | Bodega principal | 2026-10-20 | 2026-11-19 | 120 Unidad · 24 Paquete x10 |
| PT-2026-0002 | Chorizo Santarrosano | PT   | Bodega principal | 2026-10-28 | 2026-11-27 | 60 Unidad · 12 Paquete x10  |
| PT-2026-0003 | Rellena Mixta        | PT   | Bodega principal | 2026-10-25 | 2026-11-24 | 80 Unidad · 16 Paquete x10  |
| PT-2026-0004 | Chorizo Santarrosano | PT   | Punto de asados  | 2026-10-15 | 2026-11-05 | 20 Unidad · 4 Paquete x10   |
| MP-2026-0001 | Carne de cerdo magra | MP   | Bodega principal | —          | 2026-11-06 | 80 kg                       |
| MP-2026-0002 | Tocino y grasa       | MP   | Bodega principal | —          | 2026-11-20 | 40 kg                       |
| MP-2026-0003 | Mix de especias      | MP   | Bodega principal | —          | 2027-03-15 | 10 kg                       |
| MP-2026-0004 | Tripa natural        | MP   | Bodega principal | —          | 2027-04-01 | 500 m                       |

Cada saldo nace de un movimiento `opening_balance` positivo con `source_type = 'migration.opening_balance'`, `created_by` el administrador demo y `reason = 'Carga inicial de demostración'`. La semilla es idempotente por código de lote.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:** esta especificación aprobada; confirmar que la semilla y la definición de disponible son aceptables.

**Terminado cuando:**

- Esquema `inventory` y migraciones revisadas; trigger de solo-inserción y permisos aplicados.
- `recordMovement` es la única vía de cambio de saldo; la semilla lo usa.
- `InventoryUsage` implementado y conectado al catálogo.
- API de existencias, disponibilidad, lotes, kardex y trazabilidad con permisos y filtros.
- Pantallas en 04. Producción con estados de carga/vacío/error y accesibilidad.
- `pnpm check`, integración con PGlite y PostgreSQL real, build y E2E en verde.
- `PROJECT-STATUS.md`, roadmap, matriz de trazabilidad, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.

## 11. Decisiones y huecos que necesitan respuesta

1. **Disponible (BR-085, PROPOSED):** en 2b se calcula como saldos de lotes `available` no vencidos. No hay reservas todavía. ¿Se aprueba así para el prototipo?
2. **Lotes vencidos (BR-086, PROPOSED / P-05):** se muestran y se excluyen de disponible, pero no se descartan ni se ejecuta retiro. ¿Correcto?
3. **Semilla:** los lotes y cantidades de la tabla §9 son ficticios y buscan mostrar FEFO y kardex. ¿Se aceptan?
4. **Código de lote:** se usa la convención `MP-AAAA-####` / `PT-AAAA-####` del esquema preliminar. No es una regla de negocio; si el responsable prefiere otro formato, se cambia antes de implementar.
