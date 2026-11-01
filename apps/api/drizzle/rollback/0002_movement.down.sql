-- Manual rollback for 0002_movement. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
-- Dropping a hypertable also removes its chunks and compression policy.
DROP TABLE IF EXISTS sightings, delays, runs, service_alerts CASCADE;
