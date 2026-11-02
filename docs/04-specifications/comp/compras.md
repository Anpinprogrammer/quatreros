# Especificación — Entrega 3: proveedores, compras y recepción

> Estado: **APROBADA E IMPLEMENTADA** · 2026-11-02
> Cubre RF-050, RF-051 y RF-052. RF-053 (anulación) queda fuera por P-09.
> Reglas `PROVISIONAL` (DEC-083): recepción parcial y lote de materia prima por recepción, aprobadas en **DEC-094**.
> Impuestos y desglose fiscal siguen **BLOCKED** (BR-044, P-02): se registra el total pagado sin inventar reglas contables.

## 1. Objetivo y alcance

Que el comprador pueda registrar proveedores y compras, y que la mercancía **solo entre al inventario cuando se recibe**. Cada recepción, total o parcial, crea su lote de materia prima y su movimiento de entrada en la misma transacción; la compra queda pendiente o parcial hasta completar el saldo.

**Incluye:**

- Proveedores: crear, editar, inactivar y consultar (sin borrar).
- Compras con proveedor, sede, fecha, líneas de materia prima, cantidad, costo unitario y total.
- Recepción total o parcial desde el detalle de la compra, con ubicación y vencimiento cuando la materia prima lo controla.
- Creación del lote `MP-AAAA-####` y movimiento `receipt` por cada recepción.
- Estado de la compra: pendiente, parcialmente recibida o recibida.
- Alcance por sede y auditoría de compras y recepciones.
- Semilla demo con proveedores y una compra pendiente.

**No incluye:**

| Tema                                                         | Motivo                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| RF-053 anulación de compra o recepción                       | PROPOSED; depende de P-09 y del motor de aprobaciones (RF-007).                                               |
| Impuestos, IVA, retenciones y desglose fiscal                | BLOCKED por P-02 / BR-044. No se inventan tasas ni cuentas.                                                   |
| Recepción por encima de lo pendiente con motivo y aprobación | Requiere RF-007; en 3 se rechaza con `422 RECEIPT_EXCEEDS_PENDING`.                                           |
| Cerrar una compra con saldo pendiente                        | BR-043 lo menciona como cierre manual con motivo, pero no hay flujo de aprobación aprobado; no se implementa. |
| Adjuntar soporte de compra (archivo)                         | RF-051 lo marca opcional y no existe almacenamiento de archivos en el prototipo.                              |
| Costeo promedio, cuentas por pagar y hechos contables        | P-02, P-03 y P-04.                                                                                            |
| Sugerencias de compra por punto de reorden                   | Q-PRO-03.                                                                                                     |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| RF-050  | Proveedores con identificación, teléfono, estado y materias primas que suministra (relación informativa)              |
| RF-051  | Compra con proveedor, sede, fecha, líneas y total; queda pendiente de recepción                                       |
| RF-052  | Recepción total o parcial; cada recepción crea lote MP y entrada al inventario                                        |
| BR-040  | Toda compra tiene un proveedor registrado y activo                                                                    |
| BR-041  | La compra no altera existencias; solo la recepción lo hace                                                            |
| BR-042  | `PROVISIONAL` (DEC-094): cada recepción crea un lote MP con proveedor, fecha, cantidad, costo y vencimiento si aplica |
| BR-043  | `PROVISIONAL` (DEC-094): varias recepciones parciales; la compra sigue abierta mientras tenga saldo                   |
| BR-008  | Recepción y lote se crean en una sola transacción                                                                     |
| BR-044  | Impuestos bloqueados: se guarda el total pagado sin desglose fiscal                                                   |
| DEC-013 | Lote con origen de insumos y vencimiento                                                                              |
| DEC-041 | Filtro por sede en el servidor                                                                                        |
| DEC-044 | Auditoría de compra y recepción                                                                                       |
| DEC-080 | Compra y producción son procesos independientes enlazados por el lote                                                 |
| DEC-094 | Recepción parcial y lote MP aprobados como configuración provisional                                                  |

## 3. Modelo de datos (esquema `purchasing`)

Se implementa el diseño preliminar con una tabla adicional justificada.

### 3.1 `purchasing.suppliers`

| Columna        | Tipo / regla                                       |
| -------------- | -------------------------------------------------- |
| `id`           | `uuid` PK                                          |
| `name`         | texto, único                                       |
| `tax_id`       | texto, único, nullable (identificación tributaria) |
| `phone`        | texto, nullable                                    |
| `contact_name` | texto, nullable                                    |
| `is_active`    | booleano, por defecto `true`                       |
| `version`      | entero `> 0`, para edición con `If-Match`          |
| `created_at`   | `timestamptz`                                      |
| `updated_at`   | `timestamptz`                                      |

