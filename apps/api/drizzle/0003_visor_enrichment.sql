CREATE TABLE "run_stop_estimates" (
	"train_number" text NOT NULL,
	"service_date" date NOT NULL,
	"sequence" integer NOT NULL,
	"station_code" text NOT NULL,
	"scheduled_arrival" timestamp with time zone NOT NULL,
	"scheduled_departure" timestamp with time zone NOT NULL,
	"estimated_arrival" timestamp with time zone NOT NULL,
	"estimated_departure" timestamp with time zone NOT NULL,
	CONSTRAINT "run_stop_estimates_train_number_service_date_sequence_pk" PRIMARY KEY("train_number","service_date","sequence")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "rolling_stock" text;