# Especificación — Entrega 5: clientes, pedidos, despacho y reparto

> Estado: **APROBADA E IMPLEMENTADA** · 2026-11-02
> Cubre RF-150, RF-151, RF-152, RF-180, RF-181, RF-182, RF-183, RF-184, RF-185, RF-260 y RF-261.
> Quedan fuera RF-153 (cancelación/descuentos, P-09) y RF-186 (liquidación, P-08).
> Reglas `PROVISIONAL`: reservas por lote (DEC-098), cupo/mora con advertencia (DEC-099), recaudo efectivo/transferencia (DEC-100) y crédito originado en la entrega (Q-B-05).

## 1. Objetivo y alcance

Que un pedido confirmado reserve inventario, salga en un despacho con lotes FEFO, se entregue total o parcialmente desde el celular del repartidor, cobre al cliente y registre devoluciones para inspección, sin perder trazabilidad ni duplicar existencias.

**Incluye:**

- Clientes con datos de entrega, edición, inactivación y crédito (cupo/plazo) configurable por el Administrador.
- Pedido confirmado en un paso, con precio vigente congelado, canal, modalidad de pago y reserva FEFO por lote.
- Advertencia de crédito cuando el cupo se excede o hay mora; el pedido no se bloquea (DEC-099).
- Despacho que agrupa pedidos confirmados, asigna distribuidor y sale a la ubicación "En ruta".
- Portal móvil del distribuidor con sus despachos, direcciones, entrega total/parcial, recaudo y devolución.
- Entrega que descuenta la mercancía en ruta, actualiza pendientes y genera obligación si es a crédito.
- Recaudo por efectivo o transferencia, pendiente de conciliación.
- Devolución a "En inspección" y reincorporación a la bodega; el descarte queda para AP-08.
- Semilla demo con clientes, un pedido confirmado y un despacho preparado.

**No incluye:**

| Tema                                                     | Motivo                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| RF-153 cancelación de pedidos y descuentos               | PENDING P-09.                                           |
| RF-186 liquidación del distribuidor                      | PENDING P-08; no se calculan sobrantes ni faltantes.    |
| Devolución de mercancía cargada no entregada             | BR-124 PROPOSED y depende de la liquidación (P-08).     |
| Descarte de devoluciones                                 | BR-126 exige AP-08; solo se implementa reincorporar.    |
| Rutas, zonas y orden de visita                           | Q-DIS-02/P-08; solo asignación a distribuidor.          |
| Conciliación de recaudos y cartera completa              | Entrega 7; aquí solo se registra el recaudo pendiente.  |
| Facturación electrónica, impuestos y documentos fiscales | P-02.                                                   |
| Aprobación AP-01/AP-02 por crédito excedido o mora       | No existe motor de aprobaciones; se advierte (DEC-099). |
| Borrador editable de pedido                              | El pedido nace confirmado con precio fijo y reserva.    |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                       |
| ------- | ------------------------------------------------------------------------------- |
| RF-150  | Clientes, contacto, dirección, inactivación y crédito                           |
| RF-151  | Pedido con líneas, precio vigente, canal, pago y reserva                        |
| RF-152  | Seguimiento por estado y pendientes por línea                                   |
| RF-180  | Despacho con pedidos confirmados y distribuidor                                 |
| RF-181  | Salida FEFO a "En ruta"                                                         |
| RF-182  | Portal móvil del distribuidor                                                   |
| RF-183  | Entrega total o parcial con motivo                                              |
| RF-184  | Recaudo por efectivo o transferencia                                            |
| RF-185  | Devolución e inspección (reincorporar)                                          |
| RF-260  | Cupo y plazo por cliente                                                        |
| RF-261  | Validación de cupo y mora con advertencia                                       |
| BR-110  | Cliente y modalidad de pago                                                     |
| BR-111  | Crédito solo si el cliente lo tiene habilitado                                  |
| BR-112  | Pedido abierto mientras tenga pendientes                                        |
| BR-120  | Un despacho tiene un distribuidor y varios pedidos                              |
| BR-121  | Salida FEFO y mercancía en ruta (Q-B-07)                                        |
| BR-122  | El distribuidor solo ve sus despachos                                           |
| BR-123  | Entrega parcial deja saldo y motivo                                             |
| BR-125  | Devolución con motivo entra a inspección                                        |
| BR-126  | Reincorporación a disponible; descarte pendiente AP-08                          |
| BR-170  | Cupo y plazo configurables por el Administrador                                 |
| BR-171  | Exceso/mora se advierte; AP-01/02 pendiente                                     |
| BR-172  | Obligación a crédito con vencimiento = entrega + plazo (Q-B-05)                 |
| BR-175  | Recaudos separados por distribuidor                                             |
| BR-176  | Recaudo pendiente de conciliación                                               |
| BR-085  | `PROVISIONAL` (DEC-098): disponible = saldo − reservas activas                  |
| BR-093  | `PROVISIONAL` (DEC-098): reserva al confirmar, se consume al despachar          |
| BR-173  | `PROVISIONAL` (DEC-099): cupo usado = cartera + pedidos a crédito no entregados |
| DEC-098 | Reservas por lote y FEFO                                                        |
| DEC-099 | Crédito con advertencia, sin bloqueo                                            |
| DEC-100 | Recaudo efectivo/transferencia, pendiente de conciliación                       |

