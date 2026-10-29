# Diseño de la API

> Etapa C · v0.1 · 2026-10-29
> API HTTP JSON única para web (ERP, POS, portal), asistente y Telegram. Contratos en `packages/contracts` con Zod 4 y OpenAPI 3.1 generado (ADR-006).

---

## 1. Convenciones

| Aspecto                | Estándar                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base                   | `/api/v1`                                                                                                                                             |
| Versionado             | En la ruta (`v1`). Cambios incompatibles → `v2` conviviendo mientras el frontend migra. Campos nuevos opcionales no cambian versión                   |
| Recursos               | Sustantivos en inglés, plural, `kebab-case`: `/inventory/stock-balances`, `/sales/orders`                                                             |
| Comandos de negocio    | Sub-recurso verbal con `POST` cuando no es CRUD: `/sales/orders/{id}/confirm`, `/pos/shifts/{id}/close`, `/distribution/dispatches/{id}/dispatch-out` |
| Identificadores        | `uuid` en rutas; los consecutivos legibles (`number`) se muestran y se pueden buscar con filtro                                                       |
| JSON                   | `camelCase`; fechas ISO 8601 con zona (`2026-10-29T16:30:00Z`); fechas de negocio `YYYY-MM-DD`                                                        |
| Dinero y cantidades    | **Cadenas decimales** (`"12000.00"`, `"2.500"`), nunca números (ADR-008)                                                                              |
| Cantidades             | Siempre con presentación o unidad: `{ "presentationId": "…", "quantity": "2" }`                                                                       |
| Autenticación          | Cookie de sesión (Better Auth) `HttpOnly; Secure; SameSite=Lax`; protección CSRF con token en cabecera para métodos no seguros                        |
| Idempotencia           | Cabecera **`Idempotency-Key: <uuid>`** obligatoria en escrituras con efecto en inventario, dinero o cartera (ADR-010)                                 |
| Concurrencia optimista | `ETag` / `If-Match` en ediciones de maestros (producto, cliente, receta)                                                                              |
| Zona horaria           | El servidor trabaja en UTC; las fechas de negocio se calculan en `America/Bogota`                                                                     |

## 2. Paginación, filtros y orden

```
GET /api/v1/sales/orders?status=confirmed,partially_delivered&customerId=…&from=2026-10-01&to=2026-10-31&sort=-createdAt&limit=50&cursor=eyJpZCI6…
```

- **Paginación por cursor** (estable con inserciones): `limit` (máx. 100, por defecto 50) y `cursor` opaco. Respuesta:

```json
{ "data": [ … ], "page": { "nextCursor": "eyJpZCI6…", "limit": 50 } }
```

- Filtros con nombres de campo; listas separadas por coma; rangos `from`/`to`.
- `sort` con `-` para descendente; solo campos indexados permitidos (lista blanca por endpoint).
- Reportes con exportación: `GET …/export?format=xlsx` (asíncrono si supera umbral; devuelve `202` + id de trabajo).

## 3. Errores

Formato único inspirado en RFC 9457 (Problem Details):

```json
{
  "type": "https://quatreros.app/errors/credit-limit-exceeded",
  "title": "Cupo de crédito excedido",
  "status": 409,
  "code": "CREDIT_LIMIT_EXCEEDED",
  "detail": "El pedido supera el cupo disponible del cliente en $300.000.",
  "requestId": "req_7f3a…",
  "errors": [{ "path": "lines[0].quantity", "code": "too_small", "message": "Debe ser mayor que 0" }],
  "approval": { "required": true, "policy": "AP-01", "requestId": null }
}
```

