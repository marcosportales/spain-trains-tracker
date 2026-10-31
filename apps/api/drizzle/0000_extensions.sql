-- Idempotent: docker/initdb already creates these locally; CI and fresh servers rely on this.
-- WITH SCHEMA public keeps them out of per-run test schemas (search_path starts with those).
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;
