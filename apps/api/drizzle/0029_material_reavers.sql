CREATE TABLE "platform"."session_activity" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shell" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."session_activity" ADD CONSTRAINT "session_activity_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_activity_user_idx" ON "platform"."session_activity" USING btree ("user_id","last_seen_at");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT SELECT, INSERT, UPDATE ON platform.session_activity TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT SELECT ON platform.session_activity TO quatreros_readonly;
  END IF;
END $$;
