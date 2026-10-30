# Diseño de base de datos

> Etapa C · v0.1 · 2026-10-29
> Modelo relacional **preliminar** en `sql/preliminary-schema.sql` (PostgreSQL 15+). **No es una migración definitiva**: las migraciones se generan y revisan en Etapa F (ADR-005).
> **Validado** el 2026-10-29 con `sql/validate-schema.mjs` sobre PostgreSQL embebido (PGlite 0.5): el esquema carga completo (79 tablas en 14 esquemas) y **16 de 16** pruebas de restricciones se comportan como se espera (detalle en §7).

---

## 1. Principios

| #   | Principio                                                                                                                               | Implementación                                                                                                                                                     | Origen               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| 1   | Un esquema por módulo                                                                                                                   | `admin`, `catalog`, `purchasing`, `production`, `inventory`, `sales`, `distribution`, `pos`, `finance`, `accounting`, `platform`, `audit`, `assistant`, `telegram` | ADR-001              |
| 2   | Las reglas que pueden expresarse en la BD se expresan en la BD                                                                          | `CHECK`, `UNIQUE` parciales, FKs, triggers de solo-inserción, generados                                                                                            | PM §4.F              |
| 3   | Las reglas que dependen de contexto (permisos, umbrales, aprobaciones) viven en la capa de aplicación                                   | `authz`, `approvals`                                                                                                                                               | DEC-042              |
| 4   | Llaves primarias `uuid` (`gen_random_uuid()`); `bigserial` en tablas de alto volumen solo-inserción (kardex, auditoría, hechos, outbox) | —                                                                                                                                                                  | ADR-009, ADR-012     |
| 5   | Dinero `NUMERIC(14,2)`, cantidades `NUMERIC(14,3)`, costo unitario `NUMERIC(14,4)` mediante dominios `platform.money/qty/unit_cost`     | —                                                                                                                                                                  | ADR-008              |
| 6   | Fechas-hora `timestamptz` (UTC); fechas de negocio `date`                                                                               | —                                                                                                                                                                  | DR-004               |
| 7   | Tablas solo-inserción protegidas por trigger `platform.forbid_mutation()`                                                               | kardex, auditoría, asientos                                                                                                                                        | DEC-P10, DEC-P21     |
| 8   | Consecutivos legibles por tipo en `platform.document_sequences` (incremento con `UPDATE … RETURNING` dentro de la transacción)          | C-0418, OP-0042, D-301, V-1042                                                                                                                                     | DR-005               |
| 9   | FKs entre esquemas solo hacia maestros estables; el resto son "FK lógicas" validadas por el servicio dueño                              | p. ej. `inventory.reservations.sales_order_line_id`                                                                                                                | module-boundaries §3 |

## 2. Esquemas y tablas

