# Especificación — Entrega 8: asistente de IA (demo)

> Estado: **BORRADOR — pendiente de aprobación** · 2026-11-03
> Cubre RF-340, RF-341, RF-342 (solo consultas), RF-344 y RF-345.
> **RF-343 no se implementa en esta entrega:** las escrituras asistidas siguen bloqueadas por P-10 y BR-234.
> Fuentes: DM §10, DEC-070..075, DEC-087, DEC-088, ADR-023, `ai-architecture.md` v0.2 §1–§16 y `roadmap-prototipo.md` entrega 8.
> No se escribe código hasta que el responsable apruebe las decisiones D1..D8 y la lista de consultas de la demo (Q-IA-01).

## 0. Decisiones que necesitan aprobación

| #   | Decisión                                                                                                                                                                                                                                         | Recomendación                                                                                      | Si no se aprueba                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D1  | **Alcance de la demo: solo lectura.** Se integran consultas en lenguaje natural sobre módulos existentes. No se habilitan `prepare_*`, propuestas ejecutables ni la tarjeta de confirmación de escritura (P-10).                                 | Aprobar lectura; dejar RF-343 para cuando se apruebe P-10.                                         | La demo no podría mostrar ninguna consulta real y la entrega quedaría vacía.   |
| D2  | **Consultas de la demo.** Cinco preguntas: existencias por presentación, lotes por vencer, saldo de un cliente, cartera vencida y pedidos pendientes de despacho. Q-IA-01 sigue abierta para la lista final.                                     | Aprobar estas cinco; son lecturas de módulos ya construidos y no exponen datos sensibles.          | Habría que elegir otro conjunto antes de implementar.                          |
| D3  | **Activación global.** `platform.addon_settings('assistant').is_enabled` manda. Apagado: `/assistant/*` responde 404 y la burbuja no se muestra. Solo Administrador con `adm.addon.toggle` lo cambia; el cambio se audita.                       | Aprobar. Es el mecanismo de RF-340 y no toca el núcleo (BR-235).                                   | Habría que crear otro interruptor o dejar el asistente siempre activo.         |
| D4  | **Identidad y permisos.** La identidad sale de la conversación y se recarga en cada herramienta. El modelo nunca recibe usuario, rol ni sede. Cada herramienta exige su permiso de lectura y el alcance por sede del usuario.                    | Aprobar. Es BR-230 y la regla de seguridad de `ai-architecture.md` §6 y §9.                        | No se podría garantizar aislamiento entre usuarios ni sedes.                   |
| D5  | **Privacidad de conversaciones.** Solo el dueño puede leer su conversación. El Administrador ve consumo agregado y metadatos, no el contenido de los mensajes.                                                                                   | Aprobar como [Ampliación]; agregar Q-IA-07 para dejarlo explícito.                                 | Habría que definir si el Administrador puede auditar conversaciones completas. |
| D6  | **Consumo y límites.** Techo mensual en `addon_settings.settings`, presupuesto por sesión en `ASSISTANT_SESSION_BUDGET_CENTS`, 6 llamadas a herramientas por turno, 60 s por turno y 30 mensajes/10 min por usuario. Valores iniciales PROPOSED. | Aprobar los valores de `ai-architecture.md` §7 para la demo; quedan configurables.                 | Habría que fijar otro techo antes de encender el asistente.                    |
| D7  | **Retención.** Metadatos y métricas propias en PostgreSQL; el historial de mensajes vive en Anthropic. Se archiva la conversación tras 24 h sin actividad y se borra en Anthropic a los 30 días (Q-IA-05).                                       | Aprobar la propuesta de retención; sin Zero Data Retention.                                        | Habría que definir otra política de privacidad y borrado.                      |
| D8  | **Sin datos simulados.** La semilla deja el complemento apagado y sin conversaciones. Si faltan credenciales, no se puede activar: `409 ASSISTANT_NOT_CONFIGURED`.                                                                               | Aprobar. La demo debe mostrar datos reales o estados vacíos honestos, nunca respuestas inventadas. | Habría que crear una conversación de demostración ficticia.                    |

## 1. Objetivo y alcance

Que un empleado autorizado pueda **preguntar en lenguaje natural** sobre existencias, lotes, clientes, cartera y pedidos, y recibir una respuesta construida por el backend con datos reales, permisos y sede del usuario. La conversación queda registrada para medir consumo; el núcleo sigue funcionando igual si el asistente se apaga.