## 3. Modelo de datos

### 3.1 `sales.customers`

| Columna            | Tipo / regla                           |
| ------------------ | -------------------------------------- |
| `id`               | `uuid` PK                              |
| `kind`             | `restaurant`, `business`, `individual` |
| `name`             | texto                                  |
| `tax_id`           | texto único, nullable                  |
| `phone`            | texto                                  |
| `delivery_address` | texto                                  |
| `is_active`        | booleano                               |
| `version`          | entero `> 0` para `If-Match`           |
| `created_at`       | `timestamptz`                          |

### 3.2 `finance.credit_terms`

| Columna        | Tipo / regla               |
| -------------- | -------------------------- |
| `customer_id`  | PK, FK a `sales.customers` |
| `enabled`      | booleano                   |
| `credit_limit` | `NUMERIC(14,2) >= 0`       |
| `term_days`    | entero `>= 0`              |
| `updated_by`   | FK a `admin.users`         |
| `updated_at`   | `timestamptz`              |

Solo `fin.credit.configure` (Administrador) modifica el crédito.

### 3.3 `sales.orders` y `sales.order_lines`

| Tabla/columna               | Tipo / regla                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `orders.number`             | consecutivo `P-0001`                                           |
| `orders.site_id`            | FK a `admin.sites`                                             |
| `orders.customer_id`        | FK a `sales.customers`                                         |
| `orders.channel`            | texto (`whatsapp`, `phone`, `in_person`, `other`)              |
| `orders.payment_mode`       | `cash_on_delivery`, `credit`                                   |
| `orders.requested_date`     | fecha, nullable                                                |
| `orders.status`             | `confirmed`, `in_dispatch`, `partially_delivered`, `delivered` |
| `orders.credit_warning`     | texto nullable; advertencia de cupo/mora (DEC-099)             |
| `orders.confirmed_at`       | `timestamptz`                                                  |
| `orders.created_by`         | FK a `admin.users`                                             |
| `order_lines.ordered_qty`   | `NUMERIC(14,3) > 0`                                            |
| `order_lines.reserved_qty`  | `NUMERIC(14,3) >= 0` (informativo)                             |
| `order_lines.delivered_qty` | `NUMERIC(14,3) >= 0`, `<= ordered_qty`                         |
| `order_lines.returned_qty`  | `NUMERIC(14,3) >= 0`, `<= delivered_qty`                       |
| `order_lines.unit_price`    | `NUMERIC(14,2) > 0`, congelado al confirmar                    |

- El pedido se crea directamente `confirmed`; no hay borrador en esta entrega.
- El total se calcula con `unit_price × ordered_qty` y no se almacena: se deriva.
- Si no hay precio vigente para una presentación, `409 PRICE_REQUIRED`.

### 3.4 `inventory.reservations` (ajuste al diseño preliminar)

| Columna               | Tipo / regla                                |
| --------------------- | ------------------------------------------- |
| `id`                  | `uuid` PK                                   |
| `sales_order_line_id` | FK lógica a `sales.order_lines`             |
| `lot_id`              | FK a `inventory.lots` (se agrega al diseño) |
| `product_id`          | FK a `catalog.products`                     |
| `presentation_id`     | FK a `catalog.presentations`                |
| `location_id`         | FK a `admin.locations`                      |
| `quantity`            | `NUMERIC(14,3) > 0`                         |
| `status`              | `active`, `consumed`, `released`            |

- Único `(sales_order_line_id, lot_id)`.
- La reserva se crea al confirmar el pedido, se consume al cargar el despacho.
- La disponibilidad descuenta las reservas activas.

### 3.5 `distribution.dispatches`, líneas y entregas

Se implementa el diseño preliminar:

