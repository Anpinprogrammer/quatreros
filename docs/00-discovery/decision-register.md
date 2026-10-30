# Registro de decisiones

> Etapa A · v0.1 · 2026-10-29
> Consolida decisiones del Documento Maestro (**DM**) y del Prompt Maestro (**PM**). Las claves temáticas del DM (Anexo A: NEG-01, PRO-01…) se conservan como referencia; aquí se asigna numeración canónica `DEC-###` (el DM, Anexo A, indica que sus claves no son canónicas).
> Las propuestas surgidas en esta etapa se identifican como **[Ampliación Etapa A]** y nunca están confirmadas.
> Las decisiones pendientes se detallan en `open-questions.md` (columna "Pregunta").

**Formato:** ID · Dominio · Decisión · Estado · Fuente · Responsable · Impacto · Dependencias.

---

## 1. Decisiones confirmadas (`CONFIRMED`)

### 1.1 Negocio y alcance

| ID      | Dominio | Decisión                                                                                                      | Fuente              | Impacto                                               | Dependencias |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------- | ------------ |
| DEC-001 | Negocio | Producto **a medida para una sola empresa**; no SaaS multiempresa                                             | DM §1, §2.3, NEG-01 | Elimina multi-tenant; sí exige multi-sede             | —            |
| DEC-002 | Negocio | **Fabricación para inventario**; reposición según agotamiento                                                 | DM §2.2, NEG-01     | Producción no nace de pedidos                         | DEC-010      |
| DEC-003 | Negocio | Clientes comerciales (restaurantes, negocios) y personas naturales; **distribuidores propios**                | DM §2.2, NEG-02     | Un solo maestro de clientes con tipos                 | —            |
| DEC-004 | Negocio | **Una bodega principal y un POS** inicial; debe permitir más puntos de venta                                  | DM §2.2, NEG-03     | Modelo multi-ubicación/multi-sede desde el inicio     | DEC-040      |
| DEC-005 | Alcance | El primer prototipo incluye **ERP, POS, reparto, contabilidad formal y demostración de IA**                   | DM §1; PM §12       | Contabilidad formal en alcance pese a estar bloqueada | P-01..P-04   |
| DEC-006 | Alcance | Exclusiones actuales: SaaS, offline (futuro), predicción avanzada de demanda, portal autoservicio de clientes | DM §2.3, §3         | Acota alcance                                         | —            |
| DEC-007 | Alcance | Pedidos desde varios canales, **sin integración automática** comprometida                                     | DM §2.2             | Registro manual de pedidos en v1                      | Q-COM-05     |

### 1.2 Producción e inventarios

| ID      | Dominio    | Decisión                                                                                             | Fuente                | Impacto                                                             | Dependencias                  |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------- | ----------------------------- |
| DEC-010 | Producción | La **cantidad a producir la decide un humano**, con sugerencias automáticas                          | DM §7.1, PRO-02       | Sugerencia ≠ orden automática                                       | Regla de sugerencia: Q-PRO-03 |
| DEC-011 | Producción | Recetas con **cantidades exactas y documentadas**                                                    | DM §7.1, PRO-02       | Habilita consumo teórico y rendimiento esperado                     | —                             |
| DEC-012 | Producción | Registro de **rendimiento esperado y real** y merma                                                  | DM §5, §6             | Requiere captura de producción real                                 | Costeo P-03                   |
| DEC-013 | Inventario | Control de **lote, fecha de fabricación, vencimiento y origen de insumos**                           | DM §7.1, INV-01       | Trazabilidad hacia atrás (insumo→lote PT) y adelante (lote→cliente) | —                             |
| DEC-014 | Inventario | Salidas por **FEFO**, con **excepción autorizada**                                                   | DM §7.1, INV-02       | Motor de asignación de lotes + flujo de aprobación                  | DEC-042                       |
| DEC-015 | Catálogo   | Venta por **unidad y paquete**; paquete con **cantidad fija**; puede **abrirse** para venta unitaria | DM §2.2, §7.1, PRO-01 | Unidad base + presentaciones                                        | Mecánica P-06                 |
| DEC-016 | Inventario | Inventario de **materia prima y producto terminado**, por **ubicación**, con **transferencias**      | DM §5                 | Movimientos tipados y traslados bodega↔POS                          | —                             |

### 1.3 Comercial, crédito y distribución

