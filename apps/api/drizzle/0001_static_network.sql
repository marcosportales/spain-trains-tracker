-- Hand-edited after `drizzle-kit generate`: geography types unquoted and "public". qualifiers dropped
-- (so tables land in the connection search_path schema, which tests rely on). Keep both when regenerating.
-- Rollback: drizzle/rollback/0001_static_network.down.sql
CREATE TABLE "hubs" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"service_type" text NOT NULL,
	"hub_code" text,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "scheduled_runs" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"train_number" text NOT NULL,
	"line_code" text NOT NULL,
	"service_type" text NOT NULL,
	"service_id" text NOT NULL,
	"shape_id" text
);
--> statement-breakpoint
CREATE TABLE "scheduled_stops" (
	"trip_id" text NOT NULL,
	"seq" integer NOT NULL,
	"station_code" text NOT NULL,
	"arrival_seconds" integer NOT NULL,
	"departure_seconds" integer NOT NULL,
	CONSTRAINT "scheduled_stops_trip_id_seq_pk" PRIMARY KEY("trip_id","seq")
);
--> statement-breakpoint
CREATE TABLE "service_calendar_dates" (
	"service_id" text NOT NULL,
	"date" date NOT NULL,
	"added" boolean NOT NULL,
	CONSTRAINT "service_calendar_dates_service_id_date_pk" PRIMARY KEY("service_id","date")
);
--> statement-breakpoint
CREATE TABLE "service_calendars" (
	"service_id" text PRIMARY KEY NOT NULL,
	"monday" boolean NOT NULL,
	"tuesday" boolean NOT NULL,
	"wednesday" boolean NOT NULL,
	"thursday" boolean NOT NULL,
	"friday" boolean NOT NULL,
	"saturday" boolean NOT NULL,
	"sunday" boolean NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "static_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"etag" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"hub_code" text,
	"service_types" text[] NOT NULL,
	"wheelchair_boarding" boolean
);
--> statement-breakpoint
CREATE TABLE "track_geometries" (
	"shape_id" text PRIMARY KEY NOT NULL,
	"line_code" text,
	"geometry" geography(LineString, 4326) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_hub_code_hubs_code_fk" FOREIGN KEY ("hub_code") REFERENCES "hubs"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_line_code_lines_code_fk" FOREIGN KEY ("line_code") REFERENCES "lines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_service_id_service_calendars_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "service_calendars"("service_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_runs" ADD CONSTRAINT "scheduled_runs_shape_id_track_geometries_shape_id_fk" FOREIGN KEY ("shape_id") REFERENCES "track_geometries"("shape_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_stops" ADD CONSTRAINT "scheduled_stops_trip_id_scheduled_runs_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "scheduled_runs"("trip_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_stops" ADD CONSTRAINT "scheduled_stops_station_code_stations_code_fk" FOREIGN KEY ("station_code") REFERENCES "stations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_calendar_dates" ADD CONSTRAINT "service_calendar_dates_service_id_service_calendars_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "service_calendars"("service_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_hub_code_hubs_code_fk" FOREIGN KEY ("hub_code") REFERENCES "hubs"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_geometries" ADD CONSTRAINT "track_geometries_line_code_lines_code_fk" FOREIGN KEY ("line_code") REFERENCES "lines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_runs_train_number_idx" ON "scheduled_runs" USING btree ("train_number");--> statement-breakpoint
CREATE INDEX "scheduled_stops_station_idx" ON "scheduled_stops" USING btree ("station_code");--> statement-breakpoint
CREATE INDEX "stations_location_gist" ON "stations" USING gist ("location");--> statement-breakpoint
CREATE INDEX "track_geometries_geometry_gist" ON "track_geometries" USING gist ("geometry");