# Requerimientos de datos

> Etapa B · v0.1 · 2026-10-29
> Qué información debe guardar el sistema, con qué reglas de integridad y retención. **No es el esquema de base de datos** (eso es Etapa C, `database-design.md`); define los datos mínimos que el diseño debe soportar.
> Los nombres de entidad usan la columna **Código** del glosario.

---

## 1. Convenciones transversales (DR-00x)

| ID     | Requerimiento                                                                                                                           | Estado                 | Fuente  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------- |
| DR-001 | Toda entidad operativa registra **creado por, creado en, sede** y, si se modifica, **modificado por/en**.                               | PROPOSED               | DM §6   |
| DR-002 | Los montos se guardan en **COP con precisión exacta** (`NUMERIC` o entero); nunca coma flotante.                                        | PROPOSED               | DEC-P22 |
| DR-003 | Las cantidades se guardan en **unidad base** con precisión exacta; la presentación y la cantidad original se conservan como referencia. | CONFIRMED (conversión) | DM §2.2 |
| DR-004 | Las fechas-hora se guardan en **UTC** y se muestran en hora de Colombia (America/Bogota).                                               | PROPOSED               | —       |
| DR-005 | Los documentos operativos tienen un **consecutivo legible** por tipo (C-0418, OP-0042, D-301) además del identificador técnico.         | PROPOSED               | —       |
| DR-006 | Registros cerrados son **inmutables**; las correcciones referencian el registro original (BR-006).                                      | PROPOSED               | DEC-P10 |
| DR-007 | Cada operación con efecto en inventario o dinero conserva su **clave de idempotencia** (BR-007).                                        | PROPOSED               | DEC-P23 |
| DR-008 | Toda entidad maestra (producto, cliente, proveedor, usuario) se **inactiva**, no se elimina, si tiene historial.                        | PROPOSED               | BR-010  |

## 2. Datos maestros

| Entidad                                   | Datos mínimos                                                                                      | Reglas de integridad                           | Fuente      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| `Site`                                    | nombre, tipo (bodega, punto de venta), estado                                                      | nombre único                                   | DM §2.2     |
| `Location`                                | sede, nombre, tipo (bodega, POS fabricados, cocina, en ruta, en tránsito, en inspección), estado   | pertenece a una sede                           | DM §5, §7.4 |
| `User`                                    | nombre, correo, estado, MFA configurado, roles, sedes                                              | correo único                                   | DM §8       |
| `Role` / `Permission`                     | nombre, permisos con alcance                                                                       | rol Administrador indeleble                    | DM §8       |
| `ApprovalPolicy`                          | código AP, activo, aprobadores, umbral, expiración                                                 | AP-01..03 no desactivables                     | DM §8       |
| `Product`                                 | nombre, tipo (fabricado, preparado), unidad base, vida útil (días), estado                         | nombre único                                   | DM §6       |
| `Presentation`                            | producto, nombre, unidades base por presentación, estado                                           | composición inmutable con movimientos (BR-021) | DM §6       |
| `PriceHistory`                            | producto/presentación, precio, vigente desde, vigente hasta, usuario                               | un único precio vigente por presentación       | DM §7.3     |
| `RawMaterial`                             | nombre, unidad, controla vencimiento, estado                                                       | —                                              | DM §6       |
| `Recipe` / `RecipeVersion` / `RecipeLine` | producto, versión, cantidad base producida, rendimiento esperado, tolerancia; líneas MP + cantidad | versión inmutable; cantidades > 0              | DM §7.1     |
| `DishRecipe`                              | plato, ingredientes y cantidades, versión                                                          | —                                              | DM §7.4     |
| `Supplier`                                | nombre, identificación, contacto                                                                   | identificación única                           | DM §3       |
| `Customer`                                | tipo, nombre, identificación, teléfono, dirección de entrega, estado                               | identificación única cuando exista             | DM §2.2     |
| `CreditTerms`                             | cliente, habilitado, cupo, plazo (días), usuario, fecha                                            | cupo ≥ 0; plazo ≥ 0                            | DM §7.3     |
| `PaymentMethod`                           | nombre, tipo (efectivo / no efectivo), estado                                                      | —                                              | DM §6       |
| `CashRegister`                            | sede, nombre                                                                                       | —                                              | DM §6       |

