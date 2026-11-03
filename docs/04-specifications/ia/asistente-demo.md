# Especificación — Entrega 8: asistente de IA (demo)

> Estado: **APROBADA** · 2026-11-03 (D1..D8 aprobadas por el responsable; DEC-106)
> Cubre RF-340, RF-341, RF-342 (solo consultas), RF-343 (lista blanca limitada), RF-344 y RF-345.
> Fuentes: DM §10, DEC-070..075, DEC-087, DEC-088, DEC-106, ADR-023, `ai-architecture.md` v0.2 §1–§16 y `roadmap-prototipo.md` entrega 8.
> Alcance aprobado: consultas de lectura + **dos escrituras preparadas** (materia prima y receta inicial). El resto de escrituras sigue bloqueado por P-10.

## 0. Decisiones aprobadas

| #   | Decisión                                                                                                                                                                                                                                                                                           | Estado   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | **Alcance mixto controlado.** Se habilitan todas las lecturas y **dos escrituras preparadas**: crear materia prima y crear receta con su primera versión. No se habilitan versiones nuevas de receta ni otras escrituras. El flujo es propuesta → resumen → confirmación humana → ejecución única. | Aprobada |
| D2  | **Consultas de la demo.** Cinco preguntas: existencias por presentación, lotes por vencer, saldo de un cliente, cartera vencida y pedidos pendientes de despacho.                                                                                                                                  | Aprobada |
| D3  | **Activación global.** `platform.addon_settings('assistant').is_enabled` manda. Apagado: `/assistant/*` responde 404 y la burbuja no se muestra. Solo Administrador con `adm.addon.toggle` lo cambia; el cambio se audita.                                                                         | Aprobada |
| D4  | **Identidad y permisos.** La identidad sale del ticket/sesión y se recarga en cada herramienta. El modelo nunca recibe usuario, rol ni sede. Cada herramienta exige su permiso y el alcance por sede del usuario. Es BR-230; no requiere una acción del responsable.                               | Aprobada |
| D5  | **Privacidad.** Solo el dueño puede leer su ticket y sus mensajes. El Administrador ve consumo agregado y metadatos, no el contenido de las conversaciones.                                                                                                                                        | Aprobada |
| D6  | **Consumo y límites.** Presupuesto por sesión USD 0,25; diario USD 3; semanal USD 10; mensual USD 30. Alertas al 80 % y 100 %. Máximo 6 llamadas a herramientas por turno, 60 s por turno y 30 mensajes/10 min por usuario.                                                                        | Aprobada |
| D7  | **Tickets, no conversaciones completas.** Cada sesión deja un ticket con el texto de la petición inicial, un resumen de resolución con la herramienta usada, el resultado, el costo y las fechas. No se guarda la transcripción completa en PostgreSQL.                                            | Aprobada |
| D8  | **Sin datos simulados.** La semilla deja el complemento apagado y sin tickets. Si faltan credenciales, no se puede activar: `409 ASSISTANT_NOT_CONFIGURED`.                                                                                                                                        | Aprobada |

## 1. Objetivo y alcance

Que un empleado autorizado pueda **preguntar en lenguaje natural** sobre existencias, lotes, clientes, cartera y pedidos, y **preparar dos operaciones básicas** —crear una materia prima o una receta inicial— con confirmación humana. Las respuestas y los resultados provienen del backend, con los permisos y la sede del usuario. El núcleo sigue funcionando igual si el asistente se apaga.

**Incluye:**

- Activación y desactivación global del complemento por el Administrador.
- Tickets de un empleado por canal web, con sesión de Anthropic por ticket.
- Preguntas de lectura sobre módulos existentes mediante `ToolGateway`, sin SQL directo.
- Preparación de materia prima y receta inicial con resumen del backend y confirmación explícita.
- Ejecución única e idempotente de la propuesta confirmada, con auditoría y revalidación.
- Medición de tokens, costo y duración por turno, usuario, modelo y operación.
- Techo diario, semanal y mensual, presupuesto por sesión, límite de herramientas y de tasa.
- Bandeja de tickets y pantalla de consumo/configuración para el Administrador.
- Manejo de errores del proveedor sin afectar el núcleo.
- Estados vacíos, carga, error, sin permiso y complemento apagado.

**No incluye:**

