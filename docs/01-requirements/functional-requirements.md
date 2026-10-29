# Requerimientos funcionales

> Etapa B · v0.1 · 2026-10-29
> Plantilla completa de `quatreros-sdd-spec`. Los rangos siguen `traceability-matrix.md` §2.
> **Excepciones comunes a todo RF** (no se repiten en cada uno): `E-PERM` permiso insuficiente (403) · `E-SITE` registro de sede no asignada (404, no revela existencia) · `E-VAL` datos inválidos (422 con detalle por campo) · `E-DUP` misma clave de idempotencia → devuelve el resultado original sin duplicar (BR-007) · `E-CONC` conflicto de concurrencia (409, reintentar). Cada RF lista solo sus excepciones **propias**.
> Prioridad: **Alta** = necesaria para operar el núcleo en piloto · **Media** = necesaria antes de abandonar el papel · **Baja** = puede posponerse.

---

## Índice

| Módulo | RF              | Módulo   | RF              |
| ------ | --------------- | -------- | --------------- |
| ADM    | RF-001 – RF-008 | DIS      | RF-180 – RF-186 |
| CAT    | RF-030 – RF-033 | POS      | RF-220 – RF-227 |
| COMP   | RF-050 – RF-053 | FIN      | RF-260 – RF-266 |
| PROD   | RF-080 – RF-084 | CONT     | RF-300 – RF-305 |
| INV    | RF-110 – RF-119 | IA       | RF-340 – RF-345 |
| COM    | RF-150 – RF-153 | TG / MIG | RF-370 – RF-376 |

---

## 1. Administración (ADM)

### RF-001 — Autenticación con correo, contraseña y MFA

- Módulo: ADM
- Descripción: Iniciar sesión con correo y contraseña; exigir segundo factor a los roles configurados como sensibles.
- Actor responsable: Todos los usuarios internos
- Precondiciones: Usuario activo.
- Flujo esperado: 1. Ingresa correo y contraseña. 2. El sistema valida credenciales. 3. Si su rol exige MFA, solicita el código. 4. Crea la sesión con sus roles y sedes. 5. Registra el inicio de sesión.
- Excepciones: credenciales inválidas (mensaje genérico); cuenta bloqueada por intentos; MFA no configurado → flujo obligatorio de configuración.
- Reglas relacionadas: BR-002, BR-010
- Dependencias: Q-SEC-02 (roles sensibles, sesión)
- Prioridad sugerida: Alta
- Estado: CONFIRMED (método) · PROPOSED (detalles de sesión)
- Fuente: DM §8, DEC-043

### RF-002 — Recuperación de contraseña y restablecimiento de MFA

- Módulo: ADM
- Descripción: Recuperar contraseña mediante enlace de un solo uso; el restablecimiento de MFA solo lo hace un Administrador.
- Actor responsable: Usuario; Administrador (MFA)
- Precondiciones: Usuario activo con correo válido.
- Flujo esperado: 1. Solicita recuperación. 2. Recibe enlace con expiración. 3. Define nueva contraseña. 4. Se cierran sus otras sesiones. 5. Auditoría.
- Excepciones: enlace expirado o usado; correo inexistente (misma respuesta que existente).
- Reglas relacionadas: BR-005
- Dependencias: integración de correo transaccional (INT-03)
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §8 ("sesiones y recuperación: pendiente")

### RF-003 — Gestión de usuarios

- Módulo: ADM
- Descripción: Crear, editar, desactivar y reactivar usuarios; asignar roles y sedes.
- Actor responsable: Administrador
- Precondiciones: Roles y sedes existentes.
- Flujo esperado: 1. Crea usuario con nombre, correo, roles y sedes. 2. El usuario recibe invitación para definir contraseña. 3. Cambios de rol/sede quedan auditados.
- Excepciones: correo duplicado; intento de borrar usuario → solo desactivar; Administrador intenta quitarse su propio rol de Administrador si es el último → rechazado.
- Reglas relacionadas: BR-001, BR-005, BR-010
- Dependencias: RF-004
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §3, §8, DEC-040

### RF-004 — Gestión de roles y permisos

- Módulo: ADM
- Descripción: Mantener roles predefinidos editables y crear roles nuevos asignando permisos con alcance (`ALL`, `SITE`, `OWN`).
- Actor responsable: Administrador
- Precondiciones: Catálogo de permisos del sistema.
- Flujo esperado: 1. Selecciona o crea un rol. 2. Marca permisos y alcances. 3. Guarda; los cambios aplican en la siguiente petición de cada usuario. 4. Auditoría con antes/después.
- Excepciones: rol en uso no puede eliminarse (solo inactivarse); el rol Administrador conserva siempre `adm.user.*`.
- Reglas relacionadas: BR-002, BR-005
- Dependencias: Aprobación de la matriz inicial (`actors-permissions.md`, P-10)
- Prioridad sugerida: Alta
- Estado: CONFIRMED (capacidad) · PROPOSED (matriz inicial)
- Fuente: DM §8, DEC-040

### RF-005 — Gestión de sedes y ubicaciones

- Módulo: ADM
- Descripción: Registrar sedes (bodega, punto de venta) y sus ubicaciones de inventario (bodega principal, POS fabricados, cocina).
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: 1. Crea sede con tipo. 2. Crea ubicaciones dentro de la sede. 3. Asigna usuarios a la sede (RF-003).
- Excepciones: ubicación con existencias no puede inactivarse.
- Reglas relacionadas: BR-001, BR-082, BR-146
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED (1 bodega + 1 POS, ampliable)
- Fuente: DM §2.2, DEC-004

### RF-006 — Políticas de aprobación configurables

- Módulo: ADM
- Descripción: Configurar para cada política AP-xx si está activa, quién aprueba, umbral de monto/cantidad y expiración.
- Actor responsable: Administrador
- Precondiciones: Catálogo de políticas AP-01..AP-10.
- Flujo esperado: 1. Selecciona política. 2. Ajusta aprobadores y umbrales. 3. Guarda con auditoría.
- Excepciones: políticas confirmadas por el DM (AP-01, AP-02, AP-03) no pueden desactivarse.
- Reglas relacionadas: BR-003, BR-004
- Dependencias: P-10 (umbrales iniciales)
- Prioridad sugerida: Alta
- Estado: CONFIRMED (capacidad) · PENDING (umbrales)
- Fuente: DM §8, DEC-042

