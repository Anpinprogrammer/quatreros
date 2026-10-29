# Actores y permisos

> Etapa B · v0.1 · 2026-10-29
> **Estado del documento: `PROPOSED` — borrador de la matriz definitiva de privilegios (P-10 / Q-SEC-01) para aprobación del responsable.**
> Lo confirmado por el DM se indica con su fuente. Todo lo demás es propuesta del equipo y no se implementa como regla definitiva hasta su aprobación; el **motor** de permisos sí puede construirse, porque la matriz es configurable (DEC-040).

---

## 1. Principios del modelo de autorización

| #   | Principio                                                                                                                                              | Estado                                       | Fuente             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------ |
| 1   | Roles **predefinidos, editables y ampliables**; el administrador puede crear roles nuevos y modificar permisos                                         | CONFIRMED                                    | DM §8, DEC-040     |
| 2   | Cada usuario tiene **uno o más roles** y **una o más sedes asignadas**; solo ve y opera datos de sus sedes                                             | CONFIRMED (sedes) · PROPOSED (multi-rol)     | DM §3, §8, DEC-041 |
| 3   | Autorizaciones excepcionales **configurables por operación, monto y permiso**                                                                          | CONFIRMED                                    | DM §8, DEC-042     |
| 4   | Toda verificación ocurre en el **backend**; la interfaz solo oculta lo que el usuario no puede hacer                                                   | CONFIRMED                                    | DM §8              |
| 5   | Quien solicita una excepción **no puede aprobarla él mismo** (segregación)                                                                             | PROPOSED **[Ampliación]**                    | —                  |
| 6   | IA y Telegram actúan **con los permisos del usuario autenticado**, nunca con más; además existe una **lista blanca por canal** que puede restringirlos | PROPOSED                                     | DM §10, §11; PM §9 |
| 7   | MFA obligatorio para roles sensibles                                                                                                                   | CONFIRMED (principio) · PROPOSED (qué roles) | DM §8, DEC-043     |

### 1.1 Alcances de un permiso

Un permiso se expresa como `modulo.recurso.accion` con un **alcance**:

| Alcance | Significado                                                                    |
| ------- | ------------------------------------------------------------------------------ |
| `ALL`   | Todas las sedes                                                                |
| `SITE`  | Solo las sedes asignadas al usuario                                            |
| `OWN`   | Solo los registros asignados al usuario (sus despachos, su turno, sus órdenes) |
| `NONE`  | Sin acceso                                                                     |

Ejemplo: `inv.transfer.create@SITE`, `dis.delivery.register@OWN`.

## 2. Actores

| Actor                                | Tipo            | Responsabilidad                                                                                                             | Sede                      | Estado                                            | Fuente      |
| ------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------- | ----------- |
| **Administrador**                    | Usuario interno | Configuración global, políticas, precios, supervisión, autorizaciones                                                       | Todas                     | CONFIRMED                                         | DM §3       |
| **Manager**                          | Usuario interno | Gestión operativa bajo permisos delegados                                                                                   | Asignadas                 | CONFIRMED                                         | DM §3       |
| **Comprador / encargado de compras** | Usuario interno | Registro de compras y recepción de materia prima                                                                            | Asignadas                 | PENDING de formalizar (C-08); se propone como rol | DM §3       |
| **Productor**                        | Usuario interno | Ejecución y confirmación de órdenes de producción                                                                           | Asignadas                 | CONFIRMED                                         | DM §3       |
| **Distribuidor (repartidor)**        | Usuario interno | Despachos asignados, entregas, devoluciones, recaudos; portal web móvil                                                     | Asignadas                 | CONFIRMED                                         | DM §3, §7.2 |
| **Cajero**                           | Usuario interno | Venta POS, apertura y cierre de su turno                                                                                    | Sede/caja/turno asignados | CONFIRMED                                         | DM §3, §7.4 |
| **Contador**                         | Usuario interno | Contabilidad formal dentro del ERP                                                                                          | Todas (lectura)           | CONFIRMED (rol) · PENDING (segregación, Q-SEC-03) | DM §3, §9   |
| **Supervisor**                       | Función, no rol | Quien revisa diferencias de caja y aprueba excepciones; lo ejerce un Administrador o Manager con el permiso correspondiente | —                         | PROPOSED                                          | DM §7.4     |
| Cliente                              | Tercero         | Recibe pedidos; puede tener crédito. **No es usuario** (portal no aprobado)                                                 | —                         | CONFIRMED                                         | DM §3       |
| Proveedor                            | Tercero         | Abastece materia prima. **No es usuario**                                                                                   | —                         | CONFIRMED                                         | DM §3       |
| Asistente IA                         | Canal           | Actúa en nombre del usuario autenticado                                                                                     | Hereda                    | CONFIRMED (opcional)                              | DM §10      |
| Bot de Telegram                      | Canal           | Actúa en nombre del usuario vinculado                                                                                       | Hereda                    | CONFIRMED (opcional)                              | DM §11      |

