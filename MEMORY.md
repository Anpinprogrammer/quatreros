# MEMORY.md — memoria viva de Quatreros

> Última actualización: **2026-11-02**.
> Este archivo es el punto de partida para cualquier agente o desarrollador: resume el estado real, el entorno local y el trabajo en curso. Las fuentes de verdad siguen siendo los documentos enlazados; si hay contradicción, mandan ellos y se corrige este archivo. **Actualízalo al cerrar cada sesión.**

## 1. Qué es y en qué modo está

ERP a medida para una productora de embutidos de Cali: compras, producción por lotes, inventario con FEFO, pedidos y reparto, POS, cartera y contabilidad, con IA y Telegram opcionales. Se construye por Spec-Driven Development y está en **modo prototipo** (DEC-083): 8 entregas verticales demostrables, una a la vez.

| Etapa                                                            | Estado                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| A–E: descubrimiento, requerimientos, arquitectura, IA y Telegram | Completas                                                     |
| F: monorepo, CI/CD, Docker, respaldos                            | Completa                                                      |
| **Entrega 1**: ingreso, usuarios, roles y sedes                  | ✅ Terminada                                                  |
| **Entrega 2**: catálogo e inventario                             | ✅ Terminada: 2a catálogo, 2b existencias y 2c FEFO/traslados |
| **Entrega 3**: compras y recepción                               | ✅ Terminada: proveedores, compras y lotes MP por recepción   |
| **Entrega 4**: producción                                        | ✅ Terminada: recetas, consumo por lote y lote PT             |
| **Entrega 5**: pedidos y reparto                                 | ✅ Terminada: reservas, despacho, entregas y recaudo          |
| Entrega 8: Quatreros AI                                          | Configurada, sin integración funcional                        |

## 2. Dónde estamos (2026-11-02)

- Rama activa: **`feat/cat-catalogo-precios`**. `main` intacto; sin push ni PR.
- Commits de esta rama:
  - `2df3f57` — especificación 2a y decisiones.
  - `33428b4` — implementación 2a (catálogo, precios, materias primas).
  - `4e9d495` — interruptor de desarrollo para la exigencia de MFA.
  - `80f58ed` — orígenes 5173/3000 aceptados en desarrollo.
  - `1ad7041` — rediseño visual v1.1 (DEC-093), App Shell y kit de componentes.
  - `2d95eab` — especificación de existencias, kardex y trazabilidad (2b).
  - `077a6ca` — implementación 2b (lotes, existencias, kardex y trazabilidad).
  - `3363038` — isotipo oficial en la marca y el ingreso.
  - `38d7094` — FEFO y traslados con tránsito (entrega 2c).
  - `6961043` — compras, proveedores y recepción con lote MP (entrega 3).
  - `4d0dc93` — recetas, consumo y lote terminado (entrega 4).
- Entorno local recreado, migraciones `0000`–`0021` aplicadas y semilla demo cargada (incluye `T-0001`, `C-0001`, `OP-0001`, `P-0001` y `D-0001`).

### Entrega 2a (hecha)

- Productos fabricados y preparados, presentaciones, materias primas, precio único vigente con histórico.
- API `/api/v1/catalog/...` con permisos, auditoría, idempotencia e `If-Match`.
- Pantallas en **04. Producción → Catálogo y precios**.
- Semilla: Chorizo Santarrosano, Rellena Mixta, Picada Quatreros XL, cuatro materias primas y un precio histórico.
- Verificación: 59 unitarias, 41 integración (incluida concurrencia en PostgreSQL 17), 32 E2E con axe.

### Entrega 2b (hecha)

- Esquema `inventory`: lotes, kardex inmutable (trigger append-only), saldos con `CHECK >= 0` y `lot_inputs`.
- `recordMovement` es la única vía de cambio de saldo; la semilla usa `opening_balance` y fechas relativas a hoy.
- `InventoryUsage` real conectado al catálogo; API de existencias, disponibilidad, lotes, kardex, trazabilidad y resumen.
- Pantallas en **04. Producción → Existencias y traslados**, con pestañas Existencias/Lotes/Kardex y ficha de lote.
- Verificación: 71 unitarias, 55 integración (PGlite y PostgreSQL 17 real) y 47 E2E con axe.

### Entrega 2c (hecha)

