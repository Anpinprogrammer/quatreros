# Integraciones

> Etapa B · v0.1 · 2026-10-29
> Integraciones externas previstas, su estado y lo que bloquea su diseño. Ninguna integración es dependencia del núcleo para operar, salvo la facturación si el contador confirma que es obligatoria en el momento de la venta (P-02).
> La selección de proveedores concretos se hace en Etapa C (ADR), con verificación de costo y mantenimiento.

---

## Resumen

| ID     | Integración                                     | Tipo                       | ¿Núcleo?                        | Estado           | Bloqueo                       |
| ------ | ----------------------------------------------- | -------------------------- | ------------------------------- | ---------------- | ----------------------------- |
| INT-01 | Facturación electrónica / documento equivalente | Salida, síncrona o en cola | Depende de P-02                 | BLOCKED          | P-02, Q-CON-03                |
| INT-02 | Proveedor de modelos de IA                      | Salida                     | No (opcional)                   | PROPOSED         | P-14                          |
| INT-03 | Correo transaccional                            | Salida                     | Sí (recuperación, invitaciones) | PROPOSED         | Q-INF-02b                     |
| INT-04 | Telegram Bot API                                | Entrada/salida (webhook)   | No (opcional)                   | PROPOSED         | P-13                          |
| INT-05 | Transcripción de voz                            | Salida                     | No (opcional)                   | PENDING          | P-13, P-14                    |
| INT-06 | Almacenamiento de archivos privado              | Infraestructura            | Sí (soportes)                   | PROPOSED         | P-12                          |
| INT-07 | Importación/exportación Excel                   | Archivos                   | Sí                              | PROPOSED         | —                             |
| INT-08 | Canales de pedido (WhatsApp, etc.)              | Entrada                    | No                              | Fuera de alcance | DEC-007                       |
| INT-09 | Bancos / pasarelas / datáfonos                  | —                          | No                              | Fuera de alcance | Q-CON (conciliación bancaria) |

---

## INT-01 — Facturación electrónica y documentos fiscales

- **Propósito:** emitir los documentos fiscales que correspondan a ventas POS y entregas a clientes.
- **Estado:** BLOCKED. No se conocen las obligaciones efectivas, el mecanismo actual ni el proveedor tecnológico (DM §9; P-02; Q-CON-02, Q-CON-03).
- **Requisitos de diseño ya definibles (PROPOSED):**
  - Adaptador desacoplado (`FiscalDocumentProvider`) para poder cambiar de proveedor.
  - La venta se registra aunque la emisión falle; el documento queda en cola con reintentos y estado visible (RNF-133).
  - Los comprobantes internos no se presentan como fiscales (BR-150).
  - Emisión idempotente por venta.
- **Requerimientos relacionados:** RF-221, BR-150, BR-206, RNF-133.

## INT-02 — Proveedor de modelos de IA

- **Propósito:** interpretación de lenguaje natural y selección de herramientas para el asistente.
- **Estado:** PROPOSED. No se congela proveedor ni modelo hasta evaluar costo y calidad (DEC-P13); el DM menciona Hermes/OpenRouter como opción no validada.
- **Requisitos (PROPOSED):**
  - Capa de abstracción de proveedor; modelo configurable (RNF-134).
  - Medición de tokens y costo por solicitud (RF-344).
  - Techo global y límite de iteraciones (RF-345).
  - Tiempo límite y degradación: si el proveedor falla, el asistente informa indisponibilidad; el núcleo sigue (RNF-130).
  - Solo se envían los datos que las herramientas devuelven al usuario autorizado (RNF-022).
- **Evaluación pendiente (Etapa D):** 2–3 modelos con un conjunto fijo de casos de la demo (Q-IA-01), comparando exactitud de herramientas, latencia y costo por solicitud.

## INT-03 — Correo transaccional

- **Propósito:** invitaciones de usuario, recuperación de contraseña, alertas al administrador.
- **Estado:** PROPOSED; proveedor con plan gratuito o de bajo costo a elegir en Etapa C.
- **Requisitos:** plantillas en español; no incluir datos sensibles en el cuerpo; dominio propio recomendado (Q-INF-02b).

## INT-04 — Telegram Bot API

- **Propósito:** canal remoto para consultas, comandos, notificaciones (p. ej. solicitudes de aprobación) y, con IA, lenguaje natural.
- **Estado:** PROPOSED; funciones sin IA PENDING (P-13).
- **Requisitos (PROPOSED):**
  - Webhook HTTPS con verificación del token secreto de Telegram.
  - Idempotencia por `update_id` (RNF-132).
  - Vinculación de cuenta por código de un solo uso (RF-370, BR-250).
  - Todas las acciones pasan por los mismos servicios de negocio y permisos (BR-251).
  - Activación independiente (RF-371).

## INT-05 — Transcripción de voz

- **Propósito:** convertir audios de Telegram (y eventualmente de la web) en texto.
- **Estado:** PENDING. Su costo y si se ofrece sin IA contratada no están definidos (C-07, Q-TG-02).
- **Requisitos (PROPOSED):** no conservar el audio tras transcribir (DR-022); mostrar la transcripción al usuario antes de usarla para una escritura.

## INT-06 — Almacenamiento de archivos privado

- **Propósito:** soportes de compras, transferencias, devoluciones y plantillas de carga.
- **Estado:** PROPOSED (DEC-P04); proveedor según hosting (Etapa C).
- **Requisitos:** acceso solo por permiso; enlaces firmados temporales; tamaño y tipos de archivo limitados; incluido en la política de respaldo.

## INT-07 — Importación y exportación Excel

- **Propósito:** carga inicial (RF-375), importación del plan de cuentas (RF-300), exportación de reportes (RF-266, RF-305).
- **Estado:** PROPOSED.
- **Requisitos:** validación completa antes de aplicar; todo o nada (BR-008); plantillas versionadas.

## INT-08 / INT-09 — Fuera del alcance actual

- **Canales de pedido:** se registran manualmente indicando el canal (DEC-007, Q-COM-05). Integraciones futuras deberán crear pedidos por la misma API.
- **Bancos, pasarelas y datáfonos:** no hay integración prevista; los pagos no efectivos se registran manualmente. La conciliación bancaria dentro del sistema depende del cuestionario al contador.
