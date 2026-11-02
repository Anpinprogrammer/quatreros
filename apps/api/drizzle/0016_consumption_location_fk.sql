ALTER TABLE "production"."consumptions"
  ADD CONSTRAINT "consumptions_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