| ID      | Dominio      | Decisión                                                                                             | Fuente          | Impacto                                  | Dependencias              |
| ------- | ------------ | ---------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------- | ------------------------- |
| DEC-020 | Precios      | **Precio único por producto**, configurable por el administrador                                     | DM §7.3, COM-01 | Sin listas de precios por cliente        | Excepciones: P-09         |
| DEC-021 | Crédito      | Crédito con **cupo y plazo configurables por cliente**                                               | DM §7.3, CRE-01 | Control de cupo en cada venta a crédito  | —                         |
| DEC-022 | Crédito      | **Cupo excedido o cartera vencida** → requiere **autorización administrativa** para vender a crédito | DM §7.3, CRE-01 | Bloqueo + aprobación                     | DEC-042                   |
| DEC-023 | Ventas       | Ventas **contraentrega** y **a crédito**                                                             | DM §2.2         | Dos modalidades de cobro en distribución | —                         |
| DEC-024 | Distribución | Repartidores son **personal interno**; **portal web móvil en línea**                                 | DM §3, §7.2     | UI móvil responsive, sin offline         | DEC-061                   |
| DEC-025 | Distribución | **Entrega parcial**: el pedido permanece **abierto** y se reprograma                                 | DM §7.2, DIS-01 | Estados de pedido y saldo pendiente      | —                         |
| DEC-026 | Distribución | **Devoluciones**: registro, **inspección** y decisión de reincorporar o descartar                    | DM §7.2, DIS-02 | Estado "en inspección" de mercancía      | Tratamiento contable P-01 |
| DEC-027 | Finanzas     | **Recaudos separados por punto y por distribuidor**, conciliados posteriormente                      | DM §7.2, FIN-01 | Cuenta de recaudo por distribuidor       | Liquidación P-08          |

### 1.4 POS y cocina

| ID      | Dominio | Decisión                                                                                                | Fuente          | Impacto                                  | Dependencias                |
| ------- | ------- | ------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------- | --------------------------- |
| DEC-030 | POS     | Vende **productos fabricados** y **alimentos preparados**, con **inventarios funcionalmente separados** | DM §7.4         | Dos ámbitos de inventario en el POS      | Q-POS-01                    |
| DEC-031 | POS     | **Venta inmediata** y **pagos mixtos**                                                                  | DM §7.4, POS-01 | Venta con N pagos de distintos métodos   | Métodos aceptados: Q-POS-02 |
| DEC-032 | POS     | **Apertura y cierre por cajero y turno**                                                                | DM §7.4, POS-01 | Entidad turno/caja                       | —                           |
| DEC-033 | POS     | **Diferencias de caja**: se permite cerrar con **justificación** y **revisión del supervisor**          | DM §7.4, POS-02 | Cierre no bloqueante + tarea de revisión | —                           |
| DEC-034 | Cocina  | **Conteos físicos inicial/final**, **consumo teórico** por ventas y **clasificación de diferencias**    | DM §7.4, COC-01 | Requiere recetas de platos               | Ajuste P-07                 |

### 1.5 Seguridad y acceso

| ID      | Dominio       | Decisión                                                                                              | Fuente         | Impacto                                                                  | Dependencias |
| ------- | ------------- | ----------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ | ------------ |
| DEC-040 | Acceso        | **Roles predefinidos, editables y ampliables**; permisos configurables por alcance                    | DM §8, ACC-01  | RBAC con permisos granulares                                             | Matriz P-10  |
| DEC-041 | Acceso        | Trabajadores acceden a **su sede y operaciones asignadas**                                            | DM §3, §8      | Filtro por sede en todo el backend                                       | —            |
| DEC-042 | Autorización  | Autorizaciones sensibles **configurables por operación, monto y permiso**, verificadas en **backend** | DM §8; PM §4.E | Motor de políticas de aprobación                                         | P-10         |
| DEC-043 | Autenticación | **Correo y contraseña**; **MFA** para roles sensibles                                                 | DM §8, ACC-02  | Requiere definir roles sensibles                                         | Q-SEC-02     |
| DEC-044 | Auditoría     | Cambios sensibles respetan **permisos, autorizaciones y auditoría**                                   | PM §4.E        | Eleva a obligatoria la auditoría que DM §8 solo recomienda (ver DEC-P07) | —            |

### 1.6 Contabilidad

