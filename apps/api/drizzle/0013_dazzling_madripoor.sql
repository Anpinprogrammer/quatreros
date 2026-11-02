CREATE SCHEMA "production";
--> statement-breakpoint
CREATE TABLE "catalog"."recipe_lines" (
	"recipe_version_id" uuid NOT NULL,
	"raw_material_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "recipe_lines_version_material_uq" UNIQUE("recipe_version_id","raw_material_id"),
	CONSTRAINT "recipe_lines_quantity_chk" CHECK ("catalog"."recipe_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."recipe_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"base_output_qty" numeric(14, 3) NOT NULL,
	"expected_yield_pct" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"tolerance_pct" numeric(5, 2) DEFAULT '3.00' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" uuid NOT NULL,
	CONSTRAINT "recipe_versions_recipe_version_uq" UNIQUE("recipe_id","version"),
	CONSTRAINT "recipe_versions_version_chk" CHECK ("catalog"."recipe_versions"."version" > 0),
	CONSTRAINT "recipe_versions_base_qty_chk" CHECK ("catalog"."recipe_versions"."base_output_qty" > 0),
	CONSTRAINT "recipe_versions_yield_chk" CHECK ("catalog"."recipe_versions"."expected_yield_pct" > 0 AND "catalog"."recipe_versions"."expected_yield_pct" <= 100),
	CONSTRAINT "recipe_versions_tolerance_chk" CHECK ("catalog"."recipe_versions"."tolerance_pct" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'production' NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "recipes_kind_product_uq" UNIQUE("kind","product_id")
);
--> statement-breakpoint
CREATE TABLE "production"."consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"raw_material_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"theoretical_qty" numeric(14, 3) NOT NULL,
	"actual_qty" numeric(14, 3) NOT NULL,
	CONSTRAINT "production_consumptions_theoretical_chk" CHECK ("production"."consumptions"."theoretical_qty" >= 0),
	CONSTRAINT "production_consumptions_actual_chk" CHECK ("production"."consumptions"."actual_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "production"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"site_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"recipe_version_id" uuid NOT NULL,
	"planned_qty" numeric(14, 3) NOT NULL,
	"actual_qty" numeric(14, 3),
	"yield_pct" numeric(6, 2),
	"yield_note" text,
	"output_lot_id" uuid,
	"status" text DEFAULT 'planned' NOT NULL,
	"responsible_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_outputLotId_unique" UNIQUE("output_lot_id"),
	CONSTRAINT "production_orders_planned_chk" CHECK ("production"."orders"."planned_qty" > 0),
	CONSTRAINT "production_orders_actual_chk" CHECK ("production"."orders"."actual_qty" IS NULL OR "production"."orders"."actual_qty" >= 0),
	CONSTRAINT "production_orders_status_chk" CHECK ("production"."orders"."status" IN ('planned','in_progress','closed')),
	CONSTRAINT "production_orders_closed_chk" CHECK ("production"."orders"."status" <> 'closed' OR ("production"."orders"."actual_qty" IS NOT NULL AND "production"."orders"."output_lot_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "production"."outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"base_quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "production_outputs_order_presentation_uq" UNIQUE("order_id","presentation_id"),
	CONSTRAINT "production_outputs_quantity_chk" CHECK ("production"."outputs"."quantity" > 0),
	CONSTRAINT "production_outputs_base_chk" CHECK ("production"."outputs"."base_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "catalog"."recipe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ADD CONSTRAINT "recipe_lines_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "catalog"."raw_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."recipe_versions" ADD CONSTRAINT "recipe_versions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "catalog"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."recipes" ADD CONSTRAINT "recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production"."consumptions" ADD CONSTRAINT "consumptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "production"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production"."outputs" ADD CONSTRAINT "outputs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "production"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_versions_current_uq" ON "catalog"."recipe_versions" USING btree ("recipe_id") WHERE "catalog"."recipe_versions"."is_current";--> statement-breakpoint
CREATE INDEX "production_consumptions_order_idx" ON "production"."consumptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "production_consumptions_lot_idx" ON "production"."consumptions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "production_orders_site_status_idx" ON "production"."orders" USING btree ("site_id","status","created_at");--> statement-breakpoint
CREATE INDEX "production_orders_product_idx" ON "production"."orders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "production_outputs_order_idx" ON "production"."outputs" USING btree ("order_id");