-- Permisos, FKs hacia maestros y kardex solo-inserción (ADR-009, ADR-013, BR-080).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA inventory TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inventory TO quatreros_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA inventory TO quatreros_app;
    -- El kardex solo permite INSERT y SELECT; el trigger también lo impone.
    REVOKE UPDATE, DELETE, TRUNCATE ON inventory.stock_movements FROM quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA inventory TO quatreros_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA inventory TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
-- FKs hacia maestros estables. Se declaran aquí porque el módulo inventory no importa
-- los esquemas de catalog/admin (module-boundaries). Supplier, receipt y production_order
-- esperan a las entregas 3 y 4.
ALTER TABLE "inventory"."lots"
  ADD CONSTRAINT "lots_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."lots"
  ADD CONSTRAINT "lots_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "catalog"."raw_materials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements"
  ADD CONSTRAINT "stock_movements_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements"
  ADD CONSTRAINT "stock_movements_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements"
  ADD CONSTRAINT "stock_movements_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances"
  ADD CONSTRAINT "stock_balances_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances"
  ADD CONSTRAINT "stock_balances_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory.stock_movements
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();