| ID      | Dominio      | Decisión                                                                       | Fuente        | Impacto                                                     | Dependencias |
| ------- | ------------ | ------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------- | ------------ |
| DEC-050 | Contabilidad | **Toda la contabilidad formal** se gestiona y consulta **dentro de Quatreros** | DM §9, CTA-01 | Módulo contable completo, no exportación a software externo | P-01..P-04   |
| DEC-051 | Contabilidad | Habrá un **contador de la empresa con acceso** al ERP                          | DM §9         | Rol Contador; segregación pendiente                         | Q-SEC-03     |

### 1.7 Tecnología, infraestructura y migración

| ID      | Dominio   | Decisión                                                                                                                            | Fuente                   | Impacto                               | Dependencias |
| ------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------- | ------------ |
| DEC-060 | Stack     | **React + TypeScript + Tailwind**; **Node.js + Express + TypeScript**; **PostgreSQL** desde el inicio                               | DM §12, TEC-01; PM §3    | Stack cerrado                         | —            |
| DEC-061 | Infra     | **100 % cloud**, conexión obligatoria; **offline** solo como posible futuro                                                         | DM §12, TEC-02           | Sin sincronización offline en v1      | —            |
| DEC-062 | Costos    | **Presupuesto objetivo < $100.000 COP/mes** (límite deseado, no viabilidad comprobada)                                              | DM §12.1, TEC-03; PM §3  | Condiciona hosting, BD gestionada, IA | Q-INF-02     |
| DEC-063 | Usuarios  | **Entre 6 y 15 usuarios iniciales**                                                                                                 | PM §3 (no aparece en DM) | Dimensionamiento                      | Volumen P-11 |
| DEC-064 | Migración | **Carga de saldos iniciales** (inventario, caja, cartera, proveedores) sin transcribir históricos; **prueba paralela** con el papel | DM §13, PIL-01           | Herramientas de carga inicial         | P-16, P-04   |

### 1.8 IA y Telegram

| ID      | Dominio  | Decisión                                                                                                                                           | Fuente                                 | Impacto                                      | Dependencias |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------- | ------------ |
| DEC-070 | IA       | Asistente como **demostración funcional medible** en el MVP; **contratación opcional**                                                             | DM §10, IA-01; PM §4.B                 | Feature flag de activación                   | P-14         |
| DEC-071 | IA       | El **ERP sigue operativo sin IA**                                                                                                                  | DM §10; PM §4.A                        | Núcleo sin dependencias hacia IA             | —            |
| DEC-072 | IA       | **Toda escritura iniciada por IA**: resumen previo + **confirmación explícita** + aprobaciones de terceros cuando aplique; permisos intactos       | DM §10, IA-02                          | Máquina de estados de propuesta/confirmación | DEC-042      |
| DEC-073 | IA       | Consultas y alertas de IA **pueden ser automáticas**                                                                                               | DM §10                                 | Lecturas sin confirmación (con permisos)     | —            |
| DEC-074 | IA       | Secuencia de 6 pasos acordada (instrucción → interpretación → resumen → confirmación/aprobación → validación y ejecución única → respuesta con ID) | DM §10.1; ampliada a 10 pasos en PM §9 | Base del diseño de la Etapa D                | —            |
| DEC-075 | IA       | Uso inicial **sin cuotas individuales** por usuario                                                                                                | PM §9; DM §10.2                        | Requiere protección global (DEC-P11)         | —            |
| DEC-076 | Telegram | Telegram se **contrata separado** del asistente                                                                                                    | DM §11, TG-01; PM §4.C                 | Activable uno, ambos o ninguno               | P-13         |
| DEC-077 | Telegram | Consultas, registros remotos y **voz** contemplados **como visión**                                                                                | DM §11                                 | Alcance exacto PENDING                       | P-13, P-14   |
| DEC-078 | Telegram | Telegram aplica la **política general** de permisos y confirmaciones                                                                               | DM §11                                 | Detalle PENDING                              | P-10         |

### 1.9 Decisiones aprobadas en revisión de Etapa A (2026-10-29)

