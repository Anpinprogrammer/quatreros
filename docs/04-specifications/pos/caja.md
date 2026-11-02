# Especificación — Entrega 6: caja (POS)

> Estado: **BORRADOR — pendiente de aprobación** · 2026-11-02
> Cubre RF-220, RF-221, RF-222, RF-223, RF-224 y RF-225; incluye el **consumo teórico** de RF-226.
> Quedan fuera los conteos físicos y las diferencias de cocina de RF-226, RF-227 (P-07), el documento fiscal (BR-150, P-02), descuentos/anulaciones/reembolsos (P-09), la venta a crédito y los medios distintos de efectivo/transferencia (Q-POS-02), la apertura de paquetes (P-06) y la contabilización (P-01..P-04).
> Reglas provisionales: un turno por caja y por cajero (BR-141, **PROPOSED**; se aplica como PROVISIONAL en el prototipo), consumo teórico sin descuento automático de cocina (BR-147, Q-B-09) y caja = sede POS (decisión de modelo de esta especificación).

## 0. Decisiones que necesitan aprobación

| #   | Decisión                                                                                                                                                                                                                                                                                             | Recomendación                                                                                               | Si no se aprueba                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1  | **La caja es el sitio de tipo `point_of_sale`.** En el prototipo hay una caja por sitio; no se crea un maestro de cajas ni se soportan varias cajas físicas por sede. Un turno abierto por sitio y por cajero (BR-141, PROPOSED).                                                                    | Aprobar. El seed ya tiene **Punto de asados** con ubicaciones **Productos del punto** y **Cocina**.         | Habría que crear `pos.registers` y decidir cuántas cajas tiene cada sede.                     |
| D2  | **Medios de pago: Efectivo y Transferencia**, tomados de `finance.payment_methods` (`is_cash`). No hay tarjeta, QR ni crédito en el POS en esta entrega.                                                                                                                                             | Aprobar este subconjunto; Q-POS-02 sigue abierta para tarjeta/QR/crédito.                                   | El POS no podría cerrar la venta si el cliente paga con otro medio.                           |
| D3  | **Receta de plato con componentes terminados o materias primas.** Se amplía `catalog.recipe_lines` para aceptar `presentation_id` además de `raw_material_id` (exactamente uno por línea), porque un plato puede consumir chorizos o rellenas ya fabricados, no solo materias primas. `[Ampliación]` | Aprobar. Permite representar el ejemplo del DM («1 asado → 2 chorizos + 1 arepa») sin duplicar el catálogo. | Solo se podrían definir platos con materias primas; el ejemplo del DM no sería representable. |
| D4  | **Sin retiros ni depósitos parciales de efectivo.** El efectivo esperado se calcula como base + ventas en efectivo − cambios. BR-144 se cumple para el flujo sin retiros.                                                                                                                            | Aprobar para el prototipo; si se requieren retiros, se agrega `pos.cash_movements` en otra entrega.         | Habría que añadir una tabla y endpoints de retiros/depósitos antes de cerrar.                 |
| D5  | **Sin conteos físicos ni clasificación de diferencias de cocina.** Solo se registra el consumo teórico de los platos vendidos; no se descuenta inventario de cocina (BR-147, Q-B-09).                                                                                                                | Aprobar; RF-226 queda cubierto en su parte de consumo teórico y RF-227 sigue bloqueado por P-07.            | La cocina no tendría forma de contrastar teoría contra conteo en esta entrega.                |
| D6  | **Comprobante interno, no fiscal.** La venta genera un comprobante con número `V-0001`; la palabra «factura» no se usa y no se emite documento fiscal (BR-150, P-02).                                                                                                                                | Aprobar.                                                                                                    | Habría que esperar P-02 para vender con documento.                                            |
| D7  | **Revisión de diferencias por ADM/MGR, nunca por el cajero del turno** (BR-004). El cierre con diferencia no se bloquea: queda `closed_with_variance` y exige justificación; la revisión registra una conclusión y pasa a `reviewed`.                                                                | Aprobar.                                                                                                    | El cierre quedaría bloqueado o sin control supervisor.                                        |
| D8  | **Semilla con un turno cerrado con diferencia y una venta**, para demostrar la bandeja de revisión sin abrir turno antes. La demo abre su propio turno para vender.                                                                                                                                  | Aprobar.                                                                                                    | La revisión se demuestra solo después de un cierre manual.                                    |

