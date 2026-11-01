-- Hand-edited after `drizzle-kit generate`: the hypertable and compression statements at the end.
-- Drizzle cannot express them. Keep them when regenerating.
-- Rollback: drizzle/rollback/0002_movement.down.sql
CREATE TABLE "delays" (
	"train_number" text NOT NULL,
	"service_date" date NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"seconds" integer NOT NULL,
	"at_station_code" text
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"train_number" text NOT NULL,
	"service_date" date NOT NULL,
	"service_type" text NOT NULL,
	"line_code" text,
	"origin_station_code" text,
	"destination_station_code" text,
	"status" text,
	"wheelchair_accessible" boolean,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "runs_train_number_service_date_pk" PRIMARY KEY("train_number","service_date")
);
--> statement-breakpoint
CREATE TABLE "service_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"header" text NOT NULL,
	"description" text NOT NULL,
	"url" text,
	"active_periods" jsonb NOT NULL,
	"line_codes" text[] NOT NULL,
	"station_codes" text[] NOT NULL,
	"source" text NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sightings" (
	"train_number" text NOT NULL,
	"service_date" date NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"status" text NOT NULL,
	"station_code" text,
	"platform" text,
	"position_is_snapped" boolean NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delays_run_source_observed_at_uq" ON "delays" USING btree ("train_number","service_date","source","observed_at");--> statement-breakpoint
CREATE INDEX "runs_last_seen_at_idx" ON "runs" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "service_alerts_ended_at_idx" ON "service_alerts" USING btree ("ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sightings_run_source_observed_at_uq" ON "sightings" USING btree ("train_number","service_date","source","observed_at");
--> statement-breakpoint
SELECT create_hypertable('sightings', 'observed_at', chunk_time_interval => INTERVAL '1 day');--> statement-breakpoint
SELECT create_hypertable('delays', 'observed_at', chunk_time_interval => INTERVAL '1 day');--> statement-breakpoint
ALTER TABLE "sightings" SET (timescaledb.compress, timescaledb.compress_segmentby = 'train_number', timescaledb.compress_orderby = 'observed_at DESC');--> statement-breakpoint
ALTER TABLE "delays" SET (timescaledb.compress, timescaledb.compress_segmentby = 'train_number', timescaledb.compress_orderby = 'observed_at DESC');--> statement-breakpoint
SELECT add_compression_policy('sightings', INTERVAL '7 days');--> statement-breakpoint
SELECT add_compression_policy('delays', INTERVAL '7 days');
