# Ambientes y configuración

| Ambiente     | Dónde                                | Base de datos                               | Datos                                     | Despliegue                                   |
| ------------ | ------------------------------------ | ------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `local`      | Máquina del desarrollador            | `docker compose` (PostgreSQL 17)            | Semillas sintéticas                       | `pnpm dev`                                   |
| `test`       | CI y pruebas locales                 | Service container / Testcontainers / PGlite | Desechables                               | Automático en cada prueba                    |
| `staging`    | Hosting aprobado (propuesto: Render) | Instancia propia, separada de producción    | Sintéticos; nunca datos personales reales | Automático al pasar CI en `main`             |
| `production` | Hosting aprobado                     | Instancia gestionada con PITR               | Reales                                    | Manual, con aprobación del entorno protegido |

El hosting está **pendiente de aprobación** (Q-C-01, ADR-020). La configuración es por variables de entorno; la misma imagen Docker se promueve de staging a producción.

## Variables

La lista completa, con descripción, está en [`/.env.example`](../../.env.example). Reglas:

- La API valida la configuración al arrancar (`apps/api/src/config/env.ts`) y no inicia si falta algo obligatorio.
- En `staging` y `production`, `BETTER_AUTH_SECRET` es obligatoria (≥ 32 caracteres).
- `DATABASE_URL` usa siempre el rol `quatreros_app`; `DATABASE_MIGRATIONS_URL` (rol dueño) solo existe en el paso de migraciones del despliegue.
- La activación efectiva de IA y Telegram está en la base de datos (`platform.addon_settings`), no en variables.
- **Quatreros AI:** `ANTHROPIC_API_KEY` y los IDs del agente y del entorno son **por ambiente**. Hoy solo existe el espacio de trabajo de **desarrollo** (`quatreros-ai/claude-lock.json`). Staging y producción necesitan su clave y sus IDs; producción, además, su propio espacio de trabajo y lockfile (Q-IA-04). Publicar el backend no cambia el agente: el agente se sincroniza aparte con `ant apply` (deployment-design §7.1).

## Primer despliegue en un ambiente nuevo

1. Crear la base y los roles: `infrastructure/scripts/db-roles.sql` (una vez, administrador de BD).
2. Configurar variables en el hosting (sin valores en el repositorio).
3. Comando previo al despliegue: `node dist/cli/migrate.js` con `DATABASE_MIGRATIONS_URL`.
4. Una vez: `node dist/cli/seed.js` (flags apagados, complementos apagados, consecutivos).
5. Verificar `/ready` = 200.
6. Programar el respaldo diario (`infrastructure/scripts/backup.sh`) y registrar la primera restauración de prueba.