### RF-007 — Bandeja de aprobaciones

- Módulo: ADM
- Descripción: Solicitar, aprobar o rechazar operaciones excepcionales; la operación se ejecuta solo tras aprobación y revalidación.
- Actor responsable: Solicitante (cualquier rol); Aprobador (ADM/MGR según política)
- Precondiciones: Operación que cae en una política AP activa.
- Flujo esperado: 1. El sistema detecta la excepción y crea la solicitud con datos exactos y motivo. 2. El aprobador la ve en su bandeja (web; notificación por Telegram si está activo). 3. Aprueba o rechaza con comentario. 4. Al aprobar, el backend revalida y ejecuta una sola vez. 5. Se notifica al solicitante con el resultado real.
- Excepciones: solicitante intenta aprobar su solicitud (BR-004); aprobación expirada; datos cambiaron desde la solicitud → requiere nueva solicitud; revalidación falla (p. ej. ya no hay existencia) → se informa sin ejecutar.
- Reglas relacionadas: BR-003, BR-004, BR-005
- Dependencias: RF-006
- Prioridad sugerida: Alta
- Estado: CONFIRMED (concepto) · PROPOSED (mecánica)
- Fuente: DM §8, DEC-042

### RF-008 — Consulta de auditoría

- Módulo: ADM
- Descripción: Consultar el registro de auditoría filtrando por usuario, entidad, acción, canal (web/IA/Telegram), sede y fechas.
- Actor responsable: Administrador; Manager (su sede); Contador
- Precondiciones: —
- Flujo esperado: 1. Aplica filtros. 2. Ve listado paginado. 3. Abre un evento con valores antes/después y aprobación asociada.
- Excepciones: —
- Reglas relacionadas: BR-005
- Dependencias: —
- Prioridad sugerida: Media
- Estado: CONFIRMED
- Fuente: PM §4.E, DEC-044

## 2. Catálogo y precios (CAT)

### RF-030 — Gestión de productos y presentaciones

- Módulo: CAT
- Descripción: Registrar productos fabricados y alimentos preparados con unidad base, presentaciones (unidad, paquete × N), vida útil y estado.
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: 1. Crea producto con tipo y unidad base. 2. Define presentaciones y su composición. 3. Para fabricados, define vida útil (Q-PRO-04).
- Excepciones: cambiar composición de una presentación con movimientos → se exige presentación nueva (BR-021).
- Reglas relacionadas: BR-020, BR-021
- Dependencias: Q-PRO-04
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §2.2, §6, DEC-015

### RF-031 — Gestión de materias primas

- Módulo: CAT
- Descripción: Registrar materias primas con unidad de inventario (kg, unidad, metro…) y si controlan vencimiento.
- Actor responsable: Administrador; Manager; Comprador
- Precondiciones: —
- Flujo esperado: 1. Crea materia prima. 2. Define unidad y control de vencimiento.
- Excepciones: unidad no puede cambiarse si hay movimientos.
- Reglas relacionadas: BR-009
- Dependencias: Glosario: insumos no alimentarios (empaques) — confirmar
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §6

### RF-032 — Gestión de precios con histórico

- Módulo: CAT
- Descripción: Fijar el precio único vigente por producto/presentación y conservar el histórico.
- Actor responsable: Administrador
- Precondiciones: Producto y presentación activos.
- Flujo esperado: 1. Ingresa nuevo precio. 2. El sistema cierra la vigencia anterior y abre la nueva. 3. Auditoría.
- Excepciones: precio ≤ 0 → rechazado.
- Reglas relacionadas: BR-022, BR-023, BR-025, BR-005
- Dependencias: Q-COM-03 (efecto en pedidos abiertos)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.3, DEC-020

### RF-033 — Recetas de producción con versiones

- Módulo: CAT / PROD
- Descripción: Registrar recetas con cantidades exactas de cada materia prima por cantidad de producto y rendimiento esperado; cada cambio crea una versión.
- Actor responsable: Administrador; Manager
- Precondiciones: Producto fabricado y materias primas existentes.
- Flujo esperado: 1. Crea receta (lote base, ingredientes, cantidades, rendimiento esperado, tolerancia). 2. Al editar, se crea versión nueva vigente.
- Excepciones: receta sin ingredientes o con cantidad ≤ 0 → rechazada.
- Reglas relacionadas: BR-062, BR-063, BR-066
- Dependencias: Q-PRO-01 (subproductos)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.1, DEC-011

## 3. Compras (COMP)

### RF-050 — Gestión de proveedores

- Módulo: COMP
- Descripción: Registrar proveedores (nombre, identificación, contacto, materias primas que suministra).
- Actor responsable: Administrador; Manager; Comprador
- Precondiciones: —
- Flujo esperado: Crear, editar, inactivar.
- Excepciones: identificación duplicada.
- Reglas relacionadas: BR-040
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §3, §6

### RF-051 — Registro de compra

- Módulo: COMP
- Descripción: Registrar una compra a un proveedor con líneas (materia prima, cantidad, unidad, costo unitario) y adjuntar soporte.
- Actor responsable: Comprador; Manager; Administrador
- Precondiciones: Proveedor y materias primas activos.
- Flujo esperado: 1. Selecciona proveedor y sede. 2. Agrega líneas. 3. Adjunta soporte (opcional). 4. Guarda; queda "pendiente de recepción".
- Excepciones: cantidad o costo ≤ 0; impuestos → BLOCKED (BR-044), se registra el valor total pagado sin desglose fiscal mientras tanto.
- Reglas relacionadas: BR-040, BR-041, BR-044
- Dependencias: P-02
- Prioridad sugerida: Alta
- Estado: CONFIRMED (registro) · BLOCKED (impuestos)
- Fuente: DM §4.1, §5

### RF-052 — Recepción de materia prima

