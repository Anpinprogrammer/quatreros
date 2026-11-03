-- Permisos, FKs y bitácora inmutable del asistente (DEC-106, ADR-013).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA assistant TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE ON assistant.tickets, assistant.tool_calls, assistant.proposals TO quatreros_app;
    GRANT SELECT, INSERT ON assistant.requests TO quatreros_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA assistant TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA assistant TO quatreros_readonly;
    GRANT SELECT ON assistant.tickets, assistant.tool_calls, assistant.proposals, assistant.requests TO quatreros_readonly;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "assistant"."tickets"
  ADD CONSTRAINT "tickets_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant"."requests"
  ADD CONSTRAINT "requests_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER "assistant_requests_append_only"
BEFORE UPDATE OR DELETE ON "assistant"."requests"
FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();
