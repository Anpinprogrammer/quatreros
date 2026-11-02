-- Permisos, FKs a maestros/inventario y consecutivos de compras (ADR-009, ADR-013, DR-005).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON purchasing.suppliers, purchasing.purchases,
      purchasing.purchase_lines, purchasing.receipts, purchasing.receipt_lines TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT SELECT ON purchasing.suppliers, purchasing.purchases, purchasing.purchase_lines,
      purchasing.receipts, purchasing.receipt_lines TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "purchasing"."purchases"
  ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "purchasing"."suppliers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."purchases"
  ADD CONSTRAINT "purchases_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."purchases"
  ADD CONSTRAINT "purchases_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_lines"
  ADD CONSTRAINT "purchase_lines_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "catalog"."raw_materials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."receipts"
  ADD CONSTRAINT "receipts_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."receipts"
  ADD CONSTRAINT "receipts_received_by_users_id_fk"
  FOREIGN KEY ("received_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchasing"."receipt_lines"
  ADD CONSTRAINT "receipt_lines_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."lots"
  ADD CONSTRAINT "lots_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "purchasing"."suppliers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."lots"
  ADD CONSTRAINT "lots_receipt_id_receipts_id_fk"
  FOREIGN KEY ("receipt_id") REFERENCES "purchasing"."receipts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('C', 1), ('R', 1), ('MP', 1)
ON CONFLICT (doc_type) DO NOTHING;
