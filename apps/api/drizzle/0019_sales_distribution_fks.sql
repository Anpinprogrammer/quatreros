-- Permisos, FKs, consecutivos y métodos de pago de la entrega 5 (ADR-009, ADR-013, DR-005).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_app') THEN
    GRANT USAGE ON SCHEMA sales, distribution, finance TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON sales.customers, sales.orders, sales.order_lines,
      distribution.dispatches, distribution.dispatch_lines, distribution.deliveries,
      distribution.delivery_lines, distribution.returns, finance.payment_methods,
      finance.credit_terms, finance.receivables, finance.collections TO quatreros_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory.reservations TO quatreros_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quatreros_readonly') THEN
    GRANT USAGE ON SCHEMA sales, distribution, finance TO quatreros_readonly;
    GRANT SELECT ON sales.customers, sales.orders, sales.order_lines,
      distribution.dispatches, distribution.dispatch_lines, distribution.deliveries,
      distribution.delivery_lines, distribution.returns, finance.payment_methods,
      finance.credit_terms, finance.receivables, finance.collections TO quatreros_readonly;
    GRANT SELECT ON inventory.reservations TO quatreros_readonly;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "sales"."orders" (
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
  CONSTRAINT "sales_orders_status_chk" CHECK ("status" IN ('confirmed','in_dispatch','partially_delivered','delivered'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_site_status_idx" ON "sales"."orders" USING btree ("site_id","status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_customer_idx" ON "sales"."orders" USING btree ("customer_id");
--> statement-breakpoint
ALTER TABLE "sales"."order_lines"
  ADD CONSTRAINT "sales_order_lines_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "sales"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales"."orders"
  ADD CONSTRAINT "sales_orders_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales"."orders"
  ADD CONSTRAINT "sales_orders_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatches"
  ADD CONSTRAINT "dispatches_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatches"
  ADD CONSTRAINT "dispatches_driver_id_users_id_fk"
  FOREIGN KEY ("driver_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatches"
  ADD CONSTRAINT "dispatches_route_location_id_locations_id_fk"
  FOREIGN KEY ("route_location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatches"
  ADD CONSTRAINT "dispatches_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatch_lines"
  ADD CONSTRAINT "dispatch_lines_order_line_id_order_lines_id_fk"
  FOREIGN KEY ("order_line_id") REFERENCES "sales"."order_lines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatch_lines"
  ADD CONSTRAINT "dispatch_lines_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."dispatch_lines"
  ADD CONSTRAINT "dispatch_lines_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."deliveries"
  ADD CONSTRAINT "deliveries_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "sales"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."deliveries"
  ADD CONSTRAINT "deliveries_registered_by_users_id_fk"
  FOREIGN KEY ("registered_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_dispatch_id_dispatches_id_fk"
  FOREIGN KEY ("dispatch_id") REFERENCES "distribution"."dispatches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_delivery_id_deliveries_id_fk"
  FOREIGN KEY ("delivery_id") REFERENCES "distribution"."deliveries"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_order_line_id_order_lines_id_fk"
  FOREIGN KEY ("order_line_id") REFERENCES "sales"."order_lines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_registered_by_users_id_fk"
  FOREIGN KEY ("registered_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distribution"."returns"
  ADD CONSTRAINT "returns_inspected_by_users_id_fk"
  FOREIGN KEY ("inspected_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."credit_terms"
  ADD CONSTRAINT "credit_terms_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."credit_terms"
  ADD CONSTRAINT "credit_terms_updated_by_users_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."receivables"
  ADD CONSTRAINT "receivables_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."collections"
  ADD CONSTRAINT "collections_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "admin"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."collections"
  ADD CONSTRAINT "collections_collector_user_id_users_id_fk"
  FOREIGN KEY ("collector_user_id") REFERENCES "admin"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."collections"
  ADD CONSTRAINT "collections_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance"."collections"
  ADD CONSTRAINT "collections_delivery_id_deliveries_id_fk"
  FOREIGN KEY ("delivery_id") REFERENCES "distribution"."deliveries"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."reservations"
  ADD CONSTRAINT "reservations_sales_order_line_id_order_lines_id_fk"
  FOREIGN KEY ("sales_order_line_id") REFERENCES "sales"."order_lines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."reservations"
  ADD CONSTRAINT "reservations_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."reservations"
  ADD CONSTRAINT "reservations_presentation_id_presentations_id_fk"
  FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory"."reservations"
  ADD CONSTRAINT "reservations_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO platform.document_sequences (doc_type, next_value)
VALUES ('P', 1), ('D', 1), ('DV', 1), ('RC', 1)
ON CONFLICT (doc_type) DO NOTHING;
--> statement-breakpoint
INSERT INTO finance.payment_methods (name, is_cash)
VALUES ('Efectivo', true), ('Transferencia', false)
ON CONFLICT (name) DO NOTHING;
