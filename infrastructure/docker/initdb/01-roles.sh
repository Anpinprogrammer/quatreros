#!/bin/sh
# Crea roles y base de datos de desarrollo local (solo docker-compose).
# Contraseñas de desarrollo LOCAL únicamente: nunca usarlas en otros entornos.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" \
  -v owner_pw="'owner_local_dev'" -v app_pw="'app_local_dev'" -v ro_pw="'ro_local_dev'" -v dbname=quatreros \
  -f /scripts/db-roles.sql
