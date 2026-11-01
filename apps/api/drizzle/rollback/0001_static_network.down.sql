-- Manual rollback for 0001_static_network. Drizzle has no down migrations: run this by hand,
-- then delete the matching row from drizzle."__drizzle_migrations" (the one with the highest id).
DROP TABLE IF EXISTS scheduled_stops, scheduled_runs, track_geometries, service_calendar_dates,
  service_calendars, static_imports, stations, lines, hubs CASCADE;
