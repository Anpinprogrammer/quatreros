# Glosario de dominio

> Etapa A · v0.1 · 2026-10-29
> Vocabulario único para documentos, código, base de datos y UI. Columna **Código** = nombre canónico en inglés para tablas/clases **[Ampliación Etapa A, PROPOSED]**; la UI se muestra en español.
> **Estado**: `CONFIRMED` si el concepto y su significado vienen del DM; `PROPOSED` si la definición precisa es del equipo y debe validarse.
> Términos ambiguos o con reglas pendientes se señalan con ⚠️.

---

## 1. Abastecimiento

| Término                   | Código           | Definición                                                                                                                                                                                                                         | Estado                                               | Fuente                      |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| **Proveedor**             | `Supplier`       | Tercero que vende materia prima o insumos a Quatreros. Entidad comercial registrada; **no necesariamente usuario** del sistema.                                                                                                    | CONFIRMED                                            | DM §3                       |
| **Materia prima (MP)**    | `RawMaterial`    | Artículo comprado que se consume en producción según una receta (p. ej. carne, tripa, condimentos). No se vende directamente salvo decisión explícita.                                                                             | CONFIRMED (concepto) · PROPOSED (exclusión de venta) | DM §4.1                     |
| **Insumo**                | `Input`          | En este glosario, **sinónimo de materia prima**. Se usará "materia prima" en UI y `RawMaterial` en código para evitar dos nombres. ⚠️ Confirmar si existen insumos no alimentarios (empaques, etiquetas) que también se controlan. | PROPOSED                                             | DM §6                       |
| **Compra**                | `Purchase`       | Documento que registra la adquisición a un proveedor con sus líneas, cantidades y costos.                                                                                                                                          | CONFIRMED                                            | DM §6                       |
| **Línea de compra**       | `PurchaseLine`   | Artículo, cantidad, unidad y costo unitario dentro de una compra.                                                                                                                                                                  | CONFIRMED                                            | DM §6                       |
| **Recepción**             | `Receipt`        | Registro del ingreso físico de lo comprado a una ubicación; genera movimientos de entrada de MP con su lote de origen. Puede diferir de la compra (parcial).                                                                       | CONFIRMED (concepto) · PROPOSED (recepción parcial)  | DM §4.1, §6                 |
| **Lote de materia prima** | `RawMaterialLot` | Identificación de un ingreso de MP (proveedor, fecha, costo) que permite trazar su uso en producción.                                                                                                                              | PROPOSED                                             | DM §7.1 "origen de insumos" |

## 2. Catálogo y presentaciones

| Término                        | Código               | Definición                                                                                                                                | Estado                                            | Fuente          |
| ------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------- |
| **Producto**                   | `Product`            | Artículo vendible: **producto fabricado** (chorizo, rellena) o **alimento preparado** del POS.                                            | CONFIRMED                                         | DM §6, §7.4     |
| **Producto terminado (PT)**    | `FinishedGood`       | Producto fabricado por Quatreros que ingresa a inventario tras una orden de producción, con lote.                                         | CONFIRMED                                         | DM §4.1         |
| **Alimento preparado / plato** | `PreparedItem`       | Producto que se elabora en la cocina del POS para venta inmediata (p. ej. asado). Tiene su propia receta de cocina.                       | CONFIRMED (concepto) · PROPOSED (receta de plato) | DM §7.4         |
| **Unidad base**                | `BaseUnit`           | Unidad mínima en la que se lleva la existencia de un producto (p. ej. "unidad de chorizo"). Toda cantidad se convierte a ella.            | CONFIRMED                                         | DM §6           |
| **Presentación**               | `Presentation`       | Forma de venta de un producto: **unidad** o **paquete**.                                                                                  | CONFIRMED                                         | DM §2.2, §6     |
| **Paquete**                    | `Package`            | Presentación con **cantidad fija** de unidades base. Puede **abrirse** para vender unidades sueltas.                                      | CONFIRMED                                         | DM §7.1, PRO-01 |
| **Composición de paquete**     | `PackageComposition` | Número fijo de unidades base que contiene un paquete de un producto.                                                                      | CONFIRMED                                         | DM §6           |
| **Apertura de paquete** ⚠️     | `PackageOpening`     | Transformación de 1 paquete en N unidades sueltas del mismo producto y lote. Quién la hace, dónde y cómo se registra: **PENDING (P-06)**. | PENDING                                           | DM §14 P-06     |
| **Precio vigente**             | `CurrentPrice`       | Precio único de venta de un producto/presentación configurado por el administrador.                                                       | CONFIRMED                                         | DM §7.3, COM-01 |
| **Histórico de precios**       | `PriceHistory`       | Registro de precios anteriores con vigencia y responsable del cambio.                                                                     | CONFIRMED (concepto)                              | DM §6           |