| HTTP | Código interno (ejemplos)                                                                                               | Cuándo                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 400  | `MALFORMED_REQUEST`                                                                                                     | JSON inválido, cabecera faltante                                                  |
| 401  | `UNAUTHENTICATED`, `MFA_REQUIRED`                                                                                       | Sin sesión o sin segundo factor                                                   |
| 403  | `FORBIDDEN`                                                                                                             | Sin permiso (`E-PERM`)                                                            |
| 404  | `NOT_FOUND`                                                                                                             | No existe **o pertenece a una sede no asignada** (`E-SITE`, no revela existencia) |
| 409  | `CONFLICT`, `INSUFFICIENT_STOCK`, `CREDIT_LIMIT_EXCEEDED`, `OVERDUE_RECEIVABLES`, `SHIFT_NOT_OPEN`, `CONCURRENT_UPDATE` | Regla de negocio o concurrencia (`E-CONC`)                                        |
| 412  | `PRECONDITION_FAILED`                                                                                                   | `If-Match` no coincide                                                            |
| 422  | `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REUSED`                                                                           | Validación por campo (`E-VAL`); misma clave con cuerpo distinto                   |
| 423  | `FEATURE_BLOCKED`                                                                                                       | Funcionalidad deshabilitada por decisión pendiente (incluye `blockedBy: "P-06"`)  |
| 428  | `IDEMPOTENCY_KEY_REQUIRED`                                                                                              | Falta la cabecera en escritura crítica                                            |
| 429  | `RATE_LIMITED`                                                                                                          | Límite de peticiones                                                              |
| 500  | `INTERNAL`                                                                                                              | Error no controlado (sin detalles internos; `requestId` para soporte)             |

- Los mensajes (`title`, `detail`) están en **español** y dicen qué hacer (RNF-074).
- **Excepciones de negocio que requieren aprobación** responden `409` con `approval.required = true`; el cliente puede reenviar la misma operación con `"approvalReason": "…"` para crear la solicitud (`202 Accepted` + `approvalRequestId`).

## 4. Autorización en la API

1. Middleware de autenticación resuelve `ExecutionContext` (usuario, roles, sedes, canal, MFA verificado).
2. Cada ruta declara el permiso requerido: `route.post('/pos/sales', requires('pos.sale.create'), handler)`.
3. El **caso de uso** vuelve a verificar alcance (`SITE`/`OWN`) contra el recurso concreto (no basta con el middleware).
4. Las consultas de listado aplican `authz.scopeFilter()` (las filas de otras sedes no se devuelven ni se cuentan).
5. Ninguna ruta confía en `siteId` enviado por el cliente sin verificar que el usuario lo tiene asignado.

## 5. Mapa de endpoints (v1, principal)

