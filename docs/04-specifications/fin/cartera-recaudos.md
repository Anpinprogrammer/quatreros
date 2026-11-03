# Especificación — Entrega 7: cartera, recaudos y tablero

> Estado: **APROBADA** · 2026-11-02 (D1..D9 aprobadas por el responsable; implementación en curso)
> Cubre RF-262, RF-263, RF-264, RF-265 y la parte de cartera/recaudos/caja de RF-266.
> RF-303 (hechos económicos) se especifica aparte en `docs/04-specifications/cont/hechos-economicos.md`.
> Fuera de alcance: RF-266 completa (ventas, producción, inventario y cocina), liquidación de distribuidores (P-08), contabilización e impuestos (P-01..P-04), costeo (P-03), descuentos/anulaciones (P-09) y documento fiscal (P-02).
> Reglas provisionales: abono a la obligación más antigua (BR-174), cupo utilizado (BR-173/DEC-099) y vencimiento por fecha (Q-COM-04: el día siguiente al plazo, sin intereses).

## 0. Decisiones que necesitan aprobación

| #   | Decisión                                                                                                                                                                                                                                                                   | Recomendación                                                                       | Si no se aprueba                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | **Rangos de antigüedad:** por vencer (vence hoy o después), vencida 1–30, 31–60, 61–90 y más de 90 días. Son rangos de presentación, no una regla contable.                                                                                                                | Aprobar. No hay rangos en el DM; se documentan como [Ampliación] de reporte.        | Habría que definir otra agrupación antes de construir el tablero.           |
| D2  | **Abono mayor al saldo total:** se rechaza con `409 ABONO_EXCEEDS_BALANCE`. No se crea saldo a favor en el prototipo (la alternativa del RF-263 queda para una decisión posterior).                                                                                        | Aprobar el rechazo; evita inventar una cartera a favor sin regla contable.          | Habría que crear una tabla de saldos a favor y su tratamiento contable.     |
| D3  | **Aplicación del abono:** por defecto a la obligación más antigua (vencimiento y creación); el usuario puede indicar asignaciones manuales. BR-174 es PROPOSED; se aplica como PROVISIONAL en el prototipo.                                                                | Aprobar FIFO + manual.                                                              | Solo se podría aplicar manualmente o dejar el abono sin asignar.            |
| D4  | **Conciliación:** agrupa recaudos `registered` por sede, tipo de responsable y usuario; compara el esperado por método contra lo recibido y registra la diferencia. **No** liquida al distribuidor ni crea una cuenta por cobrar por faltantes (P-08).                     | Aprobar este alcance; la diferencia queda documentada y auditable.                  | Habría que esperar P-08 para cerrar recaudos con faltante.                  |
| D5  | **Recaudos de caja:** los pagos del POS no se duplican en `finance.collections`; la caja se consulta desde los turnos del POS. La conciliación de esta entrega aplica a recaudos de distribuidor y oficina. Los cierres de caja siguen en la revisión del POS (entrega 6). | Aprobar. Evita doble conteo entre `pos.payments` y `finance.collections`.           | Habría que decidir si el POS crea recaudos financieros y cómo se concilian. |
| D6  | **Exportación:** CSV UTF-8 con BOM y separador `;`, compatible con Excel, en lugar de `.xlsx`. No se agrega una dependencia de hojas de cálculo.                                                                                                                           | Aprobar para el prototipo; el nombre del reporte y las columnas quedan estables.    | Habría que incorporar una librería `.xlsx` y su mantenimiento.              |
| D7  | **Sede de la obligación:** se agrega `receivables.site_id` (nullable). Las obligaciones nuevas lo exigen; las históricas se rellenan desde el despacho de origen cuando sea posible. ADM/CONT ven todo, MGR su sede y DIST solo las obligaciones de sus entregas.          | Aprobar; permite el alcance por sede sin cambiar el origen de la obligación.        | La cartera quedaría global y MGR/DIST verían más de lo que les corresponde. |
| D8  | **Vencida:** una obligación está vencida cuando `due_on < today` y tiene saldo. El día del vencimiento es “por vencer”. Sin intereses de mora (Q-COM-04).                                                                                                                  | Aprobar como PROVISIONAL.                                                           | Habría que definir mora e intereses con el contador.                        |
| D9  | **Semilla:** obligaciones con vencimientos en los cuatro rangos, dos recaudos pendientes (distribuidor y oficina), una conciliación con diferencia y los hechos económicos correspondientes.                                                                               | Aprobar; permite demostrar cartera, recaudos y conciliación sin crear datos a mano. | La demo empezaría con pantallas vacías.                                     |