## 3. Matriz de permisos propuesta (roles predefinidos)

**Convención:** `✔` todas las sedes · `S` sedes asignadas · `O` solo lo propio/asignado · `👁` solo lectura (en su alcance) · `A` puede **aprobar** excepciones · `—` sin acceso.
Abreviaturas de rol: **ADM** Administrador · **MGR** Manager · **COMP** Comprador · **PROD** Productor · **DIST** Distribuidor · **CAJ** Cajero · **CONT** Contador.

### 3.1 Administración y catálogo

| Capacidad                                       | Permiso                 | ADM | MGR | COMP | PROD | DIST | CAJ | CONT |
| ----------------------------------------------- | ----------------------- | --- | --- | ---- | ---- | ---- | --- | ---- |
| Gestionar usuarios, roles y asignación de sedes | `adm.user.*`            | ✔   | —   | —    | —    | —    | —   | —    |
| Configurar políticas de aprobación y umbrales   | `adm.approval_policy.*` | ✔   | —   | —    | —    | —    | —   | —    |
| Consultar auditoría                             | `adm.audit.read`        | ✔   | 👁 S | —    | —    | —    | —   | 👁 ✔  |
| Gestionar sedes y ubicaciones                   | `adm.site.*`            | ✔   | —   | —    | —    | —    | —   | —    |
| Activar/desactivar complementos IA y Telegram   | `adm.addon.toggle`      | ✔   | —   | —    | —    | —    | —   | —    |
| Gestionar productos, unidades, presentaciones   | `cat.product.*`         | ✔   | 👁   | 👁    | 👁    | 👁    | 👁   | 👁    |
| **Cambiar precios**                             | `cat.price.update`      | ✔   | —   | —    | —    | —    | —   | —    |
| Gestionar materias primas                       | `cat.raw_material.*`    | ✔   | S   | S    | 👁    | —    | —   | 👁    |
| Gestionar recetas y versiones                   | `prod.recipe.*`         | ✔   | S   | —    | 👁    | —    | —   | 👁    |

### 3.2 Compras, producción e inventarios