## 1. Objetivo y alcance

Que el cajero abra un turno con base de efectivo, venda productos fabricados y platos preparados con precio vigente, cobre con pagos mixtos y cambio, cierre el turno con conteo por método, justifique una diferencia y el supervisor la revise. El inventario de producto fabricado sale por FEFO desde **Productos del punto**; el de cocina no se descuenta: solo se registra el consumo teórico de la receta.

**Incluye:**

- Apertura de turno por cajero y caja (sitio POS), con base de efectivo.
- Catálogo táctil de presentaciones vendibles: fabricadas con precio y existencia en **Productos del punto**; preparadas con receta de plato vigente.
- Venta con líneas, precio congelado, pagos mixtos, cambio y comprobante interno.
- Salida FEFO de producto fabricado y registro de los lotes asignados por línea.
- Consumo teórico de ingredientes del plato según la versión de receta vigente, sin movimiento de inventario.
- Cierre con conteo por método, efectivo esperado, diferencia y justificación.
- Bandeja de revisión de cierres con diferencia para ADM/MGR.
- Gestión versionada de recetas de platos (RF-225) para ADM/MGR.
- Semilla demo y pantallas con estados de carga, vacío, error y sin permiso.

**No incluye:**

| Tema                                                   | Motivo                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Conteos físicos de cocina y cálculo de diferencias     | RF-226 (parte física), período PENDING y P-07.                 |
| Clasificación y ajuste de diferencias de cocina        | RF-227, PENDING P-07.                                          |
| Documento fiscal, impuestos y factura electrónica      | BR-150, P-02. Solo comprobante interno.                        |
| Descuentos, anulaciones, reembolsos y propinas         | P-09; la venta nace `completed` y no se anula en esta entrega. |
| Venta a crédito en el POS                              | Q-POS-02; el POS cobra efectivo/transferencia.                 |
| Tarjeta, QR y otros medios                             | Q-POS-02; solo los métodos sembrados.                          |
| Mesas, comandas y división de cuenta                   | Q-POS-03; solo venta de mostrador.                             |
| Apertura de paquetes para vender unidades              | P-06; si no hay unidad disponible, se informa y no se abre.    |
| Retiros y depósitos parciales de efectivo              | D4; se agregan si el responsable los pide.                     |
| Contabilización de la venta y del cierre               | P-01..P-04; solo se emiten hechos económicos.                  |
| Liquidación de repartidores y conciliación de recaudos | Entrega 7 y P-08.                                              |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                       |
| ------- | ------------------------------------------------------------------------------- |
| RF-220  | Apertura de turno con base de efectivo                                          |
| RF-221  | Venta inmediata de fabricados y preparados; comprobante interno                 |
| RF-222  | Pagos mixtos, cambio en efectivo y validación de la suma                        |
| RF-223  | Cierre con conteo por método, efectivo esperado y diferencia                    |
| RF-224  | Revisión supervisor de cierres con diferencia                                   |
| RF-225  | Recetas de platos versionadas (se propone confirmarla para el prototipo)        |
| RF-226  | Solo consumo teórico de la venta; sin conteos ni diferencias físicas            |
| BR-004  | El cajero no revisa su propio turno                                             |
| BR-006  | Turno cerrado y venta completada no se editan; se corrigen por reversión (P-09) |
| BR-007  | Idempotencia en toda escritura                                                  |
| BR-083  | Salida FEFO del producto fabricado                                              |
| BR-140  | Solo se vende con turno abierto                                                 |
| BR-141  | Un turno abierto por caja y por cajero (`PROVISIONAL`)                          |
| BR-142  | La apertura registra la base de efectivo                                        |
| BR-143  | Suma de pagos = total; el exceso solo en efectivo se registra como cambio       |
| BR-144  | Esperado = base + ventas en efectivo − cambios (sin retiros, D4)                |
| BR-145  | Diferencia exige justificación y revisión; el cierre no se bloquea              |
| BR-146  | Inventario de mostrador y de cocina son ubicaciones distintas                   |
| BR-147  | Consumo teórico del plato sin descontar cocina (`PROVISIONAL`, Q-B-09)          |
| BR-200  | Hechos económicos `SaleCompleted` y `ShiftClosed`                               |
| DEC-030 | Fabricados y preparados con inventarios separados                               |
| DEC-031 | Venta inmediata y pagos mixtos                                                  |
| DEC-032 | Apertura y cierre por cajero y turno                                            |
| DEC-033 | Cierre con diferencia, justificación y revisión                                 |
| DEC-034 | Consumo teórico por ventas; conteos y clasificación fuera (P-07)                |

