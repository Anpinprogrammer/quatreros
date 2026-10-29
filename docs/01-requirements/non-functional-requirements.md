# Requerimientos no funcionales

> Etapa B · v0.1 · 2026-10-29
> **Todos los valores numéricos son propuestas medibles con estado `PENDING` hasta su aprobación** (PM §7). Están dimensionados para 6–15 usuarios (DEC-063) y un presupuesto de núcleo < $100.000 COP/mes (DEC-082). El volumen diario real (P-11) puede cambiarlos.
> Rangos: Seguridad 001–019 · Privacidad 020–029 · Rendimiento 030–039 · Disponibilidad/Recuperación 040–059 · Escalabilidad 060–069 · Accesibilidad/Usabilidad 070–089 · Auditoría/Observabilidad 090–109 · Costos 110–119 · Mantenibilidad 120–129 · Integraciones 130–139.

---

## 1. Seguridad

| ID      | Requerimiento                                                                                                  | Métrica / verificación                                                             | Valor propuesto                                  | Estado                                     | Fuente  |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ | ------- |
| RNF-001 | Toda autorización (permiso, sede, aprobación) se verifica en el backend.                                       | Pruebas automáticas de autorización por endpoint (permitido, denegado, sede ajena) | 100 % de endpoints de escritura cubiertos        | CONFIRMED (principio) · PROPOSED (métrica) | DM §8   |
| RNF-002 | MFA obligatorio para roles sensibles.                                                                          | Inicio de sesión de ADM/MGR/CONT sin MFA imposible                                 | ADM, MGR, CONT                                   | PENDING (Q-SEC-02)                         | DEC-043 |
| RNF-003 | Contraseñas almacenadas con algoritmo de hash resistente (Argon2id o bcrypt).                                  | Revisión de código                                                                 | —                                                | PROPOSED                                   | —       |
| RNF-004 | Tráfico cifrado con HTTPS (TLS 1.2+) en todos los entornos expuestos.                                          | Escaneo de configuración                                                           | —                                                | PROPOSED                                   | —       |
| RNF-005 | Protección ante fuerza bruta: bloqueo temporal tras intentos fallidos y límite de peticiones en autenticación. | Prueba automatizada                                                                | 5 intentos / 15 min                              | PENDING                                    | —       |
| RNF-006 | Sesiones con expiración por inactividad.                                                                       | Configuración                                                                      | ERP 30 min; POS 12 h por turno; portal móvil 8 h | PENDING                                    | DM §8   |
| RNF-007 | Secretos (BD, IA, Telegram) solo en variables de entorno / gestor de secretos; escaneo de secretos en CI.      | CI falla si detecta secretos                                                       | —                                                | PROPOSED                                   | PM §11  |
| RNF-008 | Protección contra vulnerabilidades OWASP Top 10 (inyección, XSS, CSRF, IDOR).                                  | Validación de entrada en servidor, consultas parametrizadas, pruebas IDOR          | —                                                | PROPOSED                                   | —       |
| RNF-009 | El asistente IA no tiene credenciales de base de datos; solo invoca herramientas del backend.                  | Revisión de arquitectura                                                           | —                                                | CONFIRMED                                  | PM §9   |
| RNF-010 | Dependencias con vulnerabilidades críticas conocidas bloquean el despliegue.                                   | Auditoría de dependencias en CI                                                    | 0 críticas                                       | PROPOSED                                   | —       |

## 2. Privacidad y protección de datos

| ID      | Requerimiento                                                                                                                    | Métrica / verificación                 | Valor propuesto | Estado   | Fuente   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------- | -------- | -------- |
| RNF-020 | Minimización de datos personales de clientes personas naturales.                                                                 | Revisión del modelo de datos           | DR-023          | PROPOSED | R-SEC-05 |
| RNF-021 | Política de tratamiento de datos personales validada por la empresa conforme a la normativa colombiana aplicable.                | Documento aprobado antes de producción | —               | PENDING  | —        |
| RNF-022 | Los datos enviados al proveedor de IA se limitan a lo necesario para responder; sin enviar datos de otras sedes ni credenciales. | Revisión de herramientas IA            | —               | PROPOSED | DM §10   |
| RNF-023 | Exportaciones de datos personales solo para roles autorizados y auditadas.                                                       | Auditoría                              | —               | PROPOSED | —        |

## 3. Rendimiento

| ID      | Requerimiento                                                                     | Métrica / verificación                 | Valor propuesto                   | Estado  | Fuente  |
| ------- | --------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------- | ------- | ------- |
| RNF-030 | Registro de venta POS (confirmación con pagos) rápido para atención en mostrador. | p95 del endpoint, medido en producción | ≤ 1 s                             | PENDING | DM §7.4 |
| RNF-031 | Operaciones del portal móvil (entrega, cobro) en red móvil 4G.                    | p95 del endpoint                       | ≤ 2 s                             | PENDING | DM §7.2 |
| RNF-032 | Consultas y listados del ERP paginados.                                           | p95                                    | ≤ 2 s con 50 registros por página | PENDING | —       |
| RNF-033 | Reportes operativos de un mes.                                                    | Tiempo de generación                   | ≤ 10 s                            | PENDING | —       |
| RNF-034 | Primera carga del frontend en móvil de gama media.                                | Lighthouse / LCP                       | LCP ≤ 3 s en 4G                   | PENDING | DEC-024 |
| RNF-035 | Respuesta del asistente IA (consulta simple).                                     | p95                                    | ≤ 10 s                            | PENDING | DM §10  |