## 3. Datos transaccionales

| Entidad                                                                     | Datos mínimos                                                                                                      | Reglas de integridad                                          | Fuente                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------- |
| `Purchase` / `PurchaseLine`                                                 | proveedor, sede, fecha, líneas (MP, cantidad, unidad, costo unitario), total, soporte, estado                      | cantidades y costos > 0                                       | DM §6                       |
| `Receipt` / `RawMaterialLot`                                                | compra, fecha, ubicación; lote: MP, proveedor, cantidad, costo unitario, vencimiento                               | recibido acumulado ≤ comprado (salvo confirmación)            | DM §7.1                     |
| `ProductionOrder`                                                           | producto, versión de receta, cantidad planeada, estado, responsable, fechas                                        | una versión de receta por orden                               | DM §6                       |
| `ActualConsumption`                                                         | orden, lote MP, cantidad teórica, cantidad real                                                                    | real ≥ 0                                                      | DM §6                       |
| `Lot`                                                                       | producto, orden de origen, fecha de fabricación, vencimiento, estado                                               | vencimiento ≥ fabricación                                     | DM §7.1                     |
| `LotInput`                                                                  | lote PT ↔ lote MP (N:M) con cantidad                                                                               | —                                                             | DEC-080                     |
| `StockMovement`                                                             | tipo, producto/MP, presentación, lote, ubicación, cantidad (+/−) en unidad base, documento origen, usuario, fecha  | inmutable; saldo resultante ≥ 0 por lote y ubicación (BR-081) | DEC-P21                     |
| `Transfer`                                                                  | origen, destino, líneas, estado, cantidades enviada/recibida, novedad                                              | origen ≠ destino                                              | DM §5                       |
| `PhysicalCount` / `Adjustment`                                              | ubicación, fecha, líneas contadas; ajuste con motivo y aprobación                                                  | motivo obligatorio                                            | DM §6                       |
| `Reservation`                                                               | pedido, producto, presentación, cantidad, estado                                                                   | reservado ≤ disponible al reservar                            | DM §6                       |
| `SalesOrder` / `SalesOrderLine`                                             | cliente, canal, modalidad, fecha deseada, estado; líneas con precio fijado, cantidad pedida, entregada, pendiente  | pendiente = pedido − entregado ≥ 0                            | DM §6                       |
| `Dispatch` / `DispatchLine`                                                 | distribuidor, fecha, pedidos, lotes asignados, estado                                                              | un distribuidor por despacho                                  | DM §6                       |
| `Delivery`                                                                  | despacho, pedido, cantidades entregadas, motivo si parcial, fecha-hora                                             | entregado ≤ cargado                                           | DM §7.2                     |
| `Return`                                                                    | cliente, despacho/entrega, producto, lote, cantidad, motivo, estado, decisión de inspección                        | —                                                             | DM §7.2                     |
| `DriverSettlement`                                                          | despacho, cuadre de mercancía, cuadre de dinero, diferencias                                                       | ⏸ P-08                                                        | DM §14                      |
| `Shift`                                                                     | caja, cajero, apertura (base), cierre (conteo por método, esperado, diferencia, justificación), estado de revisión | un turno abierto por caja y por cajero                        | DM §7.4                     |
| `Sale` / `SaleLine` / `Payment`                                             | turno, líneas (producto, presentación, cantidad, precio), lotes, pagos (método, monto), cambio                     | suma pagos − cambio = total                                   | DM §7.4                     |
| `KitchenCount` / `KitchenVariance`                                          | período, ingrediente, inicial, entradas, final, teórico, diferencia, clasificación                                 | ⏸ clasificación P-07                                          | DM §7.4                     |
| `Receivable` / `ReceivablePayment`                                          | cliente, origen (entrega/venta), monto, vencimiento, saldo; abonos con aplicación                                  | saldo ≥ 0                                                     | DM §6                       |
| `Collection` / `Reconciliation`                                             | responsable (distribuidor/caja), montos por método, soporte, estado; conciliación con recibido y diferencia        | —                                                             | DM §7.2                     |
| `ApprovalRequest`                                                           | política, solicitante, operación, datos exactos (hash), motivo, aprobador, decisión, expiración, ejecución         | aprobador ≠ solicitante                                       | DM §8                       |
| `EconomicEvent`                                                             | tipo, referencia de origen, montos, cantidades, fecha, estado de contabilización                                   | inmutable                                                     | DEC-P20                     |
| `Account` / `Voucher` / `JournalEntry` / `JournalLine` / `AccountingPeriod` | estructura contable genérica                                                                                       | Σ débitos = Σ créditos; período abierto                       | DM §9.2 (contenido BLOCKED) |