- FEFO: orden por vencimiento, exclusión de vencidos/bloqueados, reparto entre lotes y `409 INSUFFICIENT_STOCK`.
- Traslados con `inventory.transfers`/`transfer_lines`, consecutivo `T-0001`, ubicación "En tránsito", recepción completa o con novedad y auditoría.
- Pantalla de traslados en **04. Producción → Existencias y traslados**, detalle con recepción y tarjeta "Alertas FEFO" en el Command Center.
- Alcance por sede en saldos, disponibilidad, lotes, kardex, resumen y traslados.
- Semilla `T-0001` recibido; migraciones `0008`–`0009`.
- Verificación: 71 unitarias, 60 integración (PGlite y PostgreSQL 17 real) y 48 E2E con axe.
- **RF-113 (excepción FEFO) queda pendiente del motor de aprobaciones (RF-007).**

### Entrega 3 (hecha)

- Proveedores con identificación única, contacto, edición con `If-Match` e inactivación.
- Compras con consecutivo `C-0001`, líneas de materia prima, total sin impuestos y estados pendiente/parcial/recibida.
- Recepción total o parcial con consecutivo `R-0001`: cada línea crea un lote `MP-AAAA-####` con proveedor, costo y vencimiento, y un movimiento `receipt` en la misma transacción.
- Rechaza sobre-recepción, ubicación de otra sede y vencimiento faltante o pasado; la confirmación con motivo espera RF-007.
- Pantallas **06. Compras → Compras y recepción** y **Proveedores**.
- Semilla: dos proveedores y `C-0001` pendiente (40 kg de carne y 20 kg de tocino por $1.000.000 sin impuestos).
- Migraciones `0010`–`0012`; **DEC-094** aprueba la recepción parcial y el lote MP por recepción como `PROVISIONAL`.
- Verificación: 76 unitarias, 66 integración (PGlite y PostgreSQL 17 real) y 52 E2E con axe.

### Entrega 4 (hecha)

- Recetas de producción versionadas por producto fabricado; la orden congela la versión vigente (DEC-095).
- Orden planificada con consumo teórico y disponibilidad; advierte si falta MP, pero no bloquea crearla.
- Consumo real por lote con sugerencia FEFO; descuenta existencias y registra teórico/real.
- Cierre por presentación: lote `PT-AAAA-####` con fabricación/vencimiento, movimientos `production_output`, rendimiento y motivo fuera de tolerancia (DEC-096).
- Trazabilidad N:M en `inventory.lot_inputs` (DEC-097).
- Pantallas **04. Producción → Órdenes de producción** y **Recetas**.
- Semilla: dos recetas y `OP-0001` planificada para 100 unidades de chorizo.
- Migraciones `0013`–`0016`.
- Verificación: 80 unitarias, 71 integración (PGlite y PostgreSQL 17 real) y 56 E2E con axe.
- **RF-080 (sugerencias) pendiente de Q-PRO-03; RF-084 (anulación) de P-09; costo del lote BLOCKED (P-03).**

### Entrega 5 (hecha)

- Clientes con datos de entrega y crédito (cupo/plazo) configurable solo por el Administrador.
- Pedido confirmado con precio congelado y reserva FEFO por lote (DEC-098); si falta existencia queda el faltante.
- Cupo usado = cartera abierta + pedidos a crédito no entregados; exceso o mora genera advertencia, no bloqueo (DEC-099).
- Despacho con pedidos confirmados, distribuidor y salida a "En ruta"; reservas consumidas.
- Portal móvil del distribuidor: entrega total/parcial, recaudo efectivo/transferencia y devolución.
- Obligación a crédito al entregar con vencimiento entrega + plazo; abono opcional; recaudos pendientes de conciliación (DEC-100).
- Devolución a "En inspección" y reincorporación; descarte pendiente AP-08.
- Pantallas **03. Distribución → Clientes, pedidos y despachos** y portal **Ruta**.
- Semilla: dos clientes, `P-0001` a crédito y `D-0001` preparado.
- Migraciones `0017`–`0021`.
- Verificación: 80 unitarias, 76 integración (PGlite y PostgreSQL 17 real) y 60 E2E con axe.
- **RF-153 (cancelación/descuentos) P-09; RF-186 (liquidación) P-08.**

### Siguiente: entrega 6 (caja POS)