| Tema                                                     | Motivo                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Otras escrituras asistidas                               | P-10 sigue abierto para pagos, precios, inventario, caja y contabilidad |
| Versiones nuevas de receta                               | D1: solo la receta inicial; `prepare_recipe_version` queda fuera        |
| Compras, pedidos, traslados, pagos y ajustes por IA      | No están en la lista blanca de DEC-106                                  |
| Telegram, voz y notificaciones proactivas                | Entrega posterior / Q-TG; esta entrega es web                           |
| Alertas automáticas push de RF-342                       | Solo se responderán consultas sobre vencimientos y cartera vencida      |
| Memoria del agente y datos de negocio en memory stores   | DEC-088: la memoria no es fuente de verdad                              |
| Contabilidad, impuestos, costeo y documentos fiscales    | P-01..P-04 / P-02                                                       |
| Cambiar el prompt, el modelo o el agente desde el código | `quatreros-ai/` se gobierna con `ant` y autorización del responsable    |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- |
| RF-340  | Activación global del asistente sin afectar el núcleo                                           |
| RF-341  | Consultas en lenguaje natural con herramientas de lectura y permisos                            |
| RF-342  | Cobertura parcial: consultas de vencimientos; alertas push fuera de alcance                     |
| RF-343  | Cobertura parcial: dos escrituras preparadas con confirmación humana (materia prima y receta)   |
| RF-344  | Registro y consulta de consumo por modelo, usuario, operación y período                         |
| RF-345  | Techos diario/semanal/mensual, presupuesto por sesión, límites por turno y pausa                |
| BR-230  | Solo herramientas del backend, con permisos y sede del usuario                                  |
| BR-231  | Escrituras con propuesta validada, resumen estructurado y confirmación explícita                |
| BR-232  | Confirmación de una sola propuesta exacta, de un solo uso y con expiración (10 min provisional) |
| BR-233  | El resultado comunicado proviene del backend, no del modelo                                     |
| BR-234  | Escrituras limitadas a la lista blanca aprobada por DEC-106                                     |
| BR-235  | Apagar el asistente no afecta ninguna función del núcleo                                        |
| BR-236  | Consumo registrado por modelo, usuario, canal, operación y período                              |
| BR-237  | Límite técnico global con pausa y alerta al Administrador                                       |
| RNF-022 | Solo se envían al proveedor los datos necesarios; sin otras sedes                               |
| RNF-111 | Costo de IA medido y reportado por separado del núcleo                                          |
| RNF-131 | Tiempo límite y reintentos solo en errores transitorios                                         |
| DEC-106 | Lista blanca limitada: materia prima y receta inicial; el resto de escrituras sigue bloqueado   |

## 3. Modelo de datos

Se crea el esquema `assistant` con cuatro tablas. Ninguna tabla del núcleo cambia. La identidad, el rol y la sede **no** se guardan en Anthropic; se resuelven desde PostgreSQL en cada llamada.

### 3.1 `assistant.tickets`

Un ticket representa una sesión de conversación. Es la unidad que se muestra en la pestaña del ERP.

| Columna                | Tipo / regla                                                                 |
| ---------------------- | ---------------------------------------------------------------------------- |
| `id`                   | `uuid` PK                                                                    |
| `user_id`              | `uuid` FK lógica a `admin.users`; índice `(user_id, last_activity_at)`       |
| `channel`              | `text`: `web` en esta entrega; el check admite `telegram` a futuro           |
| `anthropic_session_id` | `text` único, nullable mientras se crea                                      |
| `agent_id`             | `text`; toma `ANTHROPIC_AGENT_ID`                                            |
| `agent_version`        | `text`; toma `ANTHROPIC_AGENT_VERSION` (vacío = última)                      |
| `status`               | `text`: `provisioning`, `active`, `closed`, `archived`, `terminated`         |
| `request_text`         | `text NOT NULL`, máximo 1.000 caracteres; primera petición del empleado      |
| `resolution_summary`   | `text` nullable; resumen del backend con la herramienta usada y el resultado |
| `tools_used`           | `text[] NOT NULL DEFAULT '{}'`                                               |
| `result_status`        | `text`: `completed`, `failed`, `cancelled`, `budget_reached`, `pending`      |
| `cost_cents`           | `integer >= 0`; suma de `assistant.requests` del ticket                      |
| `started_at`           | `timestamptz`                                                                |
| `last_activity_at`     | `timestamptz`; se actualiza en cada turno                                    |
| `closed_at`            | `timestamptz` nullable                                                       |

- Un ticket pertenece a un solo usuario y a un solo canal.
- `request_text` se toma del primer mensaje del empleado; no se guardan los mensajes intermedios.
- `resolution_summary` lo genera el backend al cerrar el ticket e incluye la herramienta usada y el identificador real del resultado (por ejemplo, “Materia prima MP-0007 creada con `prepare_raw_material`”).
- Al desactivar un usuario, sus tickets pasan a `archived` y las propuestas abiertas a `cancelled`.