| Capacidad                                         | Permiso                                  | ADM   | MGR                          | COMP | PROD         | DIST         | CAJ          | CONT |
| ------------------------------------------------- | ---------------------------------------- | ----- | ---------------------------- | ---- | ------------ | ------------ | ------------ | ---- |
| Gestionar proveedores                             | `comp.supplier.*`                        | ✔     | S                            | S    | —            | —            | —            | 👁    |
| Registrar compra                                  | `comp.purchase.create`                   | ✔     | S                            | S    | —            | —            | —            | 👁    |
| Registrar recepción de MP                         | `comp.receipt.create`                    | ✔     | S                            | S    | —            | —            | —            | 👁    |
| Anular compra/recepción                           | `comp.purchase.void`                     | ✔ / A | S (requiere aprobación)      | —    | —            | —            | —            | 👁    |
| Ver sugerencias de producción/compra              | `prod.suggestion.read`                   | ✔     | S                            | S    | S            | —            | —            | —    |
| Crear orden de producción                         | `prod.order.create`                      | ✔     | S                            | —    | S            | —            | —            | 👁    |
| Registrar consumo y producción real; cerrar orden | `prod.order.execute`                     | ✔     | S                            | —    | O            | —            | —            | 👁    |
| Anular orden cerrada                              | `prod.order.void`                        | ✔ / A | —                            | —    | —            | —            | —            | 👁    |
| Consultar existencias y kardex                    | `inv.stock.read`                         | ✔     | S                            | S    | S            | O (su carga) | S (POS)      | 👁 ✔  |
| Trasladar entre ubicaciones                       | `inv.transfer.create`                    | ✔     | S                            | —    | S            | —            | —            | 👁    |
| Recibir traslado en destino                       | `inv.transfer.receive`                   | ✔     | S                            | —    | —            | —            | S            | 👁    |
| Registrar conteo físico                           | `inv.count.create`                       | ✔     | S                            | S    | S            | —            | S            | 👁    |
| **Ajustar inventario**                            | `inv.adjustment.create`                  | ✔ / A | S (sobre umbral, aprobación) | —    | —            | —            | —            | 👁    |
| **Excepción FEFO**                                | `inv.fefo_override.request` / `.approve` | ✔ / A | S / A                        | —    | S (solicita) | O (solicita) | S (solicita) | —    |
| Bloquear/desbloquear lote                         | `inv.lot.block`                          | ✔     | S                            | —    | S            | —            | —            | 👁    |
| Apertura de paquete                               | `inv.package.open`                       | ✔     | S                            | —    | S            | O ⚠️         | S            | —    |
| Consultar trazabilidad de lote                    | `inv.traceability.read`                  | ✔     | S                            | S    | S            | —            | —            | 👁 ✔  |

⚠️ Apertura de paquete por el distribuidor en ruta depende de P-06 (Q-INV-02).

### 3.3 Comercial, distribución y cartera

| Capacidad                                                | Permiso                         | ADM | MGR                     | COMP | PROD | DIST             | CAJ | CONT             |
| -------------------------------------------------------- | ------------------------------- | --- | ----------------------- | ---- | ---- | ---------------- | --- | ---------------- |
| Gestionar clientes                                       | `com.customer.*`                | ✔   | S                       | —    | —    | 👁 O              | 👁   | 👁                |
| **Configurar cupo y plazo de crédito**                   | `fin.credit.configure`          | ✔   | —                       | —    | —    | —                | —   | 👁                |
| Registrar pedido                                         | `com.order.create`              | ✔   | S                       | —    | —    | —                | S   | 👁                |
| Cancelar pedido                                          | `com.order.cancel`              | ✔   | S (PENDING P-09)        | —    | —    | —                | —   | 👁                |
| **Vender a crédito con cupo excedido / cartera vencida** | `fin.credit_override.approve`   | A   | — (PROPOSED: delegable) | —    | —    | —                | —   | —                |
| Crear despacho y asignar distribuidor                    | `dis.dispatch.create`           | ✔   | S                       | —    | —    | —                | —   | 👁                |
| Ver sus despachos asignados                              | `dis.dispatch.read`             | ✔   | S                       | —    | —    | O                | —   | 👁                |
| Registrar entrega (total/parcial)                        | `dis.delivery.register`         | ✔   | S                       | —    | —    | O                | —   | 👁                |
| Registrar recaudo en entrega                             | `fin.collection.register`       | ✔   | S                       | —    | —    | O                | —   | 👁                |
| Registrar devolución                                     | `dis.return.register`           | ✔   | S                       | —    | —    | O                | —   | 👁                |
| Inspeccionar devolución (reincorporar/descartar)         | `dis.return.inspect`            | ✔   | S                       | —    | S    | —                | —   | 👁                |
| Liquidar distribuidor                                    | `dis.settlement.*`              | ✔   | S                       | —    | —    | 👁 O              | —   | 👁 (PENDING P-08) |
| Registrar abono de cartera                               | `fin.receivable_payment.create` | ✔   | S                       | —    | —    | O (en entrega)   | S   | 👁                |
| Consultar cartera                                        | `fin.receivable.read`           | ✔   | S                       | —    | —    | O (sus clientes) | —   | 👁 ✔              |

### 3.4 POS, cocina y caja