## 3. Producción

| Término                          | Código                   | Definición                                                                                                                                                                    | Estado                           | Fuente          |
| -------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------- |
| **Receta**                       | `Recipe`                 | Fórmula documentada con **cantidades exactas** de MP necesarias para fabricar una cantidad de producto terminado, con su **rendimiento esperado**.                            | CONFIRMED                        | DM §7.1         |
| **Versión de receta**            | `RecipeVersion`          | Estado inmutable de una receta en un momento; las órdenes referencian la versión usada.                                                                                       | CONFIRMED (concepto "versiones") | DM §6           |
| **Orden de producción**          | `ProductionOrder`        | Instrucción, **decidida por una persona**, de fabricar una cantidad de un producto con una versión de receta. Registra consumo real, producción real y lote resultante.       | CONFIRMED                        | DM §6, §7.1     |
| **Sugerencia de producción**     | `ProductionSuggestion`   | Recomendación automática de qué y cuánto producir; **no** crea órdenes por sí sola. Criterio de cálculo PENDING (Q-PRO-03).                                                   | CONFIRMED (concepto)             | DM §7.1, PRO-02 |
| **Consumo teórico (producción)** | `TheoreticalConsumption` | MP que la receta indica para la cantidad producida.                                                                                                                           | PROPOSED                         | DM §6           |
| **Consumo real**                 | `ActualConsumption`      | MP efectivamente usada y descargada del inventario en una orden, por lote de MP.                                                                                              | CONFIRMED (concepto)             | DM §6           |
| **Rendimiento esperado**         | `ExpectedYield`          | Cantidad de PT que la receta debería producir con su MP.                                                                                                                      | CONFIRMED                        | DM §5           |
| **Rendimiento real**             | `ActualYield`            | Cantidad de PT efectivamente obtenida en la orden.                                                                                                                            | CONFIRMED                        | DM §5           |
| **Merma** ⚠️                     | `Shrinkage`              | Diferencia negativa entre lo esperado y lo real (producción) o pérdida física de inventario. Clasificación (normal/anormal) y tratamiento contable: **PENDING (P-03, P-07)**. | CONFIRMED (concepto)             | DM §6           |

## 4. Inventarios

