CREATE TABLE "sales"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"payment_mode" text NOT NULL,
	"requested_date" date,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"credit_warning" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "sales_orders_status_chk" CHECK ("sales"."orders"."status" IN ('confirmed','in_dispatch','partially_delivered','delivered'))
);
--> statement-breakpoint
ALTER TABLE "sales"."orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_orders_site_status_idx" ON "sales"."orders" USING btree ("site_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_idx" ON "sales"."orders" USING btree ("customer_id");