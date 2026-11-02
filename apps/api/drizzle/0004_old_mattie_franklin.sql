CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"units_per" numeric(14, 3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentations_product_name_uq" UNIQUE("product_id","name"),
	CONSTRAINT "presentations_units_per_chk" CHECK ("catalog"."presentations"."units_per" > 0),
	CONSTRAINT "presentations_version_chk" CHECK ("catalog"."presentations"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_history_price_chk" CHECK ("catalog"."price_history"."price" > 0),
	CONSTRAINT "price_history_validity_chk" CHECK ("catalog"."price_history"."valid_to" IS NULL OR "catalog"."price_history"."valid_to" > "catalog"."price_history"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"base_unit" text NOT NULL,
	"shelf_life_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name"),
	CONSTRAINT "products_kind_chk" CHECK ("catalog"."products"."kind" IN ('manufactured','prepared')),
	CONSTRAINT "products_shelf_life_chk" CHECK ("catalog"."products"."shelf_life_days" IS NULL OR "catalog"."products"."shelf_life_days" > 0),
	CONSTRAINT "products_manufactured_shelf_life_chk" CHECK ("catalog"."products"."kind" = 'prepared' OR "catalog"."products"."shelf_life_days" IS NOT NULL),
	CONSTRAINT "products_version_chk" CHECK ("catalog"."products"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."raw_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"tracks_expiry" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_materials_name_unique" UNIQUE("name"),
	CONSTRAINT "raw_materials_version_chk" CHECK ("catalog"."raw_materials"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."presentations" ADD CONSTRAINT "presentations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."price_history" ADD CONSTRAINT "price_history_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "catalog"."presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presentations_product_idx" ON "catalog"."presentations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "price_history_presentation_idx" ON "catalog"."price_history" USING btree ("presentation_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "price_history_current_uq" ON "catalog"."price_history" USING btree ("presentation_id") WHERE "catalog"."price_history"."valid_to" IS NULL;