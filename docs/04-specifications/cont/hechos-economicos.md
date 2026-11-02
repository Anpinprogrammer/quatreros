# Especificación — Entrega 7: hechos económicos (RF-303)

> Estado: **APROBADA** · 2026-11-02 (E1..E7 aprobadas por el responsable; implementación en curso)
> Cubre RF-303 (registro de hechos económicos) como capa de eventos. **No** cubre RF-304 (contabilización) ni RF-305 (reportes contables), bloqueados por P-01..P-04.
> Complementa `docs/04-specifications/fin/cartera-recaudos.md`.

## 0. Decisiones que necesitan aprobación

| #   | Decisión                                                                                                                                                                                                                                                                                                                         | Recomendación                                                                           | Si no se aprueba                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| E1  | **Alcance de emisión:** se emiten eventos desde todos los casos de uso económicos ya construidos: recepción de compra, cierre de producción, venta POS, cierre de turno, obligación, recaudo/abono y conciliación. Ajustes de inventario y devoluciones quedan fuera hasta que exista su caso de uso económico (P-05/P-08/P-09). | Aprobar este alcance; cubre compras, producción, ventas y recaudos del RF-303.          | Habría que ampliar el alcance a inventario y devoluciones antes de cerrar. |
| E2  | **Solo eventos, sin contabilización:** el estado inicial es `pending`; no se crean asientos, cuentas ni períodos. La capa (b) de contabilidad sigue bloqueada (P-01..P-04).                                                                                                                                                      | Aprobar. Es la capa (a) de DEC-081.                                                     | No se podría construir el registro sin el plan de cuentas y las reglas.    |
| E3  | **Monto nullable:** los eventos sin valor monetario (p. ej. cierre de producción con costo pendiente P-03) guardan `amount = null` y las cantidades en `payload`. Los eventos monetarios guardan el monto en COP como cadena decimal.                                                                                            | Aprobar; evita inventar costos.                                                         | Habría que esperar P-03 para emitir eventos de producción.                 |
| E4  | **Catálogo cerrado de tipos:** `PurchaseReceived`, `ProductionCompleted`, `SaleCompleted`, `ShiftClosed`, `ReceivableCreated`, `PaymentReceived`, `CollectionReconciled`. La aplicación rechaza tipos fuera del catálogo.                                                                                                        | Aprobar; el catálogo se amplía con una especificación cuando se agregue un caso de uso. | Tipos libres harían la bandeja y los reportes impredecibles.               |
| E5  | **Inmutabilidad:** los eventos son solo-inserción (`platform.forbid_mutation`); no hay endpoints de edición ni borrado. La corrección se hace con un evento de reversión en el módulo de origen.                                                                                                                                 | Aprobar.                                                                                | Se podrían alterar hechos ya registrados, rompiendo la trazabilidad.       |
| E6  | **Bandeja de lectura:** `GET /accounting/economic-events` con `cont.report.read`, filtros por tipo, estado, origen y fechas. No se muestra el JSON crudo como interfaz principal: se muestran los campos clave y un detalle expandible.                                                                                          | Aprobar.                                                                                | La bandeja sería una tabla JSON difícil de usar.                           |
| E7  | **Semilla:** se siembran los eventos de las obligaciones, recaudos y conciliación demo, además de los de POS, compras y producción existentes.                                                                                                                                                                                   | Aprobar; permite demostrar la bandeja sin ejecutar toda la operación.                   | La bandeja empezaría vacía y la demo dependería de operar todo antes.      |

## 1. Objetivo y alcance

Que cada operación con efecto económico deje un **hecho persistido, inmutable y consultable** en la misma transacción del caso de uso, con su origen, monto (si aplica), cantidades y referencias. El contador puede ver la bandeja de pendientes; no se contabiliza nada todavía.

**Incluye:**

- Esquema `accounting` con `economic_events`.
- Servicio público `recordEvent(tx, input)` idempotente y transaccional.
- Emisión desde compras, producción, POS, cartera y recaudos.
- Bandeja de lectura con filtros y detalle.
- Semilla de eventos demo.

**No incluye:**

| Tema                                                     | Motivo                                                   |
| -------------------------------------------------------- | -------------------------------------------------------- |
| Asientos, cuentas, períodos y partida doble              | RF-304/RF-305 y P-01..P-04.                              |
| Contabilización automática y reglas de negocio contables | P-01..P-04.                                              |
| Costo oficial del lote y valoración                      | P-03; los eventos de producción no inventan costo.       |
| Ajustes de inventario y devoluciones económicas          | P-05/P-08/P-09; se agregan cuando exista el caso de uso. |
| Impuestos y documento fiscal                             | P-02.                                                    |
| Edición o borrado de hechos                              | E5; son inmutables.                                      |
| Reportes contables formales                              | RF-305; bloqueados.                                      |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                                     |
| ------- | --------------------------------------------------------------------------------------------- |
| RF-303  | Registro de hechos económicos con estado `pending`                                            |
| BR-200  | Cada operación económica emite un hecho persistido con tipo, montos, cantidades y referencias |
| DEC-081 | Contabilidad en dos capas; esta entrega construye la capa de hechos (a)                       |
| DEC-P20 | Hechos económicos como registro previo a la contabilización                                   |
| RNF-090 | Trazabilidad e inmutabilidad                                                                  |

