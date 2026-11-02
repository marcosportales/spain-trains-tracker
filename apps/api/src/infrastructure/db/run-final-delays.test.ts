import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withRefreshRetry } from '../../../test/support/refresh-aggregate.js';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';

async function delay(
  db: TestDatabase,
  trainNumber: string,
  serviceDate: string,
  source: string,
  observedAt: string,
  seconds: number,
): Promise<void> {
  await db.sql`
    INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
    VALUES (${trainNumber}, ${serviceDate}, ${source}, ${observedAt}, ${seconds})`;
}

async function refresh(db: TestDatabase): Promise<void> {
  // refresh_continuous_aggregate cannot run inside a transaction block.
  await withRefreshRetry(() =>
    db.sql.unsafe(
      `CALL refresh_continuous_aggregate('run_final_delays', '2026-10-01', '2026-11-30')`,
    ),
  );
}

interface FinalRow {
  bucket: string;
  final_seconds: number;
  last_observed_at: string;
}

describe('run_final_delays continuous aggregate', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE delays, runs, lines, hubs CASCADE');
  });

  const finals = (trainNumber: string) =>
    testDb.sql<FinalRow[]>`
      SELECT bucket, final_seconds, last_observed_at FROM run_final_delays
      WHERE train_number = ${trainNumber} ORDER BY bucket`;

  it('holds the last Delay observed for a Run', async () => {
    await delay(testDb, '100', '2026-10-30', 'gtfsrt_ld', '2026-10-30T10:00:00Z', 120);
    await delay(testDb, '100', '2026-10-30', 'gtfsrt_ld', '2026-10-30T10:30:00Z', 420);
    await refresh(testDb);

    const rows = await finals('100');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.final_seconds).toBe(420);
  });

  it('gives a Run that crosses midnight two buckets, the later one holding its last Delay', async () => {
    await delay(testDb, '101', '2026-10-30', 'gtfsrt_ld', '2026-10-30T23:50:00Z', 100);
    await delay(testDb, '101', '2026-10-30', 'gtfsrt_ld', '2026-10-31T00:20:00Z', 700);
    await refresh(testDb);

    const rows = await finals('101');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.final_seconds).toBe(100);
    expect(rows[1]?.final_seconds).toBe(700);
    expect(new Date(rows[1]?.last_observed_at ?? '')).toEqual(new Date('2026-10-31T00:20:00Z'));
  });

  it('picks the latest observation across interleaved Sources', async () => {
    await delay(testDb, '102', '2026-10-30', 'gtfsrt_ld', '2026-10-30T10:00:00Z', 60);
    await delay(testDb, '102', '2026-10-30', 'visor', '2026-10-30T10:10:00Z', 900);
    await delay(testDb, '102', '2026-10-30', 'gtfsrt_ld', '2026-10-30T10:05:00Z', 300);
    await refresh(testDb);

    const rows = await finals('102');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.final_seconds).toBe(900);
  });
});