| ID      | Dominio      | Decisión                                                                                                                                                                                                                                            | Fuente                                          | Impacto                                               | Dependencias             |
| ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| DEC-080 | Procesos     | **Compras, Producción y Pedidos/Despachos son procesos independientes pero vinculados** (aprueba DEC-P01; resuelve C-01). La trazabilidad se modela compra → lote MP → orden de producción → lote PT → despacho/venta → cliente, con relaciones N:M | Responsable del proyecto, 2026-10-29 (Q-PRD-01) | Base del modelo de datos de Etapa C                   | —                        |
| DEC-081 | Contabilidad | **Contabilidad en dos capas** (aprueba DEC-P24; mitiga C-02): (a) motor contable genérico — cuentas, comprobantes, asientos balanceados, períodos — construible; (b) reglas de contabilización por operación — BLOCKED hasta P-01..P-04             | Responsable del proyecto, 2026-10-29 (Q-PRD-02) | Contabilidad deja de bloquear el roadmap completo     | P-01..P-04 para capa (b) |
| DEC-082 | Costos       | El **techo de $100.000 COP/mes aplica al núcleo**; IA y Telegram se evalúan y reportan como **costo incremental** (resuelve C-04). Dominio, correo transaccional y facturación electrónica: por precisar en Q-INF-02b                               | Responsable del proyecto, 2026-10-29 (Q-INF-02) | Selección de hosting; medición de consumo IA separada | Q-INF-02b                |

### 1.10 Decisiones del prototipo (2026-10-29)

| ID      | Dominio         | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fuente                               | Impacto                                                                                                      | Dependencias                                     |
| ------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| DEC-083 | Alcance         | **Modo prototipo:** se construye primero un prototipo demostrable con el recorrido compra → producción → inventario → venta en caja → pedido y reparto → cartera. Las recomendaciones del equipo para Q-B-01..Q-B-09 se adoptan como **configuración PROVISIONAL**: se implementan configurables, se muestran como provisionales y **se confirman o cambian antes del piloto**. No cuentan como reglas confirmadas                       | Responsable del proyecto, 2026-10-29 | Desbloquea la construcción del núcleo; las preguntas Q-B siguen abiertas para confirmación definitiva        | Q-B-01..09 (confirmación antes del piloto)       |
| DEC-084 | Infraestructura | El prototipo se construye y prueba **localmente**; el hosting en línea se contrata cuando haya algo para mostrar (Q-C-01 sigue abierta)                                                                                                                                                                                                                                                                                                  | Responsable del proyecto, 2026-10-29 | Sin costo mensual mientras se construye                                                                      | Q-C-01                                           |
| DEC-085 | IA              | El asistente de IA se construye **al final del prototipo**; proveedor y techo de gasto se deciden entonces (Q-C-05, Q-C-06)                                                                                                                                                                                                                                                                                                              | Responsable del proyecto, 2026-10-29 | La demo inicial no depende de un proveedor de IA                                                             | Q-C-05, Q-C-06                                   |
| DEC-086 | Diseño          | Se adopta el **Sistema de Diseño "Los Quatreros"** (modo oscuro nativo, Ember Orange, Inter + JetBrains Mono, UI Kit y especificación de pantallas) como **única base visual** de toda interfaz, en reemplazo del sistema visual anterior. Las reglas de negocio siguen viniendo de requerimientos y de este registro; lo que la especificación de pantallas muestre sobre temas pendientes se implementa solo al resolverse su decisión | Responsable del proyecto, 2026-10-29 | Se rehacen las pantallas de la entrega 1; anexo de accesibilidad AA en `docs/05-design/sistema-de-diseno.md` | P-06, P-10, P-01..P-04 (pantallas que los tocan) |

Estado especial `PROVISIONAL`: decisión aplicada para el prototipo por autorización del responsable, pendiente de confirmación definitiva. Cualquier regla con este estado debe poder cambiarse por configuración o con un cambio acotado.

---

## 2. Decisiones propuestas (`PROPOSED`) — requieren aprobación

### 2.1 Propuestas del Documento Maestro