| Módulo       | Endpoint                                                                               | Método         | Permiso                                                    | RF                     |
| ------------ | -------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------- | ---------------------- |
| auth         | `/auth/*` (Better Auth: sign-in, sign-out, two-factor, reset)                          | —              | —                                                          | RF-001, RF-002         |
| admin        | `/admin/users`, `/admin/users/{id}`                                                    | GET POST PATCH | `adm.user.*`                                               | RF-003                 |
| admin        | `/admin/roles`, `/admin/permissions`                                                   | GET POST PATCH | `adm.user.*`                                               | RF-004                 |
| admin        | `/admin/sites`, `/admin/locations`                                                     | GET POST PATCH | `adm.site.*`                                               | RF-005                 |
| admin        | `/admin/approval-policies/{code}`                                                      | GET PATCH      | `adm.approval_policy.*`                                    | RF-006                 |
| admin        | `/admin/approval-requests`, `/{id}/approve`, `/{id}/reject`                            | GET POST       | según política                                             | RF-007                 |
| admin        | `/admin/audit-log`                                                                     | GET            | `adm.audit.read`                                           | RF-008                 |
| catalog      | `/catalog/products`, `/catalog/products/{id}/presentations`                            | GET POST PATCH | `cat.product.*`                                            | RF-030                 |
| catalog      | `/catalog/raw-materials`                                                               | GET POST PATCH | `cat.raw_material.*`                                       | RF-031                 |
| catalog      | `/catalog/presentations/{id}/prices`                                                   | GET POST       | `cat.price.update`                                         | RF-032                 |
| catalog      | `/catalog/recipes`, `/catalog/recipes/{id}/versions`                                   | GET POST       | `prod.recipe.*` / `pos.dish_recipe.*`                      | RF-033, RF-225         |
| purchasing   | `/purchasing/suppliers`                                                                | GET POST PATCH | `comp.supplier.*`                                          | RF-050                 |
| purchasing   | `/purchasing/purchases`, `/{id}/receipts`, `/{id}/void`                                | GET POST       | `comp.purchase.*`, `comp.receipt.create`                   | RF-051–053             |
| production   | `/production/suggestions`                                                              | GET            | `prod.suggestion.read`                                     | RF-080                 |
| production   | `/production/orders`, `/{id}/start`, `/{id}/consumptions`, `/{id}/close`, `/{id}/void` | GET POST       | `prod.order.*`                                             | RF-081–084             |
| inventory    | `/inventory/stock-balances`, `/inventory/availability`                                 | GET            | `inv.stock.read`                                           | RF-110                 |
| inventory    | `/inventory/movements`                                                                 | GET            | `inv.stock.read`                                           | RF-111                 |
| inventory    | `/inventory/fefo-allocations` (simulación)                                             | POST           | `inv.stock.read`                                           | RF-112                 |
| inventory    | `/inventory/transfers`, `/{id}/receive`                                                | GET POST       | `inv.transfer.*`                                           | RF-114                 |
| inventory    | `/inventory/physical-counts`, `/inventory/adjustments`                                 | GET POST       | `inv.count.create`, `inv.adjustment.create`                | RF-115                 |
| inventory    | `/inventory/package-openings`                                                          | POST           | `inv.package.open` — **423 hasta P-06**                    | RF-116                 |
| inventory    | `/inventory/lots/{id}/block`, `/unblock`                                               | POST           | `inv.lot.block`                                            | RF-117                 |
| inventory    | `/inventory/lots/{id}/traceability`                                                    | GET            | `inv.traceability.read`                                    | RF-118                 |
| sales        | `/sales/customers`                                                                     | GET POST PATCH | `com.customer.*`                                           | RF-150                 |
| sales        | `/sales/orders`, `/{id}/confirm`, `/{id}/cancel` (423 hasta P-09)                      | GET POST       | `com.order.*`                                              | RF-151–153             |
| distribution | `/distribution/dispatches`, `/{id}/dispatch-out`, `/{id}/finish-route`                 | GET POST       | `dis.dispatch.*`                                           | RF-180, RF-181         |
| distribution | `/distribution/my-dispatches` (portal)                                                 | GET            | `dis.dispatch.read@OWN`                                    | RF-182                 |
| distribution | `/distribution/deliveries`                                                             | POST           | `dis.delivery.register`                                    | RF-183                 |
| distribution | `/distribution/returns`, `/{id}/inspect`                                               | GET POST       | `dis.return.*`                                             | RF-185                 |
| distribution | `/distribution/dispatches/{id}/settlement`                                             | GET POST       | **423 hasta P-08**                                         | RF-186                 |
| pos          | `/pos/shifts`, `/{id}/close`, `/{id}/review`                                           | GET POST       | `pos.shift.*`, `pos.cash_variance.review`                  | RF-220, RF-223, RF-224 |
| pos          | `/pos/sales`                                                                           | GET POST       | `pos.sale.create`                                          | RF-221, RF-222         |
| pos          | `/pos/kitchen-periods`, `/{id}/counts`                                                 | GET POST       | `pos.kitchen_count.create`                                 | RF-226                 |
| finance      | `/finance/customers/{id}/credit-terms`                                                 | GET PUT        | `fin.credit.configure`                                     | RF-260                 |
| finance      | `/finance/customers/{id}/credit-check`                                                 | POST           | interno/consulta                                           | RF-261                 |
| finance      | `/finance/receivables`, `/finance/receivables/aging`                                   | GET            | `fin.receivable.read`                                      | RF-262                 |
| finance      | `/finance/collections`                                                                 | GET POST       | `fin.collection.register`, `fin.receivable_payment.create` | RF-184, RF-263, RF-264 |
| finance      | `/finance/reconciliations`                                                             | GET POST       | `fin.reconciliation.*`                                     | RF-265                 |
| reports      | `/reports/{name}` + `/export`                                                          | GET            | `rep.operational.read`                                     | RF-266                 |
| accounting   | `/accounting/economic-events`                                                          | GET            | `cont.report.read`                                         | RF-303                 |
| accounting   | `/accounting/accounts`, `/periods`, `/journal-entries`                                 | GET POST       | `cont.*`                                                   | RF-300–302             |
| accounting   | `/accounting/reports/{name}`                                                           | GET            | `cont.report.read`                                         | RF-305                 |
| platform     | `/platform/imports/{template}` (validar, previsualizar, confirmar)                     | POST           | `adm.user.*` (ADM)                                         | RF-375                 |
| platform     | `/platform/files` (subida firmada)                                                     | POST           | según contexto                                             | DR-024                 |
| assistant    | `/assistant/messages`, `/assistant/proposals/{id}/confirm`, `/cancel`                  | POST           | `ia.query`, permiso de la operación                        | RF-341, RF-343         |
| assistant    | `/assistant/usage`, `/assistant/settings`                                              | GET PUT        | `ia.usage.read`, `adm.addon.toggle`                        | RF-344, RF-345         |
| telegram     | `/integrations/telegram/webhook/{secret}`                                              | POST           | firma de Telegram                                          | RF-372                 |
| telegram     | `/telegram/link-codes`, `/telegram/link` (DELETE)                                      | POST DELETE    | `tg.link`                                                  | RF-370                 |
| ops          | `/health`, `/ready`                                                                    | GET            | público / interno                                          | RNF-093                |