## 3. Modelo de datos

### 3.1 `accounting.economic_events`

| Columna       | Tipo / regla                                                     |
| ------------- | ---------------------------------------------------------------- |
| `id`          | `bigserial` PK                                                   |
| `type`        | texto; catálogo E4                                               |
| `source_type` | texto: módulo/documento de origen, p. ej. `pos.sale`             |
| `source_id`   | `uuid`; id del documento de origen                               |
| `site_id`     | `uuid` nullable; sede del hecho, para el alcance de MGR          |
| `occurred_at` | `timestamptz`; momento del hecho                                 |
| `amount`      | `NUMERIC(14,2)` nullable; COP como cadena decimal                |
| `payload`     | `jsonb` no nulo, default `{}`; líneas, pagos, cantidades, moneda |
| `status`      | `pending`, `posted`, `void`; default `pending`                   |
| `created_at`  | `timestamptz`                                                    |

- `unique (type, source_type, source_id)` para idempotencia.
- Índice `(status, occurred_at desc)`, `(source_type, source_id)` y `(site_id, occurred_at desc)`.
- Trigger `platform.forbid_mutation` (solo inserción).
- `amount` no se usa para costos no aprobados (P-03); en esos casos va `null` y las cantidades en `payload`.

### 3.2 Catálogo de eventos y puntos de emisión

| Tipo                   | Origen                        | Monto                  | Payload mínimo                                            |
| ---------------------- | ----------------------------- | ---------------------- | --------------------------------------------------------- |
| `PurchaseReceived`     | Recepción de compra           | Total de la compra     | compra, proveedor, líneas, cantidades                     |
| `ProductionCompleted`  | Cierre de orden de producción | `null` (P-03)          | orden, producto, lote, cantidad real, rendimiento         |
| `SaleCompleted`        | Venta POS                     | Total de la venta      | número, líneas, pagos, cambio, lote/consumo teórico       |
| `ShiftClosed`          | Cierre de turno POS           | Diferencia de efectivo | turno, esperado, contado, diferencia, ventas              |
| `ReceivableCreated`    | Obligación de cartera         | Monto de la obligación | cliente, origen, vencimiento                              |
| `PaymentReceived`      | Recaudo/abono                 | Monto del recaudo      | cliente, método, asignaciones, recaudo                    |
| `CollectionReconciled` | Conciliación de recaudos      | Monto recibido         | conciliación, esperado, recibido, diferencia, responsable |

- La emisión ocurre **dentro de la transacción** del caso de uso. Si la operación falla, no queda el evento.
- Si el evento ya existe (misma `type/source`), `recordEvent` no duplica.
- `PurchaseReceived` y `ProductionCompleted` se agregan en sus módulos; `SaleCompleted`/`ShiftClosed` en POS; los de cartera/recaudos en finanzas.
- Los eventos de ajustes de inventario y devoluciones quedan para cuando exista su caso de uso económico (E1).

### 3.3 API interna

```ts
recordEvent(tx, {
  type: EconomicEventType;
  sourceType: string;
  sourceId: string;
  siteId?: string;
  occurredAt?: Date;
  amount?: string | null;
  payload: Record<string, unknown>;
}): Promise<void>;
```

- Exportado desde `accounting/application/public.ts`.
- No requiere permiso de usuario: lo llama el caso de uso que ya autorizó la operación.
- La inmutabilidad y el estado `pending` se garantizan en la BD.

## 4. Contrato de API

| Método y ruta                          | Permiso            | Descripción                                |
| -------------------------------------- | ------------------ | ------------------------------------------ |
| `GET /accounting/economic-events`      | `cont.report.read` | Bandeja de hechos con filtros y paginación |
| `GET /accounting/economic-events/{id}` | `cont.report.read` | Detalle de un hecho con payload            |

**Filtros:** `type`, `status`, `sourceType`, `from`, `to`, `limit`, `cursor`.

**Reglas:**

- Solo lectura; no hay POST/PATCH/DELETE.
- ADM/CONT ven todo; MGR su sede si el payload/origen la incluye; el rol CONT es el principal consumidor. La bandeja no revela datos de otras sedes a MGR.
- El detalle muestra tipo, origen, fecha, monto, estado y payload estructurado; no se presenta como asiento.
- `status` se muestra como «Pendiente de contabilizar»; `posted`/`void` quedan reservados para una entrega posterior.

