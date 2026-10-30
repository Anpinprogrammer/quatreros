# Registro de riesgos

> Etapa A · v0.1 · 2026-10-29
> Probabilidad (P) e Impacto (I): Alta / Media / Baja. Severidad = combinación (🔴 crítica · 🟠 alta · 🟡 media).
> Las mitigaciones son **propuestas** del equipo (`PROPOSED`); no constituyen decisiones de negocio.

---

## Top 8 (atender antes de especificar)

| #        | Riesgo                                                                                    | Severidad |
| -------- | ----------------------------------------------------------------------------------------- | --------- |
| R-CON-01 | Contabilidad formal comprometida en el prototipo sin políticas aprobadas                  | 🔴        |
| R-CON-02 | Obligaciones fiscales (facturación/impuestos) desconocidas                                | 🔴        |
| R-INV-01 | Inventario inconsistente por apertura de paquetes / presentaciones                        | 🔴        |
| R-SEC-01 | Escrituras por IA/Telegram sin matriz de permisos aprobada                                | 🔴        |
| R-INF-01 | Presupuesto < $100k COP insuficiente para BD gestionada + backups + IA                    | 🟠        |
| R-NEG-01 | Alcance del prototipo muy amplio (ERP+POS+reparto+contabilidad+IA) para el equipo y plazo | 🟠        |
| R-INV-02 | Venta de lotes vencidos / falta de capacidad de retiro                                    | 🟠        |
| R-FIN-01 | Faltantes de recaudo de distribuidores no detectados                                      | 🟠        |

---

## 1. Negocio y adopción

| ID       | Riesgo                                                                                      | P     | I     | Sev. | Mitigación propuesta                                                                                      | Responsable        | Fuente        |
| -------- | ------------------------------------------------------------------------------------------- | ----- | ----- | ---- | --------------------------------------------------------------------------------------------------------- | ------------------ | ------------- |
| R-NEG-01 | **Alcance amplio** del prototipo integral genera retrasos o entregas superficiales          | Alta  | Alta  | 🟠   | Entregas verticales por dependencia; contabilidad en dos capas (DEC-P24); roadmap aprobado por el cliente | Tech Lead          | DM §1; PM §12 |
| R-NEG-02 | **Resistencia al cambio** del personal acostumbrado a cuadernos                             | Media | Alta  | 🟠   | UI móvil simple para distribuidor/cajero; piloto paralelo; capacitación por rol                           | Empresa            | DM §13        |
| R-NEG-03 | **Datos iniciales poco confiables** (conteos, cartera) contaminan el sistema desde el día 1 | Alta  | Alta  | 🟠   | Controles de puesta en marcha (DEC-P14); conteo físico con lote; verificación de cartera por tercero      | Empresa + contador | DM §13.1      |
| R-NEG-04 | **Criterios de salida del piloto indefinidos** → doble operación prolongada                 | Media | Media | 🟡   | Definir P-16 antes de la puesta en marcha                                                                 | Empresa            | P-16          |
| R-NEG-05 | Reglas de negocio **inventadas** por vacíos documentales                                    | Media | Alta  | 🟠   | Trazabilidad obligatoria a DM; estados PENDING visibles; revisión por dueño del proceso                   | BA                 | PM §2         |

## 2. Inventario y producción

