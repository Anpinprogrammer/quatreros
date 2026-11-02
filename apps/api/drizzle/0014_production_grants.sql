-- Permisos, FKs a maestros/inventario y consecutivos de producción (ADR-009, ADR-013, DR-005).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA production TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON production.orders, production.consumptions,
      production.outputs TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON catalog.recipes, catalog.recipe_versions,
      catalog.recipe_lines TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA production TO quatreros_readonly;
    GRANT SELECT ON production.orders, production.consumptions, production.outputs TO quatreros_readonly;
    GRANT SELECT ON catalog.recipes, catalog.recipe_versions, catalog.recipe_lines TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "catalog"."recipe_versions"
  ADD CONSTRAINT "recipe_versions_published_by_users_id_fk"
  FOREIGN KEY ("published_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."orders"
  ADD CONSTRAINT "orders_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."orders"
  ADD CONSTRAINT "orders_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."orders"
  ADD CONSTRAINT "orders_recipe_version_id_recipe_versions_id_fk"
  FOREIGN KEY ("recipe_version_id") REFERENCES "catalog"."recipe_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."orders"
  ADD CONSTRAINT "orders_output_lot_id_lots_id_fk"
  FOREIGN KEY ("output_lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."orders"
  ADD CONSTRAINT "orders_responsible_id_users_id_fk"
  FOREIGN KEY ("responsible_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."consumptions"
  ADD CONSTRAINT "consumptions_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "catalog"."raw_materials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."consumptions"
  ADD CONSTRAINT "consumptions_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production"."outputs"
  ADD CONSTRAINT "outputs_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('OP', 1), ('PT', 1)
ON CONFLICT (doc_type) DO NOTHING;
