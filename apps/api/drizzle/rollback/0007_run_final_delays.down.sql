-- Manual rollback for 0007_run_final_delays. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
-- Dropping a continuous aggregate also removes its refresh policy.
DROP MATERIALIZED VIEW IF EXISTS run_final_delays;
