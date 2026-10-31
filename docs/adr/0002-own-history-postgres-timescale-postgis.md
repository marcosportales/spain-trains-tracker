# Build our own history in Postgres + TimescaleDB + PostGIS

Renfe publishes no historical punctuality data, so we store every Sighting and Delay we poll from the start. History that isn't recorded can't be recovered later.

The database is Postgres 17 with PostGIS and TimescaleDB, accessed through Drizzle:

- **TimescaleDB:** Sightings go into compressed hypertables.
- **PostGIS:** Track geometry and spatial queries.
- **Drizzle (not Prisma):** chosen for its first-class raw SQL support, which spatial queries and hypertables need.