## 3. Modelo de datos

Todos los montos son `NUMERIC(14,2)` y las cantidades `NUMERIC(14,3)`. Se usan cadenas decimales y `decimal.js`; nunca `float`. El total y el cambio se calculan en el servidor y se redondean a 2 decimales.

### 3.1 `pos.shifts`

| Columna           | Tipo / regla                                          |
| ----------------- | ----------------------------------------------------- |
| `id`              | `uuid` PK                                             |
| `site_id`         | FK a `admin.sites`; debe ser `kind = 'point_of_sale'` |
| `cashier_user_id` | FK a `admin.users`                                    |
| `status`          | `open`, `closed`, `closed_with_variance`, `reviewed`  |
| `opening_cash`    | `NUMERIC(14,2) >= 0`                                  |
| `opened_at`       | `timestamptz`                                         |
| `closed_at`       | `timestamptz` nullable                                |
| `cash_expected`   | `NUMERIC(14,2)` nullable; se calcula al cerrar        |
| `cash_counted`    | `NUMERIC(14,2)` nullable                              |
| `cash_difference` | `NUMERIC(14,2)` nullable; `counted − expected`        |
| `closing_note`    | texto nullable; obligatorio si hay diferencia         |
| `reviewed_by`     | FK a `admin.users` nullable                           |
| `reviewed_at`     | `timestamptz` nullable                                |
| `review_note`     | texto nullable; obligatorio al revisar                |

- Índice único parcial `shifts_open_site_uq` sobre `site_id` donde `status = 'open'`.
- Índice único parcial `shifts_open_cashier_uq` sobre `cashier_user_id` donde `status = 'open'`.
- `cash_difference <> 0` exige `status = 'closed_with_variance'` y `closing_note` no vacío.
- Un turno `reviewed` solo es válido si tenía diferencia y `review_note` no está vacío.

### 3.2 `pos.sales`

| Columna           | Tipo / regla                               |
| ----------------- | ------------------------------------------ |
| `id`              | `uuid` PK                                  |
| `number`          | texto único, consecutivo `V-0001`          |
| `shift_id`        | FK a `pos.shifts`                          |
| `site_id`         | FK a `admin.sites`                         |
| `cashier_user_id` | FK a `admin.users`                         |
| `status`          | `completed` (la anulación llega con P-09)  |
| `total`           | `NUMERIC(14,2) > 0`                        |
| `paid_total`      | `NUMERIC(14,2) >= total`                   |
| `change_amount`   | `NUMERIC(14,2) >= 0`; `paid_total − total` |
| `sold_at`         | `timestamptz`                              |

- El consecutivo usa `platform.document_sequences` con `doc_type = 'V'` y la misma transacción de la venta.
- No se guarda un total enviado por el cliente; se recalcula con precios vigentes.

### 3.3 `pos.sale_lines`

| Columna             | Tipo / regla                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `id`                | `uuid` PK                                                          |
| `sale_id`           | FK a `pos.sales`                                                   |
| `line_no`           | entero `> 0`; único por venta                                      |
| `product_id`        | FK a `catalog.products`                                            |
| `presentation_id`   | FK a `catalog.presentations`                                       |
| `quantity`          | `NUMERIC(14,3) > 0`                                                |
| `unit_price`        | `NUMERIC(14,2) >= 0`, congelado al vender                          |
| `line_total`        | `NUMERIC(14,2) >= 0`; `round(unit_price × quantity, 2)`            |
| `product_kind`      | `manufactured` o `prepared`, copiado al vender                     |
| `recipe_version_id` | FK a `catalog.recipe_versions` nullable; obligatorio si `prepared` |

- `unique (sale_id, line_no)`.
- La presentación debe estar activa y tener precio vigente; si no, `409 PRICE_REQUIRED`.

### 3.4 `pos.sale_line_lots`

| Columna        | Tipo / regla                         |
| -------------- | ------------------------------------ |
| `sale_line_id` | FK a `pos.sale_lines`                |
| `lot_id`       | FK a `inventory.lots`                |
| `location_id`  | FK a `admin.locations` (`pos_goods`) |
| `quantity`     | `NUMERIC(14,3) > 0`                  |

