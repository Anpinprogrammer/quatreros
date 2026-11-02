CREATE SCHEMA "pos";
--> statement-breakpoint
CREATE TABLE "pos"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "payments_amount_chk" CHECK ("pos"."payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "pos"."sale_line_consumptions" (
	"sale_line_id" uuid NOT NULL,
	"raw_material_id" uuid,
	"presentation_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "sale_line_consumptions_component_chk" CHECK (num_nonnulls("pos"."sale_line_consumptions"."raw_material_id", "pos"."sale_line_consumptions"."presentation_id") = 1),
	CONSTRAINT "sale_line_consumptions_quantity_chk" CHECK ("pos"."sale_line_consumptions"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "pos"."sale_line_lots" (
	"sale_line_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "sale_line_lots_line_lot_location_uq" UNIQUE("sale_line_id","lot_id","location_id"),
	CONSTRAINT "sale_line_lots_quantity_chk" CHECK ("pos"."sale_line_lots"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "pos"."sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"product_kind" text NOT NULL,
	"recipe_version_id" uuid,
	CONSTRAINT "sale_lines_sale_line_uq" UNIQUE("sale_id","line_no"),
	CONSTRAINT "sale_lines_quantity_chk" CHECK ("pos"."sale_lines"."quantity" > 0),
	CONSTRAINT "sale_lines_price_chk" CHECK ("pos"."sale_lines"."unit_price" >= 0 AND "pos"."sale_lines"."line_total" >= 0),
	CONSTRAINT "sale_lines_recipe_chk" CHECK (("pos"."sale_lines"."product_kind" = 'prepared') = ("pos"."sale_lines"."recipe_version_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pos"."sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"shift_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"cashier_user_id" uuid NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"paid_total" numeric(14, 2) NOT NULL,
	"change_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_number_unique" UNIQUE("number"),
	CONSTRAINT "sales_total_chk" CHECK ("pos"."sales"."total" > 0),
	CONSTRAINT "sales_paid_total_chk" CHECK ("pos"."sales"."paid_total" >= "pos"."sales"."total"),
	CONSTRAINT "sales_change_chk" CHECK ("pos"."sales"."change_amount" = "pos"."sales"."paid_total" - "pos"."sales"."total")
);
--> statement-breakpoint
CREATE TABLE "pos"."shift_counts" (
	"shift_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"counted_amount" numeric(14, 2) NOT NULL,
	"difference" numeric(14, 2) NOT NULL,
	CONSTRAINT "shift_counts_shift_method_uq" UNIQUE("shift_id","payment_method_id"),
	CONSTRAINT "shift_counts_amounts_chk" CHECK ("pos"."shift_counts"."expected_amount" >= 0 AND "pos"."shift_counts"."counted_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pos"."shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"cashier_user_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opening_cash" numeric(14, 2) NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"cash_expected" numeric(14, 2),
	"cash_counted" numeric(14, 2),
	"cash_difference" numeric(14, 2),
	"closing_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "shifts_status_chk" CHECK ("pos"."shifts"."status" IN ('open','closed','closed_with_variance','reviewed')),
	CONSTRAINT "shifts_opening_cash_chk" CHECK ("pos"."shifts"."opening_cash" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ALTER COLUMN "raw_material_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ADD COLUMN "presentation_id" uuid;--> statement-breakpoint
ALTER TABLE "pos"."payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "pos"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."sale_line_consumptions" ADD CONSTRAINT "sale_line_consumptions_sale_line_id_sale_lines_id_fk" FOREIGN KEY ("sale_line_id") REFERENCES "pos"."sale_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."sale_line_lots" ADD CONSTRAINT "sale_line_lots_sale_line_id_sale_lines_id_fk" FOREIGN KEY ("sale_line_id") REFERENCES "pos"."sale_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."sale_lines" ADD CONSTRAINT "sale_lines_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "pos"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "pos"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."shift_counts" ADD CONSTRAINT "shift_counts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "pos"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_sale_idx" ON "pos"."payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "payments_method_idx" ON "pos"."payments" USING btree ("payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_consumptions_material_uq" ON "pos"."sale_line_consumptions" USING btree ("sale_line_id","raw_material_id") WHERE "pos"."sale_line_consumptions"."raw_material_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_consumptions_presentation_uq" ON "pos"."sale_line_consumptions" USING btree ("sale_line_id","presentation_id") WHERE "pos"."sale_line_consumptions"."presentation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sale_lines_sale_idx" ON "pos"."sale_lines" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_shift_idx" ON "pos"."sales" USING btree ("shift_id","sold_at");--> statement-breakpoint
CREATE INDEX "sales_site_idx" ON "pos"."sales" USING btree ("site_id","sold_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_open_site_uq" ON "pos"."shifts" USING btree ("site_id") WHERE "pos"."shifts"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_open_cashier_uq" ON "pos"."shifts" USING btree ("cashier_user_id") WHERE "pos"."shifts"."status" = 'open';--> statement-breakpoint
CREATE INDEX "shifts_site_status_idx" ON "pos"."shifts" USING btree ("site_id","status","opened_at");--> statement-breakpoint
CREATE INDEX "shifts_cashier_idx" ON "pos"."shifts" USING btree ("cashier_user_id","opened_at");--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ADD CONSTRAINT "recipe_lines_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_lines_version_presentation_uq" ON "catalog"."recipe_lines" USING btree ("recipe_version_id","presentation_id") WHERE "catalog"."recipe_lines"."presentation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."recipe_lines" ADD CONSTRAINT "recipe_lines_component_chk" CHECK (num_nonnulls("catalog"."recipe_lines"."raw_material_id", "catalog"."recipe_lines"."presentation_id") = 1);