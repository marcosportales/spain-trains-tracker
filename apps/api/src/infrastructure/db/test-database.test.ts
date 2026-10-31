import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../test/support/test-database.js';

const migrationsFolder = fileURLToPath(
  new URL('../../../test/fixtures/migrations', import.meta.url),
);

describe('createTestDatabase', () => {
  it('applies migrations into a clean, isolated schema', async () => {
    const first = await createTestDatabase({ migrationsFolder });
    const second = await createTestDatabase({ migrationsFolder });
    try {
      await first.sql`INSERT INTO probe (id, label) VALUES (1, 'only in first')`;

      const inFirst = await first.sql`SELECT count(*)::int AS n FROM probe`;
      const inSecond = await second.sql`SELECT count(*)::int AS n FROM probe`;
      expect(inFirst[0]?.n).toBe(1);
      expect(inSecond[0]?.n).toBe(0);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('drops its schema on close', async () => {
    const database = await createTestDatabase({ migrationsFolder });
    const { schema } = database;
    await database.close();

    const probe = await createTestDatabase({ migrationsFolder });
    try {
      const rows = await probe.sql`
        SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schema}`;
      expect(rows).toHaveLength(0);
    } finally {
      await probe.close();
    }
  });
});
