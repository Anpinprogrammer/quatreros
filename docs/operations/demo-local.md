# Mostrar el prototipo en local

> Datos 100 % ficticios. La semilla demo **se niega a correr en producción**.

## 1. Preparar (una sola vez)

Sigue "Primeros pasos" del `README.md` (pnpm, `.env`, `docker compose up -d`, `pnpm db:migrate`). Luego agrega a `.env`:

```
DEMO_PASSWORD=<elige una de 12+ caracteres>
```

```bash
pnpm db:seed:demo        # sedes, ubicaciones y 7 usuarios demo (uno por rol)
```

## 2. Levantar

```bash
pnpm dev                 # web en http://localhost:5173
```

O, igual que en producción (la API sirve la web en un solo puerto): `pnpm build` y `APP_BASE_URL=http://localhost:3000 node apps/api/dist/main.js` → http://localhost:3000

## 3. Usuarios demo

Todos usan la contraseña de `DEMO_PASSWORD`.

| Correo                           | Rol           | Entra a | Segundo factor |
| -------------------------------- | ------------- | ------- | -------------- |
| `admin@quatreros.example`        | Administrador | ERP     | Obligatorio    |
| `manager@quatreros.example`      | Manager       | ERP     | Obligatorio    |
| `contabilidad@quatreros.example` | Contador      | ERP     | Obligatorio    |
| `compras@quatreros.example`      | Comprador     | ERP     | —              |
| `produccion@quatreros.example`   | Productor     | ERP     | —              |
| `caja@quatreros.example`         | Cajero        | Caja    | —              |
| `reparto@quatreros.example`      | Distribuidor  | Ruta    | —              |

## 4. Guion sugerido (entrega 1, ~5 minutos)

1. **Caja en tableta**: ingresa como `caja@` → queda directo en la pantalla de Caja, con su nombre y el indicador de conexión.
2. **Repartidor en celular**: ingresa como `reparto@` → portal de Distribución, una columna.
3. **Seguridad**: contraseña equivocada → mensaje genérico (no revela si el correo existe).
4. **Administrador**: ingresa como `admin@` → el sistema exige configurar la verificación en dos pasos (QR con Google/Microsoft Authenticator) y entrega códigos de respaldo.
5. **Usuarios**: en la barra lateral, sección _08. Administración_ → _Usuarios y permisos_ → crear un repartidor nuevo con sede "Bodega principal" → cerrar sesión → ese usuario ya ingresa a Ruta.
6. **Protecciones**: intentar desactivarse a sí mismo o dejar el sistema sin administrador → el sistema lo impide.
7. **Command Center**: el tablero muestra qué entrega activa cada indicador; en cada sección, los módulos "En construcción" y los que "Esperan decisión P-xx".

## 4.1 Catálogo y precios (entrega 2a, ~4 minutos)

La semilla deja productos, presentaciones, precios y materias primas ficticios. Todos los precios son de demostración.

1. **Administrador** (con su segundo factor): en la barra lateral, sección _04. Producción_ → _Catálogo y precios_.
2. **Productos**: se ven "Chorizo Santarrosano" (unidad $1.300 y paquete ×10 $12.000), "Rellena Mixta" y "Picada Quatreros XL". Abrir la ficha del chorizo → _Ver histórico_ muestra el precio anterior y el vigente.
3. **Crear producto**: _Crear producto_ → nombre "Chorizo de prueba", tipo Fabricado, unidad base Unidad, vida útil 30 días → _Crear producto_.
4. **Presentaciones y precios**: en la ficha, _Agregar presentación_ → "Unidad" con 1 unidad base; repetir con "Paquete x10" y 10. Luego _Fijar precio_ en la unidad (por ejemplo `1300.00`) → el precio queda vigente y auditado. Cambiarlo a `1400.00` → el anterior pasa al histórico.
5. **Materias primas**: pestaña _Materias primas_. Como `compras@` se puede crear "Sal de pruebas" en kg; como `produccion@` el catálogo es solo lectura.

## 4.2 Probar sin configurar el segundo factor (solo local)

Para revisar funcionalidades internas sin pasar por la configuración de TOTP, agrega al `.env`:

```
AUTH_MFA_ENFORCEMENT_DISABLED=true
```

