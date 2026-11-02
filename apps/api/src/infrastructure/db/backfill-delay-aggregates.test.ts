import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withRefreshRetry } from '../../../test/support/refresh-aggregate.js';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { backfillDelayAggregates } from './migrate.js';

describe('backfillDelayAggregates', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  afterAll(() => testDb.close());

  it('materializes existing Delays into the aggregates and is safe to repeat', async () => {
    await testDb.sql`INSERT INTO hubs (code, name) VALUES ('madrid', 'Madrid')`;
    await testDb.sql`
      INSERT INTO lines (code, name, service_type, hub_code) VALUES ('C1', 'C1', 'cercanias', 'madrid')`;
    await testDb.sql`
      INSERT INTO runs (train_number, service_date, service_type, line_code, last_seen_at)
      VALUES ('100', '2026-10-30', 'cercanias', 'C1', now())`;
    await testDb.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds) VALUES
        ('100', '2026-10-30', 'gtfsrt_ld', '2026-10-30T08:05:00Z', 299),
        ('100', '2026-10-30', 'gtfsrt_ld', '2026-10-30T08:10:00Z', 300)`;

    await withRefreshRetry(() => backfillDelayAggregates(testDb.sql));
    await withRefreshRetry(() => backfillDelayAggregates(testDb.sql));

    const [hourly] = await testDb.sql<{ on_time_pct: number }[]>`
      SELECT on_time_pct FROM delay_stats_hourly_v WHERE line_code = 'C1'`;
    expect(hourly?.on_time_pct).toBeCloseTo(50, 5);
    const [final] = await testDb.sql<{ final_seconds: number }[]>`
      SELECT final_seconds FROM run_final_delays WHERE train_number = '100'`;
    expect(final?.final_seconds).toBe(300);
    const daily = await testDb.sql`SELECT 1 FROM delay_stats_daily_v WHERE line_code = 'C1'`;
    expect(daily).toHaveLength(1);
  });
});
