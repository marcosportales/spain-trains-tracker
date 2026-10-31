-- Raw SQL migration: proves hand-written SQL (hypertables, PostGIS) can run through the workflow.
CREATE TABLE probe (id integer PRIMARY KEY, label text NOT NULL);