### 3.2 `assistant.tool_calls`

| Columna              | Tipo / regla                                       |
| -------------------- | -------------------------------------------------- |
| `id`                 | `uuid` PK                                          |
| `ticket_id`          | `uuid` FK a `assistant.tickets`                    |
| `custom_tool_use_id` | `text` único; id del evento de Anthropic           |
| `tool_name`          | `text`; nombre `snake_case` del catálogo           |
| `arguments`          | `jsonb`; argumentos normalizados, sin identidad    |
| `result`             | `jsonb`; resultado mínimo devuelto al modelo       |
| `status`             | `text`: `running`, `succeeded`, `failed`, `denied` |
| `error_code`         | `text` nullable                                    |
| `duration_ms`        | `integer` nullable                                 |
| `created_at`         | `timestamptz`                                      |

- `custom_tool_use_id` evita ejecutar dos veces la misma llamada al reconectar el stream.
- El resultado guardado es el que recibió el modelo, filtrado por permisos y sede.

### 3.3 `assistant.proposals`

| Columna                | Tipo / regla                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                   | `uuid` PK                                                                                          |
| `ticket_id`            | `uuid` FK a `assistant.tickets`                                                                    |
| `tool_name`            | `text`: `prepare_raw_material` o `prepare_recipe`                                                  |
| `arguments_hash`       | `text`; hash de argumentos normalizados                                                            |
| `summary`              | `jsonb`; resumen generado por el backend                                                           |
| `status`               | `text`: `draft`, `pending_confirmation`, `confirmed`, `executed`, `cancelled`, `expired`, `failed` |
| `expires_at`           | `timestamptz`; 10 minutos desde la creación (Q-B-03 provisional)                                   |
| `executed_entity_type` | `text` nullable: `catalog.raw_material` o `catalog.recipe`                                         |
| `executed_entity_id`   | `uuid` nullable                                                                                    |
| `created_at`           | `timestamptz`                                                                                      |
| `confirmed_at`         | `timestamptz` nullable                                                                             |

- Solo se crean propuestas para las dos herramientas de la lista blanca.
- Confirmar exige una acción humana del mismo usuario dueño del ticket.
- La ejecución usa el `Idempotency-Key` igual al `id` de la propuesta y revalida permisos, hash, expiración y datos.
- Una propuesta ejecutada no se vuelve a ejecutar; una confirmación duplicada devuelve el resultado ya guardado.

### 3.4 `assistant.requests`

| Columna              | Tipo / regla                                                   |
| -------------------- | -------------------------------------------------------------- |
| `id`                 | `bigserial` PK                                                 |
| `ticket_id`          | `uuid` FK a `assistant.tickets`                                |
| `user_id`            | `uuid`; copia denormalizada para consultas de consumo          |
| `model`              | `text`                                                         |
| `input_tokens`       | `integer >= 0`                                                 |
| `output_tokens`      | `integer >= 0`                                                 |
| `cache_read_tokens`  | `integer >= 0`                                                 |
| `cache_write_tokens` | `integer >= 0`                                                 |
| `list_cost_cents`    | `integer >= 0`; centavos de USD                                |
| `active_seconds`     | `numeric(10,3) >= 0`                                           |
| `tool_names`         | `text[]`                                                       |
| `operation`          | `text` nullable; por ejemplo `inventory_get_availability`      |
| `result`             | `text`: `completed`, `failed`, `budget_reached`, `interrupted` |
| `created_at`         | `timestamptz`                                                  |

- Índices `(user_id, created_at)`, `(created_at)` y `(model, created_at)` para el tablero.
- La tabla es de solo inserción; no se actualiza desde la aplicación.
- El consumo se calcula con la diferencia de `session.usage` de cada turno.

### 3.5 Permisos