| Capacidad                        | Permiso                         | ADM   | MGR   | COMP | PROD | DIST | CAJ                     | CONT             |
| -------------------------------- | ------------------------------- | ----- | ----- | ---- | ---- | ---- | ----------------------- | ---------------- |
| Abrir / cerrar turno propio      | `pos.shift.open` / `.close`     | ✔     | S     | —    | —    | —    | O                       | —                |
| Registrar venta y pagos mixtos   | `pos.sale.create`               | ✔     | S     | —    | —    | —    | O (turno abierto)       | —                |
| **Anular venta**                 | `pos.sale.void`                 | ✔ / A | S / A | —    | —    | —    | Solicita (PENDING P-09) | 👁                |
| **Aplicar descuento**            | `pos.discount.apply`            | ✔     | S     | —    | —    | —    | PENDING P-09            | —                |
| Revisar diferencia de caja       | `pos.cash_variance.review`      | ✔ / A | S / A | —    | —    | —    | —                       | 👁                |
| Conteo inicial/final de cocina   | `pos.kitchen_count.create`      | ✔     | S     | —    | —    | —    | S                       | —                |
| Clasificar diferencias de cocina | `pos.kitchen_variance.classify` | ✔     | S     | —    | —    | —    | —                       | 👁 (PENDING P-07) |
| Gestionar recetas de platos      | `pos.dish_recipe.*`             | ✔     | S     | —    | —    | —    | 👁                       | 👁                |

### 3.5 Contabilidad y finanzas

| Capacidad                            | Permiso                         | ADM         | MGR | COMP        | PROD           | DIST | CAJ          | CONT                           |
| ------------------------------------ | ------------------------------- | ----------- | --- | ----------- | -------------- | ---- | ------------ | ------------------------------ |
| Conciliar recaudos y caja            | `fin.reconciliation.*`          | ✔           | S   | —           | —              | —    | —            | ✔                              |
| Gestionar plan de cuentas            | `cont.account.*`                | 👁           | —   | —           | —              | —    | —            | ✔                              |
| Registrar comprobante/asiento manual | `cont.journal.create`           | —           | —   | —           | —              | —    | —            | ✔ (BLOCKED en reglas, DEC-081) |
| Cerrar / reabrir período             | `cont.period.close` / `.reopen` | A (reabrir) | —   | —           | —              | —    | —            | ✔ (cerrar)                     |
| Reportes contables                   | `cont.report.read`              | ✔           | —   | —           | —              | —    | —            | ✔                              |
| Reportes operativos y de gestión     | `rep.operational.read`          | ✔           | S   | S (compras) | S (producción) | —    | O (su turno) | ✔                              |

**Segregación del Contador (propuesta, pendiente Q-SEC-03):** el contador **no registra** operaciones de caja, ventas, recaudos ni ajustes de inventario; consulta todo y opera solo la contabilidad. La reapertura de un período cerrado exige aprobación del Administrador.

### 3.6 Complementos (IA y Telegram)

| Capacidad                     | Permiso         | ADM                                          | MGR | COMP            | PROD | DIST | CAJ | CONT |
| ----------------------------- | --------------- | -------------------------------------------- | --- | --------------- | ---- | ---- | --- | ---- |
| Usar asistente IA (consultas) | `ia.query`      | ✔                                            | ✔   | ✔               | ✔    | ✔    | ✔   | ✔    |
| Escrituras asistidas por IA   | `ia.write`      | BLOCKED hasta aprobar esta matriz (DM §15.2) |     |                 |      |      |     |      |
| Vincular cuenta de Telegram   | `tg.link`       | ✔                                            | ✔   | PENDING Q-TG-03 |      |      |     |      |
| Ver consumo de IA             | `ia.usage.read` | ✔                                            | —   | —               | —    | —    | —   | —    |

## 4. Políticas de aprobación (autorizaciones excepcionales)

Las operaciones de esta tabla exigen una **aprobación** de un usuario distinto al solicitante con el permiso `…approve`. Los **umbrales son configurables** (DEC-042); los valores iniciales son **PENDING** y los fija el Administrador.