- Módulo: COMP / INV
- Descripción: Registrar la recepción total o parcial de una compra, creando lotes de materia prima y entradas al inventario.
- Actor responsable: Comprador; Manager
- Precondiciones: Compra pendiente de recepción.
- Flujo esperado: 1. Abre la compra. 2. Indica cantidades recibidas, ubicación y vencimiento si aplica. 3. El sistema crea lotes MP y movimientos de entrada en una transacción. 4. Actualiza saldo pendiente de la compra.
- Excepciones: cantidad recibida > pendiente → requiere confirmación y motivo; vencimiento ya pasado → rechazado.
- Reglas relacionadas: BR-041, BR-042, BR-043, BR-008
- Dependencias: RF-051
- Prioridad sugerida: Alta
- Estado: CONFIRMED (recepción) · PROPOSED (parcial, lote MP)
- Fuente: DM §4.1, §7.1

### RF-053 — Anulación de compra o recepción

- Módulo: COMP
- Descripción: Anular una compra no recibida o revertir una recepción mediante movimientos inversos.
- Actor responsable: Manager (solicita); Administrador (aprueba)
- Precondiciones: La MP recibida no se ha consumido, o el consumo se gestiona aparte.
- Flujo esperado: 1. Solicita anulación con motivo. 2. Aprobación AP-06. 3. Movimientos inversos y estado "anulada". 4. Auditoría.
- Excepciones: lote MP ya consumido parcialmente → rechazado con detalle de las órdenes que lo usaron.
- Reglas relacionadas: BR-006, BR-003
- Dependencias: P-09 (política de anulaciones)
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §6, §8

## 4. Producción (PROD)

### RF-080 — Sugerencias de producción y compra

- Módulo: PROD
- Descripción: Mostrar productos y materias primas cuya existencia disponible está por debajo del punto de reorden, con cantidad sugerida.
- Actor responsable: Productor; Manager; Comprador
- Precondiciones: Puntos de reorden configurados.
- Flujo esperado: 1. Abre el tablero. 2. Ve listado ordenado por urgencia. 3. Puede crear una orden de producción o una compra desde la sugerencia (sin que se cree sola).
- Excepciones: producto sin punto de reorden → no aparece.
- Reglas relacionadas: BR-061, BR-067
- Dependencias: Q-PRO-03
- Prioridad sugerida: Media
- Estado: CONFIRMED (concepto) · PENDING (criterio)
- Fuente: DM §7.1, DEC-010

### RF-081 — Creación de orden de producción

- Módulo: PROD
- Descripción: Crear una orden con producto, cantidad a producir, versión de receta, sede, responsable y fecha.
- Actor responsable: Productor; Manager
- Precondiciones: Receta vigente.
- Flujo esperado: 1. Selecciona producto y cantidad. 2. El sistema muestra consumo teórico y disponibilidad de MP. 3. Guarda en estado "planificada".
- Excepciones: MP insuficiente → advertencia (no bloquea crear, bloquea iniciar).
- Reglas relacionadas: BR-060, BR-061, BR-062
- Dependencias: RF-033
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §6, §7.1

### RF-082 — Registro de consumo real

- Módulo: PROD / INV
- Descripción: Registrar la materia prima efectivamente consumida, por lote de MP (FEFO sugerido para MP con vencimiento).
- Actor responsable: Productor
- Precondiciones: Orden "planificada" o "en proceso".
- Flujo esperado: 1. Inicia la orden. 2. Confirma o corrige cantidades reales por MP y lote. 3. El sistema descarga existencias y vincula lotes MP a la orden.
- Excepciones: existencia insuficiente en el lote; desviación frente al teórico registrada.
- Reglas relacionadas: BR-063, BR-064, BR-081
- Dependencias: RF-081
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §6, DEC-012, DEC-013

### RF-083 — Cierre de orden y creación de lote de producto terminado

- Módulo: PROD / INV
- Descripción: Registrar la producción real por presentación, crear el lote PT con fechas y calcular el rendimiento.
- Actor responsable: Productor
- Precondiciones: Consumo real registrado.
- Flujo esperado: 1. Ingresa cantidades producidas (unidades o paquetes). 2. El sistema crea el lote con fecha de fabricación y vencimiento (vida útil). 3. Calcula rendimiento real/esperado. 4. Entrada al inventario de la ubicación de producción. 5. Emite hecho económico (sin costo oficial, BR-068).
- Excepciones: rendimiento fuera de tolerancia → motivo obligatorio (BR-066).
- Reglas relacionadas: BR-065, BR-066, BR-068, BR-200
- Dependencias: Q-PRO-02, Q-PRO-04
- Prioridad sugerida: Alta
- Estado: CONFIRMED (registro) · BLOCKED (costo)
- Fuente: DM §5, §7.1

### RF-084 — Anulación de orden de producción

- Módulo: PROD
- Descripción: Anular una orden planificada, o revertir una cerrada cuyo lote no ha tenido salidas.
- Actor responsable: Administrador (aprueba)
- Precondiciones: Lote PT sin movimientos de salida.
- Flujo esperado: Solicitud con motivo → AP-06 → movimientos inversos de PT y MP → auditoría.
- Excepciones: lote con salidas → rechazado.
- Reglas relacionadas: BR-006
- Dependencias: P-09
- Prioridad sugerida: Baja
- Estado: PROPOSED
- Fuente: DM §6

## 5. Inventarios (INV)

### RF-110 — Consulta de existencias

- Módulo: INV
- Descripción: Consultar existencias y existencia disponible por producto, presentación, lote, ubicación y estado, con fechas de vencimiento.
- Actor responsable: Roles con `inv.stock.read`
- Precondiciones: —
- Flujo esperado: Filtros + listado + totales; alerta visual de lotes próximos a vencer.
- Excepciones: —
- Reglas relacionadas: BR-082, BR-085, BR-001
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §2.1, §5

### RF-111 — Kardex de movimientos

- Módulo: INV
- Descripción: Consultar el historial cronológico de movimientos con su documento de origen.
- Actor responsable: ADM, MGR, CONT
- Precondiciones: —
- Flujo esperado: Filtrar por producto/lote/ubicación/fechas; enlazar al documento origen.
- Excepciones: —
- Reglas relacionadas: BR-080
- Dependencias: —
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DEC-P21

### RF-112 — Asignación de lotes por FEFO

