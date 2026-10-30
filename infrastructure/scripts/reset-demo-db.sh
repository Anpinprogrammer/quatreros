#!/usr/bin/env bash
# =====================================================================
# Recrea DESDE CERO la base de demostración local: borra la base, crea roles y base
# (db-roles.sql), aplica migraciones y carga la semilla demo (7 usuarios ficticios).
#
# SOLO desarrollo local o CI. Se niega a correr con NODE_ENV=staging|production.
#
# Variables:
#   PG_ADMIN_URL   conexión de superusuario al clúster (base "postgres").
#                  docker compose: postgres://postgres:postgres_local_dev@localhost:5432/postgres
#   DB_NAME        nombre de la base (por defecto: quatreros)
#   DB_HOST/DB_PORT  host y puerto para las URLs de la app (por defecto: localhost / 5432)
#   DEMO_PASSWORD  contraseña de los usuarios demo (12+ caracteres)
#   OWNER_PW / APP_PW / RO_PW  contraseñas de roles (por defecto las de desarrollo local)
#
# Uso:  PG_ADMIN_URL=... DEMO_PASSWORD=... pnpm db:reset:demo
# =====================================================================
set -euo pipefail

case "${NODE_ENV:-development}" in
  staging | production)
    echo "reset-demo-db: prohibido con NODE_ENV=${NODE_ENV}" >&2
    exit 1
    ;;
esac

: "${PG_ADMIN_URL:?Define PG_ADMIN_URL (superusuario, base postgres)}"
: "${DEMO_PASSWORD:?Define DEMO_PASSWORD (12+ caracteres)}"
DB_NAME="${DB_NAME:-quatreros}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
OWNER_PW="${OWNER_PW:-owner_local_dev}"
APP_PW="${APP_PW:-app_local_dev}"
RO_PW="${RO_PW:-ro_local_dev}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "→ Borrando la base ${DB_NAME} (si existe)"
psql "$PG_ADMIN_URL" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)"

echo "→ Roles y base"
psql "$PG_ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -v owner_pw="'${OWNER_PW}'" -v app_pw="'${APP_PW}'" -v ro_pw="'${RO_PW}'" -v dbname="${DB_NAME}" \
  -f infrastructure/scripts/db-roles.sql >/dev/null

export DATABASE_MIGRATIONS_URL="postgres://quatreros_owner:${OWNER_PW}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export DATABASE_URL="postgres://quatreros_app:${APP_PW}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export DEMO_PASSWORD

echo "→ Migraciones"
pnpm --silent db:migrate
echo "→ Semilla demo"
pnpm --silent db:seed:demo
echo "Listo: ${DATABASE_URL%%:*}://quatreros_app:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"