- `unique (sale_line_id, lot_id, location_id)`.
- Solo para líneas fabricadas. Es el detalle de la asignación FEFO; el movimiento de inventario sigue siendo la fuente del kardex.

### 3.5 `pos.sale_line_consumptions`

| Columna           | Tipo / regla                          |
| ----------------- | ------------------------------------- |
| `sale_line_id`    | FK a `pos.sale_lines`                 |
| `raw_material_id` | FK a `catalog.raw_materials` nullable |
| `presentation_id` | FK a `catalog.presentations` nullable |
| `quantity`        | `NUMERIC(14,3) > 0`                   |

- Exactamente uno de `raw_material_id` o `presentation_id` no es nulo.
- Índices únicos parciales `(sale_line_id, raw_material_id)` y `(sale_line_id, presentation_id)` donde la columna correspondiente no es nula (permite varios componentes de presentación en la misma línea).
- Es consumo **teórico**: no genera movimiento de inventario. La cantidad se escala por `base_output_qty` de la versión de receta.

### 3.6 `pos.payments`

| Columna             | Tipo / regla                   |
| ------------------- | ------------------------------ |
| `id`                | `uuid` PK                      |
| `sale_id`           | FK a `pos.sales`               |
| `payment_method_id` | FK a `finance.payment_methods` |
| `amount`            | `NUMERIC(14,2) > 0`            |

- El método debe estar activo.
- Σ `amount` = `paid_total`.
- Σ de métodos no efectivos ≤ `total`; el exceso solo puede ser efectivo y se registra como cambio.

### 3.7 `pos.shift_counts`

| Columna             | Tipo / regla                          |
| ------------------- | ------------------------------------- |
| `shift_id`          | FK a `pos.shifts`                     |
| `payment_method_id` | FK a `finance.payment_methods`        |
| `expected_amount`   | `NUMERIC(14,2) >= 0`                  |
| `counted_amount`    | `NUMERIC(14,2) >= 0`                  |
| `difference`        | `NUMERIC(14,2)`; `counted − expected` |

- `unique (shift_id, payment_method_id)`.
- Se exige conteo de todos los métodos activos; el de efectivo siempre.
- El estado del turno se decide con la diferencia del método `is_cash = true`. Las diferencias de métodos no efectivos se muestran, pero no disparan la revisión de caja (BR-145 se refiere al efectivo).

### 3.8 Recetas de platos (`catalog`)

Se reutilizan `catalog.recipes` (`kind = 'dish'`), `recipe_versions` y `recipe_lines`. Para D3 se amplía `recipe_lines`:

| Columna           | Cambio                                        |
| ----------------- | --------------------------------------------- |
| `raw_material_id` | pasa a nullable; FK a `catalog.raw_materials` |
| `presentation_id` | nueva, nullable; FK a `catalog.presentations` |

- `check (num_nonnulls(raw_material_id, presentation_id) = 1)`.
- Índices únicos parciales por versión para `raw_material_id` y `presentation_id` (cada componente una sola vez).
- Las recetas `kind = 'production'` siguen exigiendo `raw_material_id` (validación de aplicación).
- Una receta de plato tiene una versión `is_current`; las versiones anteriores no se editan.
- La venta guarda `recipe_version_id`; editar la receta después no cambia ventas pasadas.

### 3.9 Inventario y secuencias

- **Fabricado:** `inventory.allocateFefo` asigna lotes en `pos_goods` del sitio; se registra un movimiento `sale` negativo por cada lote asignado, con `source_type = 'pos.sale'` y `source_id = sale.id`; luego se insertan `sale_line_lots`.
- **Preparado:** no hay movimiento de inventario. Solo se insertan `sale_line_consumptions` calculadas desde la versión de receta.
- El módulo `pos` no escribe tablas de `inventory`: usa una función pública `inventory.issueForSale(tx, input)` que asigna FEFO, registra movimientos y devuelve las asignaciones. Se agrega a `inventory/application/public.ts`.
- Consecutivo `V` en `platform.document_sequences`; el seed lo sincroniza con las ventas existentes, igual que `P`/`D`/`OP`.

## 4. Contrato de API