| Término                      | Código           | Definición                                                                                                                                                    | Estado                                                | Fuente          |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| **Ubicación**                | `Location`       | Lugar físico donde hay existencias: bodega principal, POS (fabricados), cocina del POS; en el futuro más puntos.                                              | CONFIRMED                                             | DM §2.2, §6     |
| **Sede**                     | `Site`           | Unidad organizativa (bodega, punto de venta) a la que se asignan usuarios y que limita su acceso. Una sede puede contener varias ubicaciones.                 | CONFIRMED (sede) · PROPOSED (relación sede–ubicación) | DM §8           |
| **Lote**                     | `Lot`            | Conjunto de PT de una misma orden de producción con **fecha de fabricación, vencimiento** y **origen de insumos** trazable.                                   | CONFIRMED                                             | DM §7.1, INV-01 |
| **Estado de lote** ⚠️        | `LotStatus`      | Situación del lote: disponible, en inspección, bloqueado, vencido, descartado. Lista definitiva PENDING (P-05).                                               | PROPOSED                                              | DM §6           |
| **Existencia**               | `Stock`          | Cantidad en unidad base de un producto, por lote y ubicación, resultado de sumar movimientos.                                                                 | CONFIRMED                                             | DM §6           |
| **Existencia disponible**    | `AvailableStock` | Existencia menos reservas y menos lotes no vendibles (vencidos, bloqueados, en inspección).                                                                   | PROPOSED                                              | DM §6           |
| **Reserva**                  | `Reservation`    | Cantidad comprometida para un pedido o despacho que aún no ha salido.                                                                                         | CONFIRMED (concepto)                                  | DM §6           |
| **Movimiento de inventario** | `StockMovement`  | Registro inmutable que cambia existencias: entrada por recepción/producción, salida por venta/despacho/consumo, traslado, ajuste, transformación, devolución. | CONFIRMED (concepto) · PROPOSED (inmutable, DEC-P21)  | DM §6           |
| **Kardex**                   | `StockLedger`    | Historial cronológico de movimientos por producto/lote/ubicación.                                                                                             | PROPOSED                                              | —               |
| **Traslado / transferencia** | `Transfer`       | Movimiento de existencias entre dos ubicaciones (p. ej. bodega → POS) con salida y entrada vinculadas.                                                        | CONFIRMED                                             | DM §5, §6       |
| **Ajuste**                   | `Adjustment`     | Corrección de existencias tras conteo físico, con motivo y, según política, aprobación.                                                                       | CONFIRMED (concepto)                                  | DM §6           |
| **Conteo físico**            | `PhysicalCount`  | Registro de la cantidad contada en una ubicación y fecha.                                                                                                     | CONFIRMED (cocina) · PROPOSED (bodega)                | DM §7.4         |
| **FEFO**                     | `FEFO`           | _First Expired, First Out_: en salidas se asignan primero los lotes con **vencimiento más próximo**; excepción solo autorizada.                               | CONFIRMED                                             | DM §7.1, INV-02 |
| **Excepción FEFO**           | `FefoOverride`   | Salida de un lote distinto al sugerido por FEFO, con motivo y autorización.                                                                                   | CONFIRMED                                             | INV-02          |
| **Trazabilidad**             | `Traceability`   | Capacidad de ir de un lote de PT a sus lotes de MP (atrás) y a los clientes/ventas que lo recibieron (adelante).                                              | CONFIRMED                                             | DM §7.1         |
| **Retiro (recall)** ⚠️       | `Recall`         | Proceso para recuperar un lote ya distribuido. Procedimiento PENDING (P-05).                                                                                  | PENDING                                               | DM §14 P-05     |

## 5. Comercial y distribución

| Término                            | Código             | Definición                                                                                                                                                                          | Estado               | Fuente          |
| ---------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------- |
| **Cliente**                        | `Customer`         | Restaurante, negocio o persona natural que compra. Puede tener crédito.                                                                                                             | CONFIRMED            | DM §2.2, §3     |
| **Pedido**                         | `SalesOrder`       | Solicitud de un cliente de productos y cantidades, llegada por cualquier canal, que se atiende con uno o más despachos. Permanece **abierto** mientras tenga cantidades pendientes. | CONFIRMED            | DM §6, §7.2     |
| **Línea de pedido**                | `SalesOrderLine`   | Producto, presentación, cantidad y precio dentro de un pedido.                                                                                                                      | CONFIRMED            | DM §6           |
| **Canal**                          | `Channel`          | Medio por el que llegó el pedido. Lista PENDING (Q-COM-05).                                                                                                                         | CONFIRMED (concepto) | DM §2.2         |
| **Despacho**                       | `Dispatch`         | Salida física de mercancía de una ubicación para entregar uno o más pedidos, asignada a un distribuidor. Descuenta inventario (lotes FEFO).                                         | CONFIRMED            | DM §4.1, §6     |
| **Asignación**                     | `Assignment`       | Vínculo de un pedido/despacho con un distribuidor responsable.                                                                                                                      | CONFIRMED            | DM §5, §6       |
| **Entrega**                        | `Delivery`         | Registro de lo efectivamente recibido por el cliente en una visita. Puede ser **total** o **parcial**.                                                                              | CONFIRMED            | DM §7.2         |
| **Entrega parcial**                | `PartialDelivery`  | Entrega con cantidad menor a la pedida; el saldo queda **pendiente** y el pedido sigue abierto para **reprogramar**.                                                                | CONFIRMED            | DM §7.2, DIS-01 |
| **Pendiente**                      | `Backorder`        | Cantidad de un pedido aún no entregada.                                                                                                                                             | CONFIRMED            | DM §6           |
| **Devolución**                     | `Return`           | Mercancía que regresa del cliente o del distribuidor; se registra, **inspecciona** y se decide **reincorporar** o **descartar**.                                                    | CONFIRMED            | DM §7.2, DIS-02 |
| **Liquidación de distribuidor** ⚠️ | `DriverSettlement` | Cuadre al cierre de una salida: mercancía cargada vs. entregada vs. devuelta, y dinero esperado vs. recibido. Reglas PENDING (P-08).                                                | PENDING              | DM §14 P-08     |
| **Distribuidor / repartidor**      | `Driver`           | Empleado interno que realiza despachos, entregas y recaudos mediante el portal web móvil. En el DM "distribuidor" designa al **empleado**, no a un cliente mayorista.               | CONFIRMED            | DM §3, §7.2     |