**Incluye:**

- Activación y desactivación global del complemento por el Administrador.
- Conversaciones de un empleado por canal web, con sesión de Anthropic por conversación.
- Preguntas de lectura sobre módulos existentes mediante `ToolGateway`, sin SQL directo.
- Respuestas con los datos que devuelve el backend, no con texto inventado por el modelo.
- Medición de tokens, costo y duración por turno, usuario, modelo y operación.
- Techo mensual, presupuesto por sesión, límite de herramientas por turno y límite de tasa.
- Bandeja de consumo y configuración para el Administrador.
- Manejo de errores del proveedor sin afectar el núcleo.
- Estados vacíos, carga, error, sin permiso y complemento apagado.

**No incluye:**

| Tema                                                          | Motivo                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Escrituras asistidas, propuestas ejecutables y confirmaciones | RF-343 bloqueado por P-10 y BR-234; `feature.assistant.writes` off.   |
| Herramientas `prepare_*` y lista blanca de escrituras         | Q-IA-03 / Q-C-05; no se declaran herramientas sin aprobación.         |
| Telegram, voz y notificaciones proactivas                     | Entrega posterior / Q-TG; esta entrega es solo web y solo lectura.    |
| Alertas automáticas push de RF-342                            | Solo se responderán consultas sobre vencimientos y cartera vencida.   |
| Memoria del agente y datos de negocio en memory stores        | DEC-088: la memoria no es fuente de verdad.                           |
| Contabilidad, impuestos, costeo y documentos fiscales         | P-01..P-04 / P-02.                                                    |
| Modificar precios, permisos, crédito, inventario o caja       | Escrituras bloqueadas; el asistente solo lee.                         |
| Cambiar el prompt, el modelo o el agente desde el código      | `quatreros-ai/` se gobierna con `ant` y autorización del responsable. |

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura                                                                                |
| ------- | ---------------------------------------------------------------------------------------- |
| RF-340  | Activación global del asistente sin afectar el núcleo                                    |
| RF-341  | Consultas en lenguaje natural con herramientas de lectura y permisos                     |
| RF-342  | Cobertura parcial: consultas de vencimientos; alertas push fuera de alcance              |
| RF-344  | Registro y consulta de consumo por modelo, usuario, operación y período                  |
| RF-345  | Techo mensual, presupuesto por sesión, límites por turno y pausa                         |
| RF-343  | **Fuera de alcance**: bloqueado por P-10; se mantiene `feature.assistant.writes` apagado |
| BR-230  | Solo herramientas del backend, con permisos y sede del usuario                           |
| BR-231  | Escrituras con propuesta, resumen y confirmación (no se implementa)                      |
| BR-232  | Confirmación de una sola propuesta, de un solo uso y con expiración (futuro)             |
| BR-233  | El resultado comunicado proviene del backend, no del modelo                              |
| BR-234  | Escrituras asistidas deshabilitadas hasta aprobar la matriz de permisos                  |
| BR-235  | Apagar el asistente no afecta ninguna función del núcleo                                 |
| BR-236  | Consumo registrado por modelo, usuario, canal, operación y período                       |
| BR-237  | Límite técnico global con pausa y alerta al Administrador                                |
| RNF-022 | Solo se envían al proveedor los datos necesarios; sin otras sedes                        |
| RNF-111 | Costo de IA medido y reportado por separado del núcleo                                   |
| RNF-131 | Tiempo límite y reintentos solo en errores transitorios                                  |

## 3. Modelo de datos

Se crea el esquema `assistant` con cuatro tablas. Ninguna tabla del núcleo cambia. La identidad, el rol y la sede **no** se guardan en Anthropic; se resuelven desde PostgreSQL en cada llamada.

### 3.1 `assistant.conversations`

| Columna                | Tipo / regla                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `id`                   | `uuid` PK                                                              |
| `user_id`              | `uuid` FK lógica a `admin.users`; índice `(user_id, last_activity_at)` |
| `channel`              | `text`: `web` en esta entrega; el check admite `telegram` a futuro     |
| `anthropic_session_id` | `text` único, nullable mientras se crea                                |
| `agent_id`             | `text`; toma `ANTHROPIC_AGENT_ID`                                      |
| `agent_version`        | `text`; toma `ANTHROPIC_AGENT_VERSION` (vacío = última)                |
| `status`               | `text`: `provisioning`, `active`, `archived`, `terminated`             |
| `created_at`           | `timestamptz`                                                          |
| `last_activity_at`     | `timestamptz`; se actualiza en cada turno                              |