- No se elimina un proveedor: se inactiva.
- `tax_id` único cuando no es nulo; dos proveedores sin NIT pueden coexistir.

### 3.2 `purchasing.purchases`

| Columna          | Tipo / regla                                        |
| ---------------- | --------------------------------------------------- |
| `id`             | `uuid` PK                                           |
| `number`         | texto único; consecutivo `C-0001` (DR-005)          |
| `supplier_id`    | FK a `purchasing.suppliers`                         |
| `site_id`        | FK a `admin.sites`                                  |
| `purchased_on`   | fecha                                               |
| `total`          | `NUMERIC(14,2) >= 0`; suma de líneas, sin impuestos |
| `status`         | `pending_receipt`, `partially_received`, `received` |
| `attachment_key` | nullable; no se usa en esta entrega                 |
| `created_by`     | FK a `admin.users`                                  |
| `created_at`     | `timestamptz`                                       |

- El consecutivo usa `platform.document_sequences` con clave `C`.
- No se edita una compra después de creada en esta entrega; corregir requiere anulación (RF-053, fuera de alcance).
- `closed_with_balance` y `voided` existen en el diseño preliminar pero **no se usan** hasta que exista su flujo aprobado.

### 3.3 `purchasing.purchase_lines`

| Columna           | Tipo / regla                          |
| ----------------- | ------------------------------------- |
| `id`              | `uuid` PK                             |
| `purchase_id`     | FK a `purchasing.purchases`           |
| `raw_material_id` | FK a `catalog.raw_materials`          |
| `quantity`        | `NUMERIC(14,3) > 0`                   |
| `unit_cost`       | `NUMERIC(14,4) > 0`                   |
| `received_qty`    | `NUMERIC(14,3) >= 0`, por defecto `0` |

- `received_qty <= quantity` se valida en la recepción.
- Índice por `purchase_id` y por `raw_material_id`.

### 3.4 `purchasing.receipts`

| Columna       | Tipo / regla                               |
| ------------- | ------------------------------------------ |
| `id`          | `uuid` PK                                  |
| `number`      | texto único; consecutivo `R-0001` (DR-005) |
| `purchase_id` | FK a `purchasing.purchases`                |
| `location_id` | FK a `admin.locations`                     |
| `received_at` | `timestamptz`                              |
| `status`      | `posted` (la reversión queda para RF-053)  |
| `received_by` | FK a `admin.users`                         |

### 3.5 `purchasing.receipt_lines` (nueva, justificada)

El diseño preliminar no detalla cómo se guarda la cantidad recibida por línea ni el lote creado. Se agrega:

| Columna            | Tipo / regla                     |
| ------------------ | -------------------------------- |
| `id`               | `uuid` PK                        |
| `receipt_id`       | FK a `purchasing.receipts`       |
| `purchase_line_id` | FK a `purchasing.purchase_lines` |
| `quantity`         | `NUMERIC(14,3) > 0`              |
| `lot_id`           | FK a `inventory.lots`            |

- Único `(receipt_id, purchase_line_id)`.
- Cada línea de recepción produce un lote y un movimiento; no se agrupan lotes de recepciones distintas.

### 3.6 Enlace con inventario

- `inventory.lots.supplier_id` → `purchasing.suppliers` y `inventory.lots.receipt_id` → `purchasing.receipts` se declaran como FK en migración custom.
- El lote de recepción guarda `raw_material_id`, `supplier_id`, `receipt_id`, `unit_cost`, `expires_on` y `is_opening_balance = false`.
- Código de lote `MP-AAAA-####` con consecutivo `platform.document_sequences` clave `MP`; la primera recepción sincroniza el consecutivo con los lotes MP existentes para no chocar con la semilla.

### 3.7 Movimientos

- Por cada línea recibida: `recordMovement` con `movementType = 'receipt'`, cantidad positiva, `presentation_id = NULL` (la materia prima no usa presentaciones), ubicación de recepción, `source_type = 'purchasing.receipt'`, `source_id = receipt.id`.
- La cantidad base es igual a la cantidad recibida porque la unidad de la materia prima es su unidad base.
- No se toca `stock_balances` a mano.

## 4. Contrato de API

Prefijo `/api/v1`. Dinero y cantidades como cadenas decimales.

| Método y ruta                              | Permiso                | Descripción                                                |
| ------------------------------------------ | ---------------------- | ---------------------------------------------------------- |
| `GET /purchasing/suppliers`                | `comp.supplier.read`   | Lista proveedores con filtro `q` y estado                  |
| `POST /purchasing/suppliers`               | `comp.supplier.manage` | Crea proveedor. Idempotente                                |
| `PATCH /purchasing/suppliers/{id}`         | `comp.supplier.manage` | Edita o inactiva con `If-Match`                            |
| `GET /purchasing/purchases`                | `comp.purchase.read`   | Lista compras con filtros de estado, proveedor y fechas    |
| `POST /purchasing/purchases`               | `comp.purchase.create` | Crea la compra; el servidor calcula el total. Idempotente  |
| `GET /purchasing/purchases/{id}`           | `comp.purchase.read`   | Detalle con líneas, recepciones y ubicaciones de recepción |
| `POST /purchasing/purchases/{id}/receipts` | `comp.receipt.create`  | Registra una recepción total o parcial. Idempotente        |

