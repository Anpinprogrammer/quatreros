CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."lot_inputs" (
	"output_lot_id" uuid NOT NULL,
	"input_lot_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "lot_inputs_output_lot_id_input_lot_id_pk" PRIMARY KEY("output_lot_id","input_lot_id"),
	CONSTRAINT "lot_inputs_distinct_chk" CHECK ("inventory"."lot_inputs"."output_lot_id" <> "inventory"."lot_inputs"."input_lot_id"),
	CONSTRAINT "lot_inputs_quantity_chk" CHECK ("inventory"."lot_inputs"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"lot_type" text NOT NULL,
	"product_id" uuid,
	"raw_material_id" uuid,
	"supplier_id" uuid,
	"receipt_id" uuid,
	"production_order_id" uuid,
	"unit_cost" numeric(14, 4),
	"manufactured_on" date,
	"expires_on" date,
	"status" text DEFAULT 'available' NOT NULL,
	"is_opening_balance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lots_code_unique" UNIQUE("code"),
	CONSTRAINT "lots_type_chk" CHECK ("inventory"."lots"."lot_type" IN ('raw_material','finished_good')),
	CONSTRAINT "lots_status_chk" CHECK ("inventory"."lots"."status" IN ('available','in_inspection','blocked','expired','written_off')),
	CONSTRAINT "lots_type_consistency_chk" CHECK ((("inventory"."lots"."lot_type" = 'finished_good' AND "inventory"."lots"."product_id" IS NOT NULL AND "inventory"."lots"."raw_material_id" IS NULL)
        OR ("inventory"."lots"."lot_type" = 'raw_material' AND "inventory"."lots"."raw_material_id" IS NOT NULL AND "inventory"."lots"."product_id" IS NULL))),
	CONSTRAINT "lots_expiry_chk" CHECK ("inventory"."lots"."expires_on" IS NULL OR "inventory"."lots"."manufactured_on" IS NULL OR "inventory"."lots"."expires_on" >= "inventory"."lots"."manufactured_on")
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_balances" (
	"lot_id" uuid NOT NULL,
	"presentation_id" uuid,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_lot_presentation_location_uq" UNIQUE NULLS NOT DISTINCT("lot_id","presentation_id","location_id"),
	CONSTRAINT "stock_balances_quantity_chk" CHECK ("inventory"."stock_balances"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"movement_type" text NOT NULL,
	"lot_id" uuid NOT NULL,
	"presentation_id" uuid,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"base_quantity" numeric(14, 3) NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"reverses_id" bigint,
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type_chk" CHECK ("inventory"."stock_movements"."movement_type" IN ('receipt','production_consumption','production_output','transfer_out','transfer_in','dispatch_out','dispatch_return','sale','customer_return','return_reinstated','write_off','adjustment','package_open_out','package_open_in','opening_balance','reversal')),
	CONSTRAINT "stock_movements_quantity_chk" CHECK ("inventory"."stock_movements"."quantity" <> 0 AND "inventory"."stock_movements"."base_quantity" <> 0),
	CONSTRAINT "stock_movements_sign_chk" CHECK (sign("inventory"."stock_movements"."quantity") = sign("inventory"."stock_movements"."base_quantity"))
);
--> statement-breakpoint
ALTER TABLE "inventory"."lot_inputs" ADD CONSTRAINT "lot_inputs_output_lot_id_lots_id_fk" FOREIGN KEY ("output_lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."lot_inputs" ADD CONSTRAINT "lot_inputs_input_lot_id_lots_id_fk" FOREIGN KEY ("input_lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "inventory"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lots_fefo_idx" ON "inventory"."lots" USING btree ("product_id","expires_on") WHERE "inventory"."lots"."status" = 'available';--> statement-breakpoint
CREATE INDEX "stock_balances_location_idx" ON "inventory"."stock_balances" USING btree ("location_id") WHERE "inventory"."stock_balances"."quantity" > 0;--> statement-breakpoint
CREATE INDEX "stock_movements_lot_loc_idx" ON "inventory"."stock_movements" USING btree ("lot_id","location_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_source_idx" ON "inventory"."stock_movements" USING btree ("source_type","source_id");