| ID       | Riesgo                                                                                          | P     | I     | Sev. | Mitigación propuesta                                                                    | Responsable              | Fuente       |
| -------- | ----------------------------------------------------------------------------------------------- | ----- | ----- | ---- | --------------------------------------------------------------------------------------- | ------------------------ | ------------ |
| R-INV-01 | **Existencias erróneas** por mal manejo de paquete↔unidad                                       | Alta  | Alta  | 🔴   | Unidad base única; presentaciones como múltiplos; transformación atómica; resolver P-06 | Arquitectura + operación | P-06         |
| R-INV-02 | **Venta de lotes vencidos** o imposibilidad de rastrear un lote hasta el cliente                | Media | Alta  | 🟠   | FEFO + bloqueo de vencidos; trazabilidad lote→despacho→cliente; resolver P-05           | Producción               | P-05, INV-01 |
| R-INV-03 | **Saldos negativos** o sobreventa por concurrencia (POS y distribución vendiendo el mismo lote) | Media | Alta  | 🟠   | Transacciones con bloqueo de fila, restricción `CHECK (cantidad >= 0)`, reservas        | DB Architect             | PM §4.F      |
| R-INV-04 | **Doble descuento** de producto fabricado usado en cocina                                       | Media | Media | 🟡   | Resolver Q-POS-01; traslado explícito a inventario de cocina                            | Cocina                   | DM §7.4      |
| R-INV-05 | **Rendimiento real** no capturado → sugerencias y costos sin fundamento                         | Media | Media | 🟡   | Registro obligatorio de producción real al cerrar orden                                 | Producción               | DM §5        |
| R-INV-06 | **Excepciones FEFO** usadas como atajo habitual                                                 | Media | Media | 🟡   | Motivo obligatorio, permiso, reporte de excepciones                                     | Administración           | INV-02       |

## 3. Finanzas, cartera y contabilidad

| ID       | Riesgo                                                                                         | P     | I     | Sev. | Mitigación propuesta                                                                                  | Responsable             | Fuente           |
| -------- | ---------------------------------------------------------------------------------------------- | ----- | ----- | ---- | ----------------------------------------------------------------------------------------------------- | ----------------------- | ---------------- |
| R-CON-01 | **Contabilidad sin políticas** → asientos inventados o entrega sin contabilidad                | Alta  | Alta  | 🔴   | DEC-P24 + DEC-P20 (eventos económicos desde el inicio); sesión con contador                           | Contador + arquitectura | P-01..P-04, C-02 |
| R-CON-02 | **Incumplimiento fiscal**: el POS emite comprobantes sin validez                               | Alta  | Alta  | 🔴   | No presentar comprobantes internos como fiscales; adaptador de facturación desacoplado; resolver P-02 | Contador / empresa      | P-02, DM §9.2    |
| R-CON-03 | **Costeo** imposible de reconstruir si no se capturan costos y consumos reales desde el inicio | Media | Alta  | 🟠   | Capturar costos unitarios de compra por lote y consumos por orden aunque la fórmula esté bloqueada    | Arquitectura            | P-03             |
| R-CON-04 | **Edición silenciosa** de registros cerrados destruye trazabilidad                             | Media | Alta  | 🟠   | Inmutabilidad + reversiones (DEC-P10); auditoría                                                      | Arquitectura            | DM §6            |
| R-FIN-01 | **Faltantes de recaudo** de distribuidores no detectados o detectados tarde                    | Media | Alta  | 🟠   | Liquidación por despacho; conciliación diaria; resolver P-08                                          | Administración          | FIN-01, P-08     |
| R-FIN-02 | **Venta a crédito fuera de cupo** por fallo de validación en el cliente (frontend)             | Media | Alta  | 🟠   | Validación de cupo solo en backend, dentro de la transacción                                          | Arquitectura            | CRE-01, DM §8    |
| R-FIN-03 | **Diferencias de caja** cerradas sin revisión efectiva                                         | Media | Media | 🟡   | Cola de revisión obligatoria para supervisor; reporte de diferencias                                  | Administración          | POS-02           |
| R-FIN-04 | **Errores de redondeo** por uso de coma flotante en dinero                                     | Baja  | Alta  | 🟡   | DEC-P22                                                                                               | Arquitectura            | —                |

## 4. Seguridad y privacidad