| Objeto                 | `quatreros_app`        | `quatreros_readonly` |
| ---------------------- | ---------------------- | -------------------- |
| `assistant.tickets`    | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.tool_calls` | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.proposals`  | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.requests`   | SELECT, INSERT         | SELECT               |

- `assistant.requests` no se borra desde la aplicación.
- El Administrador no recibe permiso SQL especial: la privacidad se aplica en el caso de uso.

## 4. Contrato de API

Todas las rutas viven bajo `/api/v1/assistant`. Con el complemento apagado responden **404** y no se registran trabajos. La autenticación es la sesión normal; no hay claves de API en el navegador.

| Método y ruta                            | Permiso                 | Descripción                                                 |
| ---------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `POST /assistant/tickets`                | `ia.query`              | Crea un ticket y una sesión de Anthropic                    |
| `GET /assistant/tickets`                 | `ia.query`              | Lista los tickets del usuario autenticado                   |
| `GET /assistant/tickets/{id}/messages`   | `ia.query`              | Historial de la conversación desde los eventos de Anthropic |
| `POST /assistant/tickets/{id}/messages`  | `ia.query`              | Envía un mensaje y arranca un turno                         |
| `GET /assistant/tickets/{id}/stream`     | `ia.query`              | SSE del turno en curso; `Last-Event-ID` para reconectar     |
| `GET /assistant/usage`                   | `ia.usage.read`         | Consumo agregado y detalle por período, usuario y operación |
| `GET /assistant/settings`                | `adm.addon.toggle`      | Estado, configuración y límites del complemento             |
| `PUT /assistant/settings`                | `adm.addon.toggle`      | Activa/desactiva y actualiza techos, límites y alertas      |
| `POST /assistant/proposals/{id}/confirm` | permiso de la operación | Confirma y ejecuta una propuesta de la lista blanca         |
| `POST /assistant/proposals/{id}/cancel`  | permiso de la operación | Cancela una propuesta pendiente                             |

### 4.1 Crear ticket

`POST /assistant/tickets` con `Idempotency-Key` obligatoria.

```json
{ "channel": "web", "requestText": "Necesito crear la materia prima Tocino ahumado" }
```

- El servidor ignora cualquier `userId`, `role` o `siteId` del cuerpo.
- `requestText` es obligatorio, entre 1 y 1.000 caracteres; se guarda como `request_text`.
- Crea la sesión en Anthropic con `metadata` no personal (`app`, `env`, `ticket_id`, `user_ref`).
- Si faltan credenciales: `409 ASSISTANT_NOT_CONFIGURED`.
- Si el proveedor no responde: `503 ASSISTANT_UNAVAILABLE`; el núcleo no se afecta.
- Reintentar con la misma clave devuelve el mismo ticket y no crea otra sesión.

### 4.2 Enviar mensaje

`POST /assistant/tickets/{id}/messages` con `Idempotency-Key` obligatoria.

```json
{ "text": "¿Cuánto chorizo Santarrosano hay en Bodega principal?" }
```

- Texto entre 1 y 2.000 caracteres; se rechaza vacío o solo espacios (`422 VALIDATION_FAILED`).
- Solo el dueño del ticket puede escribir; otro usuario recibe `404`.
- Un solo turno activo por ticket. Si ya hay uno: `409 TURN_IN_PROGRESS`.
- Responde `202 { "turnId": "..." }`; el contenido llega por SSE.
- Reintentar con la misma clave no duplica el turno.

### 4.3 Stream SSE

`GET /assistant/tickets/{id}/stream` con `Accept: text/event-stream`.

| Evento              | Contenido                                            |
| ------------------- | ---------------------------------------------------- |
| `message.delta`     | Fragmento de texto del agente                        |
| `tool.started`      | `toolName` y argumentos normalizados (sin identidad) |
| `tool.completed`    | Resultado resumido y `status`                        |
| `proposal.created`  | `proposalId`, resumen y expiración                   |
| `message.completed` | Texto final y `requestId`                            |
| `usage.updated`     | Tokens, costo y duración del turno                   |
| `error`             | Código estable y mensaje para el usuario             |
| `heartbeat`         | Cada 15 s para mantener la conexión                  |

- `GET /assistant/tickets/{id}/messages` reconstruye el historial desde los eventos de Anthropic, con paginación; no se duplica la transcripción en PostgreSQL.
- `Last-Event-ID` permite reanudar sin repetir eventos ya vistos.
- Al reconectar, las llamadas `custom_tool_use` pendientes se responden por `custom_tool_use_id`; nunca se ejecutan dos veces.
- Si el turno supera 60 s, el backend envía `user.interrupt` y cierra con `error` `TURN_TIMEOUT`.

### 4.4 Confirmar o cancelar una propuesta

`POST /assistant/proposals/{id}/confirm` y `/cancel`.

- Solo el dueño del ticket puede confirmar o cancelar.
- `confirm` valida que el complemento y `feature.assistant.writes` estén activos, que la herramienta esté en la lista blanca, que la propuesta no haya expirado, que el hash coincida y que el usuario siga teniendo el permiso.
- La ejecución llama al mismo caso de uso de la UI (`createRawMaterial` o `createRecipe`) con `channel = assistant` y `proposal_id`.
- Éxito: `200 { "status": "executed", "entityId": "...", "summary": "..." }`.
- Confirmación duplicada: `200` con el resultado ya ejecutado; no vuelve a crear nada.
- Propuesta expirada: `409 PROPOSAL_EXPIRED`.
- Hash distinto: `409 PROPOSAL_STALE`.
- Herramienta fuera de la lista blanca o flag apagado: `423 FEATURE_BLOCKED` con `blockedBy = "P-10"`.

### 4.5 Consumo

`GET /assistant/usage?from=2026-11-01&to=2026-11-30&userId=&model=&operation=&limit=50`

- Solo `ia.usage.read` (Administrador).
- Devuelve totales (`requests`, `inputTokens`, `outputTokens`, `listCostCents`, `activeSeconds`) y filas paginadas.
- No devuelve el contenido de los tickets ni nombres de clientes.
- El costo se reporta separado del núcleo (RNF-111, DEC-082).

### 4.6 Configuración

`GET /assistant/settings`

```json
{
  "enabled": false,
  "configured": true,
  "settings": {
    "sessionBudgetCents": 25,
    "dailyCapCents": 300,
    "weeklyCapCents": 1000,
    "monthlyCapCents": 3000,
    "alertPct": [80, 100],
    "maxToolCallsPerTurn": 6,
    "turnTimeoutSeconds": 60,
    "messagesPerTenMinutes": 30
  }
}
```

`PUT /assistant/settings` acepta `{ "enabled": boolean, "settings": { ... } }`.

- Activar exige `ANTHROPIC_API_KEY`, `ANTHROPIC_AGENT_ID` y `ANTHROPIC_ENVIRONMENT_ID`; si faltan: `409 ASSISTANT_NOT_CONFIGURED`.
- El cambio se audita con `ia.settings.update` y el `before`/`after` sin secretos.
- Apagar no borra tickets ni métricas; solo oculta el asistente y bloquea las rutas.
- Los techos son acumulativos: al alcanzar cualquiera, el asistente se pausa y alerta al Administrador.

### 4.7 Errores estables

| Código                     | HTTP | Cuándo                                                         |
| -------------------------- | ---- | -------------------------------------------------------------- |
| `ASSISTANT_NOT_CONFIGURED` | 409  | Faltan credenciales o identificadores del agente               |
| `ASSISTANT_UNAVAILABLE`    | 503  | Anthropic caído, sin respuesta o error transitorio agotado     |
| `TURN_IN_PROGRESS`         | 409  | Ya hay un turno activo en el ticket                            |
| `TURN_TIMEOUT`             | 504  | El turno superó el tiempo límite                               |
| `RATE_LIMITED`             | 429  | Se superó el límite por usuario                                |
| `BUDGET_REACHED`           | 409  | Se alcanzó el presupuesto de sesión o un techo global          |
| `TOOL_LIMIT_REACHED`       | 409  | Se superaron las llamadas a herramientas permitidas por turno  |
| `PROPOSAL_EXPIRED`         | 409  | La propuesta superó los 10 minutos                             |
| `PROPOSAL_STALE`           | 409  | Los argumentos o permisos cambiaron desde que se propuso       |
| `PROPOSAL_ALREADY_HANDLED` | 409  | La propuesta ya fue cancelada o ejecutada con otro resultado   |
| `FEATURE_BLOCKED`          | 423  | Escritura fuera de la lista blanca o flag apagado              |
| `NOT_FOUND`                | 404  | Ticket de otro usuario, complemento apagado o ruta inexistente |

## 5. Catálogo de herramientas

El `ToolGateway` envuelve casos de uso existentes. No hay SQL en el asistente ni acceso directo a tablas del núcleo. Los esquemas de entrada **no** incluyen usuario, rol ni sede.

### 5.1 Lectura

| Herramienta (`snake_case`)        | Caso de uso                         | Permiso                 | Entrega |
| --------------------------------- | ----------------------------------- | ----------------------- | ------- |
| `inventory_get_availability`      | `listAvailability`                  | `inv.stock.read`        | 2       |
| `inventory_get_expiring_lots`     | `listLots` con `expiresBefore`      | `inv.stock.read`        | 2       |
| `inventory_trace_lot`             | `traceLot`                          | `inv.traceability.read` | 2       |
| `catalog_search_products`         | `listProducts`                      | `cat.product.read`      | 2       |
| `sales_list_open_orders`          | `listOrders` con estados pendientes | `com.order.read`        | 5       |
| `sales_search_customers`          | `listCustomers`                     | `com.customer.read`     | 5       |
| `finance_get_customer_balance`    | `getCustomerBalance`                | `fin.receivable.read`   | 7       |
| `finance_get_overdue_receivables` | `agingReport` / cartera vencida     | `fin.receivable.read`   | 7       |

La consulta de la demo usa cinco de estas herramientas: existencias, lotes por vencer, saldo de cliente, cartera vencida y pedidos pendientes.

### 5.2 Escritura preparada (lista blanca DEC-106)

| Herramienta (`snake_case`) | Caso de uso         | Permiso                   | Propuesta                                                        |
| -------------------------- | ------------------- | ------------------------- | ---------------------------------------------------------------- |
| `prepare_raw_material`     | `createRawMaterial` | `cat.raw_material.manage` | Nombre, unidad base y si controla vencimiento                    |
| `prepare_recipe`           | `createRecipe`      | `prod.recipe.manage`      | Producto fabricado, cantidad base, rendimiento y materias primas |

- `prepare_raw_material` recibe `{ name, unit, tracksExpiry }`; el resumen muestra nombre, unidad y control de vencimiento.
- `prepare_recipe` recibe `{ productId, baseOutputQty, expectedYieldPct?, tolerancePct?, lines: [{ rawMaterialId, quantity }] }`; el resumen muestra producto, cantidad base y cada materia prima con su cantidad.
- El agente debe resolver nombres a ids con las herramientas de lectura (`catalog_search_products`, `sales_search_customers` y la lista de materias primas). Un id inexistente o inactivo se rechaza en `prepare`.
- No existe `prepare_recipe_version` en esta entrega.
- Cualquier otra escritura (`prepare_purchase`, `prepare_sales_order`, `prepare_transfer`, `prepare_payment`, precios, permisos, crédito, ajustes, anulaciones) se rechaza con `423 FEATURE_BLOCKED`.

### 5.3 Límites del despacho

- Identidad recargada desde el ticket en cada llamada; si el usuario está inactivo, `403`.
- Permiso y sede de la herramienta; fuera de alcance `404`.
- Máximo 6 llamadas por turno; al superarlo, `is_error` y `user.interrupt`.
- Resultados de lectura recortados a los campos necesarios (RNF-022) y marcados como dato, no como instrucción.
- Las propuestas expiran a los 10 minutos y se ejecutan una sola vez.

## 6. Interfaz

### 6.1 Burbuja y panel existentes

Se reutiliza `AssistantWidget` (sistema de diseño, Parte 2 §5).

- **Apagado:** la burbuja no se muestra. El Administrador ve el estado en la configuración.
- **Sin `ia.query`:** la burbuja no se muestra.
- **Activo:** burbuja circular, panel de 20 % en escritorio y pantalla completa en móvil; foco atrapado y `Escape` para cerrar.
- **Vacío:** mensaje "Pregúntame por existencias, lotes, cartera o pedidos; también puedo preparar materias primas y recetas".
- **Cargando:** indicador de turno en curso; el compositor se deshabilita mientras hay un turno.
- **Error:** alerta con el mensaje del backend y opción de reintentar; sin trazas ni datos internos.
- **Fuente:** cada respuesta incluye un chip con la herramienta y el período consultado.
- **Escritura:** cuando el agente prepara una materia prima o una receta, aparece la tarjeta `AIActionConfirmation` con el resumen del backend, la consecuencia y los botones **Cancelar** y **Confirmar y guardar**.
- **Confirmación:** tras confirmar, se muestra el identificador real devuelto por el backend; nunca el texto del modelo.
- **Pie del panel:** "Consultas y preparación de materias primas/recetas. Nada se guarda sin tu confirmación."

### 6.2 Tickets

Pestaña **Sistema → Actividad de IA → Tickets**:

- Lista los tickets del usuario autenticado.
- Cada fila muestra: fecha, petición inicial, resumen de resolución, herramienta usada, resultado y costo.
- No muestra la transcripción completa ni mensajes intermedios.
- El Administrador no ve el contenido; solo el consumo agregado.

### 6.3 Administración

Pantalla **Sistema → Actividad de IA** para ADM:

- Interruptor global con estado `configured`.
- Presupuesto por sesión y techos diario, semanal y mensual.
- Alertas al 80 % y 100 %, límite de herramientas, tiempo de turno y mensajes por ventana.
- Tabla de consumo por período, usuario, modelo y operación, con totales.
- No muestra el contenido de los tickets.

### 6.4 Accesibilidad

- Se agregan la pantalla de tickets, la de consumo y la tarjeta de confirmación a `apps/web/e2e/accesibilidad.spec.ts`.
- Axe AA sin hallazgos en escritorio, tableta y móvil; sin desplazamiento horizontal.
- El panel respeta `prefers-reduced-motion`; los mensajes nuevos se anuncian con `aria-live="polite"`.

## 7. Auditoría y eventos

- `ia.settings.update`: auditado con `before`/`after` y sin secretos.
- `ia.ticket.create`: auditado con `ticketId`, `userId` y canal.
- `ia.proposal.create`, `ia.proposal.confirm` y `ia.proposal.cancel`: auditados con `proposalId`, herramienta y resultado.
- La ejecución de una propuesta usa el mismo caso de uso de la UI; el audit existente (`cat.raw_material.create` o `prod.recipe.create`) queda con `channel = assistant` y `proposal_id`.
- `assistant.requests`: consumo por turno; solo inserción.
- No se emiten hechos económicos por consultas. La creación de materia prima o receta no mueve inventario ni dinero.
- No se guarda la transcripción completa en PostgreSQL; viven el texto inicial y el resumen del ticket.

## 8. Criterios de aceptación

```gherkin
Característica: Asistente de IA con consultas y escrituras preparadas

