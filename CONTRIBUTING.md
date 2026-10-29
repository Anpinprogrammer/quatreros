# Cómo contribuir a Quatreros

Resumen operativo de las convenciones (fuente completa: skill `quatreros-conventions` y `docs/02-architecture/`).

## Flujo de trabajo (Spec-Driven Development)

1. **Especificación aprobada** en `docs/04-specifications/<modulo>/<feature>.md` con RF/BR, contrato, modelo de datos, criterios de aceptación y pruebas.
2. **Rama** `feat/<alcance>-<descripcion-corta>` desde `main`.
3. **Implementación vertical:** contrato Zod (`packages/contracts`) → dominio → caso de uso → repositorio/migración → ruta HTTP → pantalla → pruebas.
4. **PR** con la plantilla: IDs trazables y verificaciones ejecutadas. CI debe pasar.
5. **Cierre:** actualizar `docs/PROJECT-STATUS.md`, la matriz de trazabilidad y `apps/web/src/shared/modules.ts` si el módulo queda disponible.

## Reglas no negociables

- Regla de negocio sin origen en el Documento Maestro o en una `DEC-###` confirmada **no se implementa**: se registra como pregunta.
- Permisos, sede y aprobaciones se verifican **en el servidor**, en el caso de uso.
- Las existencias solo cambian con movimientos del kardex; los registros cerrados no se editan ni se borran (reversión).
- Dinero y cantidades como cadenas decimales en la API y `decimal.js` en el dominio; nunca `number`.
- Escrituras con efecto en inventario, dinero o cartera: transacción + `requireIdempotency` + auditoría.
- El núcleo nunca importa `src/addons/*` (lo vigila `dependency-cruiser`).
- Funcionalidad bloqueada por una decisión pendiente: detrás de `requireFeature(...)` hasta que se resuelva.

## Estructura de un módulo (API)

```
apps/api/src/modules/<modulo>/
├── domain/            reglas puras (sin Express, Drizzle ni E/S)
├── application/       casos de uso; public.ts = API para otros módulos y el ToolGateway
├── infrastructure/    schema.ts (Drizzle, esquema de BD propio) y repositorios
└── http/              router Express con validación Zod
```

## Pruebas mínimas por caso de uso de escritura

Éxito · validación (422) · permiso denegado (403) · sede ajena (404) · operación duplicada (misma `Idempotency-Key`) · concurrencia cuando aplique (integración con PostgreSQL real).

## Commits

Conventional Commits en español (lo valida el hook `commit-msg`):

```
feat(inv): traslado entre ubicaciones con FEFO
fix(pos): cierre de turno con diferencia exige justificación
docs(docs): especificación de recepción de compras
```

Alcances: `adm, cat, comp, prod, inv, com, dis, pos, fin, cont, ia, tg, mig, plat, docs`.

## Migraciones

- `pnpm db:generate` y **revisar el SQL** antes de subirlo.
- Triggers, permisos y reglas especiales: migración `--custom`.
- Cambios incompatibles en dos pasos (expandir → contraer).
- No crear migraciones de reglas bloqueadas (contabilización, impuestos, costeo).
