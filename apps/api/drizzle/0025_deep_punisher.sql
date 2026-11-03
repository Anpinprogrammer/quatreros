CREATE SCHEMA "accounting";
--> statement-breakpoint
CREATE TABLE "finance"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_collection_receivable_uq" UNIQUE("collection_id","receivable_id"),
	CONSTRAINT "payment_allocations_amount_chk" CHECK ("finance"."payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."reconciliation_lines" (
	"reconciliation_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"received_amount" numeric(14, 2) NOT NULL,
	"variance" numeric(14, 2) NOT NULL,
	CONSTRAINT "reconciliation_lines_method_uq" UNIQUE("reconciliation_id","payment_method_id"),
	CONSTRAINT "reconciliation_lines_amounts_chk" CHECK ("finance"."reconciliation_lines"."expected_amount" >= 0 AND "finance"."reconciliation_lines"."received_amount" >= 0),
	CONSTRAINT "reconciliation_lines_variance_chk" CHECK ("finance"."reconciliation_lines"."variance" = "finance"."reconciliation_lines"."received_amount" - "finance"."reconciliation_lines"."expected_amount")
);
--> statement-breakpoint
CREATE TABLE "finance"."reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"collector_type" text NOT NULL,
	"collector_user_id" uuid,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"received_amount" numeric(14, 2) NOT NULL,
	"variance" numeric(14, 2) NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliations_number_unique" UNIQUE("number"),
	CONSTRAINT "reconciliations_amounts_chk" CHECK ("finance"."reconciliations"."expected_amount" >= 0 AND "finance"."reconciliations"."received_amount" >= 0),
	CONSTRAINT "reconciliations_variance_chk" CHECK ("finance"."reconciliations"."variance" = "finance"."reconciliations"."received_amount" - "finance"."reconciliations"."expected_amount"),
	CONSTRAINT "reconciliations_period_chk" CHECK ("finance"."reconciliations"."period_to" >= "finance"."reconciliations"."period_from")
);
--> statement-breakpoint
CREATE TABLE "accounting"."economic_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"site_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(14, 2),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "economic_events_source_uq" UNIQUE("type","source_type","source_id"),
	CONSTRAINT "economic_events_status_chk" CHECK ("accounting"."economic_events"."status" IN ('pending','posted','void'))
);
--> statement-breakpoint
ALTER TABLE "finance"."collections" ADD COLUMN "kind" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."collections" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."collections" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "finance"."receivables" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "finance"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "finance"."receivables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."reconciliation_lines" ADD CONSTRAINT "reconciliation_lines_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."reconciliations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."reconciliation_lines" ADD CONSTRAINT "reconciliation_lines_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "finance"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_allocations_receivable_idx" ON "finance"."payment_allocations" USING btree ("receivable_id");--> statement-breakpoint
CREATE INDEX "reconciliations_site_idx" ON "finance"."reconciliations" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "reconciliations_collector_idx" ON "finance"."reconciliations" USING btree ("collector_type","collector_user_id","created_at");--> statement-breakpoint
CREATE INDEX "economic_events_status_idx" ON "accounting"."economic_events" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE INDEX "economic_events_source_idx" ON "accounting"."economic_events" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "economic_events_site_idx" ON "accounting"."economic_events" USING btree ("site_id","occurred_at");--> statement-breakpoint
ALTER TABLE "finance"."collections" ADD CONSTRAINT "collections_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."reconciliations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_status_idx" ON "finance"."collections" USING btree ("status","site_id");--> statement-breakpoint
CREATE INDEX "collections_reconciliation_idx" ON "finance"."collections" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "receivables_site_idx" ON "finance"."receivables" USING btree ("site_id","due_on");