| Método y ruta                          | Permiso                    | Descripción                                                      |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| `GET /pos/catalog`                     | `pos.sale.create`          | Presentaciones vendibles con precio, existencia o receta vigente |
| `GET /pos/shifts/current`              | `pos.shift.open`           | Turno abierto del cajero autenticado; `data: null` si no hay     |
| `POST /pos/shifts`                     | `pos.shift.open`           | Abre turno. Idempotente                                          |
| `GET /pos/shifts`                      | `pos.cash_variance.review` | Bandeja de turnos cerrados con diferencia, por sede              |
| `GET /pos/shifts/{id}`                 | propio o revisión          | Detalle del turno con ventas, pagos, conteos y revisión          |
| `POST /pos/shifts/{id}/close`          | `pos.shift.close`          | Cierra con conteo por método. Idempotente                        |
| `POST /pos/shifts/{id}/review`         | `pos.cash_variance.review` | Registra la conclusión del supervisor. Idempotente               |
| `POST /pos/sales`                      | `pos.sale.create`          | Registra la venta, pagos, FEFO y consumo teórico. Idempotente    |
| `GET /pos/sales/{id}`                  | propio o revisión          | Comprobante interno de la venta                                  |
| `GET /pos/dish-recipes`                | `pos.dish_recipe.manage`   | Lista recetas de platos                                          |
| `GET /pos/dish-recipes/{id}`           | `pos.dish_recipe.manage`   | Detalle con versiones                                            |
| `POST /pos/dish-recipes`               | `pos.dish_recipe.manage`   | Crea la receta de un producto preparado. Idempotente             |
| `POST /pos/dish-recipes/{id}/versions` | `pos.dish_recipe.manage`   | Publica una nueva versión. Idempotente                           |

**Reglas transversales:**

- `Idempotency-Key` obligatoria en todas las escrituras (`428` si falta); misma clave con cuerpo distinto → `422 IDEMPOTENCY_KEY_REUSED`; reintento con la misma clave devuelve la misma respuesta (BR-007).
- El servidor valida la sede: el sitio debe ser `point_of_sale` y estar en el alcance del usuario; fuera de alcance → `404`, nunca `403` con datos.
- **Venta y cierre: solo el cajero dueño del turno.** Un supervisor no vende ni cierra turnos ajenos; solo los revisa. ADM/MGR pueden abrir su propio turno y vender si lo necesitan.
- Un ADM/MGR no puede revisar un turno del que sea cajero (BR-004).
- La sesión del turno se bloquea con `FOR UPDATE` al vender/cerrar; una venta y un cierre concurrentes se serializan.
- No se aceptan totales, precios ni cambios enviados por el cliente; se recalculan.

**Apertura — `POST /pos/shifts`:**

```json
{ "siteId": "uuid", "openingCash": "100000.00" }
```

- `openingCash >= 0`; sitio POS del alcance; sin turno abierto del cajero ni del sitio → `409 SHIFT_ALREADY_OPEN`.
- Respuesta `201` con el turno `open`.

**Venta — `POST /pos/sales`:**

```json
{
  "shiftId": "uuid",
  "lines": [{ "presentationId": "uuid", "quantity": "2.000" }],
  "payments": [
    { "paymentMethodId": "uuid-efectivo", "amount": "20000.00" },
    { "paymentMethodId": "uuid-transferencia", "amount": "10000.00" }
  ]
}
```

- Turno `open`, del cajero (o del alcance de un supervisor) y del sitio.
- Líneas no vacías; cantidades > 0; presentaciones activas con precio vigente.
- Fabricado: existencia suficiente en **Productos del punto**; se asigna FEFO (puede repartir entre lotes). Sin existencia → `409 INSUFFICIENT_STOCK`; no se abre paquete (P-06).
- Preparado: debe tener receta `dish` vigente; si no, `409 RECIPE_REQUIRED`.
- Pagos: métodos activos; Σ pagos ≥ total; Σ no efectivo ≤ total; cambio = Σ pagos − total; el cambio se paga en efectivo (`422 CHANGE_REQUIRES_CASH` si no).
- Respuesta `201` con número, total, pagos, cambio, líneas, lotes y consumo teórico.

**Cierre — `POST /pos/shifts/{id}/close`:**

```json
{
  "counts": [
    { "paymentMethodId": "uuid-efectivo", "countedAmount": "475000.00" },
    { "paymentMethodId": "uuid-transferencia", "countedAmount": "120000.00" }
  ],
  "note": "Faltante de $5.000 en efectivo; se revisa con el supervisor."
}
```