## 4. Disponibilidad y recuperación

| ID      | Requerimiento                                                                                                                              | Métrica / verificación                      | Valor propuesto                                                                         | Estado                                   | Fuente            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------- |
| RNF-040 | Disponibilidad mensual del núcleo en horario operativo.                                                                                    | Monitoreo de salud externo                  | 99 % (≈ 7 h de caída/mes)                                                               | PENDING (P-12)                           | DM §12.2          |
| RNF-041 | **RPO** (pérdida máxima de datos ante fallo).                                                                                              | Frecuencia efectiva de respaldo / PITR      | ≤ 24 h con respaldo diario; ≤ 15 min si el proveedor ofrece PITR dentro del presupuesto | PENDING (P-12)                           | DM §12.2          |
| RNF-042 | **RTO** (tiempo máximo para restablecer el servicio).                                                                                      | Simulacro de restauración                   | ≤ 4 h                                                                                   | PENDING (P-12)                           | DM §12.2          |
| RNF-043 | Retención de respaldos.                                                                                                                    | Configuración                               | Diarios 7 días + semanales 4 semanas + mensuales 6 meses                                | PENDING                                  | DM §12.2          |
| RNF-044 | Copia de respaldo **fuera del proveedor** principal.                                                                                       | Verificación mensual                        | Semanal                                                                                 | PROPOSED                                 | R-INF-02          |
| RNF-045 | Prueba de restauración documentada.                                                                                                        | Registro del simulacro                      | Trimestral                                                                              | PROPOSED                                 | DM §12.2          |
| RNF-046 | Procedimiento de **contingencia** ante caída de Internet o del sistema (POS y ruta) y registro posterior identificado como "contingencia". | Procedimiento aprobado y probado en piloto  | —                                                                                       | PENDING (requiere aprobación de negocio) | R-INF-03, DEC-061 |
| RNF-047 | Las transacciones fallidas no dejan datos parciales (atomicidad).                                                                          | Pruebas de integración con fallos inducidos | 100 % de operaciones multi-registro                                                     | CONFIRMED                                | PM §4.F           |

## 5. Escalabilidad

| ID      | Requerimiento                                                                        | Métrica / verificación                                       | Valor propuesto          | Estado         | Fuente         |
| ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------ | -------------- | -------------- |
| RNF-060 | Soportar los usuarios iniciales concurrentes sin degradación.                        | Prueba de carga                                              | 15 usuarios concurrentes | PENDING        | DEC-063        |
| RNF-061 | Agregar una sede o punto de venta nuevo es **configuración**, no desarrollo.         | Prueba: crear sede + ubicaciones + usuarios                  | —                        | CONFIRMED      | DM §1, DEC-004 |
| RNF-062 | El crecimiento de datos (movimientos, auditoría) no degrada las operaciones diarias. | Índices y paginación; prueba con volumen sintético de 3 años | —                        | PENDING (P-11) | —              |

## 6. Accesibilidad y usabilidad

| ID      | Requerimiento                                                                                                                                         | Métrica / verificación              | Valor propuesto                                           | Estado    | Fuente            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- | --------- | ----------------- |
| RNF-070 | Interfaces **responsive**: ERP en escritorio y tableta; POS en tableta/escritorio con pantalla táctil; portal del distribuidor optimizado para móvil. | Pruebas en 360 px, 768 px y 1280 px | —                                                         | CONFIRMED | PM §3             |
| RNF-071 | Contraste y tamaño de texto conforme a WCAG 2.1 AA en las pantallas principales.                                                                      | Auditoría automática + manual       | AA                                                        | PROPOSED  | —                 |
| RNF-072 | Elementos táctiles del POS y portal móvil con tamaño mínimo cómodo.                                                                                   | Revisión de diseño                  | ≥ 44 × 44 px                                              | PROPOSED  | —                 |
| RNF-073 | Registrar una venta habitual en el POS en pocos pasos.                                                                                                | Prueba con cajero en piloto         | ≤ 5 interacciones para venta de 1–2 productos con un pago | PENDING   | DM §7.4           |
| RNF-074 | Mensajes de error comprensibles en español, indicando qué hacer.                                                                                      | Revisión de textos                  | —                                                         | PROPOSED  | —                 |
| RNF-075 | Toda cantidad muestra su **unidad o presentación** explícita.                                                                                         | Revisión de UI                      | —                                                         | PROPOSED  | R-IA-07, R-INV-01 |