## 1. Objetivo y alcance

Que el negocio pueda ver **quién debe, cuánto y desde cuándo**, registrar abonos aplicados a obligaciones, consultar los recaudos por responsable, conciliar lo registrado contra lo recibido y exportar la información. La cartera y los recaudos son la fuente operativa de la cobranza; la contabilización sigue bloqueada.

**Incluye:**

- Cartera por cliente con antigüedad, saldo, vencimiento y detalle de obligaciones.
- Abonos de clientes con método de pago, aplicación automática FIFO o manual y comprobante interno.
- Registro de asignaciones (`payment_allocations`) para saber qué abono pagó qué obligación.
- Consulta de recaudos por distribuidor, oficina y caja, con estado de conciliación.
- Conciliación de recaudos pendientes por método, con diferencia y constancia.
- Tablero de cartera/recaudos para el Command Center y reportes CSV de cartera, recaudos y caja.
- Semilla demo con antigüedad y casos de conciliación.
- Hechos económicos de cartera/recaudos según la especificación complementaria.

**No incluye:**

| Tema                                                         | Motivo                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Contabilización, asientos, impuestos y períodos              | P-01..P-04; la capa de hechos se especifica aparte y no se contabiliza. |
| Costeo, margen y rentabilidad                                | P-03; RF-266 queda parcial en esta entrega.                             |
| Liquidación de distribuidores, faltantes y sobrantes de ruta | P-08; la conciliación solo registra la diferencia.                      |
| Cuenta por cobrar al distribuidor por faltante               | P-08 / Q-DIS-03; no se inventa.                                         |
| Saldo a favor por abono en exceso                            | D2; se rechaza en el prototipo.                                         |
| Descuentos, anulaciones, notas de crédito y reembolsos       | P-09.                                                                   |
| Facturación electrónica y documento fiscal                   | P-02.                                                                   |
| Intereses de mora                                            | Q-COM-04; no se calculan.                                               |
| Reportes de ventas, producción, inventario y cocina          | Fuera del foco de cartera; se mantienen las pantallas existentes.       |
| Duplicar los pagos del POS en `finance.collections`          | D5; la caja se consulta desde `pos`.                                    |

## 2. Requerimientos y reglas cubiertas

| ID       | Cobertura                                                                           |
| -------- | ----------------------------------------------------------------------------------- |
| RF-262   | Cartera por cliente, antigüedad, obligaciones y exportación                         |
| RF-263   | Abonos con método, aplicación FIFO/manual y comprobante interno                     |
| RF-264   | Recaudos por distribuidor/oficina/caja y estado de conciliación                     |
| RF-265   | Conciliación de recaudos con diferencia documentada                                 |
| RF-266   | Reportes CSV de cartera, recaudos y caja (parte financiera)                         |
| BR-172   | Vencimiento = origen + plazo                                                        |
| BR-173   | Cupo utilizado = cartera + pedidos a crédito no entregados (`PROVISIONAL`, DEC-099) |
| BR-174   | Abono a la obligación más antigua por defecto (`PROVISIONAL`, D3)                   |
| BR-175   | Recaudos separados por punto de venta y distribuidor                                |
| BR-176   | Recaudo de distribuidor pendiente de conciliación hasta verificarse                 |
| BR-177   | Conciliación = registrado vs. recibido, con diferencia y responsable                |
| BR-178   | Montos en COP como cadenas decimales, sin punto flotante                            |
| BR-200   | Hechos económicos de las operaciones (ver especificación complementaria)            |
| DEC-099  | Crédito con advertencia; cartera vencida se consulta, no se bloquea aquí            |
| DEC-100  | Recaudos efectivo/transferencia pendientes de conciliación                          |
| Q-COM-04 | Vencida al día siguiente del plazo; sin intereses (D8)                              |
| Q-DIS-03 | Faltante de distribuidor sin tratamiento contable hasta P-08                        |
| Q-DIS-04 | Efectivo/transferencia; soporte opcional para transferencias                        |

