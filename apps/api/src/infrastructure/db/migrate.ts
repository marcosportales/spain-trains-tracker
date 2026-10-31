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
  } finally {
    await sql.end();
  }
}