- Módulo: INV (servicio usado por DIS y POS)
- Descripción: Asignar automáticamente lotes por vencimiento más próximo en toda salida de producto terminado.
- Actor responsable: Sistema (invocado por RF-181, RF-114, RF-223)
- Precondiciones: Existencia disponible suficiente.
- Flujo esperado: 1. Recibe producto, presentación, cantidad y ubicación. 2. Ordena lotes vendibles por vencimiento. 3. Devuelve la asignación (puede repartir entre lotes).
- Excepciones: disponible insuficiente → error con cantidad faltante.
- Reglas relacionadas: BR-083, BR-085, BR-086
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.1, DEC-014

### RF-113 — Excepción FEFO

- Módulo: INV
- Descripción: Solicitar el uso de un lote distinto al asignado, con motivo, y ejecutar tras aprobación.
- Actor responsable: Solicitante (PROD, DIST, CAJ, MGR); Aprobador (ADM, MGR)
- Precondiciones: Asignación FEFO calculada.
- Flujo esperado: 1. Elige otro lote y motivo. 2. Solicitud AP-03. 3. Tras aprobación, la salida usa el lote elegido.
- Excepciones: lote elegido vencido o bloqueado → rechazado.
- Reglas relacionadas: BR-084, BR-086, BR-003
- Dependencias: RF-007, Q-INV-03
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.1, DEC-014

### RF-114 — Traslado entre ubicaciones

- Módulo: INV
- Descripción: Enviar producto de una ubicación a otra (bodega → POS, POS fabricados → cocina) y confirmar la recepción en destino.
- Actor responsable: Envía: MGR/PROD; Recibe: MGR/CAJ de la sede destino
- Precondiciones: Ubicaciones activas; existencia disponible en origen.
- Flujo esperado: 1. Crea traslado con productos y cantidades; lotes por FEFO. 2. Sale de origen, queda en tránsito. 3. Destino confirma cantidades recibidas. 4. Entrada en destino.
- Excepciones: diferencia entre enviado y recibido → novedad (BR-089).
- Reglas relacionadas: BR-088, BR-089, BR-083
- Dependencias: Q-POS-01
- Prioridad sugerida: Alta
- Estado: CONFIRMED (traslado) · PROPOSED (tránsito, novedad)
- Fuente: DM §5, DEC-016

### RF-115 — Conteo físico y ajuste

- Módulo: INV
- Descripción: Registrar conteos por ubicación y generar ajustes por las diferencias, con motivo y aprobación sobre umbral.
- Actor responsable: Cuenta: COMP/PROD/CAJ/MGR; Ajusta: MGR/ADM
- Precondiciones: —
- Flujo esperado: 1. Registra conteo (producto, lote, cantidad). 2. El sistema compara con existencia teórica. 3. Propone ajustes. 4. Ajuste con motivo; AP-05 si supera umbral.
- Excepciones: movimientos registrados durante el conteo → advertencia.
- Reglas relacionadas: BR-091, BR-080
- Dependencias: Q-INV-04
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §6

### RF-116 — Apertura de paquete

- Módulo: INV
- Descripción: Transformar un paquete en sus unidades del mismo lote y ubicación.
- Actor responsable: Según P-06
- Precondiciones: Existencia del paquete.
- Flujo esperado: 1. Selecciona paquete y cantidad a abrir. 2. Salida de paquetes y entrada de N × unidades en una transacción.
- Excepciones: —
- Reglas relacionadas: BR-090, BR-009
- Dependencias: **P-06**
- Prioridad sugerida: Alta
- Estado: PENDING
- Fuente: DM §7.1, PRO-01

### RF-117 — Bloqueo y desbloqueo de lotes

- Módulo: INV
- Descripción: Marcar un lote como bloqueado (no vendible) con motivo y desbloquearlo.
- Actor responsable: PROD, MGR, ADM
- Precondiciones: —
- Flujo esperado: Cambiar estado con motivo → auditoría → excluido de FEFO.
- Excepciones: —
- Reglas relacionadas: BR-085, BR-005
- Dependencias: P-05
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §6 (estado de lote)

### RF-118 — Consulta de trazabilidad de lote

- Módulo: INV
- Descripción: Para un lote de PT, mostrar lotes de MP y proveedores (hacia atrás) y despachos, clientes y ventas (hacia adelante).
- Actor responsable: ADM, MGR, PROD, CONT
- Precondiciones: —
- Flujo esperado: Buscar lote → árbol de trazabilidad → exportar.
- Excepciones: —
- Reglas relacionadas: BR-092
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.1, DEC-013

### RF-119 — Gestión de vencidos y retiro de lote

- Módulo: INV
- Descripción: Tratamiento del producto vencido y procedimiento de retiro de un lote distribuido.
- Actor responsable: Producción
- Precondiciones: —
- Flujo esperado: Por definir.
- Excepciones: —
- Reglas relacionadas: BR-086, BR-087
- Dependencias: **P-05**
- Prioridad sugerida: Media
- Estado: PENDING
- Fuente: DM §14

## 6. Comercial (COM)

### RF-150 — Gestión de clientes

- Módulo: COM
- Descripción: Registrar clientes (tipo: restaurante, negocio, persona natural), contacto, dirección de entrega y, si aplica, crédito (RF-260).
- Actor responsable: ADM, MGR
- Precondiciones: —
- Flujo esperado: Crear, editar, inactivar.
- Excepciones: identificación duplicada; inactivar cliente con cartera pendiente → advertencia.
- Reglas relacionadas: BR-110
- Dependencias: RNF-021 (política de datos personales)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §2.2, DEC-003

### RF-151 — Registro de pedido

- Módulo: COM
- Descripción: Registrar un pedido con cliente, canal, líneas (producto, presentación, cantidad), modalidad de pago y fecha de entrega deseada.
- Actor responsable: ADM, MGR, CAJ
- Precondiciones: Cliente activo.
- Flujo esperado: 1. Selecciona cliente y canal. 2. Agrega líneas con precio vigente. 3. Si es a crédito, valida cupo y cartera (BR-171). 4. Confirma; se fija precio y se reservan cantidades.
- Excepciones: excede cupo o cartera vencida → solicitud AP-01/AP-02; disponibilidad insuficiente → advertencia (permite confirmar con pendiente de producción).
- Reglas relacionadas: BR-110, BR-111, BR-024, BR-093, BR-171
- Dependencias: Q-COM-03, Q-COM-04, Q-COM-05
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §2.2, §7.3

### RF-152 — Seguimiento de pedidos

