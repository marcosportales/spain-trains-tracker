import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withRefreshRetry } from '../../../test/support/refresh-aggregate.js';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';

/** Inserts one Delay for a Run; `observedAt` decides the hour and day bucket. */
async function delay(
  db: TestDatabase,
  trainNumber: string,
  observedAt: string,
  seconds: number,
): Promise<void> {
  await db.sql`
    INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
    VALUES (${trainNumber}, ${observedAt.slice(0, 10)}, 'gtfsrt_ld', ${observedAt}, ${seconds})`;
}

async function refresh(db: TestDatabase): Promise<void> {
  // refresh_continuous_aggregate cannot run inside a transaction block: one statement per call.
  await withRefreshRetry(() =>
    db.sql.unsafe(
      `CALL refresh_continuous_aggregate('delay_stats_hourly', '2026-10-01', '2026-11-30')`,
    ),
  );
  await withRefreshRetry(() =>
    db.sql.unsafe(
      `CALL refresh_continuous_aggregate('delay_stats_daily', '2026-10-01', '2026-11-30')`,
    ),
  );
}

describe('Delay continuous aggregates', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE delays, runs, lines, hubs CASCADE');
    await testDb.sql`INSERT INTO hubs (code, name) VALUES ('madrid', 'Madrid')`;
    await testDb.sql`
      INSERT INTO lines (code, name, service_type, hub_code)
      VALUES ('C1', 'C1', 'cercanias', 'madrid'), ('AVE-MS', 'AVE Madrid-Sevilla', 'ave', NULL)`;
    await testDb.sql`
      INSERT INTO runs (train_number, service_date, service_type, line_code, last_seen_at) VALUES
        ('100', '2026-10-30', 'cercanias', 'C1', now()),
        ('101', '2026-10-30', 'cercanias', 'C1', now()),
        ('101', '2026-10-31', 'cercanias', 'C1', now()),
        ('200', '2026-10-30', 'ave', 'AVE-MS', now())`;
  });

  it('aggregates Delays per Line and hour: count, average, on time share, percentiles', async () => {
    await delay(testDb, '100', '2026-10-30T08:05:00Z', 0);
    await delay(testDb, '100', '2026-10-30T08:20:00Z', 60);
    await delay(testDb, '101', '2026-10-30T08:40:00Z', 600);
    await delay(testDb, '101', '2026-10-30T08:50:00Z', 1200);
    await delay(testDb, '101', '2026-10-30T09:10:00Z', 30);
    await refresh(testDb);

    const rows = await testDb.sql<
      {
        bucket: string;
        line_code: string;
        service_type: string;
        hub_code: string | null;
        observations: string;
        avg_seconds: number;
        on_time_pct: number;
        p50: number;
        p90: number;
      }[]
    >`
      SELECT bucket, line_code, service_type, hub_code, observations,
             avg_seconds, on_time_pct, p50_seconds AS p50, p90_seconds AS p90
      FROM delay_stats_hourly_v WHERE line_code = 'C1' ORDER BY bucket`;

    expect(rows).toHaveLength(2);
    const [eight, nine] = rows;
    expect(new Date(eight?.bucket ?? '')).toEqual(new Date('2026-10-30T08:00:00Z'));
    expect(eight).toMatchObject({ service_type: 'cercanias', hub_code: 'madrid' });
    expect(Number(eight?.observations)).toBe(4);
    expect(eight?.avg_seconds).toBeCloseTo(465, 5);
    expect(eight?.on_time_pct).toBeCloseTo(50, 5); // 0 s and 60 s are on time (< 5 min)
    expect(eight?.p50).toBeGreaterThan(0);
    expect(eight?.p50).toBeLessThan(700);
    expect(eight?.p90).toBeGreaterThan(1000);
    expect(Number(nine?.observations)).toBe(1);
    expect(nine?.on_time_pct).toBeCloseTo(100, 5);
  });

  it('does not count a Delay of exactly 300 s as on time', async () => {
    await delay(testDb, '100', '2026-10-30T08:05:00Z', 299);
    await delay(testDb, '100', '2026-10-30T08:10:00Z', 300);
    await refresh(testDb);

    const [row] = await testDb.sql<{ on_time_pct: number }[]>`
      SELECT on_time_pct FROM delay_stats_hourly_v WHERE line_code = 'C1'`;
    expect(row?.on_time_pct).toBeCloseTo(50, 5);
  });

  it('keeps Lines without a Hub, split by Service type', async () => {
    await delay(testDb, '200', '2026-10-30T08:05:00Z', 900);
    await refresh(testDb);

    const [row] = await testDb.sql<{ hub_code: string | null; service_type: string }[]>`
      SELECT hub_code, service_type FROM delay_stats_hourly_v WHERE line_code = 'AVE-MS'`;
    expect(row).toEqual({ hub_code: null, service_type: 'ave' });
  });

  it('rolls the hours up into days', async () => {
    await delay(testDb, '100', '2026-10-30T08:05:00Z', 0);
    await delay(testDb, '101', '2026-10-30T15:05:00Z', 600);
    await delay(testDb, '101', '2026-10-31T08:05:00Z', 60);
    await refresh(testDb);

    const rows = await testDb.sql<
      { bucket: string; observations: string; avg_seconds: number; on_time_pct: number }[]
    >`
      SELECT bucket, observations, avg_seconds, on_time_pct
      FROM delay_stats_daily_v WHERE line_code = 'C1' ORDER BY bucket`;
    expect(rows).toHaveLength(2);
    expect(Number(rows[0]?.observations)).toBe(2);
    expect(rows[0]?.avg_seconds).toBeCloseTo(300, 5);
    expect(rows[0]?.on_time_pct).toBeCloseTo(50, 5);
    expect(Number(rows[1]?.observations)).toBe(1);
  });

  it('ignores Delays of Runs without a Line', async () => {
    await testDb.sql`
      INSERT INTO runs (train_number, service_date, service_type, line_code, last_seen_at)
      VALUES ('300', '2026-10-30', 'ave', NULL, now())`;
    await delay(testDb, '300', '2026-10-30T08:05:00Z', 100);
    await refresh(testDb);
    const rows = await testDb.sql`SELECT 1 FROM delay_stats_hourly_v WHERE line_code IS NULL`;
    expect(rows).toHaveLength(0);
  });
});
