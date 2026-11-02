-- Permisos de traslados, FKs a maestros y consecutivo T (ADR-009, DR-005).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory.transfers, inventory.transfer_lines TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT SELECT ON inventory.transfers, inventory.transfer_lines TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "inventory"."transfers"
  ADD CONSTRAINT "transfers_from_location_id_locations_id_fk"
  FOREIGN KEY ("from_location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."transfers"
  ADD CONSTRAINT "transfers_to_location_id_locations_id_fk"
  FOREIGN KEY ("to_location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."transfers"
  ADD CONSTRAINT "transfers_transit_location_id_locations_id_fk"
  FOREIGN KEY ("transit_location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."transfers"
  ADD CONSTRAINT "transfers_sent_by_users_id_fk"
  FOREIGN KEY ("sent_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."transfers"
  ADD CONSTRAINT "transfers_received_by_users_id_fk"
  FOREIGN KEY ("received_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."transfer_lines"
  ADD CONSTRAINT "transfer_lines_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('T', 1)
ON CONFLICT (doc_type) DO NOTHING;