## 6. Venta, caja y POS

| Término                      | Código                    | Definición                                                                                            | Estado               | Fuente          |
| ---------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------- | --------------- |
| **Venta (POS)**              | `Sale`                    | Transacción de venta inmediata en el punto de venta.                                                  | CONFIRMED            | DM §6, §7.4     |
| **Pago**                     | `Payment`                 | Monto recibido con un **método de pago**. Una venta puede tener varios (**pago mixto**).              | CONFIRMED            | DM §6, POS-01   |
| **Método de pago**           | `PaymentMethod`           | Efectivo, transferencia, tarjeta, etc. Catálogo PENDING (Q-POS-02).                                   | CONFIRMED (concepto) | DM §6           |
| **Pago mixto**               | `SplitPayment`            | Venta pagada con dos o más métodos cuya suma iguala el total.                                         | CONFIRMED            | DM §7.4         |
| **Caja**                     | `CashRegister`            | Punto de cobro físico de una sede.                                                                    | CONFIRMED            | DM §6           |
| **Turno**                    | `Shift`                   | Período de trabajo de un **cajero** en una **caja**, delimitado por apertura y cierre.                | CONFIRMED            | DM §7.4, POS-01 |
| **Apertura**                 | `ShiftOpening`            | Inicio de turno con registro de la base de efectivo.                                                  | CONFIRMED            | DM §6           |
| **Cierre**                   | `ShiftClosing`            | Fin de turno con arqueo (contado vs. esperado).                                                       | CONFIRMED            | DM §6           |
| **Diferencia de caja**       | `CashVariance`            | Contado − esperado al cierre. Se permite cerrar con **justificación** y **revisión del supervisor**.  | CONFIRMED            | DM §7.4, POS-02 |
| **Consumo teórico (cocina)** | `KitchenTheoreticalUsage` | Ingredientes que debieron usarse según las ventas de platos y sus recetas.                            | CONFIRMED            | DM §7.4, COC-01 |
| **Diferencia de cocina** ⚠️  | `KitchenVariance`         | (Inicial + entradas − final) − consumo teórico. Se **clasifica**; categorías y ajuste PENDING (P-07). | CONFIRMED (concepto) | COC-01, P-07    |

## 7. Cartera y finanzas

| Término                       | Código               | Definición                                                                                                                                                                      | Estado               | Fuente          |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------- |
| **Cupo**                      | `CreditLimit`        | Monto máximo de crédito concedido a un cliente.                                                                                                                                 | CONFIRMED            | DM §7.3         |
| **Plazo**                     | `CreditTerm`         | Días para pagar una obligación a crédito.                                                                                                                                       | CONFIRMED            | DM §7.3         |
| **Cartera**                   | `AccountsReceivable` | Conjunto de obligaciones pendientes de pago de los clientes.                                                                                                                    | CONFIRMED            | DM §5           |
| **Obligación**                | `Receivable`         | Deuda de un cliente originada por una venta/entrega a crédito, con vencimiento.                                                                                                 | CONFIRMED            | DM §6           |
| **Cartera vencida**           | `OverdueReceivable`  | Obligación cuyo plazo terminó sin pago total. Momento exacto de vencimiento PENDING (Q-COM-04).                                                                                 | CONFIRMED            | DM §7.3         |
| **Abono**                     | `ReceivablePayment`  | Pago parcial o total aplicado a una o más obligaciones.                                                                                                                         | CONFIRMED            | DM §6           |
| **Recaudo**                   | `Collection`         | Dinero cobrado por un distribuidor o un punto de venta, registrado separadamente por responsable para su conciliación.                                                          | CONFIRMED            | DM §7.2, FIN-01 |
| **Conciliación**              | `Reconciliation`     | Comparación entre lo registrado en el sistema y lo efectivamente recibido o existente (dinero de distribuidores, caja, bancos, cuentas contables), con registro de diferencias. | CONFIRMED (concepto) | DM §4.1, FIN-01 |
| **Aprobación / autorización** | `Approval`           | Permiso otorgado por un usuario facultado para ejecutar una operación excepcional (venta sobre cupo, excepción FEFO, diferencia de caja).                                       | CONFIRMED            | DM §8           |

