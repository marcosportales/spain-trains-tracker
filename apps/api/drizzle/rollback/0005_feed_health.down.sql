-- Manual rollback for 0005_feed_health. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
DROP TABLE IF EXISTS feed_health;