## 4. Auditoría, IA y Telegram

| Entidad                              | Datos mínimos                                                                                                                                  | Fuente   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `AuditLog`                           | fecha-hora, usuario, rol, sede, canal (web, IA, Telegram, sistema), acción, entidad e ID, valores antes/después, motivo, aprobación, IP/agente | PM §4.E  |
| `AiRequest`                          | usuario, canal, modelo, tokens de entrada/salida, costo estimado, herramientas invocadas, duración, resultado                                  | DM §10.2 |
| `OperationProposal` / `Confirmation` | usuario, operación, datos estructurados, hash, estado, expiración, confirmación (una vez), operación ejecutada                                 | DM §10.1 |
| `TelegramLink`                       | usuario, ID de chat de Telegram, fecha de vínculo, estado                                                                                      | DM §8    |
| `AddOnSetting`                       | complemento (IA, Telegram), activo, límites                                                                                                    | DM §5    |

## 5. Retención, respaldo y privacidad

| ID     | Requerimiento                                                                                                                                                                                              | Estado                    | Fuente   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- |
| DR-020 | Datos operativos, contables y de auditoría se conservan **sin borrado** durante el plazo legal que indique el contador.                                                                                    | PENDING (plazo con Q-CON) | DM §9    |
| DR-021 | Datos de consumo de IA y texto de conversaciones: plazo de retención a definir; por defecto conservar metadatos y no el texto completo más allá de un período corto.                                       | PROPOSED                  | —        |
| DR-022 | Audios de Telegram: transcribir y **no conservar el audio** salvo decisión contraria.                                                                                                                      | PROPOSED                  | —        |
| DR-023 | Datos personales de clientes personas naturales: mínimos necesarios (nombre, teléfono, dirección de entrega, identificación si se requiere fiscalmente) y política de tratamiento validada por la empresa. | PROPOSED                  | R-SEC-05 |
| DR-024 | Soportes adjuntos (compras, transferencias) en almacenamiento **privado**, acceso por permiso y enlaces temporales.                                                                                        | PROPOSED                  | DEC-P04  |
| DR-025 | Respaldos y restauración: ver RNF-040–045.                                                                                                                                                                 | —                         | DM §12.2 |

## 6. Datos para la carga inicial (MIG)

| Plantilla                              | Contenido                                                                                          | Responsable                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Catálogo de productos y presentaciones | productos, unidad base, presentaciones, vida útil, precio vigente                                  | Administrador                           |
| Materias primas                        | nombre, unidad, control de vencimiento                                                             | Administrador                           |
| Recetas                                | producto, ingredientes, cantidades, rendimiento esperado                                           | Producción                              |
| Proveedores                            | datos de contacto e identificación                                                                 | Administrador                           |
| Clientes y crédito                     | datos, cupo, plazo                                                                                 | Administrador                           |
| Inventario inicial                     | ubicación, producto/MP, presentación, lote, fabricación, vencimiento, cantidad, costo si se conoce | Administrador + conteo físico           |
| Cartera inicial                        | cliente, documento, fecha, vencimiento, saldo                                                      | Administrador + verificación de tercero |
| Cuentas por pagar                      | proveedor, documento, vencimiento, saldo                                                           | Administrador                           |
| Caja inicial                           | caja, saldo por método                                                                             | Administrador                           |
| Plan de cuentas y apertura             | ⏸ P-04                                                                                             | Contador                                |