**Reglas:**

- `POST /purchases` recibe `{ supplierId, siteId, purchasedOn?, lines: [{ rawMaterialId, quantity, unitCost }] }`; al menos una línea. `purchasedOn` por defecto es la fecha de negocio (America/Bogota).
- La sede debe estar dentro del alcance del actor (`authorize` con `siteId`).
- Proveedor y materias primas deben existir y estar activos (`409 SUPPLIER_INACTIVE`, `409 RAW_MATERIAL_INACTIVE`).
- `total = Σ(quantity × unitCost)` redondeado a 2 decimales; no incluye impuestos.
- `POST /purchases/{id}/receipts` recibe `{ locationId, lines: [{ purchaseLineId, quantity, expiresOn? }] }`. Las líneas omitidas quedan pendientes.
- La ubicación debe estar activa y pertenecer a la sede de la compra (`422 LOCATION_NOT_IN_PURCHASE_SITE`).
- `quantity > 0` y `quantity <= pendingQuantity`; si supera lo pendiente, `422 RECEIPT_EXCEEDS_PENDING` (no se implementa la confirmación con motivo hasta RF-007).
- Si `raw_materials.tracks_expiry = true`, `expiresOn` es obligatorio; si la fecha es anterior a hoy, `422 EXPIRY_IN_PAST`.
- Un traslado de estado ya recibido no admite otra recepción (`409 PURCHASE_ALREADY_RECEIVED`).
- La recepción bloquea la compra y sus líneas con `FOR UPDATE`, crea los lotes y movimientos, actualiza `received_qty`, recalcula el estado y audita, todo en una transacción.
- **Alcance por sede:** listado y detalle de compras filtran por las sedes del actor cuando su alcance no es `ALL`; una compra ajena responde `404`. Los proveedores son globales.
- `Idempotency-Key` obligatoria en `POST /suppliers`, `POST /purchases` y `POST /receipts`.

**Errores propios:**

| Código                          | HTTP | Cuándo                                         |
| ------------------------------- | ---- | ---------------------------------------------- |
| `TAX_ID_TAKEN`                  | 409  | Identificación de proveedor ya registrada      |
| `SUPPLIER_INACTIVE`             | 409  | Compra con proveedor inactivo                  |
| `RAW_MATERIAL_INACTIVE`         | 409  | Compra con materia prima inactiva              |
| `LOCATION_NOT_IN_PURCHASE_SITE` | 422  | Ubicación de recepción de otra sede            |
| `RECEIPT_EXCEEDS_PENDING`       | 422  | Cantidad recibida mayor que el saldo pendiente |
| `EXPIRY_IN_PAST`                | 422  | Vencimiento anterior a hoy                     |
| `PURCHASE_ALREADY_RECEIVED`     | 409  | Recepción sobre una compra ya completa         |

## 5. Pantallas

La sección **06. Compras** pasa a `available` y abre `/erp/compras`.

- **Pestaña Compras:**
  - Lista con número, proveedor, sede, fecha, total, estado y líneas.
  - Filtro por estado y búsqueda por número/proveedor.
  - Botón **Nueva compra** si `comp.purchase.create`.
  - Formulario: proveedor, sede (de `me.sites`), fecha y líneas dinámicas (materia prima, cantidad, costo unitario), con total calculado en vivo.
  - Estados vacío, carga, error y sin permiso.
- **Detalle de compra:**
  - Cabecera con número, proveedor, sede, fecha, estado y total.
  - Líneas con cantidad, recibido, pendiente y costo unitario.
  - Historial de recepciones con número, ubicación, receptor, líneas y lotes creados.
  - Formulario **Recibir** si `comp.receipt.create` y la compra no está completa: ubicación, cantidades por línea y vencimiento cuando aplique.
  - Aviso explícito de que el total no incluye impuestos (P-02).
- **Pestaña Proveedores:**
  - Lista con nombre, NIT, teléfono, contacto y estado.
  - Formulario de creación/edición si `comp.supplier.manage`.
- **Existencias:** el lote recibido aparece en lotes, kardex y trazabilidad con origen en la compra y el proveedor.
- **Command Center:** no se agrega tarjeta nueva; la compra se descubre desde la sección 06.