## 3. Modelo de datos

Se mantienen `NUMERIC(14,2)` para dinero y `date`/`timestamptz` para fechas. Los saldos se actualizan dentro de la misma transacción del abono, con bloqueo de las obligaciones.

### 3.1 `finance.receivables` (ajustes)

| Columna       | Tipo / regla                                         |
| ------------- | ---------------------------------------------------- |
| `site_id`     | nueva, `uuid` nullable; FK a `admin.sites`           |
| `customer_id` | FK a `sales.customers` (maestro estable)             |
| `source_type` | texto: `distribution.delivery`, `seed.receivable`, … |
| `source_id`   | uuid; único junto con `source_type`                  |
| `amount`      | `NUMERIC(14,2) > 0`                                  |
| `balance`     | `NUMERIC(14,2) >= 0` y `<= amount`                   |
| `issued_on`   | fecha de origen                                      |
| `due_on`      | `>= issued_on`                                       |
| `status`      | `open`, `partially_paid`, `paid`                     |

- Índice `(site_id, due_on) WHERE balance > 0`.
- `createReceivable` recibe `siteId`; el despacho pasa `dispatch.siteId`.
- Las obligaciones históricas sin sede se rellenan desde `distribution.deliveries → dispatches.site_id` cuando sea posible; si no, quedan visibles solo para ADM/CONT.

### 3.2 `finance.collections` (ajustes)

| Columna             | Tipo / regla                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `kind`              | nueva, `delivery` o `payment`; las existentes se migran como `delivery` |
| `reconciliation_id` | nueva, `uuid` nullable; FK a `finance.reconciliations`                  |
| `site_id`           | FK a `admin.sites`                                                      |
| `collector_type`    | `driver`, `cash_register`, `office`                                     |
| `collector_user_id` | FK a `admin.users`; nullable para recaudos sin usuario                  |
| `customer_id`       | FK a `sales.customers`; nullable para recaudos sin cliente              |
| `payment_method_id` | FK a `finance.payment_methods`                                          |
| `amount`            | `NUMERIC(14,2) > 0`                                                     |
| `delivery_id`       | nullable; entrega de origen                                             |
| `status`            | `registered`, `reconciled`, `reconciled_with_variance`                  |

- Un recaudo `payment` es un abono de cartera; un `delivery` es un cobro de entrega (contraentrega o abono a crédito).
- Un recaudo `payment` debe tener al menos una asignación y la suma de asignaciones = `amount`.
- Un recaudo `delivery` puede no tener asignaciones (contraentrega sin obligación) o tenerlas (abono a crédito).

### 3.3 `finance.payment_allocations`

| Columna         | Tipo / regla               |
| --------------- | -------------------------- |
| `id`            | `uuid` PK                  |
| `collection_id` | FK a `finance.collections` |
| `receivable_id` | FK a `finance.receivables` |
| `amount`        | `NUMERIC(14,2) > 0`        |
| `created_at`    | `timestamptz`              |

- `unique (collection_id, receivable_id)`.
- Índice por `receivable_id`.
- La suma por recaudo no puede superar el monto del recaudo; la suma por obligación no puede superar su saldo. Se valida en la transacción con `FOR UPDATE`.

### 3.4 `finance.reconciliations` y `finance.reconciliation_lines`

`reconciliations`:

| Columna             | Tipo / regla                                                  |
| ------------------- | ------------------------------------------------------------- |
| `id`                | `uuid` PK                                                     |
| `number`            | `CONC-0001`, único; secuencia `CONC`                          |
| `site_id`           | FK a `admin.sites`                                            |
| `collector_type`    | `driver`, `cash_register`, `office`                           |
| `collector_user_id` | FK a `admin.users`                                            |
| `period_from`       | `date`                                                        |
| `period_to`         | `date`                                                        |
| `expected_amount`   | `NUMERIC(14,2) >= 0`                                          |
| `received_amount`   | `NUMERIC(14,2) >= 0`                                          |
| `variance`          | columna generada `received_amount − expected_amount` (BR-177) |
| `note`              | texto nullable                                                |
| `created_by`        | FK a `admin.users`                                            |
| `created_at`        | `timestamptz`                                                 |

