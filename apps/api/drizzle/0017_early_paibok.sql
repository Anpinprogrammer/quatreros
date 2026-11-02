CREATE SCHEMA "sales";
--> statement-breakpoint
CREATE SCHEMA "distribution";
--> statement-breakpoint
CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "inventory"."reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_order_line_lot_uq" UNIQUE("sales_order_line_id","lot_id"),
	CONSTRAINT "reservations_quantity_chk" CHECK ("inventory"."reservations"."quantity" > 0),
	CONSTRAINT "reservations_status_chk" CHECK ("inventory"."reservations"."status" IN ('active','consumed','released'))
);
--> statement-breakpoint
CREATE TABLE "sales"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"phone" text,
	"delivery_address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_taxId_unique" UNIQUE("tax_id"),
	CONSTRAINT "customers_version_chk" CHECK ("sales"."customers"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"ordered_qty" numeric(14, 3) NOT NULL,
	"reserved_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"delivered_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"returned_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	CONSTRAINT "sales_order_lines_order_presentation_uq" UNIQUE("order_id","presentation_id"),
	CONSTRAINT "sales_order_lines_ordered_chk" CHECK ("sales"."order_lines"."ordered_qty" > 0),
	CONSTRAINT "sales_order_lines_reserved_chk" CHECK ("sales"."order_lines"."reserved_qty" >= 0 AND "sales"."order_lines"."reserved_qty" <= "sales"."order_lines"."ordered_qty"),
	CONSTRAINT "sales_order_lines_delivered_chk" CHECK ("sales"."order_lines"."delivered_qty" >= 0 AND "sales"."order_lines"."delivered_qty" <= "sales"."order_lines"."ordered_qty"),
	CONSTRAINT "sales_order_lines_returned_chk" CHECK ("sales"."order_lines"."returned_qty" >= 0 AND "sales"."order_lines"."returned_qty" <= "sales"."order_lines"."delivered_qty"),
	CONSTRAINT "sales_order_lines_price_chk" CHECK ("sales"."order_lines"."unit_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "distribution"."deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"is_partial" boolean NOT NULL,
	"partial_reason" text,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"registered_by" uuid NOT NULL,
	CONSTRAINT "deliveries_partial_chk" CHECK (NOT "distribution"."deliveries"."is_partial" OR "distribution"."deliveries"."partial_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "distribution"."delivery_lines" (
	"delivery_id" uuid NOT NULL,
	"dispatch_line_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "delivery_lines_delivery_line_uq" UNIQUE("delivery_id","dispatch_line_id"),
	CONSTRAINT "delivery_lines_quantity_chk" CHECK ("distribution"."delivery_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "distribution"."dispatch_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"loaded_qty" numeric(14, 3) NOT NULL,
	"delivered_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"returned_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	CONSTRAINT "dispatch_lines_loaded_chk" CHECK ("distribution"."dispatch_lines"."loaded_qty" > 0),
	CONSTRAINT "dispatch_lines_delivered_chk" CHECK ("distribution"."dispatch_lines"."delivered_qty" >= 0 AND "distribution"."dispatch_lines"."delivered_qty" <= "distribution"."dispatch_lines"."loaded_qty"),
	CONSTRAINT "dispatch_lines_returned_chk" CHECK ("distribution"."dispatch_lines"."returned_qty" >= 0 AND "distribution"."dispatch_lines"."returned_qty" <= "distribution"."dispatch_lines"."delivered_qty")
);
--> statement-breakpoint
CREATE TABLE "distribution"."dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"route_location_id" uuid,
	"dispatch_date" date NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loaded_at" timestamp with time zone,
	CONSTRAINT "dispatches_number_unique" UNIQUE("number"),
	CONSTRAINT "dispatches_status_chk" CHECK ("distribution"."dispatches"."status" IN ('prepared','in_route','to_settle'))
);
--> statement-breakpoint
CREATE TABLE "distribution"."returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"delivery_id" uuid,
	"order_line_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'in_inspection' NOT NULL,
	"inspected_by" uuid,
	"inspected_at" timestamp with time zone,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_number_unique" UNIQUE("number"),
	CONSTRAINT "returns_quantity_chk" CHECK ("distribution"."returns"."quantity" > 0),
	CONSTRAINT "returns_status_chk" CHECK ("distribution"."returns"."status" IN ('in_inspection','reinstated'))
);
--> statement-breakpoint
CREATE TABLE "finance"."collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"collector_type" text NOT NULL,
	"collector_user_id" uuid,
	"customer_id" uuid,
	"payment_method_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"delivery_id" uuid,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_number_unique" UNIQUE("number"),
	CONSTRAINT "collections_amount_chk" CHECK ("finance"."collections"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."credit_terms" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credit_limit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"term_days" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_cash" boolean NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_methods_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "finance"."receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivables_source_uq" UNIQUE("source_type","source_id"),
	CONSTRAINT "receivables_amount_chk" CHECK ("finance"."receivables"."amount" > 0 AND "finance"."receivables"."balance" >= 0 AND "finance"."receivables"."balance" <= "finance"."receivables"."amount"),
	CONSTRAINT "receivables_dates_chk" CHECK ("finance"."receivables"."due_on" >= "finance"."receivables"."issued_on")
);
--> statement-breakpoint
ALTER TABLE "inventory"."reservations" ADD CONSTRAINT "reservations_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution"."deliveries" ADD CONSTRAINT "deliveries_dispatch_id_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "distribution"."dispatches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution"."delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "distribution"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution"."delivery_lines" ADD CONSTRAINT "delivery_lines_dispatch_line_id_dispatch_lines_id_fk" FOREIGN KEY ("dispatch_line_id") REFERENCES "distribution"."dispatch_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution"."dispatch_lines" ADD CONSTRAINT "dispatch_lines_dispatch_id_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "distribution"."dispatches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."collections" ADD CONSTRAINT "collections_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "finance"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_active_idx" ON "inventory"."reservations" USING btree ("presentation_id","location_id") WHERE "inventory"."reservations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "sales_order_lines_order_idx" ON "sales"."order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "deliveries_dispatch_idx" ON "distribution"."deliveries" USING btree ("dispatch_id");--> statement-breakpoint
CREATE INDEX "deliveries_order_idx" ON "distribution"."deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dispatch_lines_dispatch_idx" ON "distribution"."dispatch_lines" USING btree ("dispatch_id");--> statement-breakpoint
CREATE INDEX "dispatch_lines_order_line_idx" ON "distribution"."dispatch_lines" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "dispatches_driver_idx" ON "distribution"."dispatches" USING btree ("driver_id","status");--> statement-breakpoint
CREATE INDEX "dispatches_site_idx" ON "distribution"."dispatches" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "returns_dispatch_idx" ON "distribution"."returns" USING btree ("dispatch_id","status");--> statement-breakpoint
CREATE INDEX "collections_driver_idx" ON "finance"."collections" USING btree ("collector_user_id","created_at");--> statement-breakpoint
CREATE INDEX "collections_delivery_idx" ON "finance"."collections" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "receivables_open_idx" ON "finance"."receivables" USING btree ("customer_id","due_on") WHERE "finance"."receivables"."balance" > 0;