Cada pantalla nueva se agrega a `apps/web/e2e/accesibilidad.spec.ts` en escritorio, tableta y móvil.

## 6. Auditoría

- `comp.supplier.create` y `comp.supplier.update` con los cambios.
- `comp.purchase.create` con número, proveedor, sede, líneas y total.
- `comp.receipt.create` con número, compra, ubicación, líneas, lotes creados y estado resultante.
- El kardex conserva `source_type = 'purchasing.receipt'` y `source_id = receipt.id`; el lote enlaza proveedor y recepción para la trazabilidad hacia atrás.

## 7. Criterios de aceptación

```gherkin
Escenario: registrar un proveedor
  Cuando el comprador crea un proveedor con nombre e identificación
  Entonces queda activo y disponible para compras
  Y una identificación repetida responde 409 TAX_ID_TAKEN

Escenario: una compra no mueve existencias
  Dado un proveedor activo y una materia prima activa
  Cuando se registra una compra de 40 kg a $18.000/kg
  Entonces la compra queda pending_receipt
  Y el total es $720.000,00
  Y el saldo del inventario no cambia

Escenario: recepción parcial crea lote y deja saldo
  Dada una compra pendiente de 40 kg
  Cuando se reciben 25 kg en la ubicación Principal con vencimiento
  Entonces se crea un lote MP-AAAA-#### con proveedor, costo y vencimiento
  Y entra 25 kg al inventario con movimiento receipt
  Y la compra queda partially_received con 15 kg pendientes

Escenario: completar la recepción
  Dada una compra parcialmente recibida
  Cuando se recibe el saldo pendiente
  Entonces la compra queda received
  Y el kardex muestra las dos entradas con sus lotes

Escenario: no recibir más de lo pendiente
  Cuando se intenta recibir más cantidad que el saldo pendiente
  Entonces responde 422 RECEIPT_EXCEEDS_PENDING

Escenario: ubicación de otra sede
  Dada una compra de la sede Bodega principal
  Cuando se intenta recibir en una ubicación de Punto de asados
  Entonces responde 422 LOCATION_NOT_IN_PURCHASE_SITE

Escenario: vencimiento obligatorio y no pasado
  Dada una materia prima que controla vencimiento
  Cuando se recibe sin vencimiento o con fecha pasada
  Entonces responde 422 y no crea lote ni movimiento

Escenario: compra ya recibida
  Cuando se intenta recibir una compra completa
  Entonces responde 409 PURCHASE_ALREADY_RECEIVED

Escenario: permisos y sede
  Dado un usuario con alcance SITE en Bodega principal
  Cuando consulta compras
  Entonces no ve compras de Punto de asados
  Y un usuario sin comp.receipt.create no puede recibir

Escenario: duplicado idempotente
  Cuando se repite la misma recepción con la misma Idempotency-Key
  Entonces devuelve el mismo resultado y no duplica lote ni movimiento
```

## 8. Pruebas

- **Unitarias:** total de compra, estado resultante según cantidades recibidas, validación de pendiente y de vencimiento, cálculo de cantidad base.
- **Integración (PostgreSQL real):** proveedor duplicado; compra que no mueve inventario; recepción parcial y total; lote con proveedor/recepción; kardex con `receipt`; sobre-recepción; ubicación de otra sede; vencimiento pasado; compra ya recibida; idempotencia; permisos y alcance por sede.
- **E2E:** el comprador crea una compra, la recibe parcialmente y ve el lote en existencias; accesibilidad de la lista, proveedores y detalle en tres tamaños.

## 9. Datos de demostración

- Proveedores: **Cárnicos del Valle S.A.S.** (NIT 900123456-7) y **Distribuidora La Especia** (NIT 900987654-3).
- Compra `C-0001` pendiente para Bodega principal: 40 kg de carne de cerdo magra a $18.000/kg y 20 kg de tocino y grasa a $14.000/kg. Total $1.000.000,00.
- No se siembran recepciones: la demo recibe desde la compra y crea el primer lote `MP-2026-0005` (los cuatro lotes MP de la semilla ya existen).

## 10. Condiciones de inicio y definición de terminado

**Antes de programar:** especificación aprobada y DEC-094 registrada. Impuestos y anulación siguen bloqueados.

**Terminado cuando:**

- Esquema `purchasing`, migración y permisos aplicados; lotes enlazados a proveedor y recepción.
- Casos de uso de proveedores, compras y recepción con transacciones, bloqueos, idempotencia y auditoría.
- Pantallas de Compras y Proveedores, detalle y recepción; módulo `available`.
- Semilla demo idempotente.
- `pnpm check`, integración PGlite/PostgreSQL, build y E2E en verde.
- `PROJECT-STATUS.md`, roadmap, matriz, `demo-local.md`, `HANDOFF.md` y `MEMORY.md` actualizados.