`reconciliation_lines`:

| Columna             | Tipo / regla                                         |
| ------------------- | ---------------------------------------------------- |
| `reconciliation_id` | FK a `finance.reconciliations`                       |
| `payment_method_id` | FK a `finance.payment_methods`                       |
| `expected_amount`   | `NUMERIC(14,2) >= 0`                                 |
| `received_amount`   | `NUMERIC(14,2) >= 0`                                 |
| `variance`          | columna generada `received_amount − expected_amount` |

- `unique (reconciliation_id, payment_method_id)`.
- Al conciliar, cada recaudo seleccionado pasa a `reconciled` o `reconciled_with_variance` y guarda `reconciliation_id`.
- No se crea una obligación por la diferencia (P-08).

### 3.5 Secuencias y consultas

- `platform.document_sequences`: `RC` ya existe para recaudos; se agrega `CONC` para conciliaciones.
- Antigüedad: `case` sobre `due_on >= current_date`, `current_date - due_on <= 30`, `<= 60`, `<= 90`, `> 90`.
- Cupo usado: cartera abierta + pedidos a crédito confirmados no entregados (BR-173); se reutiliza `creditSnapshot` y se agrega el abierto por cliente.

### 3.6 Hechos económicos

Esta entrega emite `ReceivableCreated`, `PaymentReceived` y `CollectionReconciled` a `accounting.economic_events` (ver `cont/hechos-economicos.md`). No se contabiliza.

## 4. Contrato de API

| Método y ruta                                    | Permiso                         | Descripción                                                               |
| ------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------- |
| `GET /finance/receivables`                       | `fin.receivable.read`           | Cartera con filtros por cliente, estado, sede y fechas                    |
| `GET /finance/receivables/aging`                 | `fin.receivable.read`           | Totales por antigüedad y cliente                                          |
| `GET /finance/receivables/{id}`                  | `fin.receivable.read`           | Detalle de una obligación con asignaciones                                |
| `GET /finance/collections`                       | `fin.receivable.read`           | Recaudos por responsable, sede, estado y fecha                            |
| `GET /finance/collections/{id}`                  | `fin.receivable.read`           | Detalle con asignaciones                                                  |
| `POST /finance/collections`                      | `fin.receivable_payment.create` | Abono de cartera. Idempotente                                             |
| `GET /finance/payment-methods`                   | `fin.receivable_payment.create` | Medios de pago activos para abonos                                        |
| `GET /finance/receivables/customer/{customerId}` | `fin.receivable_payment.create` | Obligaciones abiertas del cliente para cobrar en caja, filtradas por sede |
| `GET /finance/reconciliations`                   | `fin.reconciliation.manage`     | Conciliaciones por sede/fecha                                             |
| `GET /finance/reconciliations/{id}`              | `fin.reconciliation.manage`     | Detalle con líneas y recaudos                                             |
| `POST /finance/reconciliations`                  | `fin.reconciliation.manage`     | Conciliar recaudos pendientes. Idempotente                                |
| `GET /finance/dashboard`                         | `fin.receivable.read`           | Resumen de cartera y recaudos para el Command Center                      |
| `GET /reports/cartera`                           | `rep.operational.read`          | Reporte de cartera                                                        |
| `GET /reports/cartera/export`                    | `rep.operational.read`          | CSV de cartera                                                            |
| `GET /reports/recaudos`                          | `rep.operational.read`          | Reporte de recaudos                                                       |
| `GET /reports/recaudos/export`                   | `rep.operational.read`          | CSV de recaudos                                                           |
| `GET /reports/caja`                              | `rep.operational.read`          | Cierres de caja del POS (lectura)                                         |
| `GET /reports/caja/export`                       | `rep.operational.read`          | CSV de caja                                                               |
| `GET /accounting/economic-events`                | `cont.report.read`              | Hechos económicos (especificación complementaria)                         |

**Reglas transversales:**

