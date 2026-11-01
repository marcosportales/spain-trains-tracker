-- Manual rollback for 0003_visor_enrichment. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
DROP TABLE IF EXISTS run_stop_estimates;
ALTER TABLE runs DROP COLUMN IF EXISTS rolling_stock;
