-- Manual rollback for 0004_search. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
DROP INDEX IF EXISTS stations_name_trgm_idx, lines_name_trgm_idx;
DROP FUNCTION IF EXISTS stt_unaccent(text);
DROP EXTENSION IF EXISTS unaccent;
DROP EXTENSION IF EXISTS pg_trgm;
