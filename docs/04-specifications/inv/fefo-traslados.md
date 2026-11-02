# Especificación — Entrega 2c: FEFO, traslados y alertas

> Estado: **BORRADOR para revisión del responsable** · 2026-11-02
> Cubre RF-112 y RF-114. RF-113 queda condicionado al motor de aprobaciones (RF-007), que no está construido.
> Reglas `PROVISIONAL` (DEC-083): Q-B-07 (en tránsito) y Q-B-08 (sin negativos).
> La implementación no empieza hasta que esta especificación esté aprobada.

## 1. Objetivo y alcance

Que el inventario se mueva solo: toda salida asignada por **FEFO**, los traslados con su mercancía **en tránsito** hasta que el destino confirma, y las alertas de vencimiento visibles en el Command Center.

**Incluye:**

- Asignación FEFO por vencimiento más próximo, repartiendo entre lotes cuando hace falta.
- Traslado bodega → punto de venta: envío, salida de origen, entrada a la ubicación "en tránsito", recepción en destino y novedad si llega menos.
- Consulta de traslados y su detalle.
- Tarjeta "Alertas FEFO" del Command Center con datos reales.
- Alcance por sede en las consultas de inventario: un usuario con alcance `SITE` solo ve sus sedes.
- Auditoría de envío y recepción.

**No incluye:**

| Tema                                          | Motivo                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| RF-113 excepción FEFO (usar un lote distinto) | Depende del motor de aprobaciones RF-007, que no existe. Se hará cuando esté. |
| RF-117 bloqueo de lotes                       | PROPOSED y depende de P-05; no implementar                                    |
| Resolución de novedades con ajuste/descarte   | Requiere ajustes (Q-INV-04/P-05); en 2c la novedad queda pendiente            |
| Traslados a cocina y consumo por receta       | Entrega 6 / Q-POS-01                                                          |
| Recepción en Caja desde el shell POS          | Entrega 6; en 2c recibe MGR/ADM desde el ERP                                  |
| Reservas de pedidos                           | Entrega 5                                                                     |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                       |
| ------- | ------------------------------------------------------------------------------- |
| RF-112  | Asignación FEFO automática con reparto entre lotes y error si falta             |
| RF-114  | Traslado con salida, tránsito, recepción y novedad                              |
| BR-083  | FEFO por vencimiento más próximo                                                |
| BR-088  | Salida en origen y entrada en destino del mismo lote; en tránsito hasta recibir |
| BR-089  | Diferencia entre enviado y recibido queda como novedad pendiente (PROVISIONAL)  |
| BR-086  | Lotes vencidos no se asignan                                                    |
| BR-081  | Ninguna salida deja saldo negativo (Q-B-08)                                     |
| DEC-014 | FEFO con excepción autorizada (la excepción se difiere con RF-113)              |
| DEC-016 | Inventario por ubicación y traslados                                            |
| DEC-041 | Filtro por sede en el servidor                                                  |
| DEC-044 | Auditoría de envío y recepción                                                  |

## 3. Modelo de datos

Se crean las tablas del diseño preliminar, con un ajuste justificado:

### 3.1 `inventory.transfers`

| Columna               | Tipo / regla                                                      |
| --------------------- | ----------------------------------------------------------------- |
| `id`                  | `uuid` PK                                                         |
| `number`              | texto único; consecutivo `T-0001` (DR-005)                        |
| `from_location_id`    | FK a `admin.locations`                                            |
| `to_location_id`      | FK a `admin.locations`                                            |
| `transit_location_id` | FK a `admin.locations`; ubicación "en tránsito" de la sede origen |
| `status`              | `in_transit`, `received`, `received_with_variance`                |
| `sent_by`             | FK a `admin.users`                                                |
| `sent_at`             | `timestamptz`                                                     |
| `received_by`         | FK a `admin.users`, nullable                                      |
| `received_at`         | `timestamptz`, nullable                                           |

- `from_location_id <> to_location_id`.
- `transit_location_id` se guarda para que la recepción no dependa de buscar la sede de origen.
- El consecutivo usa `platform.document_sequences` con clave `transfer`.

### 3.2 `inventory.transfer_lines`