Escenario: El administrador activa el asistente
  Dado que las credenciales de Anthropic están configuradas
  Cuando el Administrador activa el complemento
  Entonces la API responde 200 y el cambio queda auditado
  Y la burbuja del asistente aparece para los usuarios con ia.query

Escenario: El complemento está apagado
  Dado que el Administrador apagó el asistente
  Cuando un usuario intenta abrir un ticket
  Entonces la ruta responde 404
  Y el POS, el ERP y el portal de ruta siguen funcionando

Escenario: Consulta de existencias con alcance por sede
  Dado un usuario con inv.stock.read en Bodega principal
  Cuando pregunta "¿cuánto chorizo Santarrosano hay?"
  Entonces el backend ejecuta inventory_get_availability sin recibir usuario ni sede del modelo
  Y la respuesta muestra la cantidad disponible y la fuente
  Y no incluye existencias de otra sede

Escenario: Consulta sin permiso
  Dado un cajero sin fin.receivable.read
  Cuando pregunta por la cartera vencida
  Entonces la herramienta devuelve un error de permiso tipado
  Y el asistente explica que no tiene acceso
  Y no revela datos de cartera

Escenario: Consulta de cartera vencida
  Dado un Manager con fin.receivable.read en su sede
  Cuando pregunta "¿qué cartera está vencida hoy?"
  Entonces el backend ejecuta finance_get_overdue_receivables
  Y la respuesta lista solo obligaciones de su sede