| ID       | Riesgo                                                                             | P     | I     | Sev. | Mitigación propuesta                                                                                       | Responsable         | Fuente  |
| -------- | ---------------------------------------------------------------------------------- | ----- | ----- | ---- | ---------------------------------------------------------------------------------------------------------- | ------------------- | ------- |
| R-SEC-01 | **Escrituras por IA/Telegram** sin matriz de permisos → operaciones no autorizadas | Media | Alta  | 🔴   | No habilitar escrituras asistidas hasta aprobar P-10 (DM §15.2); lista blanca de herramientas              | Arquitectura        | P-10    |
| R-SEC-02 | **Fuga de datos entre sedes** (manager ve otra sede)                               | Media | Media | 🟡   | Filtro de sede obligatorio en capa de servicio + pruebas de autorización                                   | Arquitectura        | DM §8   |
| R-SEC-03 | **Robo de cuenta** de roles sensibles                                              | Media | Alta  | 🟠   | MFA (ACC-02), bloqueo por intentos, sesiones cortas                                                        | Arquitectura        | ACC-02  |
| R-SEC-04 | **Suplantación en Telegram** (cuenta no vinculada o vínculo robado)                | Media | Alta  | 🟠   | Vinculación con código de un solo uso desde el ERP; verificación adicional en acciones sensibles (DEC-P08) | AI Integration Eng. | DM §8   |
| R-SEC-05 | **Datos personales** de clientes (personas naturales) sin tratamiento adecuado     | Media | Media | 🟡   | Minimización de datos; política de tratamiento validada por la empresa; acceso por rol                     | Empresa             | DM §2.2 |
| R-SEC-06 | **Secretos** (API keys de IA, BD) expuestos en repositorio                         | Baja  | Alta  | 🟡   | Variables de entorno, gestor de secretos del hosting, escaneo en CI                                        | Tech Lead           | PM §11  |
| R-SEC-07 | **Comprobantes adjuntos** accesibles públicamente                                  | Baja  | Alta  | 🟡   | Almacenamiento privado con URLs firmadas de corta duración (DEC-P04)                                       | Arquitectura        | DM §12  |

## 5. Inteligencia artificial

| ID      | Riesgo                                                                                                                                                                                  | P     | I     | Sev. | Mitigación propuesta                                                                                                                                                                                  | Responsable                | Fuente     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| R-IA-01 | El modelo **"afirma" haber ejecutado** una operación que no ocurrió                                                                                                                     | Alta  | Alta  | 🟠   | El resultado solo lo informa el backend (ID de operación real); nunca texto del modelo                                                                                                                | AI Integration Eng.        | PM §9      |
| R-IA-02 | **Doble ejecución** por reintentos o confirmaciones repetidas                                                                                                                           | Media | Alta  | 🟠   | Propuesta con ID único, confirmación de un solo uso con expiración, clave de idempotencia                                                                                                             | AI Integration Eng.        | PM §9      |
| R-IA-03 | **Consumo extraordinario** (bucles, abuso) supera el presupuesto                                                                                                                        | Media | Media | 🟡   | Techo global, límite de iteraciones por petición, alertas (DEC-P11)                                                                                                                                   | Arquitectura               | DM §10.2   |
| R-IA-04 | **Prompt injection** desde datos (nombres de clientes, notas) que manipulan al agente                                                                                                   | Media | Alta  | 🟠   | Herramientas con validación estricta, permisos del usuario, confirmación humana, sin SQL libre                                                                                                        | AI Integration Eng.        | —          |
| R-IA-05 | **Acoplamiento** del núcleo a la IA (ERP falla si el proveedor de IA cae)                                                                                                               | Baja  | Alta  | 🟡   | IA como cliente de la API; feature flag; sin dependencias del núcleo hacia IA                                                                                                                         | Arquitectura               | PM §4.A    |
| R-IA-06 | **Dependencia de un proveedor/modelo** cuyo precio cambia (proveedor único Anthropic por DEC-087)                                                                                       | Media | Media | 🟡   | Riesgo aceptado: dependencia aislada en `addons/assistant/infrastructure/anthropic`; `ToolGateway` y propuestas independientes del proveedor; techo de gasto; modelo cambiable con un campo (ADR-023) | Arquitectura               | DM §10.2   |
| R-IA-07 | **Interpretación errónea** de cantidades/unidades ("10 de chorizo" = ¿paquetes o unidades?)                                                                                             | Alta  | Media | 🟠   | Resumen estructurado con unidad explícita antes de confirmar                                                                                                                                          | AI Integration Eng.        | DM §10.1   |
| R-IA-08 | **Fuga entre empleados**: una sesión compartida o mal vinculada muestra datos o historial de otro empleado                                                                              | Baja  | Alta  | 🟠   | Una sesión por empleado y canal; identidad desde el vínculo sesión→usuario, recargada en cada herramienta; pruebas de aislamiento (ai-architecture §6)                                                | AI Integration Eng.        | DEC-AI-005 |
| R-IA-09 | **Sesión bloqueada** en `requires_action`: herramienta declarada sin manejador, o backend caído a mitad de turno                                                                        | Media | Media | 🟡   | Desplegar el manejador antes de `ant apply`; respuesta `is_error` por defecto; recuperación con `events.list` al reanudar (ai-architecture §8, §11)                                                   | AI Integration Eng.        | ADR-023    |
| R-IA-10 | **Desincronización del agente**: cambios en la consola fuera de los archivos, `ant apply` con credenciales o lockfile equivocados, o aplicar a producción lo probado solo en desarrollo | Media | Media | 🟡   | Solo `ant apply` sobre archivos revisados por PR; `--dry-run` primero; `ant` rechaza otra organización o espacio; lockfile por entorno; prohibido `--force`/`--prune` sin revisión (Q-IA-04)          | Responsable + Arquitectura | DEC-087    |
| R-IA-11 | **Costo de tiempo de ejecución** además de tokens (`active_seconds`) y sesiones largas o abiertas                                                                                       | Media | Media | 🟡   | Presupuesto por sesión (`budget.max_list_cost`), límite de turno, archivado por inactividad, medición con `session.usage` (ai-architecture §7)                                                        | Arquitectura               | ADR-023    |
| R-IA-12 | **Retención de datos en el proveedor**: Managed Agents en beta y sin Zero Data Retention; las transcripciones quedan en Anthropic                                                       | Media | Media | 🟡   | Mínimo dato en herramientas, enmascarar datos personales, borrar sesiones a los N días (Q-IA-05); revisar la política de tratamiento de datos antes de producción (RNF-021)                           | Responsable                | ADR-023    |