| ID      | Propuesta                                                                                                                                                          | Fuente                | Quién aprueba              | Recomendación Etapa A                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-P01 | Compras, Producción y Pedidos/Despachos como **procesos independientes pero vinculados**, en lugar del "ciclo por compra con dos subciclos" del documento original | DM §4.2               | Responsable del proyecto   | ✅ **APROBADA → DEC-080.** Una compra alimenta varias producciones y un lote abastece varias ventas; el ciclo por compra rompe la trazabilidad por lote. Ver contradicción C-01 |
| DEC-P02 | Valoración de inventario por **costo promedio ponderado**                                                                                                          | DM §7.1               | Contador                   | Evaluar con contador (P-03). No bloquea la operación física                                                                                                                     |
| DEC-P03 | **Monolito modular**                                                                                                                                               | DM §12; PM §3         | Arquitectura (técnica)     | ✅ **ACEPTADA (técnica) → ADR-001**                                                                                                                                             |
| DEC-P04 | **Almacenamiento privado** de comprobantes con control de acceso                                                                                                   | DM §12                | Arquitectura               | Aprobar; elegir proveedor según costo                                                                                                                                           |
| DEC-P05 | Asistentes como **módulos opcionales que usan la API central**                                                                                                     | DM §12, §10.2         | Arquitectura               | ✅ **ACEPTADA (técnica) → ADR-015**                                                                                                                                             |
| DEC-P06 | **Servicio de herramientas de negocio compartidas** (no tres conjuntos de reglas)                                                                                  | DM §10.2              | Arquitectura               | ✅ **ACEPTADA (técnica) → ADR-015 (ToolGateway)**                                                                                                                               |
| DEC-P07 | **Auditoría** de cambios de precio, ajustes, anulaciones y aprobaciones                                                                                            | DM §8 ("recomendado") | Responsable                | Ya elevado por PM §4.E (DEC-044); confirmar alcance mínimo de eventos auditables                                                                                                |
| DEC-P08 | Vincular **identidad Telegram ↔ usuario interno** y verificación adicional para acciones sensibles                                                                 | DM §8                 | Responsable + arquitectura | Aprobar                                                                                                                                                                         |
| DEC-P09 | **Partida doble**, asientos balanceados vinculados al hecho de origen; correcciones por **reversión/ajuste**                                                       | DM §9.2               | Contador                   | Diseño candidato; validar con contador                                                                                                                                          |
| DEC-P10 | **No edición silenciosa ni eliminación destructiva** de registros cerrados                                                                                         | DM §6                 | Responsable + contador     | Aprobar como principio transversal                                                                                                                                              |
| DEC-P11 | **Límites técnicos globales de costo** de IA y protección ante bucles/reintentos                                                                                   | DM §10.2              | Producto + arquitectura    | Aprobar (techo mensual global + alertas)                                                                                                                                        |
| DEC-P12 | **Registro de consumo** de IA por petición, canal y modelo                                                                                                         | DM §10.2; PM §9       | Arquitectura               | Aprobar; PM agrega usuario, operación y período                                                                                                                                 |
| DEC-P13 | Elegir proveedor/modelo de IA **por evaluación de costos**; no congelar Hermes/OpenRouter sin pruebas                                                              | DM §10.2              | Arquitectura               | Diseñado en ADR-016 y ai-architecture §10; elección final tras benchmark                                                                                                        |
| DEC-P14 | **Controles de puesta en marcha** (fecha de corte, conteo físico por lote, verificación de cartera/CxP, revisión con contador, comparación durante piloto)         | DM §13.1              | Empresa + contador         | Aprobar                                                                                                                                                                         |

### 2.2 Propuestas nuevas **[Ampliación Etapa A]**

| ID                          | Propuesta                                                                                                                                                                                                       | Motivo                                                           | Quién aprueba             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| DEC-P20 ✅ ADR-011, ADR-021 | Los módulos operativos **emiten hechos económicos** (eventos de dominio persistidos) desde el inicio, aunque Contabilidad esté bloqueada; la contabilización se aplica cuando el contador apruebe las políticas | Desbloquea la construcción de la operación sin inventar asientos | Arquitectura (técnica)    |
| DEC-P21 ✅ ADR-009          | **Kardex / libro de movimientos inmutable** como única forma de cambiar existencias (sin `UPDATE` directo de saldos sin movimiento)                                                                             | Trazabilidad y conciliación de inventario                        | Arquitectura (técnica)    |
| DEC-P22 ✅ ADR-008          | **Dinero en enteros (pesos) o `NUMERIC`**, nunca `float`; cantidades en `NUMERIC` con escala definida por unidad                                                                                                | Evitar errores de redondeo financieros                           | Arquitectura (técnica)    |
| DEC-P23 ✅ ADR-010          | **Idempotencia** obligatoria en toda operación de escritura con efectos financieros o de inventario (no solo en IA)                                                                                             | Portal móvil con reintentos, doble clic, red inestable           | Arquitectura (técnica)    |
| DEC-P24                     | Separar la **"Contabilidad completa" del prototipo** en dos capas: (a) motor contable genérico (cuentas, comprobantes, asientos, períodos) — construible; (b) reglas de contabilización por operación — BLOCKED | Mantener el compromiso de DEC-005 sin inventar políticas         | ✅ **APROBADA → DEC-081** |

---

## 3. Decisiones pendientes (`PENDING` / `BLOCKED`)

