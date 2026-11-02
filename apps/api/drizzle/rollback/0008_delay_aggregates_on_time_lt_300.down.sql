-- Manual rollback for 0008_delay_aggregates_on_time_lt_300: restores the 0006 definitions (`<= 300`).
-- Drizzle has no down migrations: run this by hand, then delete the matching row from
-- drizzle."__drizzle_migrations" (the one with the highest id).
DROP VIEW IF EXISTS delay_stats_daily_v, delay_stats_hourly_v;
DROP MATERIALIZED VIEW IF EXISTS delay_stats_daily;
DROP MATERIALIZED VIEW IF EXISTS delay_stats_hourly;
CREATE MATERIALIZED VIEW delay_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 hour', d.observed_at) AS bucket,
  r.line_code,
  r.service_type,
  l.hub_code,
  count(*) AS observations,
  sum(d.seconds)::bigint AS total_seconds,
  count(*) FILTER (WHERE d.seconds <= 300) AS on_time_observations,
  public.percentile_agg(d.seconds::double precision) AS seconds_sketch
FROM delays d
JOIN runs r ON r.train_number = d.train_number AND r.service_date = d.service_date
JOIN lines l ON l.code = r.line_code
GROUP BY 1, 2, 3, 4
WITH NO DATA;
CREATE MATERIALIZED VIEW delay_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', bucket) AS bucket,
  line_code,
  service_type,
  hub_code,
  sum(observations)::bigint AS observations,
  sum(total_seconds)::bigint AS total_seconds,
  sum(on_time_observations)::bigint AS on_time_observations,
  public.rollup(seconds_sketch) AS seconds_sketch
FROM delay_stats_hourly
GROUP BY 1, 2, 3, 4
WITH NO DATA;
-- Readable shapes over the stored sums and sketches.
CREATE VIEW delay_stats_hourly_v AS
SELECT bucket, line_code, service_type, hub_code, observations,
  total_seconds::double precision / observations AS avg_seconds,
  100.0 * on_time_observations / observations AS on_time_pct,
  public.approx_percentile(0.5, seconds_sketch) AS p50_seconds,
  public.approx_percentile(0.9, seconds_sketch) AS p90_seconds
FROM delay_stats_hourly;
CREATE VIEW delay_stats_daily_v AS
SELECT bucket, line_code, service_type, hub_code, observations,
  total_seconds::double precision / observations AS avg_seconds,
  100.0 * on_time_observations / observations AS on_time_pct,
  public.approx_percentile(0.5, seconds_sketch) AS p50_seconds,
  public.approx_percentile(0.9, seconds_sketch) AS p90_seconds
FROM delay_stats_daily;
SELECT add_continuous_aggregate_policy('delay_stats_hourly',
  start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '30 minutes');
SELECT add_continuous_aggregate_policy('delay_stats_daily',
  start_offset => INTERVAL '7 days', end_offset => INTERVAL '1 day', schedule_interval => INTERVAL '1 hour');
-- Then backfill the aggregates (CALL refresh_continuous_aggregate(...) outside a transaction), or re-run the migrations.