- RF-220 apertura de turno, RF-221 venta de mostrador, RF-222 pagos mixtos, RF-223 cierre/arqueo, RF-224 revisión de diferencias.
- RF-225 platos con consumo teórico sin descuento automático de cocina (Q-B-09); RF-226 conteos P-07; RF-227 documento fiscal BLOCKED P-02.
- La especificación `docs/04-specifications/pos/caja.md` se escribe antes de programar; el plan está en `docs/HANDOFF.md`.

## 3. Decisiones vigentes que más afectan el trabajo

- **DEC-083**: modo prototipo; las reglas `PROVISIONAL` se implementan configurables y se confirman antes del piloto.
- **DEC-086**: sistema de diseño "Los Quatreros" es la única base visual.
- **DEC-087 / DEC-088**: Quatreros AI sobre Managed Agents; memoria del agente no es fuente de verdad. No `ant apply` sin autorización.
- **DEC-089**: pantalla de kardex aprobada.
- **DEC-090**: vida útil fija por producto, editable con permiso.
- **DEC-091**: catálogo dentro de 04. Producción.
- **DEC-092**: RF-033 (recetas) se construye en la entrega 4.
- Bloqueado: contabilidad e impuestos (P-01..P-04), apertura de paquetes (P-06), mermas de cocina (P-07), liquidación de repartidores (P-08), escrituras de IA (P-10), vencidos/retiros (P-05). Se muestran como "Espera decisión" y no se implementan.

## 4. Entorno local

### Levantar

```bash
cd /Users/andrespineda/Desktop/quatreros
docker compose up -d          # PostgreSQL 17
pnpm dev                      # API :3000 + web :5173
```

- Web con recarga en caliente: **http://localhost:5173** (úsala para ver cambios).
- API: http://localhost:3000; documentación: http://localhost:3000/api/docs.
- En desarrollo también se acepta **http://localhost:3000** (app compilada por la API), pero no tiene recarga en caliente.

### Base demo

- `.env` ya está configurado en local (no se versiona).
- Contraseña demo: `grep '^DEMO_PASSWORD=' .env` (no la escribas en el repositorio).
- Usuarios: `admin@`, `manager@`, `contabilidad@`, `compras@`, `produccion@`, `caja@`, `reparto@` — todos `@quatreros.example`.
- Recrear la base: `pnpm db:reset:demo` (requiere `psql` en el host). En este equipo **no hay `psql`**: usa el equivalente con Docker:

```bash
docker exec quatreros-postgres-1 psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS quatreros WITH (FORCE)'
docker exec quatreros-postgres-1 psql -U postgres -d postgres \
  -v owner_pw="'owner_local_dev'" -v app_pw="'app_local_dev'" -v ro_pw="'ro_local_dev'" \
  -v dbname=quatreros -f /scripts/db-roles.sql
pnpm db:migrate && pnpm db:seed:demo
```

### Variables de prueba locales (solo desarrollo; el arranque las rechaza en staging/producción)

```env
AUTH_MFA_ENFORCEMENT_DISABLED=true  # no exigir configurar TOTP a ADM/MGR/CONT
AUTH_RATE_LIMIT_DISABLED=true      # sin límite de intentos de ingreso
```

- `AUTH_MFA_ENFORCEMENT_DISABLED` **no elimina un TOTP ya activado**. Si el login pide código, en la base demo:

```sql
delete from auth.two_factor;
update auth.user set two_factor_enabled = false;
```

- Los E2E fuerzan `AUTH_MFA_ENFORCEMENT_DISABLED=false` y siguen validando el flujo real.

## 5. Problemas ya vistos y su solución

| Síntoma                                        | Causa / solución                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "Correo o contraseña incorrectos" al instante  | La API está caída: revisa `lsof -iTCP:3000`; reinicia `pnpm --filter @quatreros/api dev`.                                        |
| `Invalid origin: http://localhost:3000` (403)  | Se abrió la app en un origen no configurado. En desarrollo ya se aceptan 5173 y 3000; en staging/producción solo `APP_BASE_URL`. |
| 429 al repetir ingresos                        | Límite de 3 intentos/10 s. Usa `AUTH_RATE_LIMIT_DISABLED=true` en `.env` y reinicia.                                             |
| Pide configurar TOTP                           | `AUTH_MFA_ENFORCEMENT_DISABLED=true` en `.env`; reinicia la API.                                                                 |
| Pide el código TOTP aunque el flag esté activo | La cuenta ya tiene TOTP: borra `auth.two_factor` y pon `two_factor_enabled=false` (solo base demo).                              |
| Web 5173 con errores de proxy `ECONNREFUSED`   | La API no está escuchando en 3000. Reiníciala; Vite no necesita reinicio.                                                        |
| `pnpm db:reset:demo` falla por `psql`          | Usa el bloque con `docker exec` de arriba.                                                                                       |

