-- Permisos del esquema catalog y FK lógica a admin.users (ADR-013, module-boundaries).
-- Las tablas nuevas reciben DML por los privilegios por defecto de db-roles.sql; el uso del esquema no.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA catalog TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA catalog TO quatreros_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
-- El catálogo no importa el esquema de admin (frontera de módulos): la FK se declara aquí.
ALTER TABLE "catalog"."price_history"
  ADD CONSTRAINT "price_history_set_by_users_id_fk"
  FOREIGN KEY ("set_by") REFERENCES "admin"."users"("id")
  ON DELETE no action ON UPDATE no action;