Escenario: Preparar una materia prima
  Dado un usuario con cat.raw_material.manage
  Cuando pide crear la materia prima "Tocino ahumado" en kilogramos con vencimiento
  Entonces el agente ejecuta prepare_raw_material
  Y aparece una tarjeta con nombre, unidad y control de vencimiento
  Y no se crea nada hasta confirmar

Escenario: Confirmar la materia prima
  Dado el resumen de la materia prima
  Cuando el usuario confirma
  Entonces el backend crea la materia prima una sola vez
  Y devuelve el identificador real
  Y el ticket guarda el resumen con la herramienta usada

Escenario: Preparar una receta inicial
  Dado un usuario con prod.recipe.manage
  Cuando pide una receta de chorizo con materias primas y cantidades
  Entonces el agente resuelve los ids con herramientas de lectura
  Y ejecuta prepare_recipe
  Y muestra producto, cantidad base e ingredientes antes de confirmar

Escenario: Escritura fuera de la lista blanca
  Dado que el usuario pide registrar un pago
  Cuando el agente intenta una herramienta no autorizada
  Entonces el backend responde 423 FEATURE_BLOCKED con blockedBy P-10
  Y no se modifica ningún dato

Escenario: Propuesta expirada
  Dado un resumen de escritura sin confirmar
  Cuando pasan más de 10 minutos
  Entonces confirmar responde 409 PROPOSAL_EXPIRED
  Y no se ejecuta nada