y reinicia `pnpm dev`. El servidor deja de exigir la configuración a Administrador, Manager y Contador (`/api/v1/me` devuelve `mfa.required: false`). No elimina un TOTP ya activado: si la cuenta ya lo tiene, el ingreso seguirá pidiendo el código. La variable se rechaza en staging y producción; los E2E fuerzan `false` para seguir probando el flujo real de MFA.

Si vas a repetir ingresos durante las pruebas, agrega también `AUTH_RATE_LIMIT_DISABLED=true`: evita el límite de 3 intentos cada 10 s. Ambas variables son solo para desarrollo local.

En desarrollo se aceptan como origen tanto `http://localhost:5173` (Vite, con recarga en caliente) como `http://localhost:3000` (app compilada servida por la API). Usa 5173 para ver los cambios al instante.

## 4.3 Existencias, lotes y kardex (entrega 2b, ~4 minutos)

La semilla crea 8 lotes y 12 saldos con movimientos `opening_balance`; las fechas son relativas al día de la carga.

1. **Compras o Producción**: pestaña _04. Producción_ → _Existencias y traslados_.
2. **Resumen**: productos con saldo, materias primas, lotes por vencer en 7 días y lotes vencidos.
3. **Existencias**: tabla por producto, presentación, lote y ubicación. Filtra por "Principal" o por estado; abre el lote `PT-2026-0001` desde su código.
4. **Ficha de lote**: saldo total en unidad base (360 unidades entre Unidad y Paquete x10), saldos por ubicación y últimos movimientos.
5. **Kardex**: pestaña _Kardex_; verifica la carga inicial, el usuario y el documento de origen. Filtra por tipo o rango de fechas.
6. **Trazabilidad**: entra como `produccion@` y abre el lote; verás las secciones "Hacia atrás" y "Hacia adelante" con los vacíos que activan las entregas 3, 4 y 5. Como `compras@` no se consulta trazabilidad, pero sí existencias y kardex.

## 4.4 FEFO y traslados (entrega 2c, ~4 minutos)

La semilla deja el traslado `T-0001` ya recibido (2 paquetes de PT-2026-0001 de Bodega principal a Productos del punto).

1. **Manager o Administrador**: _04. Producción_ → _Existencias y traslados_ → pestaña _Traslados_. Abre `T-0001` para ver las líneas, el lote asignado, quién envió y quién recibió.
2. **FEFO por vencimiento**: _Nuevo traslado_ → origen "Principal" y destino "Productos del punto" → "Chorizo Santarrosano · Paquete x10" → cantidad `30`. La asignación usa primero PT-2026-0001 (vence antes) y reparte el resto en PT-2026-0002.
3. **Enviar**: el traslado queda _En tránsito_. En _Existencias_ el saldo sale de Principal y entra a la ubicación "En tránsito".
4. **Recibir completo**: abre el traslado y confirma la cantidad. El saldo sale de tránsito y entra a Productos del punto; el traslado queda _Recibido_.
5. **Novedad**: repite con otra cantidad y confirma menos de lo enviado. El traslado queda _Recibido con novedad_ y la diferencia permanece en tránsito.
6. **Command Center**: la tarjeta _Alertas FEFO_ muestra hasta 3 lotes vendibles que vencen en 7 días. Si estás como `compras@`, solo ves las sedes de su alcance.

## 4.5 Compras y recepción (entrega 3, ~4 minutos)

La semilla deja dos proveedores y la compra `C-0001` pendiente: 40 kg de carne de cerdo magra a $18.000/kg y 20 kg de tocino a $14.000/kg, total $1.000.000 sin impuestos.