- `dispatches`: número `D-0001`, sede, distribuidor, ubicación "En ruta", fecha, estado `prepared`, `in_route`, `to_settle`, creador.
- `dispatch_lines`: despacho, línea de pedido, lote, presentación, `loaded_qty`, `delivered_qty`, `returned_qty`.
- `deliveries`: despacho, pedido, parcial, motivo, fecha, registrador.
- `delivery_lines`: entrega, línea de despacho, cantidad.
- No se crea `distribution.settlements`.

### 3.6 `distribution.returns`

| Columna           | Tipo / regla                                       |
| ----------------- | -------------------------------------------------- |
| `id`              | `uuid` PK                                          |
| `number`          | consecutivo `DV-0001`                              |
| `customer_id`     | FK a `sales.customers`                             |
| `dispatch_id`     | FK a `distribution.dispatches`                     |
| `delivery_id`     | FK a `distribution.deliveries` (se agrega)         |
| `order_line_id`   | FK lógica a `sales.order_lines` (se agrega)        |
| `lot_id`          | FK a `inventory.lots`                              |
| `presentation_id` | FK a `catalog.presentations`                       |
| `quantity`        | `NUMERIC(14,3) > 0`                                |
| `reason`          | texto obligatorio                                  |
| `status`          | `in_inspection`, `reinstated` (descarte pendiente) |
| `inspected_by/at` | nullable                                           |
| `registered_by`   | FK a `admin.users`                                 |

### 3.7 `finance` mínimo

- `payment_methods` con **Efectivo** y **Transferencia** (semilla).
- `receivables`: obligación por entrega a crédito, `source_type = 'distribution.delivery'`, saldo, vencimiento.
- `collections`: número `RC-0001`, sede, distribuidor, cliente, método, monto, `delivery_id` (se agrega), estado `registered`, pendiente de conciliación.
- `payment_allocations`: aplicación del recaudo a la obligación.

### 3.8 Movimientos y reservas

- Carga: `dispatch_out` negativo en origen y `dispatch_return` positivo en "En ruta"; reservas → `consumed`.
- Entrega: `sale` negativo en "En ruta".
- Devolución: `customer_return` positivo en "En inspección".
- Reincorporación: `customer_return` negativo en "En inspección" y `return_reinstated` positivo en la bodega.
- Entrega parcial: solo se mueve lo entregado; lo cargado no entregado permanece en ruta hasta la liquidación (P-08).

## 4. Contrato de API

| Método y ruta                                   | Permiso                 | Descripción                                                      |
| ----------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `GET /sales/customers`                          | `com.customer.read`     | Lista clientes                                                   |
| `POST /sales/customers`                         | `com.customer.manage`   | Crea cliente. Idempotente                                        |
| `PATCH /sales/customers/{id}`                   | `com.customer.manage`   | Edita/inactiva con `If-Match`                                    |
| `PUT /sales/customers/{id}/credit`              | `fin.credit.configure`  | Configura cupo y plazo                                           |
| `GET /sales/orders`                             | `com.order.read`        | Lista pedidos por sede, estado y fechas                          |
| `POST /sales/orders`                            | `com.order.create`      | Crea y confirma el pedido, congela precio y reserva. Idempotente |
| `GET /sales/orders/{id}`                        | `com.order.read`        | Detalle con líneas, reservas, despachos y advertencia            |
| `GET /distribution/dispatches`                  | `dis.dispatch.read`     | Lista despachos; el distribuidor solo ve los suyos               |
| `POST /distribution/dispatches`                 | `dis.dispatch.create`   | Crea despacho preparado con pedidos confirmados                  |
| `GET /distribution/dispatches/{id}`             | `dis.dispatch.read`     | Detalle con pedidos, líneas, clientes y estado                   |
| `POST /distribution/dispatches/{id}/load`       | `dis.dispatch.create`   | Confirma carga, mueve a "En ruta" y consume reservas             |
| `POST /distribution/dispatches/{id}/deliveries` | `dis.delivery.register` | Registra entrega total/parcial, recaudo y obligación             |
| `POST /distribution/dispatches/{id}/returns`    | `dis.return.register`   | Registra devolución a inspección                                 |
| `POST /distribution/returns/{id}/inspect`       | `dis.return.inspect`    | Reincorpora la devolución a la bodega                            |

**Reglas:**

- `POST /sales/orders` recibe `{ customerId, siteId, channel, paymentMode, requestedDate?, lines: [{ presentationId, quantity }] }`.
  - Cliente activo; presentaciones activas con precio vigente; cantidades > 0.
  - Si `paymentMode = credit`, el cliente debe tener crédito habilitado (`409 CREDIT_NOT_ENABLED`).
  - Se calcula el total; si es crédito, se calcula cupo usado y mora. Si excede o hay mora, se guarda `credit_warning` y el pedido se confirma igual (DEC-099).
  - Se reserva FEFO hasta la cantidad disponible; si falta, el pedido se confirma con faltante y `reserved_qty < ordered_qty`.
