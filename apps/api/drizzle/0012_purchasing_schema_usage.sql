-- La aplicación necesita USAGE del esquema para leer y escribir las tablas de compras (ADR-013).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA purchasing TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA purchasing TO quatreros_readonly;
  END IF;
END $$;
