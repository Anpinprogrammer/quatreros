-- Permisos del esquema admin para los roles de aplicación (ADR-013).
-- Las tablas nuevas reciben DML por los privilegios por defecto de db-roles.sql; el uso del esquema no.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA admin TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA admin TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA admin TO quatreros_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA admin TO quatreros_readonly;
  END IF;
END $$;