## 6. Mapa del código (lo que existe hoy)

```
apps/api/src/
  modules/admin/       referencia completa (authz, usuarios, roles, sedes)
  modules/catalog/     2a: domain, application, infrastructure, http
  platform/            auth, authz, idempotencia, auditoría, flags, db
apps/api/drizzle/      migraciones 0000–0005 (catálogo en 0004/0005)
packages/contracts/    admin.ts, catalog.ts, common.ts, errors.ts
apps/web/src/
  features/usuarios/   entrega 1
  features/catalogo/   2a: api, páginas, formularios, formatos
  shells/erp/          shell ERP y rutas
  shared/ui/           componentes del sistema de diseño
apps/web/e2e/          flujos, catálogo y accesibilidad (axe)
docs/                  descubrimiento, requerimientos, arquitectura, specs, diseño, operación
```

## 7. Trabajo en curso del responsable (no tocar sin preguntar)

El **rediseño v1.1 está commiteado** (`1ad7041`) y las entregas 2a–2c también. Las entregas 3, 4 y 5 se commitean con este cierre; la siguiente tarea es la entrega 6.

El **logo oficial** está integrado en la marca y los iconos (`public/logo.webp` → `logo-mark.webp`, `favicon.png`, `apple-touch-icon.png`). Las fuentes alternativas quedaron archivadas en `docs/05-design/original/`.

## 8. Reglas para el próximo agente

1. Lee `AGENTS.md`, `docs/HANDOFF.md`, este archivo y la especificación de la entrega en curso.
2. No inventes reglas: sin origen en el Documento Maestro o una `DEC`, se abre pregunta.
3. El servidor manda: permisos, sede, validación y auditoría en el caso de uso.
4. Inventario y dinero solo con movimientos inmutables, transacción e idempotencia.
5. No fusiones a `main`, no hagas push de PRs de Dependabot, no `ant apply` ni cambios irreversibles sin aprobación.
6. Verifica antes de declarar terminado: `pnpm check`, integración con PGlite y PostgreSQL real, `pnpm build && pnpm db:reset:demo && pnpm test:e2e`.
7. Al cerrar: actualiza `MEMORY.md`, `docs/HANDOFF.md`, `PROJECT-STATUS.md`, roadmap y matriz de trazabilidad.

## 9. Bitácora

- **2026-11-02**: entrega 2a implementada y verificada; decisiones DEC-089..092; interruptores locales de MFA y límite de ingreso; orígenes 5173/3000 aceptados en desarrollo. Rediseño v1.1 (DEC-093) revisado y commiteado en `1ad7041`. Entrega 2b (lotes, existencias, kardex y trazabilidad) implementada y verificada. Entrega 2c (FEFO, traslados con tránsito, recepción y alertas) implementada y verificada; RF-113 queda para cuando exista el motor de aprobaciones. **Logo oficial "Los 4 Treros" integrado** en la marca, el favicon y el icono de iOS (`public/logo.webp` → `logo-mark.webp`). Entrega 3 (proveedores, compras y recepción con lote MP) implementada y verificada. Entrega 4 (recetas, consumo real y lote PT) implementada y verificada. Entrega 5 (pedidos, despacho, reparto y recaudo) implementada y verificada; sigue la entrega 6 (caja POS). **Burbuja y panel de Quatreros AI** listos como vista previa; compositor deshabilitado hasta la entrega 8, sin respuestas simuladas. **Ingreso rediseñado** en clave luminosa (52/48, logo oficial, personaje y formulario de 52 px), manteniendo la autenticación intacta. **Command Center y header reorganizados**: pestañas Módulos/Tablero del día, KPIs operativos reales, atención priorizada, módulos compactos y menú de usuario con tema/cierre; fuera el panel de plan del dashboard.
