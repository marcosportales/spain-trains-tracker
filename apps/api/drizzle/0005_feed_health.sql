CREATE TABLE "feed_health" (
	"feed" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