- Turno `open` del cajero; todos los métodos activos con conteo.
- Esperado efectivo = base + Σ pagos efectivo − Σ cambios. Esperado no efectivo = Σ pagos del método.
- Diferencia = contado − esperado. Si la diferencia de efectivo es distinta de cero: `note` obligatoria (`422 VARIANCE_NOTE_REQUIRED`) y estado `closed_with_variance`; si es cero: `closed`.
- Respuesta con conteos, esperado, diferencia y estado. Un turno cerrado no admite más ventas (`409 SHIFT_NOT_OPEN`).

**Revisión — `POST /pos/shifts/{id}/review`:**

```json
{ "conclusion": "Se verificó el arqueo; el faltante se descuenta al cajero." }
```

- Solo `closed_with_variance`; el revisor no puede ser el cajero (`403 SELF_REVIEW_FORBIDDEN`); conclusión no vacía.
- Pasa a `reviewed`; segunda revisión → `409 SHIFT_ALREADY_REVIEWED`. No genera ajuste contable ni de inventario (P-01..P-04, P-07).

**Errores propios:**

| Código                    | HTTP | Cuándo                                             |
| ------------------------- | ---- | -------------------------------------------------- |
| `SHIFT_ALREADY_OPEN`      | 409  | Ya hay un turno abierto del cajero o del sitio     |
| `SHIFT_NOT_OPEN`          | 409  | Venta o cierre sin turno abierto                   |
| `SHIFT_NOT_IN_VARIANCE`   | 409  | Revisión de un turno sin diferencia o ya revisado  |
| `SHIFT_ALREADY_REVIEWED`  | 409  | Segunda revisión                                   |
| `SELF_REVIEW_FORBIDDEN`   | 403  | El cajero intenta revisar su propio turno          |
| `VARIANCE_NOTE_REQUIRED`  | 422  | Cierre con diferencia sin justificación            |
| `PAYMENT_SUM_BELOW_TOTAL` | 422  | Σ pagos < total                                    |
| `CHANGE_REQUIRES_CASH`    | 422  | El cambio excede lo pagado en efectivo             |
| `PAYMENT_METHOD_INVALID`  | 422  | Método inactivo o inexistente                      |
| `PRICE_REQUIRED`          | 409  | Presentación sin precio vigente                    |
| `INSUFFICIENT_STOCK`      | 409  | Sin existencia vendible en **Productos del punto** |
| `RECIPE_REQUIRED`         | 409  | Plato preparado sin receta `dish` vigente          |
| `SALE_EMPTY`              | 422  | Venta sin líneas                                   |
| `SITE_NOT_ALLOWED`        | 404  | Sitio fuera del alcance o que no es POS            |

## 5. Pantallas

- **POS (`/pos`, reemplaza el placeholder de `PosShell`):**
  - **Sin turno:** tarjeta «Abrir turno» con sede y base de efectivo; no muestra catálogo. Estado de carga y error.
  - **Turno abierto:** dos columnas en escritorio/tableta y una en móvil. Catálogo táctil con búsqueda, presentación, precio y existencia (fabricado) o «Receta» (preparado); las presentaciones sin precio o sin receta se muestran deshabilitadas con el motivo. Ticket con líneas, cantidades, total y botón «Cobrar».
  - **Pago mixto:** modal con métodos activos, montos, cambio calculado, validación de suma y confirmación. El exceso solo se acepta en efectivo.
  - **Venta confirmada:** comprobante interno `V-0001` con líneas, pagos, cambio y leyenda «Comprobante interno — no es factura»; acciones «Nueva venta» y «Cerrar turno».
  - **Cierre:** modal con esperado y contado por método, diferencia, justificación si aplica y confirmación. Tras cerrar, resumen del turno y estado.
  - **Estados:** carga, vacío (sin productos vendibles), error, sin permiso, sin turno, turno cerrado.
- **Bandeja de revisión (`/erp/pos/revision`, ADM/MGR):** lista de turnos `closed_with_variance` con sede, cajero, fecha, esperado, contado y diferencia; detalle con ventas/pagos/conteos; campo de conclusión y acción «Revisar». Sin acceso para el cajero.
- **Recetas de platos (`/erp/pos/recetas`, ADM/MGR):** lista de productos preparados con su receta vigente; formulario con componentes (materia prima o presentación), cantidad y versión; publicar nueva versión sin editar la anterior.
- **Navegación:** en `config/modules.ts`, la sección **02. POS y cocina** marca `Caja` como `available` con ruta `/pos`, agrega `Diferencias de caja` (`/erp/pos/revision`, `pos.cash_variance.review`) y `Recetas de platos` (`/erp/pos/recetas`, `pos.dish_recipe.manage`). `Mermas de cocina` sigue bloqueada por P-07.
- **Diseño y accesibilidad:** tokens y componentes de `components/ui` (sin lenguaje visual nuevo); botones táctiles ≥ 52 px, foco visible, etiquetas accesibles, sin desplazamiento horizontal, contraste AA. Cada pantalla se agrega a `apps/web/e2e/accesibilidad.spec.ts`.