- `POST /dispatches` recibe `{ siteId, driverId, dispatchDate, orderIds }`.
  - Pedidos confirmados de la sede, con reservas activas y sin otro despacho activo.
  - El distribuidor debe tener rol `DIST` activo.
  - Crea líneas por reserva (lote/presentación/cantidad).
- `POST /dispatches/{id}/load` no recibe cuerpo. Solo desde `prepared`; si no hay ubicación "En ruta", `409 NO_ROUTE_LOCATION`.
- `POST /dispatches/{id}/deliveries` recibe `{ orderId, lines: [{ dispatchLineId, quantity }], partialReason?, paymentMethod?: 'cash'|'transfer', collectedAmount? }`.
  - Solo despacho `in_route`; el distribuidor debe ser el asignado.
  - `quantity <= loaded_qty − delivered_qty`; si alguna línea es menor, `partialReason` obligatorio.
  - Si el pedido es contraentrega, `collectedAmount` debe ser igual al valor entregado; si es crédito, se crea obligación por el valor entregado y el abono es opcional y no puede superar ese valor.
  - Un pedido puede recibir varias entregas; queda `partially_delivered` o `delivered`.
  - Cuando todas las líneas cargadas del despacho están entregadas, el despacho pasa a `to_settle`.
- `POST /returns` recibe `{ deliveryId, dispatchLineId, quantity, reason }`; `quantity <= delivered − returned` de esa línea.
- `POST /returns/{id}/inspect` recibe `{ decision: 'reinstate' }`. `discard` responde `423 FEATURE_BLOCKED` (AP-08).
- **Alcance:** pedidos y despachos filtran por sede; el distribuidor solo ve sus despachos (BR-122). Los clientes son globales.
- `Idempotency-Key` obligatoria en todas las escrituras.

**Errores propios:**

| Código                     | HTTP | Cuándo                                              |
| -------------------------- | ---- | --------------------------------------------------- |
| `CREDIT_NOT_ENABLED`       | 409  | Pedido a crédito con cliente sin crédito habilitado |
| `PRICE_REQUIRED`           | 409  | Presentación sin precio vigente                     |
| `CUSTOMER_INACTIVE`        | 409  | Cliente inactivo                                    |
| `DRIVER_INVALID`           | 409  | Usuario sin rol DIST activo                         |
| `ORDER_NOT_CONFIRMED`      | 409  | Pedido no confirmado o sin reservas                 |
| `ORDER_ALREADY_DISPATCHED` | 409  | Pedido ya está en un despacho activo                |
| `NO_ROUTE_LOCATION`        | 409  | La sede no tiene ubicación "En ruta" activa         |
| `DISPATCH_NOT_PREPARED`    | 409  | Carga de un despacho que no está preparado          |
| `DISPATCH_NOT_IN_ROUTE`    | 409  | Entrega/devolución fuera de ruta                    |
| `DELIVERY_EXCEEDS_LOADED`  | 422  | Cantidad entregada mayor a la cargada pendiente     |
| `RETURN_EXCEEDS_DELIVERED` | 422  | Devolución mayor a lo entregado                     |
| `COLLECTION_REQUIRED`      | 422  | Contraentrega sin recaudo completo                  |
| `COLLECTION_EXCEEDS_TOTAL` | 422  | Recaudo mayor al valor entregado                    |

## 5. Pantallas

- **03. Distribución → Clientes y pedidos** (`/erp/ventas`):
  - Pestaña **Clientes:** lista, formulario con datos de entrega y crédito (solo Administrador).
  - Pestaña **Pedidos:** lista con número, cliente, sede, fecha, total, pago y estado; formulario de alta con líneas y disponibilidad; detalle con advertencia de crédito, reservas y despachos.
  - Pestaña **Despachos:** lista, creación con pedidos confirmados y distribuidor, detalle con carga y seguimiento.
- **Portal del distribuidor** (`/ruta`): lista de despachos asignados; detalle con cliente, dirección, teléfono, líneas, lote, entrega parcial, recaudo y devolución.
- **Inspección:** desde el detalle del despacho o una lista de devoluciones en el ERP; acción "Reincorporar".
- Estados vacío/carga/error/sin permiso en cada pantalla.
- Cada pantalla nueva se agrega a `apps/web/e2e/accesibilidad.spec.ts`.

