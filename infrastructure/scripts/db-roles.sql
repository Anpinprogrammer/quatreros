-- =====================================================================
-- Roles de base de datos de mínimo privilegio (ADR-013).
-- Se ejecuta UNA VEZ por un administrador de la BD, antes de la primera migración.
-- Uso (local):
--   psql "$ADMIN_URL" -v owner_pw="'...'" -v app_pw="'...'" -v ro_pw="'...'" \
--        -v dbname=quatreros -f infrastructure/scripts/db-roles.sql
-- Nunca guardar contraseñas reales en el repositorio.
-- =====================================================================

-- Dueño de esquemas: solo para migraciones (CI/CD).
SELECT 'CREATE ROLE quatreros_owner LOGIN PASSWORD ' || :'owner_pw'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_owner') \gexec

-- Aplicación: DML, sin DDL.
SELECT 'CREATE ROLE quatreros_app LOGIN PASSWORD ' || :'app_pw'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') \gexec

-- Solo lectura: respaldos y soporte.
SELECT 'CREATE ROLE quatreros_readonly LOGIN PASSWORD ' || :'ro_pw'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') \gexec

SELECT format('CREATE DATABASE %I OWNER quatreros_owner', :'dbname')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname') \gexec

\connect :dbname

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO quatreros_app, quatreros_readonly;

-- Tablas y secuencias que el dueño cree en el futuro: permisos por defecto para la aplicación.
-- (Las excepciones de solo-inserción —auditoría, kardex, asientos— se aplican en cada migración.)
ALTER DEFAULT PRIVILEGES FOR ROLE quatreros_owner
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quatreros_app;
ALTER DEFAULT PRIVILEGES FOR ROLE quatreros_owner
  GRANT USAGE, SELECT ON SEQUENCES TO quatreros_app;
ALTER DEFAULT PRIVILEGES FOR ROLE quatreros_owner
  GRANT SELECT ON TABLES TO quatreros_readonly;