- `Idempotency-Key` obligatoria en `POST /finance/collections` y `POST /finance/reconciliations`.
- Alcance: ADM/CONT todo; MGR su sede; DIST solo sus recaudos y las obligaciones de sus entregas; CAJ solo obligaciones de su sede. Un CAJ no puede asignar un abono a una obligación de otra sede. Fuera de alcance → `404`.
- Montos y saldos se recalculan en el servidor; nunca se confía en totales del cliente.
- Los abonos y conciliaciones bloquean las filas afectadas (`FOR UPDATE`) y revalidan saldos/estados.
- Un recaudo conciliado no se vuelve a conciliar (`COLLECTION_NOT_PENDING`).
- Las diferencias de conciliación no generan asientos ni obligaciones (P-08).

**Abono — `POST /finance/collections`:**

```json
{
  "customerId": "uuid",
  "siteId": "uuid",
  "paymentMethodId": "uuid",
  "amount": "500000.00",
  "allocations": [{ "receivableId": "uuid", "amount": "200000.00" }],
  "note": "Abono recibido en oficina"
}
```

- Cliente con al menos una obligación abierta.
- Sin `allocations`: se aplica FIFO por `due_on`, `created_at`.
- Con `allocations`: cada obligación pertenece al cliente, tiene saldo suficiente y la suma coincide con el monto (`ALLOCATION_SUM_MISMATCH`).
- Si el monto supera el saldo total → `409 ABONO_EXCEEDS_BALANCE` (D2).
- Crea el recaudo `RC-…` con `kind='payment'`, asignaciones, actualiza saldos/estados, auditoría y evento `PaymentReceived`.
- Respuesta con número, cliente, monto, asignaciones y comprobante interno.

**Conciliación — `POST /finance/reconciliations`:**

```json
{
  "siteId": "uuid",
  "collectorType": "driver",
  "collectorUserId": "uuid",
  "collectionIds": ["uuid"],
  "counts": [
    { "paymentMethodId": "uuid-efectivo", "receivedAmount": "640000.00" },
    { "paymentMethodId": "uuid-transferencia", "receivedAmount": "0.00" }
  ],
  "note": "Faltante de $10.000 en efectivo"
}
```

- Recaudos `registered`, de la misma sede, tipo y usuario; no puede haber mezcla (`RECONCILIATION_MIXED_COLLECTORS`).
- Esperado por método = suma de los recaudos seleccionados.
- Se exige conteo de cada método con esperado > 0; el resto puede omitirse y se asume 0.
- Diferencia = recibido − esperado; el estado de los recaudos pasa a `reconciled` o `reconciled_with_variance`.
- La conciliación queda registrada con número `CONC-…`, líneas y responsable; no se bloquea por diferencia.
- Evento `CollectionReconciled`.

**Errores propios:**

| Código                            | HTTP | Cuándo                                                 |
| --------------------------------- | ---- | ------------------------------------------------------ |
| `ABONO_EXCEEDS_BALANCE`           | 409  | El abono supera el saldo abierto del cliente           |
| `ALLOCATION_EXCEEDS_BALANCE`      | 422  | Asignación mayor al saldo de una obligación            |
| `ALLOCATION_SUM_MISMATCH`         | 422  | La suma de asignaciones no coincide con el abono       |
| `CUSTOMER_NO_OPEN_RECEIVABLES`    | 409  | Cliente sin obligaciones abiertas                      |
| `PAYMENT_METHOD_INVALID`          | 422  | Medio inactivo o inexistente                           |
| `COLLECTION_NOT_PENDING`          | 409  | Recaudo ya conciliado o no seleccionable               |
| `RECONCILIATION_MIXED_COLLECTORS` | 422  | Recaudos de responsables distintos en una conciliación |
| `RECONCILIATION_EMPTY`            | 422  | Sin recaudos seleccionados                             |
| `RECONCILIATION_METHOD_MISMATCH`  | 422  | Conteo de un método sin recaudos esperados             |
| `SITE_NOT_ALLOWED`                | 404  | Sede fuera del alcance                                 |

## 5. Pantallas