## 6. Ejemplo de contrato: registrar entrega (RF-183)

```http
POST /api/v1/distribution/deliveries
Idempotency-Key: 6b1f8b52-2a1d-4c43-9c8a-9a1e2f0d7c11
Content-Type: application/json

{
  "dispatchId": "0f6c…",
  "orderId": "a91d…",
  "lines": [ { "dispatchLineId": "c3e2…", "quantity": "6" } ],
  "partialReason": "Cliente solo recibió 6 por espacio en nevera"
}
```

```json
201 Created
{
  "data": {
    "id": "5d0a…", "isPartial": true,
    "order": { "number": "P-0088", "status": "partially_delivered",
               "lines": [ { "presentation": "Paquete x10", "ordered": "10", "delivered": "6", "pending": "4" } ] },
    "receivable": { "number": "CxC-0213", "amount": "72000.00", "dueOn": "2026-11-13" }
  }
}
```

Errores posibles: `404` despacho no asignado al distribuidor (`OWN`), `409 QUANTITY_EXCEEDS_LOADED`, `409 DISPATCH_NOT_IN_ROUTE`, `422` validación, `428` sin `Idempotency-Key`; reintento con la misma clave → `201` con la misma respuesta (BR-007).

## 7. Validación

- Toda entrada se valida en el servidor con el esquema Zod del contrato (`strict`: campos desconocidos rechazados).
- La validación de **forma** (Zod) es distinta de la validación de **negocio** (dominio): la primera da `422`, la segunda `409`.
- Límites de tamaño: cuerpo JSON 1 MB; archivos 10 MB por subida (imágenes, PDF, XLSX), tipo verificado por contenido.

## 8. Documentación

- OpenAPI 3.1 generado desde los contratos en cada build; publicado con Scalar en `/api/docs` en `local` y `staging` (en producción solo para ADM autenticado o deshabilitado).
- Cada endpoint documenta: permiso, si exige `Idempotency-Key`, códigos de error de negocio y el RF que implementa.
