-- Punctuality per Run (ADR 0007): the last Delay observed for each Run, across all Sources.
-- Hand-written: Drizzle cannot express continuous aggregates. Rollback: drizzle/rollback/0007_run_final_delays.down.sql
-- One row per Run and day bucket. A Run that crosses midnight has two rows: readers keep the one
-- with the latest `last_observed_at`.
CREATE MATERIALIZED VIEW run_final_delays
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', observed_at) AS bucket,
  train_number,
  service_date,
  last(seconds, observed_at) AS final_seconds,
  max(observed_at) AS last_observed_at
FROM delays
GROUP BY 1, 2, 3
WITH NO DATA;--> statement-breakpoint
-- end_offset of 1 hour: today's figure is provisional but present.
SELECT add_continuous_aggregate_policy('run_final_delays',
  start_offset => INTERVAL '7 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '30 minutes');
