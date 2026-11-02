-- FKs, permisos y consecutivo de la entrega 6 (ADR-009, ADR-013, DR-005).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA pos TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pos TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA pos TO quatreros_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA pos TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "pos"."shifts"
  ADD CONSTRAINT "shifts_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."shifts"
  ADD CONSTRAINT "shifts_cashier_user_id_users_id_fk"
  FOREIGN KEY ("cashier_user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."shifts"
  ADD CONSTRAINT "shifts_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sales"
  ADD CONSTRAINT "sales_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sales"
  ADD CONSTRAINT "sales_cashier_user_id_users_id_fk"
  FOREIGN KEY ("cashier_user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_lines"
  ADD CONSTRAINT "sale_lines_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_lines"
  ADD CONSTRAINT "sale_lines_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_lines"
  ADD CONSTRAINT "sale_lines_recipe_version_id_recipe_versions_id_fk"
  FOREIGN KEY ("recipe_version_id") REFERENCES "catalog"."recipe_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_line_lots"
  ADD CONSTRAINT "sale_line_lots_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_line_lots"
  ADD CONSTRAINT "sale_line_lots_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_line_consumptions"
  ADD CONSTRAINT "sale_line_consumptions_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "catalog"."raw_materials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."sale_line_consumptions"
  ADD CONSTRAINT "sale_line_consumptions_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."payments"
  ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk"
  FOREIGN KEY ("payment_method_id") REFERENCES "finance"."payment_methods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pos"."shift_counts"
  ADD CONSTRAINT "shift_counts_payment_method_id_payment_methods_id_fk"
  FOREIGN KEY ("payment_method_id") REFERENCES "finance"."payment_methods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('V', 1)
ON CONFLICT (doc_type) DO NOTHING;
