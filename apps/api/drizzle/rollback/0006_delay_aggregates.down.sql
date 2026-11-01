-- Manual rollback for 0006_delay_aggregates. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
-- Dropping a continuous aggregate also removes its refresh policy.
DROP VIEW IF EXISTS delay_stats_daily_v, delay_stats_hourly_v;
DROP MATERIALIZED VIEW IF EXISTS delay_stats_daily;
DROP MATERIALIZED VIEW IF EXISTS delay_stats_hourly;
DROP EXTENSION IF EXISTS timescaledb_toolkit;
