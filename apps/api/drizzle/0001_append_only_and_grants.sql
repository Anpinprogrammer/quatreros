-- Migración personalizada: reglas que drizzle-kit no genera.
-- ADR-012 (auditoría append-only) y ADR-013 (roles de mínimo privilegio).

-- 1. Función genérica que prohíbe UPDATE/DELETE en tablas solo-inserción.
CREATE OR REPLACE FUNCTION platform.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabla append-only: % no permitido en %.%', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit.audit_log
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();
--> statement-breakpoint

-- 2. Permisos para el rol de la aplicación, solo si el rol existe.
--    Los roles se crean una vez por un administrador de BD (infrastructure/scripts/db-roles.sql),
--    porque en servicios gestionados la migración no siempre puede crear roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA auth, platform, audit TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO quatreros_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform, audit TO quatreros_app;
    -- Auditoría: solo insertar y leer (RNF-090).
    GRANT SELECT, INSERT ON audit.audit_log TO quatreros_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_log FROM quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA auth, platform, audit TO quatreros_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA platform, audit TO quatreros_readonly;
  END IF;
END $$;