- **Cartera y recaudos (`/erp/cartera`, módulo `Cartera y recaudos`):** pestañas Cartera, Recaudos y Conciliación.
  - **Cartera:** tarjetas de total abierto, vencido y por vencer; tabla de antigüedad por cliente; filtros por cliente, estado y sede; detalle de obligaciones; enlace a exportación CSV.
  - **Abono:** formulario con cliente, monto, método y modo de aplicación (automática/manual). En manual se listan las obligaciones con su saldo y se validan las asignaciones. Al confirmar, comprobante interno `RC-…` con cliente, monto, método y obligaciones aplicadas.
  - **Recaudos:** lista por responsable (distribuidor/oficina), sede, fecha y estado; totales; detalle con asignaciones; enlace a la caja del POS para los turnos.
  - **Conciliación:** recaudos pendientes agrupados por responsable; selección; esperado por método; campos de recibido; diferencia calculada; nota; confirmación. Lista de conciliaciones con `CONC-…`, esperado, recibido y diferencia.
- **Canales de registro:** ADM/MGR/CONT operan desde `/erp/cartera`; el **CAJ** registra el abono desde una acción «Cobrar cartera» del POS (consulta las obligaciones de su sede con `GET /finance/receivables/customer/{id}` y usa el mismo endpoint de abono, sin duplicar la venta); el **DIST** registra el abono de una entrega a crédito en el portal Ruta (RF-184) y no ve la cartera global.
- **Command Center:** reemplaza el placeholder «Crédito y cartera» por cartera abierta, vencida y recaudos pendientes, con enlace a `/erp/cartera`. La tarjeta «Caja POS» sigue consumiendo los turnos del POS; no se duplica en finanzas.
- **Hechos económicos:** pantalla separada `Hechos económicos` (`/erp/contabilidad/hechos`, `cont.report.read`), solo lectura, con filtros por tipo, estado y fecha. La contabilidad formal sigue bloqueada.
- **Estados:** carga, vacío, error, sin permiso, sin obligaciones, sin recaudos pendientes y conciliación ya cerrada.
- **Accesibilidad:** tokens y componentes de `components/ui`; tablas con `caption`; formularios con etiquetas; botones ≥ 44/52 px; foco visible; sin scroll horizontal; axe en los tres tamaños. Se agregan las pantallas a `apps/web/e2e/accesibilidad.spec.ts` (o a un `finanzas.spec.ts` con la misma auditoría).

## 6. Auditoría y eventos

- Auditoría: `fin.collection.create`, `fin.reconciliation.create`.
- Eventos: `ReceivableCreated` (al crear la obligación), `PaymentReceived` (al registrar abono/recaudo) y `CollectionReconciled` (al conciliar). Se insertan en la misma transacción; ver `cont/hechos-economicos.md`.
- No se contabiliza ni se generan asientos (P-01..P-04).
- Los recaudos de caja del POS conservan su auditoría y eventos de la entrega 6; no se recrean en finanzas.

## 7. Criterios de aceptación