| Esquema        | Tablas                                                                                                                                                                                                       | Notas                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`        | sites, locations, users, roles, permissions, role_permissions, user_roles, user_sites, approval_policies, approval_requests                                                                                  | Better Auth crea además sus tablas en el esquema `auth` (usuario, sesión, cuenta, verificación, dos factores); `admin.users.auth_user_id` las vincula |
| `catalog`      | products, presentations, price_history, raw_materials, recipes, recipe_versions, recipe_lines                                                                                                                | Recetas de producción y de platos comparten estructura (`kind`)                                                                                       |
| `purchasing`   | suppliers, purchases, purchase_lines, receipts                                                                                                                                                               | Sin columnas de impuestos (BLOCKED P-02)                                                                                                              |
| `inventory`    | lots, lot_inputs, stock_movements, stock_balances, transfers, transfer_lines, adjustments, reservations                                                                                                      | Núcleo transaccional (§4)                                                                                                                             |
| `production`   | orders, consumptions                                                                                                                                                                                         | El costo del lote PT queda `NULL` hasta P-03                                                                                                          |
| `sales`        | customers, orders, order_lines                                                                                                                                                                               | `delivered_qty ≤ ordered_qty`                                                                                                                         |
| `distribution` | dispatches, dispatch_lines, deliveries, delivery_lines, returns                                                                                                                                              | `settlements` **no se crea** hasta P-08                                                                                                               |
| `pos`          | cash_registers, shifts, shift_counts, sales, sale_lines, payments, kitchen_periods, kitchen_counts                                                                                                           | Diferencia de cocina como columna generada (BR-148)                                                                                                   |
| `finance`      | payment_methods, credit_terms, receivables, collections, payment_allocations, reconciliations                                                                                                                | Diferencia de conciliación generada (BR-177)                                                                                                          |
| `accounting`   | economic_events, periods, accounts, journal_entries, journal_lines                                                                                                                                           | Solo capa genérica (ADR-021)                                                                                                                          |
| `audit`        | audit_log                                                                                                                                                                                                    | Solo-inserción                                                                                                                                        |
| `platform`     | idempotency_keys, outbox, addon_settings, feature_flags, document_sequences                                                                                                                                  | —                                                                                                                                                     |
| `assistant`    | conversations (empleado, canal, `anthropic_session_id`, versión del agente, estado), tool_calls (`custom_tool_use_id` único), proposals, requests (consumo por turno: tokens, `list_cost`, `active_seconds`) | Opcional                                                                                                                                              |
| `telegram`     | link_codes, links, updates                                                                                                                                                                                   | Opcional                                                                                                                                              |

## 3. Restricciones que implementan reglas de negocio

| Regla                                | Restricción en BD                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| BR-004 aprobador ≠ solicitante       | `CHECK (decided_by <> requested_by)` en `approval_requests`; `CHECK (reviewed_by <> cashier_id)` en `shifts` |
| BR-020/021 composición de paquete    | `presentations.units_per > 0`; inmutabilidad con movimientos validada en aplicación                          |
| BR-022 un precio vigente             | índice único parcial `price_history (presentation_id) WHERE valid_to IS NULL`                                |
| BR-062 versión de receta             | `production.orders.recipe_version_id NOT NULL`; versión vigente única por índice parcial                     |
| BR-064 trazabilidad N:M              | `inventory.lot_inputs (output_lot_id, input_lot_id)`                                                         |
| BR-080 kardex inmutable              | trigger `stock_movements_append_only`                                                                        |
| BR-081 sin negativos                 | `stock_balances CHECK (quantity >= 0)` (sujeto a Q-B-08)                                                     |
| BR-112 pendiente ≥ 0                 | `order_lines CHECK (delivered_qty <= ordered_qty)`                                                           |
| BR-123 entrega ≤ cargado             | `dispatch_lines CHECK (delivered_qty <= loaded_qty)`                                                         |
| BR-141 un turno abierto              | índices únicos parciales por caja y por cajero `WHERE status = 'open'`                                       |
| BR-145 justificación                 | `CHECK (status <> 'closed_with_variance' OR variance_note IS NOT NULL)`                                      |
| BR-148 diferencia de cocina          | columna generada `variance_qty`                                                                              |
| BR-170 cupo ≥ 0                      | `credit_terms CHECK (credit_limit >= 0)`                                                                     |
| BR-172 vencimiento                   | `receivables CHECK (due_on >= issued_on)`                                                                    |
| BR-177 diferencia conciliación       | columna generada `variance`                                                                                  |
| BR-201 partida doble                 | constraint trigger diferido `journal_lines_balanced`                                                         |
| BR-202 período cerrado               | trigger `journal_entries_period_open`                                                                        |
| BR-005 / RNF-090 auditoría inmutable | trigger `audit_log_append_only` + permisos (ADR-013)                                                         |
| AP-01..03 obligatorias               | `approval_policies CHECK (NOT (is_mandatory AND NOT is_active))`                                             |

## 4. Estrategia transaccional de inventario (ADR-009)

**Toda salida de producto terminado** (venta POS, despacho, traslado) sigue este patrón dentro de la transacción del caso de uso:

```sql
-- 1. Lotes candidatos FEFO (BR-083, BR-086): vendibles, no vencidos, con disponible
SELECT b.lot_id, b.quantity AS available
FROM inventory.stock_balances b
JOIN inventory.lots l ON l.id = b.lot_id
WHERE b.location_id = $location AND b.presentation_id = $presentation
  AND l.status = 'available' AND (l.expires_on IS NULL OR l.expires_on >= current_date)
  AND b.quantity > 0