- Una conversación pertenece a un solo usuario y a un solo canal.
- `user_id` se toma del actor autenticado; el cliente nunca lo envía.
- Al desactivar un usuario, sus conversaciones pasan a `archived` y las propuestas abiertas a `cancelled`.

### 3.2 `assistant.tool_calls`

| Columna              | Tipo / regla                                       |
| -------------------- | -------------------------------------------------- |
| `id`                 | `uuid` PK                                          |
| `conversation_id`    | `uuid` FK a `assistant.conversations`              |
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

### 3.3 `assistant.proposals` (reservada, sin uso en esta entrega)

| Columna                | Tipo / regla                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                   | `uuid` PK                                                                                          |
| `conversation_id`      | `uuid` FK a `assistant.conversations`                                                              |
| `tool_name`            | `text`; solo `prepare_*` cuando se habilite                                                        |
| `arguments_hash`       | `text`; hash de argumentos normalizados                                                            |
| `summary`              | `jsonb`; resumen generado por el backend                                                           |
| `status`               | `text`: `draft`, `pending_confirmation`, `confirmed`, `executed`, `cancelled`, `expired`, `failed` |
| `expires_at`           | `timestamptz`                                                                                      |
| `executed_entity_type` | `text` nullable                                                                                    |
| `executed_entity_id`   | `uuid` nullable                                                                                    |
| `created_at`           | `timestamptz`                                                                                      |

- La tabla se crea para no bloquear la entrega futura, pero **no se insertan propuestas** ni se montan rutas de confirmación ejecutables.
- `feature.assistant.writes` permanece apagado; `POST /assistant/proposals/:id/confirm` responde `423 FEATURE_BLOCKED` con `blockedBy = "P-10"`.

### 3.4 `assistant.requests`

| Columna              | Tipo / regla                                                   |
| -------------------- | -------------------------------------------------------------- |
| `id`                 | `bigserial` PK                                                 |
| `conversation_id`    | `uuid` FK a `assistant.conversations`                          |
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

| Objeto                    | `quatreros_app`        | `quatreros_readonly` |
| ------------------------- | ---------------------- | -------------------- |
| `assistant.conversations` | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.tool_calls`    | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.proposals`     | SELECT, INSERT, UPDATE | SELECT               |
| `assistant.requests`      | SELECT, INSERT         | SELECT               |

- `assistant.requests` y `assistant.tool_calls` no se borran desde la aplicación.
- El Administrador no recibe permiso SQL especial: la privacidad se aplica en el caso de uso.

## 4. Contrato de API

Todas las rutas viven bajo `/api/v1/assistant`. Con el complemento apagado responden **404** y no se registran trabajos. La autenticación es la sesión normal; no hay claves de API en el navegador.

| Método y ruta                                 | Permiso                 | Descripción                                                 |
| --------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `POST /assistant/conversations`               | `ia.query`              | Crea una conversación y una sesión de Anthropic             |
| `GET /assistant/conversations`                | `ia.query`              | Lista las conversaciones del usuario autenticado            |
| `GET /assistant/conversations/{id}/messages`  | `ia.query`              | Historial de la conversación desde los eventos de Anthropic |
| `POST /assistant/conversations/{id}/messages` | `ia.query`              | Envía un mensaje y arranca un turno                         |
| `GET /assistant/conversations/{id}/stream`    | `ia.query`              | SSE del turno en curso; `Last-Event-ID` para reconectar     |
| `GET /assistant/usage`                        | `ia.usage.read`         | Consumo agregado y detalle por período, usuario y operación |
| `GET /assistant/settings`                     | `adm.addon.toggle`      | Estado, configuración y límites del complemento             |
| `PUT /assistant/settings`                     | `adm.addon.toggle`      | Activa/desactiva y actualiza techo, límites y alertas       |
| `POST /assistant/proposals/{id}/confirm`      | permiso de la operación | **Bloqueado en esta entrega**: `423 FEATURE_BLOCKED`        |
| `POST /assistant/proposals/{id}/cancel`       | permiso de la operación | **Bloqueado en esta entrega**: `423 FEATURE_BLOCKED`        |

### 4.1 Crear conversación

`POST /assistant/conversations` con `Idempotency-Key` obligatoria.

```json
{ "channel": "web" }
```