| Columna           | Tipo / regla                      |
| ----------------- | --------------------------------- |
| `id`              | `uuid` PK                         |
| `transfer_id`     | FK a `inventory.transfers`        |
| `lot_id`          | FK a `inventory.lots`             |
| `presentation_id` | FK a `catalog.presentations`      |
| `sent_qty`        | `NUMERIC(14,3)`, `> 0`            |
| `received_qty`    | `NUMERIC(14,3)`, nullable, `>= 0` |

- Cada línea es una asignación FEFO concreta: si una solicitud se reparte entre dos lotes, se crean dos líneas.
- `received_qty <= sent_qty` (validado en aplicación y en la recepción).
- Índice `(transfer_id)`.

### 3.3 Movimientos

- **Enviar:** por cada línea, `transfer_out` negativo en `from_location_id` y `transfer_in` positivo en `transit_location_id`, mismo lote/presentación y `source_type = 'inventory.transfer'`, `source_id = transfer.id`.
- **Recibir:** por cada línea recibida, `transfer_out` negativo en `transit_location_id` y `transfer_in` positivo en `to_location_id`.
- Todo pasa por `recordMovement`; no se toca `stock_balances` a mano.

### 3.4 Consecutivo

`platform.document_sequences` ya existe. Si la clave `transfer` no existe, se crea en la migración custom con valor 0. El consecutivo se incrementa con `UPDATE ... RETURNING` dentro de la transacción.

## 4. Contrato de API

| Método y ruta                            | Permiso                | Descripción                                                              |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `POST /inventory/fefo-allocations`       | `inv.stock.read`       | Simula la asignación FEFO para presentación, ubicación y cantidad        |
| `POST /inventory/transfers`              | `inv.transfer.create`  | Crea y envía un traslado; el servidor asigna lotes por FEFO. Idempotente |
| `GET /inventory/transfers`               | `inv.stock.read`       | Lista traslados con filtros por estado, sede y fechas                    |
| `GET /inventory/transfers/{id}`          | `inv.stock.read`       | Detalle con líneas, lotes y estado                                       |
| `POST /inventory/transfers/{id}/receive` | `inv.transfer.receive` | Confirma cantidades recibidas; mueve de tránsito a destino. Idempotente  |

**Reglas:**

- `POST /fefo-allocations` recibe `{ presentationId, locationId, quantity }` y devuelve `{ allocations: [{ lotId, code, expiresOn, quantity }], baseQuantity, baseUnit }`; si no alcanza, `409 INSUFFICIENT_STOCK` con `missing`.
- `POST /transfers` recibe `{ fromLocationId, toLocationId, lines: [{ presentationId, quantity }] }`. Solo producto terminado con presentación (MP se traslada en una entrega posterior si aplica).
- La ubicación de origen debe ser de la sede del actor (o ALL); la de destino también debe estar permitida.
- La ubicación "en tránsito" se resuelve por la sede de origen; si no existe, `409 NO_TRANSIT_LOCATION`.
- `POST /receive` recibe `{ lines: [{ lineId, receivedQuantity }] }`; `receivedQuantity <= sent_qty`; las líneas omitidas se consideran no recibidas.
- Si todas las líneas se reciben completas → `received`; si alguna queda incompleta → `received_with_variance` y la diferencia permanece en tránsito.
- Un traslado ya recibido no se vuelve a recibir (`409 TRANSFER_ALREADY_RECEIVED`).
- `Idempotency-Key` obligatoria en `POST /transfers` y `POST /receive`.
- **Alcance por sede:** los listados de existencias, lotes, kardex, disponibilidad, resumen y traslados filtran por las sedes del actor cuando su alcance no es `ALL`. La ficha de un lote fuera de sus sedes responde `404`.

## 5. Pantallas

- **Existencias y traslados** gana la pestaña **Traslados**:
  - Lista con número, origen → destino, estado, fecha, líneas y receptor.
  - Botón **Nuevo traslado** si `inv.transfer.create`; formulario con origen (ubicación de su sede), destino y líneas (producto/presentación/cantidad). Al enviar, muestra la asignación FEFO por lote.
  - Detalle con líneas, lotes asignados y formulario **Recibir** si `inv.transfer.receive` y el traslado está en tránsito.
  - Estados vacío/carga/error/sin permiso.