**Contrato de lectura:**

```json
{
  "id": 123,
  "type": "SaleCompleted",
  "sourceType": "pos.sale",
  "sourceId": "uuid",
  "occurredAt": "2026-11-02T18:00:00.000Z",
  "amount": "47600.00",
  "status": "pending",
  "payload": { "number": "V-0002", "payments": [] }
}
```

## 5. Pantalla

- **Hechos económicos (`/erp/contabilidad/hechos`)** para ADM/CONT con `cont.report.read`:
  - Filtros por tipo, estado y rango de fechas; búsqueda por documento de origen.
  - Tabla con fecha, tipo, origen, monto, estado y enlace al documento de origen cuando exista.
  - Detalle expandible con el payload clave; sin acciones de edición.
  - Estados: carga, vacío («No hay hechos registrados»), error y sin permiso.
  - Aviso visible: «Pendiente de contabilizar; la contabilidad formal está bloqueada (P-01..P-04)».
- **Command Center:** tarjeta «Hechos pendientes» con conteo y enlace, solo para roles con `cont.report.read`.
- **Accesibilidad:** tabla con `caption`, filtros etiquetados, foco visible, sin scroll horizontal; axe en escritorio, tableta y móvil.

## 6. Auditoría y eventos

- El hecho económico es el registro; la operación de origen conserva su auditoría (`pos.sale.create`, `fin.collection.create`, etc.).
- No se genera auditoría adicional por leer la bandeja.
- No se contabiliza ni se crean asientos.

## 7. Criterios de aceptación

```gherkin
Escenario: venta POS deja hecho económico
  Dado un turno abierto
  Cuando se confirma una venta
  Entonces existe un evento SaleCompleted con el total y las líneas
  Y su estado es pending
  Y la venta y el evento se confirman en la misma transacción

Escenario: operación fallida no deja hecho
  Dado un intento de venta sin existencia
  Cuando la venta falla
  Entonces no existe un evento SaleCompleted para ese intento

Escenario: compra recibida
  Cuando se recibe una compra
  Entonces existe un evento PurchaseReceived con el total y las líneas
  Y el evento queda pending

Escenario: producción cerrada
  Cuando se cierra una orden de producción
  Entonces existe un evento ProductionCompleted con cantidad y rendimiento
  Y el monto es null porque el costo está pendiente (P-03)

Escenario: obligación y recaudo
  Cuando se crea una obligación y se registra un abono
  Entonces existen ReceivableCreated y PaymentReceived
  Y el abono tiene sus asignaciones en el payload

Escenario: conciliación
  Cuando se concilia un recaudo con diferencia
  Entonces existe CollectionReconciled con esperado, recibido y diferencia

Escenario: sin duplicados
  Cuando se repite la misma operación con la misma Idempotency-Key
  Entonces el evento no se duplica
  Y la bandeja muestra un solo hecho por origen

Escenario: solo lectura
  Cuando el contador abre la bandeja
  Entonces puede consultar y filtrar
  Y no hay acciones para editar, borrar ni contabilizar

Escenario: permiso denegado
  Dado un usuario sin cont.report.read
  Cuando consulta los hechos económicos
  Entonces responde 403
```

## 8. Pruebas

- **Unitarias:** catálogo de tipos; validación de payload/monto; idempotencia por origen; estado inicial.
- **Integración (PostgreSQL real):** eventos de compra, producción, venta POS, cierre de turno, obligación, recaudo y conciliación; rollback de la operación no deja evento; duplicado no inserta; lectura con `cont.report.read`; permiso denegado; inmutabilidad (UPDATE/DELETE rechazados); filtros y paginación.
- **E2E:** el administrador/contador abre la bandeja después de una venta y una conciliación demo; ve los eventos y no encuentra acciones de edición; axe en tres tamaños.

## 9. Datos de demostración

- Eventos de las obligaciones, recaudos y conciliación de la semilla de cartera.
- Eventos de la venta y cierre de turno del POS demo.
- Eventos de la compra y orden de producción demo.
- Todos en estado `pending` y con `sourceType/sourceId` únicos.
- La semilla es idempotente y no duplica eventos.

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:**

- Aprobar E1..E7.
- Confirmar el alcance de emisión (compras, producción, POS, cartera/recaudos).
- Registrar las decisiones en `decision-register.md` y actualizar la matriz.

**Terminado cuando:**

- Esquema `accounting` y migración con `economic_events`, trigger append-only, índices y grants.
- `recordEvent` público, idempotente y transaccional.
- Emisión desde los módulos aprobados en E1.
- Endpoint de lectura con permisos y filtros.
- Pantalla de hechos y tarjeta del Command Center.
- Semilla demo idempotente.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E con axe en verde.
- Nada de contabilización, asientos, impuestos ni costos se simula; RF-304/305 siguen bloqueados.