- El servidor ignora cualquier `userId`, `role` o `siteId` del cuerpo.
- Crea la sesión en Anthropic con `metadata` no personal (`app`, `env`, `conversation_id`, `user_ref`).
- Si faltan credenciales: `409 ASSISTANT_NOT_CONFIGURED`.
- Si el proveedor no responde: `503 ASSISTANT_UNAVAILABLE`; el núcleo no se afecta.
- Reintentar con la misma clave devuelve la misma conversación y no crea otra sesión.

### 4.2 Enviar mensaje

`POST /assistant/conversations/{id}/messages` con `Idempotency-Key` obligatoria.

```json
{ "text": "¿Cuánto chorizo Santarrosano hay en Bodega principal?" }
```

- Texto entre 1 y 2.000 caracteres; se rechaza vacío o solo espacios (`422 VALIDATION_FAILED`).
- Solo el dueño de la conversación puede escribir; otro usuario recibe `404` (no se revela que existe).
- Un solo turno activo por conversación. Si ya hay uno: `409 TURN_IN_PROGRESS`.
- Responde `202 { "turnId": "..." }`; el contenido llega por SSE.
- Reintentar con la misma clave no duplica el turno.

### 4.3 Stream SSE

`GET /assistant/conversations/{id}/stream` con `Accept: text/event-stream`.

Eventos:

| Evento              | Contenido                                            |
| ------------------- | ---------------------------------------------------- |
| `message.delta`     | Fragmento de texto del agente                        |
| `tool.started`      | `toolName` y argumentos normalizados (sin identidad) |
| `tool.completed`    | Resultado resumido y `status`                        |
| `message.completed` | Texto final y `requestId`                            |
| `usage.updated`     | Tokens, costo y duración del turno                   |
| `error`             | Código estable y mensaje para el usuario             |
| `heartbeat`         | Cada 15 s para mantener la conexión                  |

- `GET /assistant/conversations/{id}/messages` reconstruye el historial desde los eventos de Anthropic, con paginación; no se duplica el texto en PostgreSQL.
- `Last-Event-ID` permite reanudar sin repetir eventos ya vistos.
- Al reconectar, las llamadas `custom_tool_use` pendientes se responden por `custom_tool_use_id`; nunca se ejecutan dos veces.
- Si el turno supera 60 s, el backend envía `user.interrupt` y cierra con `error` `TURN_TIMEOUT`.

### 4.4 Consumo

`GET /assistant/usage?from=2026-11-01&to=2026-11-30&userId=&model=&operation=&limit=50`

- Solo `ia.usage.read` (Administrador).
- Devuelve totales (`requests`, `inputTokens`, `outputTokens`, `listCostCents`, `activeSeconds`) y filas paginadas.
- No devuelve el contenido de mensajes ni nombres de clientes.
- El costo se reporta separado del núcleo (RNF-111, DEC-082).

### 4.5 Configuración

`GET /assistant/settings`

```json
{
  "enabled": false,
  "configured": true,
  "settings": {
    "monthlyCapCents": 1000,
    "alertPct": [80, 100],
    "maxToolCallsPerTurn": 6,
    "turnTimeoutSeconds": 60,
    "messagesPerTenMinutes": 30,
    "sessionBudgetCents": 50
  }
}
```

`PUT /assistant/settings` acepta `{ "enabled": boolean, "settings": { ... } }`.

- Activar exige `ANTHROPIC_API_KEY`, `ANTHROPIC_AGENT_ID` y `ANTHROPIC_ENVIRONMENT_ID`; si faltan: `409 ASSISTANT_NOT_CONFIGURED`.
- El cambio se audita con `ia.settings.update` y el `before`/`after` sin secretos.
- Apagar no borra conversaciones ni métricas; solo oculta el asistente y bloquea las rutas.

### 4.6 Errores estables

| Código                     | HTTP | Cuándo                                                               |
| -------------------------- | ---- | -------------------------------------------------------------------- |
| `ASSISTANT_NOT_CONFIGURED` | 409  | Faltan credenciales o identificadores del agente                     |
| `ASSISTANT_UNAVAILABLE`    | 503  | Anthropic caído, sin respuesta o error transitorio agotado           |
| `TURN_IN_PROGRESS`         | 409  | Ya hay un turno activo en la conversación                            |
| `TURN_TIMEOUT`             | 504  | El turno superó el tiempo límite                                     |
| `RATE_LIMITED`             | 429  | Se superó el límite por usuario                                      |
| `BUDGET_REACHED`           | 409  | Se alcanzó el presupuesto de la sesión o el techo global             |
| `TOOL_LIMIT_REACHED`       | 409  | Se superaron las llamadas a herramientas permitidas por turno        |
| `FEATURE_BLOCKED`          | 423  | Confirmar una propuesta con `feature.assistant.writes` apagado       |
| `NOT_FOUND`                | 404  | Conversación de otro usuario, complemento apagado o ruta inexistente |