Escenario: Confirmación duplicada
  Dado un resumen ya confirmado
  Cuando el usuario vuelve a confirmar
  Entonces recibe el mismo resultado
  Y no se crea otro registro

Escenario: Consumo medido
  Dado un turno completado
  Cuando el Administrador consulta el consumo
  Entonces ve tokens, costo, duración, usuario y operación
  Y el costo se reporta separado del núcleo

Escenario: Techo alcanzado
  Dado que el techo diario, semanal o mensual está configurado
  Cuando el consumo lo alcanza
  Entonces el asistente queda en pausa
  Y el Administrador recibe una alerta
  Y el núcleo sigue operando

Escenario: Ticket privado
  Dado un usuario con un ticket activo
  Cuando otro usuario intenta leerlo o escribir en él
  Entonces recibe 404
  Y no se revela su existencia

Escenario: Ticket con resumen de resolución
  Dado un ticket terminado
  Cuando el dueño abre la pestaña de tickets
  Entonces ve la petición inicial, el resumen con la herramienta usada, el resultado y el costo
  Y no ve la transcripción completa

Escenario: Mensaje duplicado
  Dado un mensaje enviado con una Idempotency-Key
  Cuando el cliente reintenta con la misma clave
  Entonces recibe el mismo turno
  Y no se ejecuta dos veces la herramienta