## 8. Contabilidad (conceptual — tratamiento BLOCKED)

| Término               | Código                         | Definición                                                                                                                              | Estado                            | Fuente  |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| **Hecho económico**   | `EconomicEvent`                | Evento operativo con efecto económico (compra, venta, recaudo, ajuste) que la contabilidad debe reconocer.                              | CONFIRMED (concepto)              | DM §4   |
| **Cuenta**            | `Account`                      | Elemento del plan de cuentas. Plan PENDING (P-04).                                                                                      | CONFIRMED (concepto)              | DM §6   |
| **Comprobante**       | `Voucher`                      | Documento contable que agrupa asientos y soporta un hecho. ⚠️ Los comprobantes internos **no acreditan cumplimiento fiscal** (DM §9.2). | CONFIRMED (concepto)              | DM §6   |
| **Asiento / partida** | `JournalEntry` / `JournalLine` | Registro de débitos y créditos balanceados vinculado al hecho de origen.                                                                | PROPOSED (partida doble, DEC-P09) | DM §9.2 |
| **Período contable**  | `AccountingPeriod`             | Intervalo con estado abierto/cerrado. Política de cierre PENDING.                                                                       | CONFIRMED (concepto)              | DM §6   |
| **Reversión**         | `Reversal`                     | Corrección mediante asiento/movimiento inverso, sin borrar el original.                                                                 | PROPOSED                          | DM §9.2 |

## 9. Seguridad, IA y Telegram

| Término                    | Código              | Definición                                                                                                        | Estado    | Fuente         |
| -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- | -------------- |
| **Usuario**                | `User`              | Persona con credenciales en Quatreros.                                                                            | CONFIRMED | DM §6          |
| **Rol**                    | `Role`              | Conjunto editable de permisos (Administrador, Manager, Comprador, Productor, Distribuidor, Cajero, Contador).     | CONFIRMED | DM §3, ACC-01  |
| **Permiso**                | `Permission`        | Autorización para una acción sobre un recurso, opcionalmente limitada por sede y monto.                           | CONFIRMED | DM §8          |
| **Auditoría**              | `AuditLog`          | Registro inmutable de quién hizo qué, cuándo, desde qué canal (web, IA, Telegram) y con qué datos antes/después.  | CONFIRMED | PM §4.E; DM §8 |
| **Solicitud IA**           | `AiRequest`         | Petición del usuario al asistente, con consumo medido.                                                            | CONFIRMED | DM §6          |
| **Propuesta de operación** | `OperationProposal` | Operación estructurada preparada por la IA, validada por el backend, pendiente de confirmación; tiene expiración. | PROPOSED  | DM §10.1       |
| **Confirmación**           | `Confirmation`      | Aceptación explícita y de un solo uso del usuario sobre una propuesta concreta.                                   | CONFIRMED | DM §6, §10     |
| **Herramienta (tool)**     | `AgentTool`         | Función del backend expuesta al asistente con validación y permisos; único medio de acceso a datos de la IA.      | PROPOSED  | DM §10.2       |
| **Vinculación Telegram**   | `TelegramLink`      | Asociación verificada entre una cuenta de Telegram y un usuario interno.                                          | PROPOSED  | DM §8          |
| **Complemento**            | `AddOn`             | Funcionalidad contratable y activable por separado (IA, Telegram).                                                | CONFIRMED | DM §5          |

---

## Términos a evitar o desambiguar

| Evitar                                  | Usar                                                     | Motivo                                      |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| "Ciclo de compra" para todo el flujo    | Compra, Orden de producción, Pedido (procesos separados) | DEC-P01                                     |
| "Distribuidor" para clientes mayoristas | Cliente (tipo negocio)                                   | En el DM distribuidor = empleado repartidor |
| "Factura" para comprobantes internos    | Comprobante interno / venta                              | Validez fiscal no confirmada (DM §9.2)      |
| "Stock" sin calificar                   | Existencia / existencia disponible                       | Distinguir reservas y lotes no vendibles    |
| "Cantidad" sin unidad                   | Cantidad + unidad base o presentación                    | Riesgo R-IA-07, R-INV-01                    |