- Módulo: COM
- Descripción: Consultar pedidos por estado (borrador, confirmado, en despacho, parcialmente entregado, entregado, cancelado) con pendientes por línea.
- Actor responsable: ADM, MGR
- Precondiciones: —
- Flujo esperado: Listado con filtros y detalle con historial de entregas.
- Excepciones: —
- Reglas relacionadas: BR-112
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.2

### RF-153 — Cancelación de pedido y descuentos

- Módulo: COM
- Descripción: Cancelar pedidos y aplicar descuentos.
- Actor responsable: Por definir
- Precondiciones: —
- Flujo esperado: Por definir.
- Excepciones: —
- Reglas relacionadas: BR-113, BR-114
- Dependencias: **P-09**
- Prioridad sugerida: Media
- Estado: PENDING
- Fuente: DM §7.3

## 7. Distribución (DIS)

### RF-180 — Creación de despacho y asignación

- Módulo: DIS
- Descripción: Agrupar pedidos confirmados en un despacho y asignarlo a un distribuidor.
- Actor responsable: ADM, MGR
- Precondiciones: Pedidos confirmados con pendiente.
- Flujo esperado: 1. Selecciona pedidos y cantidades a enviar. 2. Asigna distribuidor y fecha. 3. Estado "preparado".
- Excepciones: pedido ya en otro despacho activo por la misma cantidad → rechazado.
- Reglas relacionadas: BR-120
- Dependencias: RF-151
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §5, §7.2

### RF-181 — Salida del despacho

- Módulo: DIS / INV
- Descripción: Confirmar la carga: asignación FEFO, salida de bodega y mercancía bajo responsabilidad del distribuidor.
- Actor responsable: MGR (confirma carga); DIST (acepta)
- Precondiciones: Despacho "preparado".
- Flujo esperado: 1. El sistema asigna lotes FEFO. 2. Confirma carga. 3. Movimientos de salida a ubicación "en ruta". 4. Estado "en ruta".
- Excepciones: disponible insuficiente → ajustar cantidades o excepción FEFO.
- Reglas relacionadas: BR-121, BR-083
- Dependencias: RF-112
- Prioridad sugerida: Alta
- Estado: CONFIRMED (FEFO) · PROPOSED (en ruta)
- Fuente: DM §7.1, §7.2

### RF-182 — Portal móvil del distribuidor

- Módulo: DIS
- Descripción: Interfaz web móvil donde el distribuidor ve sus despachos, pedidos, direcciones, montos a cobrar y registra entregas, cobros y devoluciones.
- Actor responsable: Distribuidor
- Precondiciones: Sesión iniciada; conexión a Internet.
- Flujo esperado: 1. Ve despachos del día. 2. Abre un pedido. 3. Registra entrega (RF-183), cobro (RF-184) o devolución (RF-185).
- Excepciones: sin conexión → mensaje claro y reintento; no se guarda localmente (sin offline, DEC-061).
- Reglas relacionadas: BR-122, BR-007
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §3, §7.2, DEC-024

### RF-183 — Registro de entrega total o parcial

- Módulo: DIS
- Descripción: Registrar cantidades entregadas por línea; si son menores, el saldo queda pendiente y el pedido abierto para reprogramar.
- Actor responsable: Distribuidor
- Precondiciones: Despacho "en ruta" asignado al usuario.
- Flujo esperado: 1. Confirma cantidades entregadas. 2. Registra motivo si es parcial. 3. Si es a crédito, se crea la obligación (BR-172). 4. Actualiza pendientes del pedido.
- Excepciones: cantidad entregada > cargada → rechazado.
- Reglas relacionadas: BR-123, BR-112, BR-172
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.2, DEC-025

### RF-184 — Registro de recaudo en ruta

- Módulo: DIS / FIN
- Descripción: Registrar cobros contraentrega y abonos de cartera recibidos por el distribuidor, por método de pago.
- Actor responsable: Distribuidor
- Precondiciones: Entrega registrada o cliente con cartera.
- Flujo esperado: 1. Ingresa montos por método. 2. Adjunta soporte de transferencia (opcional). 3. Queda como recaudo del distribuidor pendiente de conciliación.
- Excepciones: monto > saldo a cobrar → confirmación adicional.
- Reglas relacionadas: BR-175, BR-176, BR-174
- Dependencias: Q-DIS-04
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.2, DEC-027

### RF-185 — Devolución e inspección

- Módulo: DIS / INV
- Descripción: Registrar devoluciones de clientes (en ruta) e inspeccionarlas en bodega para reincorporar o descartar.
- Actor responsable: Registra: DIST; Inspecciona: PROD/MGR
- Precondiciones: Entrega previa al cliente.
- Flujo esperado: 1. Registra producto, cantidad, lote y motivo. 2. Ingresa a estado "en inspección". 3. Inspección: reincorporar o descartar (AP-08). 4. Si afecta cartera/cobro, se ajusta (tratamiento contable BLOCKED).
- Excepciones: lote desconocido → se registra y se identifica en inspección.
- Reglas relacionadas: BR-125, BR-126
- Dependencias: P-01 (efecto contable)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.2, DEC-026

### RF-186 — Liquidación del distribuidor

- Módulo: DIS / FIN
- Descripción: Cuadrar al regreso la mercancía (cargada vs. entregada, devuelta y sobrante) y el dinero (esperado vs. entregado).
- Actor responsable: MGR; DIST
- Precondiciones: Despacho "en ruta" finalizado.
- Flujo esperado: Propuesto: 1. El sistema calcula los cuadres. 2. Se registra sobrante que reingresa (BR-124). 3. Se registra dinero recibido. 4. Diferencias registradas. Tratamiento de faltantes: PENDING.
- Excepciones: —
- Reglas relacionadas: BR-124, BR-127, BR-177
- Dependencias: **P-08**, Q-DIS-01, Q-DIS-03
- Prioridad sugerida: Alta
- Estado: PENDING
- Fuente: DM §7.2, §14

## 8. POS y cocina (POS)

### RF-220 — Apertura de turno

