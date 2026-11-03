CREATE SCHEMA "assistant";
--> statement-breakpoint
CREATE TABLE "assistant"."proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"arguments_hash" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"status" text DEFAULT 'pending_confirmation' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"executed_entity_type" text,
	"executed_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "proposals_expiry_chk" CHECK ("assistant"."proposals"."expires_at" > "assistant"."proposals"."created_at")
);
--> statement-breakpoint
CREATE TABLE "assistant"."requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"list_cost_cents" integer DEFAULT 0 NOT NULL,
	"active_seconds" numeric(10, 3) DEFAULT '0' NOT NULL,
	"tool_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"operation" text,
	"result" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_tokens_chk" CHECK ("assistant"."requests"."input_tokens" >= 0 and "assistant"."requests"."output_tokens" >= 0 and "assistant"."requests"."cache_read_tokens" >= 0 and "assistant"."requests"."cache_write_tokens" >= 0),
	CONSTRAINT "requests_cost_chk" CHECK ("assistant"."requests"."list_cost_cents" >= 0),
	CONSTRAINT "requests_seconds_chk" CHECK ("assistant"."requests"."active_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assistant"."tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"anthropic_session_id" text,
	"agent_id" text,
	"agent_version" text,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"request_text" text NOT NULL,
	"resolution_summary" text,
	"tools_used" text[] DEFAULT '{}'::text[] NOT NULL,
	"result_status" text DEFAULT 'pending' NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "tickets_anthropicSessionId_unique" UNIQUE("anthropic_session_id"),
	CONSTRAINT "tickets_request_text_chk" CHECK (char_length("assistant"."tickets"."request_text") between 1 and 1000),
	CONSTRAINT "tickets_cost_chk" CHECK ("assistant"."tickets"."cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assistant"."tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"custom_tool_use_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"error_code" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_calls_custom_id_uq" UNIQUE("custom_tool_use_id"),
	CONSTRAINT "tool_calls_duration_chk" CHECK ("assistant"."tool_calls"."duration_ms" is null or "assistant"."tool_calls"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "assistant"."proposals" ADD CONSTRAINT "proposals_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "assistant"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant"."requests" ADD CONSTRAINT "requests_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "assistant"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant"."tool_calls" ADD CONSTRAINT "tool_calls_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "assistant"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposals_ticket_idx" ON "assistant"."proposals" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "assistant"."proposals" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "requests_user_created_idx" ON "assistant"."requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "requests_created_idx" ON "assistant"."requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "requests_model_created_idx" ON "assistant"."requests" USING btree ("model","created_at");--> statement-breakpoint
CREATE INDEX "tickets_user_activity_idx" ON "assistant"."tickets" USING btree ("user_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "assistant"."tickets" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "tool_calls_ticket_idx" ON "assistant"."tool_calls" USING btree ("ticket_id","created_at");