## 6. Auditoría y eventos

- **Auditoría:** `pos.shift.open`, `pos.shift.close`, `pos.shift.review`, `pos.sale.create`, `pos.dish_recipe.create`, `pos.dish_recipe.version`.
- **Hechos económicos:** se preparan `SaleCompleted` (venta, total, pagos, líneas; costo pendiente P-03) y `ShiftClosed` (esperado, contado y diferencia) como eventos de dominio. No se contabilizan ni se asientan (P-01..P-04); la venta y el cierre quedan auditados como fuente.
- **Inventario:** movimiento `sale` por lote asignado, con `source_type = 'pos.sale'` y `source_id = sale.id`. Los preparados no generan movimiento; solo `sale_line_consumptions`.
- **Trazabilidad:** `sale_line_lots` enlaza cada línea fabricada con sus lotes; `recipe_version_id` congela la receta del plato vendido.

## 7. Criterios de aceptación

```gherkin
Escenario: abrir turno
  Dado un cajero con acceso a Punto de asados y sin turno abierto
  Cuando abre un turno con base de $100.000
  Entonces el turno queda abierto
  Y el POS habilita el catálogo

Escenario: turno duplicado
  Dado un cajero con un turno abierto
  Cuando intenta abrir otro turno
  Entonces responde 409 SHIFT_ALREADY_OPEN
  Y no se crea un segundo turno

Escenario: vender sin turno
  Dado un cajero sin turno abierto
  Cuando intenta registrar una venta
  Entonces responde 409 SHIFT_NOT_OPEN
  Y no se mueve inventario

Escenario: venta de fabricado con FEFO
  Dado un turno abierto y dos lotes de chorizo con vencimientos distintos en Productos del punto
  Cuando vende 15 unidades con 10 en el primer lote
  Entonces se asignan 10 del primer lote y 5 del segundo
  Y se registran movimientos sale negativos por cada lote
  Y la venta queda completed

Escenario: venta de plato preparado
  Dado un turno abierto y una receta vigente de Picada
  Cuando vende una Picada
  Entonces se registra el consumo teórico de sus componentes
  Y no se descuenta inventario de cocina

Escenario: pago mixto con cambio
  Dado un total de $30.000
  Cuando registra $40.000 en efectivo y $5.000 por transferencia con $15.000 de cambio
  Entonces la venta se confirma
  Y el cambio es $15.000
  Y el efectivo esperado del turno lo descuenta

Escenario: pagos insuficientes
  Dado un total de $30.000
  Cuando registra $20.000 en efectivo
  Entonces responde 422 PAYMENT_SUM_BELOW_TOTAL
  Y no se crea la venta

Escenario: cambio no efectivo
  Dado un total de $30.000
  Cuando registra $35.000 por transferencia
  Entonces responde 422 CHANGE_REQUIRES_CASH

Escenario: existencia insuficiente
  Dado un fabricado sin existencia en Productos del punto
  Cuando intenta venderlo
  Entonces responde 409 INSUFFICIENT_STOCK
  Y no se abre el paquete (P-06)

Escenario: cierre sin diferencia
  Dado un turno abierto con ventas
  Cuando cierra con el conteo exacto por método
  Entonces el turno queda closed
  Y no exige justificación

Escenario: cierre con diferencia
  Dado un turno abierto con $5.000 menos en efectivo
  Cuando cierra con justificación
  Entonces el turno queda closed_with_variance
  Y aparece en la bandeja de revisión

Escenario: cierre con diferencia sin justificación
  Cuando cierra con diferencia y sin nota
  Entonces responde 422 VARIANCE_NOTE_REQUIRED
  Y el turno sigue abierto

Escenario: revisión del supervisor
  Dado un turno closed_with_variance
  Cuando un manager distinto del cajero registra su conclusión
  Entonces el turno queda reviewed
  Y la conclusión queda auditada

Escenario: el cajero no revisa su turno
  Dado un turno closed_with_variance del cajero
  Cuando el mismo cajero intenta revisarlo
  Entonces responde 403 SELF_REVIEW_FORBIDDEN

Escenario: el supervisor no opera el turno ajeno
  Dado un turno abierto de un cajero
  Cuando un manager intenta vender o cerrar ese turno
  Entonces responde 403
  Y el turno del cajero no cambia

Escenario: sede ajena
  Dado un cajero de Punto de asados
  Cuando intenta abrir un turno en otra sede
  Entonces responde 404 SITE_NOT_ALLOWED

Escenario: duplicado idempotente
  Cuando repite una apertura, venta, cierre o revisión con la misma Idempotency-Key
  Entonces devuelve el mismo resultado
  Y no duplica ventas, movimientos, conteos ni auditoría

Escenario: concurrencia de apertura
  Dado dos solicitudes simultáneas del mismo cajero
  Cuando ambas intentan abrir turno
  Entonces solo una crea el turno
  Y la otra responde 409 SHIFT_ALREADY_OPEN

Escenario: permiso denegado
  Dado un usuario sin pos.sale.create
  Cuando intenta vender
  Entonces responde 403
```

