CREATE TABLE "inventory"."transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"sent_qty" numeric(14, 3) NOT NULL,
	"received_qty" numeric(14, 3),
	CONSTRAINT "transfer_lines_sent_qty_chk" CHECK ("inventory"."transfer_lines"."sent_qty" > 0),
	CONSTRAINT "transfer_lines_received_qty_chk" CHECK ("inventory"."transfer_lines"."received_qty" IS NULL OR ("inventory"."transfer_lines"."received_qty" >= 0 AND "inventory"."transfer_lines"."received_qty" <= "inventory"."transfer_lines"."sent_qty"))
);
--> statement-breakpoint
CREATE TABLE "inventory"."transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"transit_location_id" uuid NOT NULL,
	"status" text DEFAULT 'in_transit' NOT NULL,
	"sent_by" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	CONSTRAINT "transfers_number_unique" UNIQUE("number"),
	CONSTRAINT "transfers_locations_chk" CHECK ("inventory"."transfers"."from_location_id" <> "inventory"."transfers"."to_location_id"),
	CONSTRAINT "transfers_status_chk" CHECK ("inventory"."transfers"."status" IN ('in_transit','received','received_with_variance'))
);
--> statement-breakpoint
ALTER TABLE "inventory"."transfer_lines" ADD CONSTRAINT "transfer_lines_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "inventory"."transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."transfer_lines" ADD CONSTRAINT "transfer_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfer_lines_transfer_idx" ON "inventory"."transfer_lines" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "inventory"."transfers" USING btree ("status","sent_at");