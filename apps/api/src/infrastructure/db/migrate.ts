import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export { DEFAULT_DATABASE_URL } from './default-database-url.js';

export const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../../drizzle', import.meta.url),
);

export type MigrateOptions = {
  databaseUrl: string;
  migrationsFolder?: string;
  /** Schema the migrations run in (and where drizzle tracks them). Defaults to the DB default. */
  schema?: string;
};

/**
 * Materializes the Delay aggregates (hourly, daily and final Delay per Run) over the full range of
 * `delays`. Migrations 0007 and 0008 create them WITH NO DATA, and `refresh_continuous_aggregate` cannot run inside
 * the migration transaction, so it runs here, after it. Repeating it is harmless.
 */
export async function backfillDelayAggregates(sql: postgres.Sql): Promise<void> {
  const [range] = await sql<{ first: Date | null; last: Date | null }[]>`
    SELECT min(observed_at) AS first, max(observed_at) AS last FROM delays`;
  if (!range?.first || !range.last) return;
  const { first, last } = range;
  // Bounds are aligned to the bucket widths; one statement per call (no transaction block allowed).
  await sql`CALL refresh_continuous_aggregate('delay_stats_hourly',
    date_trunc('hour', ${first}::timestamptz), date_trunc('hour', ${last}::timestamptz) + INTERVAL '1 hour')`;
  await sql`CALL refresh_continuous_aggregate('delay_stats_daily',
    date_trunc('day', ${first}::timestamptz), date_trunc('day', ${last}::timestamptz) + INTERVAL '1 day')`;
  await sql`CALL refresh_continuous_aggregate('run_final_delays',
    date_trunc('day', ${first}::timestamptz), date_trunc('day', ${last}::timestamptz) + INTERVAL '1 day')`;
}

export async function runMigrations(options: MigrateOptions): Promise<void> {
  const { databaseUrl, migrationsFolder = DEFAULT_MIGRATIONS_FOLDER, schema } = options;
  const sql = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {},
    // `public` stays on the path so PostGIS/TimescaleDB functions resolve.
    ...(schema ? { connection: { search_path: `${schema},public` } } : {}),
  });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder,
      ...(schema ? { migrationsSchema: schema } : {}),
    });
    // Every run, not only after a new migration: a failed backfill is retried, and refreshing an
    // up-to-date aggregate is a cheap no-op.
    await backfillDelayAggregates(sql);
  } finally {
    await sql.end();
  }
}