## 5. Catálogo de herramientas de lectura

El `ToolGateway` envuelve casos de uso existentes. No hay SQL en el asistente ni acceso directo a tablas del núcleo. Los esquemas de entrada **no** incluyen usuario, rol ni sede.

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

- La consulta de la demo usa cinco de estas herramientas; la lista final queda pendiente de Q-IA-01 (D2).
- `production_get_suggestions`, `production_get_yield_report`, `pos_get_shift_summary` y `reports_sales_summary` del diseño de IA **no se implementan** hasta que exista su caso de uso de lectura dedicado.
- Un resultado fuera de alcance por sede devuelve `404` tipado al modelo; el asistente explica que no tiene acceso y no reintenta con otro id.
- El resultado se recorta a los campos necesarios (RNF-022) y se marca como dato, no como instrucción.

## 6. Interfaz

### 6.1 Burbuja y panel existentes

Se reutiliza `AssistantWidget` (sistema de diseño, Parte 2 §5).

- **Apagado:** la burbuja no se muestra. El Administrador ve el estado en la pantalla de configuración.
- **Sin `ia.query`:** la burbuja no se muestra.
- **Activo:** burbuja circular, panel de 20 % en escritorio y pantalla completa en móvil; foco atrapado y `Escape` para cerrar.
- **Vacío:** mensaje "Pregúntame por existencias, lotes, cartera o pedidos" y las consultas sugeridas aprobadas.
- **Cargando:** indicador de turno en curso; el compositor se deshabilita mientras hay un turno.
- **Error:** alerta con el mensaje del backend y opción de reintentar; no se muestran trazas ni datos internos.
- **Fuente:** cada respuesta incluye un chip con la herramienta y el período consultado; el texto del modelo no se presenta como dato si no hay herramienta.
- **Consumo:** solo el Administrador ve el costo del turno en la pantalla de consumo, no en el chat.
- **Escrituras:** no hay botón de confirmación ni tarjeta de escritura. El pie del panel dice "Solo consultas; las escrituras esperan decisión (P-10)".

### 6.2 Administración

Nueva pantalla **Sistema → Actividad de IA**:

- Interruptor global con estado `configured`.
- Techo mensual, alertas al 80 % y 100 %, límite de herramientas, tiempo de turno y mensajes por ventana.
- Tabla de consumo por período, usuario, modelo y operación, con totales.
- No muestra el contenido de las conversaciones.

La sección `ia` de `config/modules.ts` deja de ser "próximamente" y muestra el módulo disponible para ADM.

### 6.3 Accesibilidad

- Se agrega la pantalla de asistente y la de consumo a `apps/web/e2e/accesibilidad.spec.ts`.
- Axe AA sin hallazgos en escritorio, tableta y móvil; sin desplazamiento horizontal.
- El panel respeta `prefers-reduced-motion`; los mensajes nuevos se anuncian con `aria-live="polite"`.

## 7. Auditoría y eventos

- `ia.settings.update`: auditado con `before`/`after` y sin secretos.
- `ia.conversation.create`: auditado con `conversationId`, `userId` y canal.
- `assistant.tool_calls`: registro técnico de cada herramienta, argumentos normalizados, resultado mínimo y duración.
- `assistant.requests`: consumo por turno; solo inserción.
- No se emiten hechos económicos: las consultas no cambian inventario, dinero ni contabilidad.
- No se guarda el texto completo de los mensajes en PostgreSQL; vive en la sesión de Anthropic según la retención aprobada.

## 8. Criterios de aceptación