- Módulo: POS
- Descripción: Abrir turno en una caja registrando la base de efectivo.
- Actor responsable: Cajero
- Precondiciones: Caja sin turno abierto; cajero sin turno abierto.
- Flujo esperado: 1. Selecciona caja. 2. Ingresa base. 3. Turno "abierto".
- Excepciones: turno abierto existente (BR-141).
- Reglas relacionadas: BR-140, BR-141, BR-142
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.4, DEC-032

### RF-221 — Venta inmediata

- Módulo: POS
- Descripción: Registrar una venta de productos fabricados (unidad o paquete) y alimentos preparados.
- Actor responsable: Cajero
- Precondiciones: Turno abierto.
- Flujo esperado: 1. Agrega productos (búsqueda rápida). 2. Ve total. 3. Registra pagos (RF-222). 4. Al confirmar: salida FEFO de fabricados, consumo teórico de preparados, pagos, comprobante interno, hecho económico.
- Excepciones: existencia insuficiente de fabricado → aviso (apertura de paquete según P-06); documento fiscal → BLOCKED (BR-150).
- Reglas relacionadas: BR-140, BR-083, BR-146, BR-147, BR-150, BR-200
- Dependencias: P-02, P-06
- Prioridad sugerida: Alta
- Estado: CONFIRMED (venta) · BLOCKED (documento fiscal)
- Fuente: DM §7.4, DEC-030, DEC-031

### RF-222 — Pagos mixtos

- Módulo: POS / FIN
- Descripción: Registrar uno o varios pagos por venta con distintos métodos; calcular cambio en efectivo.
- Actor responsable: Cajero
- Precondiciones: Venta con total.
- Flujo esperado: 1. Agrega pagos. 2. El sistema valida suma = total (cambio si sobra efectivo). 3. Confirma.
- Excepciones: suma < total → no permite confirmar.
- Reglas relacionadas: BR-143
- Dependencias: Q-POS-02 (métodos)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.4, DEC-031

### RF-223 — Cierre de turno con arqueo

- Módulo: POS / FIN
- Descripción: Cerrar turno contando el dinero por método, calcular diferencia y exigir justificación si existe.
- Actor responsable: Cajero
- Precondiciones: Turno abierto del cajero.
- Flujo esperado: 1. Ingresa conteo por método. 2. El sistema calcula esperado y diferencia. 3. Si hay diferencia, justificación obligatoria. 4. Turno "cerrado"; si hay diferencia, "pendiente de revisión".
- Excepciones: —
- Reglas relacionadas: BR-144, BR-145, BR-006
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.4, DEC-033

### RF-224 — Revisión de diferencias de caja

- Módulo: POS
- Descripción: El supervisor revisa los cierres con diferencia y registra su conclusión.
- Actor responsable: ADM, MGR
- Precondiciones: Turno cerrado con diferencia.
- Flujo esperado: Bandeja → revisa ventas/pagos del turno → registra conclusión → "revisado".
- Excepciones: el cajero no puede revisar su propio turno (BR-004).
- Reglas relacionadas: BR-145, BR-004
- Dependencias: Q-POS-04 (tratamiento contable de sobrantes/faltantes)
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.4, DEC-033

### RF-225 — Recetas de platos

- Módulo: POS
- Descripción: Definir ingredientes y cantidades de cada alimento preparado para calcular consumo teórico.
- Actor responsable: ADM, MGR
- Precondiciones: Productos e ingredientes existentes.
- Flujo esperado: Crear/editar con versión.
- Excepciones: —
- Reglas relacionadas: BR-147
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: PROPOSED (necesaria para COC-01)
- Fuente: DM §7.4

### RF-226 — Conteos de cocina y consumo teórico

- Módulo: POS / INV
- Descripción: Registrar conteos inicial y final de ingredientes de cocina y calcular diferencias contra el consumo teórico del período.
- Actor responsable: Cajero / encargado de cocina; MGR
- Precondiciones: Recetas de platos.
- Flujo esperado: 1. Conteo inicial. 2. Ventas del período generan consumo teórico. 3. Conteo final. 4. El sistema calcula diferencia por ingrediente (BR-148).
- Excepciones: falta conteo inicial → advertencia.
- Reglas relacionadas: BR-147, BR-148
- Dependencias: Período de conteo (turno/día) PENDING
- Prioridad sugerida: Media
- Estado: CONFIRMED
- Fuente: DM §7.4, DEC-034

### RF-227 — Clasificación y ajuste de diferencias de cocina

- Módulo: POS
- Descripción: Clasificar diferencias y generar el ajuste de inventario de cocina.
- Actor responsable: MGR
- Precondiciones: Diferencias calculadas.
- Flujo esperado: Por definir.
- Excepciones: —
- Reglas relacionadas: BR-149
- Dependencias: **P-07**
- Prioridad sugerida: Media
- Estado: PENDING
- Fuente: DM §7.4, §14

## 9. Cartera, caja y finanzas (FIN)

### RF-260 — Configuración de crédito por cliente

- Módulo: FIN
- Descripción: Habilitar crédito y definir cupo y plazo por cliente.
- Actor responsable: Administrador
- Precondiciones: Cliente activo.
- Flujo esperado: Definir/modificar cupo y plazo → auditoría.
- Excepciones: reducir cupo por debajo del saldo → advertencia (permitido).
- Reglas relacionadas: BR-170, BR-005
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.3, DEC-021

### RF-261 — Control de cupo y cartera vencida

- Módulo: FIN (servicio usado por COM y DIS)
- Descripción: Validar cupo disponible y mora en cada venta a crédito y disparar la aprobación cuando corresponda.
- Actor responsable: Sistema; Administrador (aprueba)
- Precondiciones: Cliente con crédito.
- Flujo esperado: 1. Calcula cupo utilizado y obligaciones vencidas. 2. Si excede o hay mora → AP-01/AP-02. 3. Si no, permite continuar.
- Excepciones: —
- Reglas relacionadas: BR-171, BR-173
- Dependencias: Q-COM-04
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.3, DEC-022

### RF-262 — Estado de cartera

- Módulo: FIN
- Descripción: Consultar cartera por cliente con antigüedad (por vencer, vencida por rangos) y detalle de obligaciones.
- Actor responsable: ADM, MGR, CONT; DIST (sus clientes)
- Precondiciones: —
- Flujo esperado: Listado + detalle + exportación.
- Excepciones: —
- Reglas relacionadas: BR-172
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §2.1, §5