```gherkin
Escenario: cartera por antigüedad
  Dado un cliente con obligaciones que vencen hoy, hace 10, 45 y 100 días
  Cuando consulta la cartera
  Entonces el total abierto se reparte en por vencer, 1–30, 31–60 y más de 90
  Y el detalle muestra cada obligación con su saldo y vencimiento

Escenario: abono automático a la más antigua
  Dado un cliente con dos obligaciones abiertas de $300.000 y $200.000
  Cuando registra un abono de $400.000 sin asignaciones
  Entonces se aplican $300.000 a la más antigua y $100.000 a la siguiente
  Y los saldos quedan en $0 y $100.000

Escenario: abono manual
  Dado un cliente con dos obligaciones
  Cuando registra un abono indicando la obligación y el monto
  Entonces se aplica exactamente a esa obligación
  Y la suma de asignaciones coincide con el abono

Escenario: abono mayor al saldo
  Dado un cliente con $200.000 de saldo total
  Cuando intenta abonar $250.000
  Entonces responde 409 ABONO_EXCEEDS_BALANCE
  Y no se modifica ningún saldo

Escenario: abono duplicado
  Cuando repite un abono con la misma Idempotency-Key
  Entonces devuelve el mismo comprobante
  Y no duplica asignaciones ni saldos

Escenario: conciliación sin diferencia
  Dado un distribuidor con recaudos pendientes por $650.000
  Cuando el supervisor concilia y recibe exactamente $650.000
  Entonces los recaudos quedan reconciled
  Y la diferencia es $0

Escenario: conciliación con diferencia
  Dado un distribuidor con recaudos por $650.000
  Cuando recibe $640.000 y registra la nota
  Entonces la conciliación queda con diferencia de −$10.000
  Y los recaudos quedan reconciled_with_variance
  Y no se crea una obligación al distribuidor (P-08)

Escenario: recaudo ya conciliado
  Dado un recaudo ya conciliado
  Cuando intenta incluirlo en otra conciliación
  Entonces responde 409 COLLECTION_NOT_PENDING

Escenario: sede ajena
  Dado un manager de una sede
  Cuando consulta obligaciones de otra sede
  Entonces responde 404
  Y no ve el saldo ajeno

Escenario: permisos
  Dado un cajero
  Cuando intenta conciliar recaudos
  Entonces responde 403
  Y solo puede registrar abonos de su sede

Escenario: exportación
  Cuando solicita la exportación de cartera
  Entonces recibe un CSV UTF-8 con BOM y separador ;
  Y las columnas incluyen cliente, obligación, saldo, vencimiento y antigüedad
```

## 8. Pruebas

- **Unitarias:** rangos de antigüedad; FIFO; asignación manual; suma de asignaciones; saldo y estado de obligación; diferencia de conciliación; formato CSV.
- **Integración (PostgreSQL real):** cartera con cuatro rangos; abono FIFO; abono manual; abono en exceso; asignación en exceso; suma inconsistente; idempotencia; concurrencia de dos abonos sobre la misma obligación; recaudos por sede/responsable; conciliación sin/con diferencia; recaudo ya conciliado; mezcla de responsables; permisos y alcance; exportación.
- **E2E:** manager/admin consulta cartera, registra un abono y concilia un recaudo; axe en escritorio, tableta y móvil para cartera, recaudos, conciliación y hechos. Se reutiliza la sesión del administrador después del alta de MFA en `acceso.spec` o se configura TOTP para el usuario de finanzas; no se inventa un usuario sin MFA.
- **Eventos:** se verifica el alta de `ReceivableCreated`, `PaymentReceived` y `CollectionReconciled` en la misma transacción y sin duplicados.

## 9. Datos de demostración

- Cliente **Restaurante La Brasa** con cuatro obligaciones demo: vence en 5 días, venció hace 10, hace 45 y hace 100 días (montos ficticios).
- Cliente **Tienda Doña Rosa** con una obligación vencida hace 20 días y un recaudo de distribuidor pendiente.
- Dos recaudos `registered`: uno de distribuidor y uno de oficina, con métodos efectivo/transferencia.
- Una conciliación `CONC-0001` con diferencia de $10.000, para ver el estado `reconciled_with_variance`.
- Los hechos económicos de las obligaciones y recaudos sembrados, con estado `pending`.
- La semilla es idempotente por `source_type/source_id` y no duplica obligaciones, recaudos ni conciliaciones.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:**

- Especificación aprobada, incluidas D1..D9.
- Registrar las decisiones en `decision-register.md` y actualizar la matriz de trazabilidad.
- Confirmar el alcance de reportes (cartera/recaudos/caja) y de eventos (especificación complementaria).
- Aprobar los rangos de antigüedad y el rechazo de abonos en exceso.

**Terminado cuando:**

- Migración con `payment_allocations`, `reconciliations`, `reconciliation_lines`, `collections.kind/reconciliation_id`, `receivables.site_id`, FKs, índices y grants.
- Casos de uso con transacciones, bloqueos, idempotencia, auditoría y eventos.
- Endpoints y permisos con alcance ADM/MGR/CONT/DIST/CAJ.
- Pantalla de cartera/recaudos/conciliación, tablero en el Command Center y pantalla de hechos.
- Exportaciones CSV y semilla demo.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E con axe en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.
- Nada de P-01..P-04, P-08, P-09 ni P-02 se simula o se contabiliza.
