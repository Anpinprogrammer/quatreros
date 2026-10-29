# Quatreros

ERP a medida para Quatreros: compras, producción por lotes, inventarios con FEFO, pedidos y reparto, punto de venta, cartera y contabilidad. Complementos opcionales: asistente de IA y Telegram.

- **Estado del proyecto:** [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)
- **Fuente de verdad del negocio:** [`docs/Quatreros_Documento_Maestro_v1.0.pdf`](docs/Quatreros_Documento_Maestro_v1.0.pdf)
- **Decisiones:** [`docs/00-discovery/decision-register.md`](docs/00-discovery/decision-register.md) · **Arquitectura:** [`docs/02-architecture/`](docs/02-architecture/)

## Estructura

```
quatreros/
├── apps/
│   ├── api/                 API Express 5 (monolito modular) + migraciones Drizzle
│   └── web/                 SPA React con tres shells: /erp, /pos, /ruta
├── packages/
│   ├── contracts/           Esquemas Zod y tipos compartidos entre API y web
│   └── config/              tsconfig base
├── infrastructure/
│   ├── docker/              Dockerfile (imagen única) e init de PostgreSQL local
│   └── scripts/             Roles de BD, respaldo, restauración, verificación de integridad
├── docs/                    Descubrimiento, requerimientos, arquitectura, planeación, especificaciones, operación
└── .github/                 CI, despliegue, Dependabot, plantilla de PR
```

## Requisitos

| Herramienta | Versión               | Nota                                      |
| ----------- | --------------------- | ----------------------------------------- |
| Node.js     | 24 LTS (mínimo 22.12) | `.nvmrc`                                  |
| pnpm        | 12 (vía Corepack)     | `corepack enable`                         |
| Docker      | Reciente              | PostgreSQL local y pruebas de integración |
| PostgreSQL  | 17 (15+ compatible)   | Lo levanta `docker compose`               |

## Puesta en marcha local

```bash
corepack enable
pnpm install                       # instala dependencias y los hooks de Git
cp .env.example .env               # completar BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d               # PostgreSQL 17 con los roles quatreros_owner / _app / _readonly
```

En `.env`, para el entorno local creado por `docker compose`:

```
DATABASE_URL=postgres://quatreros_app:app_local_dev@localhost:5432/quatreros
DATABASE_MIGRATIONS_URL=postgres://quatreros_owner:owner_local_dev@localhost:5432/quatreros
```

(Contraseñas solo de desarrollo local, definidas en `infrastructure/docker/initdb/01-roles.sh`.)

```bash
pnpm db:migrate                    # aplica migraciones con el rol dueño
pnpm db:seed                       # flags de funcionalidades bloqueadas (apagados), complementos, consecutivos
pnpm dev                           # API en :3000 y web en :5173 (con proxy a la API)
```

- Web: http://localhost:5173 · Salud: http://localhost:3000/health · Documentación API: http://localhost:3000/api/docs

## Comandos

| Comando                                                                           | Qué hace                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                                                      | Formato + ESLint + fronteras de módulos + tipos + pruebas unitarias (lo mismo que el hook de pre-push) |
| `pnpm test:integration`                                                           | Pruebas contra PostgreSQL real (Testcontainers; ver modos abajo)                                       |
| `pnpm test:e2e`                                                                   | Playwright en escritorio, tableta y móvil                                                              |
| `pnpm build`                                                                      | Compila contratos, web y API                                                                           |
| `pnpm db:generate`                                                                | Genera una migración SQL desde los esquemas Drizzle (se revisa en el PR)                               |
| `pnpm --filter @quatreros/api exec drizzle-kit generate --custom --name <nombre>` | Migración manual (triggers, permisos)                                                                  |
| `docker compose --profile app up -d --build`                                      | Prueba la imagen de producción en :3000                                                                |

### Modos de pruebas de integración

| Modo                         | Cómo                                                                             | Uso                                               |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| Testcontainers (por defecto) | `pnpm test:integration`                                                          | Requiere Docker                                   |
| Base existente               | `TEST_DATABASE_URL=... [TEST_DATABASE_MIGRATIONS_URL=...] pnpm test:integration` | CI (con roles separados para validar permisos)    |
| PostgreSQL embebido          | `TEST_DB=pglite pnpm test:integration`                                           | Sin Docker; no sirve para pruebas de concurrencia |

## Cómo se trabaja

1. Ninguna funcionalidad se programa sin especificación aprobada (`docs/04-specifications/`).
2. Una funcionalidad vertical por PR: contrato → dominio → caso de uso → API → UI → pruebas.
3. Reglas de negocio solo desde el registro de decisiones; lo pendiente queda detrás de un flag (`423 FEATURE_BLOCKED`).
4. Detalle de convenciones en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Operación

- Ambientes y variables: [`docs/operations/environments.md`](docs/operations/environments.md)
- Política de secretos: [`docs/operations/secrets-policy.md`](docs/operations/secrets-policy.md)
- Respaldo y restauración: [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md)
