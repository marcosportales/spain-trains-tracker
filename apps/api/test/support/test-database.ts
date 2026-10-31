import { randomBytes } from 'node:crypto';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  DEFAULT_DATABASE_URL,
  DEFAULT_MIGRATIONS_FOLDER,
  runMigrations,
} from '../../src/infrastructure/db/migrate.js';

export type TestDatabase = {
  schema: string;
  sql: postgres.Sql;
  db: PostgresJsDatabase;
  /** Drops the schema and closes the connection. */
  close(): Promise<void>;
};

/**
 * Creates a fresh, uniquely named schema on the compose database (DATABASE_URL),
 * applies the migrations into it and returns a client scoped to that schema.
 */
export async function createTestDatabase(
  options: { migrationsFolder?: string } = {},
): Promise<TestDatabase> {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schema = `test_${randomBytes(6).toString('hex')}`;

  const admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  } catch (error) {
    await admin.end();
    throw error;
  }

  const dropSchema = async () => {
    try {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  };

  try {
    await runMigrations({
      databaseUrl,
      schema,
      migrationsFolder: options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER,
    });
  } catch (error) {
    await dropSchema();
    throw error;
  }

  const sql = postgres(databaseUrl, {
    max: 4,
    onnotice: () => {},
    connection: { search_path: `${schema},public` },
  });

  return {
    schema,
    sql,
    db: drizzle(sql),
    async close() {
      try {
        await sql.end();
      } finally {
        await dropSchema();
      }
    },
  };
}