## 6. Infraestructura y operación

| ID       | Riesgo                                                                                      | P     | I     | Sev. | Mitigación propuesta                                                                                            | Responsable  | Fuente           |
| -------- | ------------------------------------------------------------------------------------------- | ----- | ----- | ---- | --------------------------------------------------------------------------------------------------------------- | ------------ | ---------------- |
| R-INF-01 | **Presupuesto insuficiente** para BD gestionada con backups + hosting + almacenamiento + IA | Media | Alta  | 🟠   | Cotización real de 2–3 proveedores; separar costo base e incremental                                            | Arquitectura | TEC-03, DM §12.1 |
| R-INF-02 | **Pérdida de datos** por backups no probados                                                | Media | Alta  | 🟠   | Backups automatizados + copia externa + prueba de restauración periódica documentada                            | Arquitectura | DM §12.2         |
| R-INF-03 | **Caída de Internet** en POS o en ruta detiene la operación (sin offline)                   | Alta  | Media | 🟠   | Procedimiento de contingencia en papel + registro posterior con marca de contingencia **[requiere aprobación]** | Empresa      | TEC-02           |
| R-INF-04 | **Errores no detectados** en producción por falta de observabilidad                         | Media | Media | 🟡   | Logging estructurado, alertas básicas, health checks                                                            | Tech Lead    | —                |
| R-INF-05 | **Dependencia de una sola persona** desarrolladora                                          | Media | Alta  | 🟠   | Documentación SDD, ADRs, setup reproducible                                                                     | Tech Lead    | PM §11           |

## 7. Integraciones

| ID       | Riesgo                                                               | P    | I     | Sev. | Mitigación propuesta                                        | Responsable         | Fuente  |
| -------- | -------------------------------------------------------------------- | ---- | ----- | ---- | ----------------------------------------------------------- | ------------------- | ------- |
| R-INT-01 | **Proveedor de facturación electrónica** con API/costos desconocidos | Alta | Alta  | 🟠   | Adaptador desacoplado; elegir tras P-02                     | Arquitectura        | DM §9.1 |
| R-INT-02 | **API de Telegram** caída o con límites → mensajes perdidos          | Baja | Media | 🟡   | Webhook idempotente por `update_id`, reintentos con backoff | AI Integration Eng. | PM §10  |