```gherkin
Característica: Asistente de IA de solo lectura

Escenario: El administrador activa el asistente
  Dado que las credenciales de Anthropic están configuradas
  Cuando el Administrador activa el complemento
  Entonces la API responde 200 y el cambio queda auditado
  Y la burbuja del asistente aparece para los usuarios con ia.query

Escenario: El complemento está apagado
  Dado que el Administrador apagó el asistente
  Cuando un usuario intenta abrir una conversación
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

Escenario: Consumo medido
  Dado un turno completado
  Cuando el Administrador consulta el consumo
  Entonces ve tokens, costo, duración, usuario y operación del turno
  Y el costo se reporta separado del núcleo

Escenario: Límite de gasto alcanzado
  Dado que el techo mensual está configurado
  Cuando el consumo lo alcanza
  Entonces el asistente queda en pausa
  Y el Administrador recibe una alerta
  Y el núcleo sigue operando

Escenario: Conversación privada
  Dado un usuario con una conversación activa
  Cuando otro usuario intenta leerla o escribir en ella
  Entonces recibe 404
  Y no se revela su existencia

Escenario: Mensaje duplicado
  Dado un mensaje enviado con una Idempotency-Key
  Cuando el cliente reintenta con la misma clave
  Entonces recibe el mismo turno
  Y no se ejecuta dos veces la herramienta

Escenario: Escritura bloqueada
  Dado que feature.assistant.writes está apagado
  Cuando alguien intenta confirmar una propuesta
  Entonces la API responde 423 FEATURE_BLOCKED con blockedBy P-10
  Y no se modifica ningún dato

Escenario: Proveedor no disponible
  Dado que Anthropic no responde
  Cuando el usuario envía un mensaje
  Entonces ve "El asistente no está disponible"
  Y puede seguir usando el ERP, el POS y la ruta
```

## 9. Pruebas

- **Unitarias:** selección de herramienta por nombre, normalización de argumentos, identidad tomada de la conversación, denegación por permiso, alcance por sede, límites por turno, estados de propuesta, cálculo de consumo y formato de fechas.
- **Integración (PostgreSQL real):** activación/desactivación, conversación de un usuario, aislamiento entre usuarios, herramienta permitida/denegada, consumo insertado, techo alcanzado, mensaje idempotente y reconexión de stream.
- **Integración con Anthropic simulado:** eventos grabados de `agent.custom_tool_use`, `message.delta`, `session.usage` y error; sin llamadas reales en CI.
- **E2E:** Administrador activa el asistente, usuario pregunta por existencias, ve la fuente, cierra sesión; Administrador revisa consumo; complemento apagado oculta la burbuja; axe AA en escritorio, tableta y móvil.
- **Seguridad:** inyección de instrucciones en un nombre de cliente no ejecuta herramientas; el modelo no recibe identidad; una conversación de otra sede no filtra datos; una propuesta bloqueada no modifica datos.

## 10. Condiciones para comenzar

1. Aprobar D1..D8 y las consultas de la demo (Q-IA-01).
2. Aprobar el techo de gasto y el presupuesto por sesión (Q-IA-02, Q-C-06).
3. Confirmar el modelo y la evaluación (Q-IA-06).
4. Definir retención y borrado de sesiones (Q-IA-05).
5. Autorizar quién ejecuta `ant apply` y con qué espacio de trabajo (Q-IA-04). **No se ejecuta `ant apply` en esta entrega.**
6. Configurar `ANTHROPIC_API_KEY`, `ANTHROPIC_AGENT_ID`, `ANTHROPIC_ENVIRONMENT_ID` y, si aplica, `ANTHROPIC_AGENT_VERSION` en el entorno de desarrollo.
7. Aprobar la privacidad de conversaciones (Q-IA-07).

## 11. Definición de Terminado

- Migración `assistant` aplicada en una base vacía y en la base demo.
- Complemento apagado por defecto; activarlo sin credenciales devuelve `ASSISTANT_NOT_CONFIGURED`.
- Las cinco consultas aprobadas funcionan con datos reales y respetan permisos y sede.
- Las ocho herramientas de lectura quedan detrás de `ToolGateway`; ninguna consulta usa SQL directo.
- SSE, idempotencia, reconexión y un solo turno por conversación probados.
- Consumo, techo y pausa implementados y visibles para el Administrador.
- RF-343 sigue bloqueado: `feature.assistant.writes` apagado y confirmación con `423 FEATURE_BLOCKED`.
- `pnpm check`, integración PGlite, integración PostgreSQL real, `pnpm build` y E2E en verde.
- Documentación actualizada: `HANDOFF.md`, `PROJECT-STATUS.md`, roadmap, matriz de trazabilidad y `open-questions.md` (Q-IA-07).
- Nada de `ant apply`, cambios de prompt, modelo o herramientas del agente sin autorización del responsable.