Escenario: Proveedor no disponible
  Dado que Anthropic no responde
  Cuando el usuario envía un mensaje
  Entonces ve "El asistente no está disponible"
  Y puede seguir usando el ERP, el POS y la ruta
```

## 9. Pruebas

- **Unitarias:** selección de herramienta por nombre, normalización de argumentos, identidad tomada del ticket, denegación por permiso, alcance por sede, límites por turno, estados de propuesta, hash y expiración, cálculo de consumo, resumen de ticket y formato de fechas.
- **Integración (PostgreSQL real):** activación/desactivación, ticket de un usuario, aislamiento entre usuarios, herramienta permitida/denegada, consumo insertado, techo alcanzado, mensaje idempotente, creación de materia prima, creación de receta, confirmación duplicada, propuesta expirada y escritura fuera de lista blanca.
- **Integración con Anthropic simulado:** eventos grabados de `agent.custom_tool_use`, `message.delta`, `session.usage` y error; sin llamadas reales en CI.
- **E2E:** Administrador activa el asistente, usuario pregunta por existencias, ve la fuente; usuario prepara una materia prima y confirma; usuario prepara una receta y confirma; Administrador revisa consumo; complemento apagado oculta la burbuja; axe AA en escritorio, tableta y móvil.
- **Seguridad:** inyección de instrucciones en un nombre de cliente no ejecuta herramientas; el modelo no recibe identidad; un ticket de otra sede no filtra datos; una escritura fuera de la lista blanca no modifica datos; confirmar dos veces no duplica.

## 10. Condiciones para comenzar

1. Registrar DEC-106 en el registro de decisiones y la matriz de trazabilidad. **Hecho con esta especificación.**
2. Confirmar el modelo y la evaluación (Q-IA-06).
3. Definir retención y borrado de sesiones (Q-IA-05).
4. Autorizar quién ejecuta `ant apply` y con qué espacio de trabajo (Q-IA-04). **No se ejecuta `ant apply` en esta entrega.**
5. Configurar `ANTHROPIC_API_KEY`, `ANTHROPIC_AGENT_ID`, `ANTHROPIC_ENVIRONMENT_ID` y, si aplica, `ANTHROPIC_AGENT_VERSION` en el entorno de desarrollo.
6. Mantener P-10 abierto para cualquier escritura fuera de la lista blanca de DEC-106.

## 11. Definición de Terminado

- Migración `assistant` aplicada en una base vacía y en la base demo.
- Complemento apagado por defecto; activarlo sin credenciales devuelve `ASSISTANT_NOT_CONFIGURED`.
- Las cinco consultas aprobadas funcionan con datos reales y respetan permisos y sede.
- Las ocho herramientas de lectura y las dos de escritura preparada quedan detrás de `ToolGateway`; ninguna consulta usa SQL directo.
- La creación de materia prima y receta funciona solo con propuesta, resumen, confirmación humana, revalidación, idempotencia y auditoría.
- Cualquier otra escritura responde `423 FEATURE_BLOCKED`.
- SSE, idempotencia, reconexión y un solo turno por ticket probados.
- Consumo, techos diario/semanal/mensual y pausa implementados y visibles para el Administrador.
- Tickets con petición inicial, resumen de resolución, herramienta, resultado y costo; sin transcripción completa.
- `pnpm check`, integración PGlite, integración PostgreSQL real, `pnpm build` y E2E en verde.
- Documentación actualizada: `HANDOFF.md`, `PROJECT-STATUS.md`, roadmap, matriz de trazabilidad y `open-questions.md`.
- Nada de `ant apply`, cambios de prompt, modelo o herramientas del agente sin autorización del responsable.
