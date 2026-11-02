CREATE SCHEMA "purchasing";
--> statement-breakpoint
CREATE TABLE "purchasing"."purchase_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"raw_material_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 4) NOT NULL,
	"received_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	CONSTRAINT "purchase_lines_quantity_chk" CHECK ("purchasing"."purchase_lines"."quantity" > 0),
	CONSTRAINT "purchase_lines_unit_cost_chk" CHECK ("purchasing"."purchase_lines"."unit_cost" > 0),
	CONSTRAINT "purchase_lines_received_chk" CHECK ("purchasing"."purchase_lines"."received_qty" >= 0 AND "purchasing"."purchase_lines"."received_qty" <= "purchasing"."purchase_lines"."quantity")
);
--> statement-breakpoint
CREATE TABLE "purchasing"."purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"purchased_on" date NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'pending_receipt' NOT NULL,
	"attachment_key" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_number_unique" UNIQUE("number"),
	CONSTRAINT "purchases_total_chk" CHECK ("purchasing"."purchases"."total" >= 0),
	CONSTRAINT "purchases_status_chk" CHECK ("purchasing"."purchases"."status" IN ('pending_receipt','partially_received','received'))
);
--> statement-breakpoint
CREATE TABLE "purchasing"."receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"purchase_line_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"lot_id" uuid NOT NULL,
	CONSTRAINT "receipt_lines_receipt_purchase_line_uq" UNIQUE("receipt_id","purchase_line_id"),
	CONSTRAINT "receipt_lines_quantity_chk" CHECK ("purchasing"."receipt_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchasing"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"received_by" uuid NOT NULL,
	CONSTRAINT "receipts_number_unique" UNIQUE("number"),
	CONSTRAINT "receipts_status_chk" CHECK ("purchasing"."receipts"."status" IN ('posted','reversed'))
);
--> statement-breakpoint
CREATE TABLE "purchasing"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"phone" text,
	"contact_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_unique" UNIQUE("name"),
	CONSTRAINT "suppliers_taxId_unique" UNIQUE("tax_id"),
	CONSTRAINT "suppliers_version_chk" CHECK ("purchasing"."suppliers"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "purchasing"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchasing"."receipt_lines" ADD CONSTRAINT "receipt_lines_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "purchasing"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchasing"."receipt_lines" ADD CONSTRAINT "receipt_lines_purchase_line_id_purchase_lines_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "purchasing"."purchase_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchasing"."receipts" ADD CONSTRAINT "receipts_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "purchasing"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_lines_purchase_idx" ON "purchasing"."purchase_lines" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_lines_material_idx" ON "purchasing"."purchase_lines" USING btree ("raw_material_id");--> statement-breakpoint
CREATE INDEX "purchases_site_status_idx" ON "purchasing"."purchases" USING btree ("site_id","status","purchased_on");--> statement-breakpoint
CREATE INDEX "purchases_supplier_idx" ON "purchasing"."purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "receipt_lines_receipt_idx" ON "purchasing"."receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipt_lines_lot_idx" ON "purchasing"."receipt_lines" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "receipts_purchase_idx" ON "purchasing"."receipts" USING btree ("purchase_id","received_at");