### RF-263 — Registro de abonos

- Módulo: FIN
- Descripción: Registrar pagos de clientes y aplicarlos a obligaciones.
- Actor responsable: ADM, MGR, CAJ; DIST (en ruta, RF-184)
- Precondiciones: Cliente con obligaciones.
- Flujo esperado: 1. Ingresa monto y método. 2. Aplicación automática a la más antigua o manual. 3. Comprobante interno.
- Excepciones: abono > saldo total → registrar saldo a favor (PENDING tratamiento) o rechazar.
- Reglas relacionadas: BR-174
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §5, §6

### RF-264 — Recaudos por distribuidor y punto

- Módulo: FIN
- Descripción: Consultar recaudos registrados separados por distribuidor y por caja, con estado de conciliación.
- Actor responsable: ADM, MGR, CONT
- Precondiciones: —
- Flujo esperado: Listado por responsable y fecha.
- Excepciones: —
- Reglas relacionadas: BR-175, BR-176
- Dependencias: —
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §7.2, DEC-027

### RF-265 — Conciliación de recaudos

- Módulo: FIN
- Descripción: Registrar el dinero efectivamente recibido de cada distribuidor o caja, compararlo con lo registrado y documentar diferencias.
- Actor responsable: ADM, MGR, CONT
- Precondiciones: Recaudos pendientes de conciliar.
- Flujo esperado: 1. Selecciona recaudos. 2. Ingresa monto recibido por método. 3. El sistema calcula diferencia. 4. Registra conciliación.
- Excepciones: —
- Reglas relacionadas: BR-177
- Dependencias: P-08 (faltantes)
- Prioridad sugerida: Alta
- Estado: CONFIRMED (concepto)
- Fuente: DM §4.1, §7.2

### RF-266 — Reportes operativos y de gestión

- Módulo: FIN / transversal
- Descripción: Reportes de ventas, producción y rendimiento, existencias y vencimientos, cartera, recaudos, diferencias de caja y cocina.
- Actor responsable: Según permiso `rep.operational.read`
- Precondiciones: —
- Flujo esperado: Filtros por fecha y sede, exportación a Excel.
- Excepciones: reportes de margen y rentabilidad → BLOCKED hasta costeo (P-03).
- Reglas relacionadas: BR-001
- Dependencias: P-03
- Prioridad sugerida: Media
- Estado: CONFIRMED (operativos) · BLOCKED (rentabilidad)
- Fuente: DM §2.1

## 10. Contabilidad (CONT) — capa (a) construible, capa (b) BLOCKED (DEC-081)

### RF-300 — Plan de cuentas

- Módulo: CONT
- Descripción: Crear/importar y mantener el plan de cuentas jerárquico.
- Actor responsable: Contador
- Precondiciones: —
- Flujo esperado: Importar desde Excel o crear manualmente; activar/inactivar cuentas.
- Excepciones: cuenta con movimientos no se elimina.
- Reglas relacionadas: BR-204
- Dependencias: P-04 (contenido)
- Prioridad sugerida: Media
- Estado: CONFIRMED (capacidad) · BLOCKED (contenido)
- Fuente: DM §6, §9

### RF-301 — Comprobantes y asientos manuales

- Módulo: CONT
- Descripción: Registrar comprobantes con asientos de partida doble.
- Actor responsable: Contador
- Precondiciones: Plan de cuentas; período abierto.
- Flujo esperado: Crear comprobante → partidas → validar balance → registrar.
- Excepciones: desbalanceado o período cerrado → rechazado.
- Reglas relacionadas: BR-201, BR-202
- Dependencias: Q-CON-06
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §9.2

### RF-302 — Períodos contables

- Módulo: CONT
- Descripción: Abrir, cerrar y reabrir (con aprobación) períodos.
- Actor responsable: Contador; Administrador (reapertura)
- Precondiciones: —
- Flujo esperado: Cerrar período → bloquea registros con esa fecha.
- Excepciones: reapertura → AP-09.
- Reglas relacionadas: BR-202
- Dependencias: Q-CON-06
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §6, §9.1

### RF-303 — Registro de hechos económicos

- Módulo: CONT (consume eventos de todos los módulos)
- Descripción: Recibir y almacenar los hechos económicos de compras, producción, ventas, recaudos, ajustes y devoluciones, con estado "pendiente de contabilizar".
- Actor responsable: Sistema; Contador (consulta)
- Precondiciones: —
- Flujo esperado: Cada operación emite su hecho dentro de su transacción; el contador ve la bandeja de hechos.
- Excepciones: —
- Reglas relacionadas: BR-200
- Dependencias: —
- Prioridad sugerida: Alta (se construye con cada módulo)
- Estado: PROPOSED
- Fuente: DEC-P20, DEC-081

### RF-304 — Contabilización automática de hechos económicos

- Módulo: CONT
- Descripción: Generar asientos a partir de hechos económicos según reglas de contabilización.
- Actor responsable: Sistema; Contador
- Precondiciones: Reglas aprobadas.
- Flujo esperado: Por definir con el contador.
- Excepciones: —
- Reglas relacionadas: BR-203, BR-205, BR-206
- Dependencias: **P-01..P-04**
- Prioridad sugerida: Alta (para el prototipo integral)
- Estado: BLOCKED
- Fuente: DM §9.1, DEC-081

### RF-305 — Reportes contables

- Módulo: CONT
- Descripción: Balance de prueba, libro diario, mayor y auxiliares; estados financieros según lo que defina el contador.
- Actor responsable: Contador; Administrador
- Precondiciones: Asientos registrados.
- Flujo esperado: Filtros por período y cuenta; exportación.
- Excepciones: —
- Reglas relacionadas: BR-201
- Dependencias: Q-CON-07
- Prioridad sugerida: Media
- Estado: PROPOSED (balance de prueba, diario, mayor) · PENDING (lista final)
- Fuente: DM §4.1, §9

## 11. Asistente IA (IA)

### RF-340 — Activación del asistente

- Módulo: IA
- Descripción: Activar o desactivar el asistente globalmente sin afectar el núcleo.
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: Interruptor → efecto inmediato en web (y Telegram si depende de IA).
- Excepciones: —
- Reglas relacionadas: BR-235
- Dependencias: —
- Prioridad sugerida: Alta (para la demo)
- Estado: CONFIRMED
- Fuente: DM §10, DEC-070