| Código | Operación                                                        | Disparador                     | Aprueba (propuesto)                                   | Umbral inicial          | Estado    | Fuente           |
| ------ | ---------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- | ----------------------- | --------- | ---------------- |
| AP-01  | Venta a crédito con **cupo excedido**                            | saldo + venta > cupo           | ADM                                                   | — (siempre)             | CONFIRMED | DM §7.3, DEC-022 |
| AP-02  | Venta a crédito con **cartera vencida**                          | cliente con obligación vencida | ADM                                                   | — (siempre)             | CONFIRMED | DM §7.3, DEC-022 |
| AP-03  | **Excepción FEFO**                                               | lote distinto al sugerido      | ADM, MGR                                              | — (siempre)             | CONFIRMED | DM §7.1, DEC-014 |
| AP-04  | **Cierre de caja con diferencia**                                | contado ≠ esperado             | Revisión posterior por ADM/MGR (no bloquea el cierre) | Monto: PENDING          | CONFIRMED | DM §7.4, DEC-033 |
| AP-05  | **Ajuste de inventario**                                         | ajuste por conteo              | ADM, MGR                                              | Valor/cantidad: PENDING | PROPOSED  | DM §6            |
| AP-06  | **Anulación** de venta, compra, orden o despacho                 | cualquier anulación            | ADM, MGR                                              | PENDING P-09            | PROPOSED  | DM §8            |
| AP-07  | **Descuento** en venta o pedido                                  | descuento > umbral             | ADM                                                   | PENDING P-09            | PENDING   | DM §7.3          |
| AP-08  | **Descarte** de devolución o lote                                | decisión de descartar          | ADM, MGR                                              | PENDING P-05            | PROPOSED  | DM §7.2          |
| AP-09  | **Reapertura de período contable**                               | reabrir período                | ADM                                                   | — (siempre)             | PROPOSED  | DM §9            |
| AP-10  | **Escritura asistida por IA/Telegram** que caiga en AP-01..AP-09 | según política de la operación | Igual que la operación                                | Igual                   | CONFIRMED | DM §10, IA-02    |

**Reglas comunes de aprobación (PROPOSED):**

1. La solicitud registra solicitante, operación, datos exactos, motivo obligatorio y fecha.
2. La aprobación es **sobre la solicitud exacta**: si cambian los datos, se requiere nueva aprobación.
3. Una aprobación **expira** (plazo PENDING) y se usa **una sola vez**.
4. El backend **revalida** reglas y permisos al ejecutar, aunque exista aprobación.
5. Todo queda en auditoría (BR-005).

## 5. Autenticación y sesiones (propuesta, pendiente Q-SEC-02)

| Aspecto            | Propuesta                                                                      | Estado            |
| ------------------ | ------------------------------------------------------------------------------ | ----------------- |
| Método             | Correo + contraseña                                                            | CONFIRMED (DM §8) |
| MFA                | Obligatorio para **ADM, MGR y CONT**; opcional para el resto                   | PROPOSED          |
| Factor             | TOTP (aplicación autenticadora)                                                | PROPOSED          |
| Contraseña         | Longitud mínima 12; verificación contra listas de contraseñas filtradas        | PROPOSED          |
| Bloqueo            | Bloqueo temporal tras intentos fallidos consecutivos (número PENDING)          | PROPOSED          |
| Sesión             | Expiración por inactividad (POS y portal móvil con valores distintos, PENDING) | PROPOSED          |
| Recuperación       | Enlace de un solo uso por correo; restablecer MFA solo por ADM                 | PROPOSED          |
| Usuarios inactivos | Desactivar, nunca borrar (preserva auditoría)                                  | PROPOSED          |

## 6. Decisiones que solicita este documento

| #   | Pregunta                                                                     | Recomendación                                   |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | ¿Se aprueba la matriz de las secciones 3.1–3.6 como configuración inicial?   | Aprobar; se ajusta luego desde la configuración |
| 2   | ¿Se formaliza el rol **Comprador**? (C-08)                                   | Sí                                              |
| 3   | ¿La aprobación de crédito excedido (AP-01/02) puede delegarse en el Manager? | No por ahora; solo ADM, como dice el DM         |
| 4   | ¿Se aprueba la segregación del Contador (sección 3.5)?                       | Sí (resuelve Q-SEC-03)                          |
| 5   | ¿MFA obligatorio para ADM, MGR y CONT?                                       | Sí (resuelve Q-SEC-02 parcialmente)             |
| 6   | Umbrales iniciales de AP-04, AP-05 y AP-06                                   | Fijar valores en pesos al aprobar               |