ORDER BY l.expires_on NULLS LAST, l.created_at, b.lot_id
FOR UPDATE OF b;                          -- bloquea las filas de saldo, en orden determinista

-- 2. La aplicación reparte la cantidad entre lotes (o usa el lote aprobado por excepción AP-03)
-- 3. Por cada lote asignado:
INSERT INTO inventory.stock_movements (...) VALUES (... -qty ...);
UPDATE inventory.stock_balances SET quantity = quantity - $qty, updated_at = now()
WHERE lot_id = $lot AND presentation_id = $presentation AND location_id = $location;
-- Si otro proceso consumió primero, el CHECK (quantity >= 0) aborta la transacción → 409 E-CONC
```

- **Nivel de aislamiento:** `READ COMMITTED` + bloqueos explícitos `FOR UPDATE` (suficiente y predecible). Las operaciones que leen un agregado completo (cierre de turno, liquidación) bloquean la raíz (`SELECT … FROM pos.shifts WHERE id = $1 FOR UPDATE`).
- **Interbloqueos:** se evitan bloqueando siempre en el mismo orden (`ORDER BY … lot_id`); si ocurren (`40P01`), el caso de uso se reintenta una vez automáticamente (es idempotente).
- **Conciliación nocturna (pg-boss):** compara `stock_balances.quantity` con `SUM(stock_movements.quantity)` por lote/presentación/ubicación y alerta diferencias.
- **Reservas:** se registran en `inventory.reservations` por **presentación y ubicación** (no por lote); el lote se decide al despachar por FEFO. **Disponible** (BR-085) = Σ saldos de lotes vendibles − Σ reservas activas. Al despachar, la salida consume la reserva en la misma transacción. Así no hay dos fuentes de verdad para lo reservado.

## 5. Índices principales

| Índice                                                            | Uso                                 |
| ----------------------------------------------------------------- | ----------------------------------- |
| `lots_fefo_idx (product_id, expires_on) WHERE status='available'` | Asignación FEFO                     |
| `stock_balances_location_idx (location_id) WHERE quantity > 0`    | Existencias por ubicación           |
| `stock_movements_lot_loc_idx`, `stock_movements_source_idx`       | Kardex y trazabilidad por documento |
| `sales_orders_open_idx (site_id, status) WHERE abiertos`          | Pedidos pendientes                  |
| `dispatches_driver_idx (driver_id, status)`                       | Portal del distribuidor             |
| `receivables_open_idx (customer_id, due_on) WHERE balance > 0`    | Cupo, mora y antigüedad de cartera  |
| `approval_requests_pending_idx`                                   | Bandeja de aprobaciones             |
| `audit_log_entity_idx`, `audit_log_user_idx`                      | Consulta de auditoría               |
| `reservations_active_idx`                                         | Disponibilidad con reservas         |
| `outbox_unpublished_idx`                                          | Trabajador de outbox                |
| `assistant_requests_usage_idx`                                    | Tablero de consumo IA               |

Índices adicionales se agregan con evidencia (`EXPLAIN ANALYZE`) en cada especificación.

## 6. Qué NO se crea todavía (PM §8.4)

| Elemento                                            | Motivo |
| --------------------------------------------------- | ------ |
| Columnas y tablas de impuestos, documentos fiscales | P-02   |
| Contenido del plan de cuentas, asiento de apertura  | P-04   |
| Reglas de contabilización (`posting_rules`)         | P-01   |
| Costo oficial de lotes PT y valoración              | P-03   |
| `distribution.settlements`                          | P-08   |
| Catálogo de clasificaciones de cocina               | P-07   |
| Descuentos, anulaciones POS, reembolsos             | P-09   |
| Tabla de vencidos/retiros (recall)                  | P-05   |

## 7. Validación ejecutada (2026-10-29)

`node sql/validate-schema.mjs sql/preliminary-schema.sql` sobre PGlite 0.5 (PostgreSQL embebido):

| Prueba                                           | Resultado                 |
| ------------------------------------------------ | ------------------------- |
| Esquema completo carga sin errores               | ✅ 79 tablas, 14 esquemas |
| Saldo negativo (BR-081)                          | ✅ rechazado              |
| Saldo duplicado por lote/presentación/ubicación  | ✅ rechazado              |
| Editar o borrar movimiento del kardex            | ✅ rechazados (2 pruebas) |
| Dos precios vigentes (BR-022)                    | ✅ rechazado              |
| Vencimiento anterior a fabricación               | ✅ rechazado              |
| Segundo turno abierto en la misma caja (BR-141)  | ✅ rechazado              |
| Cierre con diferencia sin justificación (BR-145) | ✅ rechazado              |
| Cajero revisa su propio turno (BR-004)           | ✅ rechazado              |
| Borrar auditoría                                 | ✅ rechazado              |
| Desactivar política obligatoria AP-01            | ✅ rechazado              |
| Aprobador = solicitante (BR-004)                 | ✅ rechazado              |
| Asiento desbalanceado (BR-201)                   | ✅ rechazado al confirmar |
| Asiento balanceado                               | ✅ aceptado               |
| Asiento en período cerrado (BR-202)              | ✅ rechazado              |
| Diferencia de cocina 40 + 20 − 15 − 42           | ✅ = 3                    |

Pendiente para Etapa F: pruebas de concurrencia (dos ventas simultáneas sobre el último saldo) con Testcontainers y PostgreSQL real, y pruebas de permisos de los roles de BD (ADR-013).

## 8. Implementación inicial (Etapa F, 2026-10-29)

- Migraciones reales en `apps/api/drizzle/`: `0000_platform_foundation` (esquemas `auth`, `platform`, `audit`) y `0001_append_only_and_grants` (trigger solo-inserción de auditoría y permisos condicionales por rol).
- Diferencia con el esquema preliminar: las tablas de plataforma (`idempotency_keys`, `audit_log`) usan `actor_id text` (identidad de autenticación) en lugar de FK a `admin.users`, porque `admin` aún no existe; al construir Administración se agrega `admin.users.auth_user_id` como vínculo.
- El historial de migraciones vive en el esquema `drizzle`.
- Verificado en PostgreSQL 17.6 real con roles separados: el rol de aplicación recibe _permission denied_ al intentar modificar la auditoría, y el rol dueño es detenido por el trigger.

## 9. Migraciones, respaldo y mantenimiento

- **Migraciones:** drizzle-kit genera SQL; cada migración se revisa, se versiona y se ejecuta en CI contra una BD vacía y contra una copia del esquema anterior. Las ejecuta el rol `quatreros_owner` en el despliegue, nunca la aplicación.
- **Datos semilla:** permisos, roles predefinidos (matriz aprobada), políticas AP, flags (todos los bloqueados en `false`), métodos de pago, consecutivos.
- **Respaldo:** PITR del proveedor + `pg_dump` diario cifrado a almacenamiento externo (RNF-041..045, `deployment-design.md`).
- **Crecimiento:** `audit_log` y `stock_movements` candidatas a particionado mensual cuando superen ~10 M de filas (no esperado en los primeros años con el volumen actual; revisar con P-11).