### RF-341 — Consultas en lenguaje natural

- Módulo: IA
- Descripción: Responder preguntas sobre existencias, pedidos, cartera, producción, ventas, usando herramientas de lectura con los permisos del usuario.
- Actor responsable: Usuarios con `ia.query`
- Precondiciones: Asistente activo.
- Flujo esperado: 1. Pregunta escrita o hablada. 2. El modelo selecciona herramientas de lectura. 3. El backend aplica permisos y sede. 4. Respuesta con datos y fuente.
- Excepciones: sin permiso → respuesta de denegación; límite global alcanzado → asistente en pausa.
- Reglas relacionadas: BR-230, BR-237
- Dependencias: Q-IA-01 (casos de demo)
- Prioridad sugerida: Alta (demo)
- Estado: CONFIRMED
- Fuente: DM §10, DEC-073

### RF-342 — Alertas automáticas

- Módulo: IA
- Descripción: Generar alertas (lotes por vencer, existencias bajas, cartera vencida) y presentarlas en lenguaje natural.
- Actor responsable: Sistema
- Precondiciones: —
- Flujo esperado: Por definir en Etapa D.
- Excepciones: —
- Reglas relacionadas: BR-230
- Dependencias: Q-IA-01
- Prioridad sugerida: Baja
- Estado: CONFIRMED (concepto)
- Fuente: DM §10

### RF-343 — Propuesta y confirmación de operaciones

- Módulo: IA
- Descripción: Preparar una operación de escritura, pedir datos faltantes, presentar resumen estructurado y ejecutarla tras confirmación explícita.
- Actor responsable: Usuario con el permiso de la operación
- Precondiciones: Matriz de permisos aprobada (BR-234); operación en lista blanca.
- Flujo esperado: Los 10 pasos de PM §9 (detalle en Etapa D).
- Excepciones: propuesta expirada; confirmación duplicada (BR-232); revalidación fallida; aprobación de tercero requerida → RF-007.
- Reglas relacionadas: BR-231, BR-232, BR-233, BR-234
- Dependencias: **P-10**, Q-IA-03
- Prioridad sugerida: Alta (demo)
- Estado: CONFIRMED (flujo) · BLOCKED (habilitación hasta P-10)
- Fuente: DM §10.1, IA-02

### RF-344 — Medición de consumo

- Módulo: IA
- Descripción: Registrar y consultar consumo y costo por modelo, usuario, canal, operación y período.
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: Tablero de consumo con filtros.
- Excepciones: —
- Reglas relacionadas: BR-236
- Dependencias: —
- Prioridad sugerida: Alta (demo medible)
- Estado: PROPOSED
- Fuente: DM §10, §10.2

### RF-345 — Límite global de costo

- Módulo: IA
- Descripción: Configurar techo de gasto mensual e iteraciones por solicitud; alertar y pausar al alcanzarlo.
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: Configurar techo → alertas al 80 % y 100 % (propuesto) → pausa.
- Excepciones: —
- Reglas relacionadas: BR-237
- Dependencias: Q-IA-02
- Prioridad sugerida: Alta
- Estado: PROPOSED
- Fuente: DM §10.2, DEC-P11

## 12. Telegram y migración

### RF-370 — Vinculación de cuenta de Telegram

- Módulo: TG
- Descripción: Vincular una cuenta de Telegram con un usuario interno mediante código de un solo uso generado en el ERP; desvincular.
- Actor responsable: Usuario; Administrador (revocar)
- Precondiciones: Telegram activo; usuario habilitado.
- Flujo esperado: 1. Genera código en su perfil. 2. Lo envía al bot. 3. Vínculo creado y auditado.
- Excepciones: código expirado/usado; cuenta ya vinculada a otro usuario.
- Reglas relacionadas: BR-250
- Dependencias: Q-TG-03
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §8, DEC-P08

### RF-371 — Activación independiente de Telegram

- Módulo: TG
- Descripción: Activar o desactivar Telegram independientemente del asistente.
- Actor responsable: Administrador
- Precondiciones: —
- Flujo esperado: Interruptor con efecto inmediato.
- Excepciones: —
- Reglas relacionadas: BR-252
- Dependencias: —
- Prioridad sugerida: Media
- Estado: CONFIRMED
- Fuente: DM §11, DEC-076

### RF-372 — Funciones de Telegram (comandos, consultas, voz, notificaciones)

- Módulo: TG
- Descripción: Conjunto de funciones disponibles con y sin IA.
- Actor responsable: Usuarios vinculados
- Precondiciones: —
- Flujo esperado: Por definir en Etapa E.
- Excepciones: —
- Reglas relacionadas: BR-251, BR-253
- Dependencias: **P-13**, P-14
- Prioridad sugerida: Baja
- Estado: PENDING
- Fuente: DM §11

### RF-375 — Carga de saldos iniciales

- Módulo: MIG
- Descripción: Cargar mediante plantillas Excel validadas: inventario por ubicación y lote, caja, cartera por cliente, cuentas por pagar a proveedores, a una fecha de corte.
- Actor responsable: Administrador; Contador (verifica)
- Precondiciones: Catálogos cargados; conteo físico realizado.
- Flujo esperado: 1. Descarga plantilla. 2. Sube archivo. 3. El sistema valida y muestra errores por fila. 4. Previsualiza totales. 5. Confirma; se crean movimientos/obligaciones "apertura".
- Excepciones: archivo con errores → no se carga nada.
- Reglas relacionadas: BR-260, BR-261, BR-008
- Dependencias: P-04 (apertura contable), Q-PIL-02
- Prioridad sugerida: Alta
- Estado: CONFIRMED
- Fuente: DM §13, DEC-064

### RF-376 — Soporte al piloto paralelo

- Módulo: MIG
- Descripción: Reportes de comparación diaria (existencias, caja, cartera) para contrastar con los cuadernos.
- Actor responsable: Administrador
- Precondiciones: Sistema en piloto.
- Flujo esperado: Reporte diario exportable.
- Excepciones: —
- Reglas relacionadas: —
- Dependencias: P-16
- Prioridad sugerida: Media
- Estado: PROPOSED
- Fuente: DM §13, §13.1
