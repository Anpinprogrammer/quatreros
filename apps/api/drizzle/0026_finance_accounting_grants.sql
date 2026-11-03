-- Permisos, FKs, hechos inmutables y consecutivo de la entrega 7 (ADR-009, ADR-012, ADR-013).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA accounting, finance TO quatreros_app;
    GRANT SELECT, INSERT ON accounting.economic_events TO quatreros_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA accounting TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON finance.payment_allocations,
      finance.reconciliations, finance.reconciliation_lines TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON finance.receivables, finance.collections TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA accounting, finance TO quatreros_readonly;
    GRANT SELECT ON accounting.economic_events TO quatreros_readonly;
    GRANT SELECT ON finance.payment_allocations, finance.reconciliations,
      finance.reconciliation_lines, finance.receivables, finance.collections TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "finance"."receivables"
  ADD CONSTRAINT "receivables_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."reconciliations"
  ADD CONSTRAINT "reconciliations_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."reconciliations"
  ADD CONSTRAINT "reconciliations_collector_user_id_users_id_fk"
  FOREIGN KEY ("collector_user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."reconciliations"
  ADD CONSTRAINT "reconciliations_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "accounting"."economic_events"
  ADD CONSTRAINT "economic_events_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
UPDATE "finance"."receivables" r
SET "site_id" = dp."site_id"
FROM "distribution"."deliveries" d
JOIN "distribution"."dispatches" dp ON dp."id" = d."dispatch_id"
WHERE r."source_type" = 'distribution.delivery'
  AND r."source_id" = d."id"
  AND r."site_id" IS NULL;
--> statement-breakpoint
CREATE TRIGGER "economic_events_append_only"
BEFORE UPDATE OR DELETE ON "accounting"."economic_events"
FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('CONC', 1)
ON CONFLICT (doc_type) DO NOTHING;