1. **Comprador**: _06. Compras_ → _Compras y recepción_. Abre `C-0001`; verás las líneas, el total sin impuestos y el saldo pendiente.
2. **Proveedores**: pestaña _Proveedores_ → _Nuevo proveedor_. Crea uno con NIT ficticio; una identificación repetida se rechaza.
3. **Registrar compra**: _Nueva compra_ → proveedor, sede, materia prima, cantidad y costo. El total se calcula en vivo y la compra queda _Pendiente de recepción_. El inventario no cambia.
4. **Recepción parcial**: en el detalle, elige la ubicación "Principal", recibe 25 kg de carne con vencimiento futuro. Se crea el lote `MP-2026-0005` y la compra queda _Recibida parcialmente_ con 15 kg pendientes.
5. **Completar**: recibe el saldo. La compra queda _Recibida_ y el kardex muestra las entradas con su proveedor y recepción.
6. **Trazabilidad**: abre el lote recibido en _04. Producción_ → _Existencias y traslados_ → _Lotes_; la ficha muestra el origen en la compra y el proveedor.
7. **Bloqueado**: los impuestos y el desglose fiscal no se capturan (P-02). Una cantidad mayor a la pendiente se rechaza: la confirmación con motivo requiere el motor de aprobaciones (RF-007).

## 4.6 Producción (entrega 4, ~5 minutos)

La semilla deja las recetas de Chorizo Santarrosano y Rellena Mixta, y la orden `OP-0001` planificada para 100 unidades de chorizo. La orden no mueve inventario hasta el consumo.

1. **Productor**: _04. Producción_ → _Órdenes de producción_. Abre `OP-0001`; verás la receta v1, el consumo teórico y la disponibilidad de cada materia prima.
2. **Recetas**: pestaña _Recetas_ → abre la receta del chorizo. Revisa la versión vigente, sus ingredientes y el historial. Como manager o administrador puedes publicar una versión nueva; las órdenes existentes conservan la anterior.
3. **Consumo**: en la orden, registra el consumo con los lotes sugeridos por vencimiento. Se descuentan las materias primas y la orden pasa a _En proceso_.
4. **Cierre**: registra 50 unidades y 5 paquetes ×10. El sistema crea el lote `PT-2026-0005` con fabricación y vencimiento, calcula el rendimiento y lo vincula a los lotes de MP consumidos.
5. **Rendimiento fuera de tolerancia**: repite con una orden nueva y cierra con 90 unidades. Como el rendimiento se aleja más de 3 puntos del esperado (98 %), el cierre exige un motivo.
6. **Trazabilidad**: abre el lote PT en _Existencias y traslados_ → _Lotes_; la sección "Hacia atrás" muestra los lotes de materia prima usados.
7. **Pendiente**: las sugerencias por punto de reorden (RF-080, Q-PRO-03) y la anulación de órdenes (RF-084, P-09) no se implementan. El costo oficial del lote sigue bloqueado (P-03).

## 4.7 Pedidos, despacho y reparto (entrega 5, ~6 minutos)

La semilla deja dos clientes, el pedido `P-0001` a crédito con reserva FEFO y el despacho `D-0001` preparado para `reparto@`.

1. **Manager**: _03. Distribución_ → _Clientes y pedidos_. Revisa clientes y su crédito. En _Pedidos_ abre `P-0001`; verás precio congelado, reserva y total.
2. **Nuevo pedido**: crea uno para "Restaurante La Brasa" con pago a crédito. Si el cupo se excede o hay mora, el pedido se confirma con **advertencia** (DEC-099), no se bloquea.
3. **Despacho**: pestaña _Despachos_ → _Nuevo despacho_, selecciona pedidos confirmados y a Diego Reparto. Abre el despacho y pulsa _Confirmar carga y salir_; los lotes pasan a "En ruta" y las reservas se consumen.
4. **Repartidor en celular**: entra como `reparto@` → _Rutas del día_. Abre el despacho, confirma una entrega total o parcial (con motivo), registra el recaudo si es contraentrega y el abono si es crédito.
5. **Devolución**: registra una devolución con motivo; la mercancía entra a "En inspección".
6. **Inspección**: como manager, abre el despacho y pulsa _Reincorporar_. La devolución vuelve a la bodega en su lote. El descarte requiere AP-08 y no está disponible.
7. **Cartera**: la entrega a crédito crea una obligación con vencimiento entrega + plazo. La liquidación del distribuidor y la conciliación quedan para la entrega 7 / P-08.

## 5. Volver a empezar

Para repetir la demo desde cero (el administrador sin segundo factor), recrea la base: `docker compose down -v && docker compose up -d`, luego `pnpm db:migrate`, `pnpm db:seed` y `pnpm db:seed:demo`.