## 6. Auditoría

- `com.customer.create`, `com.customer.update`, `fin.credit.configure`.
- `com.order.create` con líneas, precios, reservas y advertencia de crédito.
- `dis.dispatch.create`, `dis.dispatch.load`.
- `dis.delivery.register` con líneas, lote, recaudo y obligación.
- `dis.return.register` y `dis.return.inspect`.
- Movimientos con `source_type` del documento de origen.

## 7. Criterios de aceptación

```gherkin
Escenario: confirmar pedido con reserva FEFO
  Dado un cliente activo y dos lotes del producto con vencimientos distintos
  Cuando se confirma un pedido de 15 unidades con 10 en el primer lote
  Entonces se reservan 10 del primer lote y 5 del segundo
  Y la disponibilidad descuenta las reservas activas

Escenario: confirmar con faltante
  Cuando se pide más de la existencia disponible
  Entonces el pedido se confirma con una advertencia de faltante
  Y solo se reserva lo disponible

Escenario: crédito excedido solo advierte
  Dado un cliente con cupo agotado o cartera vencida
  Cuando confirma un pedido a crédito
  Entonces el pedido se confirma con advertencia de crédito
  Y no se bloquea

Escenario: salida del despacho
  Dado un despacho preparado con pedidos y reservas
  Cuando el manager confirma la carga
  Entonces los lotes salen de la bodega y entran a "En ruta"
  Y las reservas quedan consumidas
  Y el despacho queda in_route

Escenario: entrega parcial
  Dado un despacho en ruta
  Cuando el distribuidor entrega 6 de 10 y registra motivo
  Entonces el pedido queda partially_delivered con 4 pendientes
  Y el inventario en ruta baja en 6

Escenario: recaudo contraentrega
  Dado un pedido contraentrega
  Cuando se entrega y se cobra el valor completo por efectivo
  Entonces se crea un recaudo pendiente de conciliación

Escenario: obligación a crédito
  Dado un pedido a crédito
  Cuando se entrega
  Entonces se crea una obligación con vencimiento entrega + plazo
  Y un abono opcional reduce el saldo

Escenario: devolución e inspección
  Dado un pedido entregado
  Cuando el distribuidor registra una devolución con motivo
  Entonces la mercancía entra a "En inspección"
  Y al reincorporar vuelve a la bodega en su lote

Escenario: descarte bloqueado
  Cuando se intenta descartar una devolución
  Entonces responde 423 FEATURE_BLOCKED (AP-08)

Escenario: permisos
  Dado un distribuidor
  Cuando consulta despachos
  Entonces solo ve los asignados a él
  Y no puede crear despachos ni inspeccionar devoluciones

Escenario: duplicado idempotente
  Cuando se repite un pedido, despacho, entrega o devolución con la misma clave
  Entonces devuelve el mismo resultado y no duplica reservas, movimientos ni recaudos
```

## 8. Pruebas

- **Unitarias:** total del pedido, cupo usado, mora, reparto de reservas, cantidades pendientes y entrega parcial, valor de obligación y recaudo.
- **Integración (PostgreSQL real):** cliente y crédito; pedido con reservas FEFO; faltante; crédito excedido con advertencia; despacho y salida a ruta; entrega parcial; recaudo COD; obligación y abono a crédito; devolución y reincorporación; descarte bloqueado; permisos del distribuidor; idempotencia.
- **E2E:** manager crea cliente y pedido, crea despacho y carga; distribuidor entrega parcial, cobra y devuelve; inspección reincorpora; accesibilidad en tres tamaños.

## 9. Datos de demostración

- Clientes: **Restaurante La Brasa** (crédito $2.000.000, 15 días) y **Tienda Doña Rosa** (contraentrega).
- Pedido `P-0001` confirmado para Restaurante La Brasa: 10 paquetes ×10 de chorizo; reserva FEFO.
- Despacho `D-0001` preparado con `P-0001` asignado a `reparto@`.
- No se siembran entregas, recaudos ni devoluciones: la demo los registra.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:** especificación aprobada y DEC-098/099/100 registradas. RF-153 y RF-186 siguen fuera.

**Terminado cuando:**

- Esquemas `sales`, `distribution`, `finance` mínimo y reservas en `inventory`; migración y permisos.
- Casos de uso con transacciones, bloqueos, idempotencia y auditoría.
- Reservas, salida FEFO, entregas, recaudos y devoluciones funcionando en local.
- Pantallas ERP y portal del distribuidor; módulos `available`.
- Semilla demo idempotente.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.