## 7. Auditoría y observabilidad

| ID      | Requerimiento                                                                                                       | Métrica / verificación                                | Valor propuesto            | Estado    | Fuente  |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------- | --------- | ------- |
| RNF-090 | Auditoría inmutable de operaciones sensibles (BR-005); ningún rol puede modificarla o borrarla desde la aplicación. | Prueba: intento de modificación rechazado             | —                          | CONFIRMED | PM §4.E |
| RNF-091 | Logs estructurados (JSON) con identificador de correlación por petición.                                            | Revisión                                              | —                          | PROPOSED  | —       |
| RNF-092 | Los logs no contienen contraseñas, tokens ni datos personales completos.                                            | Prueba automatizada de redacción                      | —                          | PROPOSED  | —       |
| RNF-093 | Monitoreo de salud y alerta al responsable técnico ante caída o tasa de errores alta.                               | Alerta configurada                                    | Errores 5xx > 5 % en 5 min | PENDING   | —       |
| RNF-094 | Registro de errores del frontend y backend con contexto.                                                            | Herramienta de seguimiento de errores (plan gratuito) | —                          | PROPOSED  | —       |

## 8. Costos operativos

| ID      | Requerimiento                                                                                                        | Métrica / verificación      | Valor propuesto         | Estado                              | Fuente           |
| ------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- | ----------------------------------- | ---------------- |
| RNF-110 | Costo mensual del **núcleo** (hosting, base de datos, almacenamiento, respaldos, monitoreo) por debajo del objetivo. | Factura mensual             | < $100.000 COP          | CONFIRMED (objetivo, no viabilidad) | DEC-062, DEC-082 |
| RNF-111 | Costo de IA y Telegram medido y reportado **por separado**.                                                          | Tablero de consumo (RF-344) | —                       | CONFIRMED                           | DEC-082          |
| RNF-112 | Techo técnico global de gasto de IA con pausa automática.                                                            | Configuración + prueba      | Valor PENDING (Q-IA-02) | PROPOSED                            | DEC-P11          |
| RNF-113 | Costos de dominio, correo transaccional y facturación electrónica identificados aparte.                              | Presupuesto                 | —                       | PENDING (Q-INF-02b)                 | —                |

## 9. Mantenibilidad

| ID      | Requerimiento                                                                                                     | Métrica / verificación                        | Valor propuesto                      | Estado    | Fuente  |
| ------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ | --------- | ------- |
| RNF-120 | Monolito modular con fronteras explícitas; un módulo no accede a las tablas de otro sino a través de su servicio. | Regla de lint de importaciones + revisión     | —                                    | PROPOSED  | DEC-P03 |
| RNF-121 | TypeScript en modo estricto en frontend y backend.                                                                | Configuración `strict: true`                  | —                                    | PROPOSED  | PM §11  |
| RNF-122 | Cobertura de pruebas de la lógica de dominio (reglas BR).                                                         | Reporte de cobertura                          | ≥ 80 % en `domain/` y `application/` | PENDING   | PM §13  |
| RNF-123 | Pruebas de integración contra PostgreSQL real para flujos transaccionales.                                        | CI                                            | Todos los flujos WF-01..WF-08        | PROPOSED  | PM §13  |
| RNF-124 | Entorno local reproducible en un comando y documentado.                                                           | Un desarrollador nuevo lo levanta en < 30 min | —                                    | PROPOSED  | PM §11  |
| RNF-125 | Migraciones versionadas, reversibles cuando sea posible, y probadas en CI.                                        | CI                                            | —                                    | CONFIRMED | PM §3   |
| RNF-126 | Decisiones técnicas relevantes registradas como ADR.                                                              | `architecture-decisions.md`                   | —                                    | PROPOSED  | —       |

## 10. Resiliencia de integraciones

| ID      | Requerimiento                                                                                                                                              | Métrica / verificación              | Valor propuesto               | Estado         | Fuente          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------- | -------------- | --------------- |
| RNF-130 | La caída del proveedor de IA o de Telegram **no afecta** al núcleo.                                                                                        | Prueba con proveedor simulado caído | —                             | CONFIRMED      | DM §10, PM §4.A |
| RNF-131 | Llamadas a servicios externos con tiempo límite y reintentos con espera exponencial; sin reintentos automáticos de escrituras de negocio sin idempotencia. | Revisión + pruebas                  | Timeout 15 s IA; 3 reintentos | PENDING        | —               |
| RNF-132 | Webhook de Telegram idempotente por identificador de actualización.                                                                                        | Prueba de duplicados                | —                             | PROPOSED       | R-INT-02        |
| RNF-133 | Integración de facturación electrónica aislada tras un adaptador; si falla, la venta queda registrada y el documento en cola de reintento.                 | Diseño + pruebas                    | —                             | PENDING (P-02) | R-INT-01        |
| RNF-134 | El proveedor y modelo de IA son intercambiables por configuración.                                                                                         | Prueba con dos proveedores          | —                             | PROPOSED       | DEC-P13         |