- **Command Center:** la tarjeta "Alertas FEFO" muestra hasta 3 lotes vendibles que vencen en 7 días, con código, producto, días restantes y cantidad; enlace a Existencias. Si no hay datos, estado vacío honesto.
- **Caja:** en 2c no se agrega pantalla POS; la recepción se hace desde el ERP por MGR/ADM. La entrega 6 agregará la vista de Caja.
- **Accesibilidad:** cada pantalla nueva en `accesibilidad.spec.ts` en escritorio, tableta y móvil.

## 6. Auditoría

- `inv.transfer.create` (número, origen, destino, líneas y lotes asignados).
- `inv.transfer.receive` (líneas recibidas, diferencias y estado resultante).
- El kardex guarda `source_type='inventory.transfer'` y `source_id`; la trazabilidad enlaza el traslado.

## 7. Criterios de aceptación

```gherkin
Escenario: FEFO reparte entre lotes
  Dados dos lotes vendibles del mismo producto con vencimientos 10/11 y 15/11
  Cuando se solicitan 30 unidades y el primero tiene 20
  Entonces la asignación usa 20 del primero y 10 del segundo
  Y el segundo lote aparece después en el orden

Escenario: FEFO no usa lotes vencidos ni bloqueados
  Dado un lote vencido con existencia
  Cuando se asigna FEFO
  Entonces ese lote no se incluye

Escenario: FEFO sin existencia suficiente
  Cuando se solicitan más unidades que el disponible vendible
  Entonces recibe 409 INSUFFICIENT_STOCK con la cantidad faltante

Escenario: enviar un traslado
  Dado un manager con permiso y stock en Bodega principal
  Cuando crea un traslado de 10 paquetes a Productos del punto
  Entonces el stock sale de Bodega y entra a la ubicación En tránsito
  Y el traslado queda in_transit

Escenario: recibir completo
  Dado un traslado en tránsito
  Cuando el destino confirma las cantidades enviadas
  Entonces el stock sale de En tránsito y entra a Productos del punto
  Y el traslado queda received

Escenario: recibir con novedad
  Cuando el destino confirma menos de lo enviado
  Entonces la diferencia permanece en En tránsito
  Y el traslado queda received_with_variance

Escenario: no se recibe dos veces
  Cuando se intenta recibir un traslado ya recibido
  Entonces recibe 409 TRANSFER_ALREADY_RECEIVED

Escenario: permisos y sede
  Dado un usuario de la sede Bodega principal
  Cuando consulta existencias
  Entonces no ve saldos de Punto de asados
  Y un usuario sin inv.transfer.create no puede enviar

Escenario: alertas FEFO
  Dados lotes que vencen en 7 días
  Cuando abre el Command Center
  Entonces ve hasta 3 lotes con días restantes y cantidad
```

## 8. Pruebas

- **Unitarias:** orden FEFO con reparto, exclusión de vencidos/bloqueados, cantidad faltante, transición `in_transit → received | received_with_variance`, validación de recepción.
- **Integración (PostgreSQL real):** asignación FEFO con dos lotes; traslado completo; novedad; no recibir dos veces; idempotencia; permisos; alcance por sede; kardex con `transfer_out`/`transfer_in`; saldo nunca negativo.
- **E2E:** manager crea un traslado y lo recibe; la tarjeta FEFO muestra datos; accesibilidad en tres tamaños.

## 9. Datos de demostración

No se siembran traslados: el manager los crea en la demo con los lotes existentes. Las alertas FEFO usan PT-2026-0004 (vence en 3 días) y MP-2026-0001 (vence en 4 días).

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:** esta especificación aprobada; confirmar el alcance de RF-113 (diferido) y la recepción solo desde ERP.

**Terminado cuando:**

- Tablas de traslados, consecutivo y movimientos FEFO/tránsito implementados.
- `allocateFefo`, `createTransfer`, `receiveTransfer` con transacciones, bloqueos, idempotencia y auditoría.
- API y pantallas de traslados; tarjeta FEFO del Command Center con datos reales.
- Alcance por sede en las consultas de inventario.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.

## 11. Decisión pendiente

**RF-113 (excepción FEFO).** No se implementa en 2c porque el motor de aprobaciones RF-007 no existe. Cuando se construya, la excepción AP-03 debe solicitar un lote distinto con motivo, aprobarlo un ADM/MGR y consumir la aprobación al ejecutar la salida. No se inventa un bypass ni un umbral.