Detalle, responsable, impacto y recomendación en `open-questions.md`.

| Clave DM | Asunto                                       | Estado DM       | Bloquea                                                               |
| -------- | -------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| P-01     | Grupo y políticas contables                  | BLOCKED         | Implementación de Contabilidad                                        |
| P-02     | Mecanismo fiscal exacto e impuestos          | BLOCKED         | Facturación, impuestos en ventas/compras, documentos fiscales del POS |
| P-03     | Costeo de producción y valoración            | BLOCKED         | Costo de lotes, margen, valoración de inventario                      |
| P-04     | Plan de cuentas y apertura                   | BLOCKED         | Contabilidad, carga inicial contable                                  |
| P-05     | Producto vencido y retiros                   | PENDING CRÍTICO | Reglas de vencidos/recall                                             |
| P-06     | Apertura de paquetes y conversión            | PENDING CRÍTICO | Movimientos de presentación                                           |
| P-07     | Mermas y diferencias en cocina               | PENDING CRÍTICO | Ajustes de inventario de cocina                                       |
| P-08     | Rutas, devoluciones y liquidación de reparto | PENDING         | Liquidación de distribuidores                                         |
| P-09     | Cancelaciones, reembolsos y descuentos       | PENDING         | Excepciones comerciales, anulaciones POS                              |
| P-10     | Matriz definitiva de privilegios             | PENDING         | Escrituras por IA/Telegram (DM §15.2)                                 |
| P-11     | Volumen diario y concurrencia                | PENDING         | Valores de RNF de rendimiento                                         |
| P-12     | RPO/RTO y hosting                            | PENDING         | Despliegue y backups                                                  |
| P-13     | Telegram sin asistente                       | PENDING         | Alcance de Telegram                                                   |
| P-14     | Precios y límites técnicos IA                | PENDING         | Límites, modelo comercial                                             |
| P-15     | Landing                                      | PENDING         | — (fuera de compromiso)                                               |
| P-16     | Piloto paralelo                              | PENDING         | Puesta en producción                                                  |

---

## 4. Contradicciones y tensiones detectadas

| ID   | Tensión                                                                                                                                                      | Fuentes         | Impacto                                                                         | Recomendación                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| C-01 | El documento original propone **un ciclo por cada compra** con dos subciclos; el DM propone procesos **independientes y vinculados**                         | DM §4.2         | Cambia el modelo de datos completo de trazabilidad                              | ✅ Resuelta por DEC-080                                                                     |
| C-02 | **Contabilidad formal está en el alcance del prototipo** (DEC-005) pero sus políticas están **bloqueadas** (P-01..P-04)                                      | DM §1, §9.1     | Riesgo de que el prototipo se entregue sin contabilidad o con reglas inventadas | Mitigada por DEC-081; sigue pendiente sesión con contador                                   |
| C-03 | **Precio único** (DEC-020) vs. módulo que menciona **"excepciones comerciales"** y descuentos pendientes                                                     | DM §5, §7.3     | Si hay descuentos, el precio de venta deja de ser único                         | Definir en P-09 si el precio único es de lista y las excepciones son descuentos autorizados |
| C-04 | El presupuesto < $100k COP **incluye IA** según DM §12.1, pero PM §3 dice que los servicios opcionales se **evalúan por separado**                           | DM §12.1; PM §3 | Cambia la viabilidad económica                                                  | ✅ Resuelta por DEC-082                                                                     |
| C-05 | "6–15 usuarios" aparece en PM pero **no en DM**, donde volumen y concurrencia siguen pendientes (P-11)                                                       | PM §3; DM §14   | Bajo; son métricas distintas                                                    | Registrar en DM v1.1                                                                        |
| C-06 | Auditoría **recomendada** en DM §8 vs. **obligatoria** en PM §4.E                                                                                            | DM §8; PM §4.E  | Bajo                                                                            | Tratar como obligatoria (DEC-044) y definir catálogo mínimo de eventos                      |
| C-07 | Telegram incluye **voz** como visión, pero la transcripción requiere un servicio de voz (con costo) cuya relación con la "IA no contratada" no está definida | DM §11; PM §10  | Alcance y costo de Telegram                                                     | Resolver en P-13/P-14                                                                       |
| C-08 | Rol **"Comprador / encargado"** aparece en actores pero está "pendiente de formalizar"                                                                       | DM §3           | Permisos de compras                                                             | Resolver en P-10                                                                            |
