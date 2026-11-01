-- Station search: unaccented, trigram-matched names. Extensions go in `public` like the others.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;--> statement-breakpoint
-- `unaccent` is only STABLE; this wrapper (the usual idiom) is what an index can use.
CREATE OR REPLACE FUNCTION stt_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
CREATE INDEX "stations_name_trgm_idx" ON "stations" USING gin (stt_unaccent(lower("name")) public.gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lines_name_trgm_idx" ON "lines" USING gin (stt_unaccent(lower("name")) public.gin_trgm_ops);
