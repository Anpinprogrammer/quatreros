ALTER TABLE "distribution"."dispatch_lines"
  ADD CONSTRAINT "dispatch_lines_location_id_locations_id_fk"
  FOREIGN KEY ("location_id") REFERENCES "admin"."locations"("id") ON DELETE no action ON UPDATE no action;