## 8. Pruebas

- **Unitarias:** redondeo de líneas y total; suma de pagos, cambio y regla de cambio en efectivo; esperado por método; diferencia y transición de estado; consumo teórico escalado por `base_output_qty`; validación de componentes de receta (exactamente uno).
- **Integración (PostgreSQL real):** apertura y duplicado por cajero/sitio; venta de fabricado con FEFO repartido; venta de preparado con consumo teórico y sin movimiento; pagos mixtos y cambio; pagos insuficientes; cambio no efectivo; existencia insuficiente; venta sin turno; cierre sin/con diferencia; nota obligatoria; revisión por supervisor; cajero no revisa; segunda revisión; sede ajena; idempotencia; concurrencia de apertura, venta y cierre; permisos.
- **E2E:** cajero abre turno, vende un fabricado y un plato con pago mixto, ve el comprobante y cierra con diferencia; manager revisa el turno; accesibilidad axe en escritorio, tableta y móvil para `/pos`, `/erp/pos/revision` y `/erp/pos/recetas`.
- **Regresión:** el E2E de caja existente deja de comprobar el placeholder y pasa a comprobar la venta real.

## 9. Datos de demostración

- Sitio **Punto de asados** con **Productos del punto** y **Cocina**; cajero `caja@quatreros.example` con alcance a ese sitio.
- Existencia vendible en **Productos del punto**: chorizo unidad/paquete (ya existe); se agrega rellena unidad para la demo.
- Receta de plato **Picada Quatreros XL** (versión 1): 2 chorizos unidad + 1 rellena unidad (si se aprueba D3; con la alternativa, componentes en materias primas). El plato ya está en el catálogo como `prepared`.
- Un turno cerrado con diferencia de `caja@`, con una venta pagada en efectivo y transferencia y una nota de faltante, para que el manager tenga una revisión pendiente.
- No se siembra un turno abierto: la demo lo abre para vender.
- La semilla es idempotente por sitio/cajero/fecha y no duplica ventas ni movimientos.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:**

- Especificación aprobada, incluidas D1..D8.
- Registrar las decisiones aprobadas en `decision-register.md` (nuevo `DEC-###`) y actualizar la matriz de trazabilidad.
- Confirmar que RF-225 se implementa en esta entrega y que RF-226 solo incluye consumo teórico.
- Aprobar la ampliación de `catalog.recipe_lines` (D3).

**Terminado cuando:**

- Esquema `pos` con tablas, restricciones, índices parciales y grants; migración revisada y probada desde una base vacía.
- Contratos Zod en `packages/contracts/src/pos.ts` y ampliación de catálogo para recetas `dish`.
- Casos de uso con transacciones, bloqueos, idempotencia, auditoría y hechos económicos.
- Endpoints, permisos y alcance por sede/OWN.
- POS real en `/pos`; bandeja de revisión y recetas en el ERP.
- Semilla demo idempotente.
- `pnpm check`, integración PGlite/PostgreSQL real, build y E2E con axe en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.
- `Mermas de cocina` sigue bloqueada y el documento fiscal sigue fuera; nada de P-02, P-06, P-07 ni P-09 se simula.
