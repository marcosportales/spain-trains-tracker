import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withRefreshRetry } from '../../../test/support/refresh-aggregate.js';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { DrizzlePunctualityReader } from './drizzle-punctuality.reader.js';

let nextTrain = 1;
/** A Run on `lineCode` whose Delays (seconds) are observed one minute apart; the last is its final Delay. */
async function run(
  db: TestDatabase,
  options: {
    lineCode: string | null;
    serviceDate: string;
    delays: number[];
    status?: string;
  },
): Promise<string> {
  const trainNumber = String(nextTrain++);
  await db.sql`
    INSERT INTO runs (train_number, service_date, service_type, line_code, status, last_seen_at)
    VALUES (${trainNumber}, ${options.serviceDate}, 'cercanias', ${options.lineCode},
            ${options.status ?? null}, now())`;
  for (const [index, seconds] of options.delays.entries()) {
    const observedAt = new Date(
      Date.parse(`${options.serviceDate}T10:00:00Z`) + index * 60_000,
    ).toISOString();
    await db.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
      VALUES (${trainNumber}, ${options.serviceDate}, 'gtfsrt_ld', ${observedAt}, ${seconds})`;
  }
  return trainNumber;
}

async function refresh(db: TestDatabase): Promise<void> {
  await withRefreshRetry(() =>
    db.sql.unsafe(
      `CALL refresh_continuous_aggregate('run_final_delays', '2026-10-01', '2026-11-30')`,
    ),
  );
}

describe('DrizzlePunctualityReader.lineRunTotals', () => {
  let testDb: TestDatabase;
  let reader: DrizzlePunctualityReader;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    reader = new DrizzlePunctualityReader(testDb.db);
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE delays, runs, lines, hubs CASCADE');
    await testDb.sql`INSERT INTO hubs (code, name) VALUES ('madrid', 'Madrid')`;
    await testDb.sql`
      INSERT INTO lines (code, name, service_type, hub_code)
      VALUES ('C1', 'C1 Príncipe Pío', 'cercanias', 'madrid'), ('AVE-MS', 'AVE Madrid-Sevilla', 'ave', NULL)`;
    nextTrain = 1;
    await refresh(testDb); // clears buckets left by earlier tests
  });

  it('counts each Run once, by its final Delay, and On time is under 300 s', async () => {
    await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-30', delays: [900, 400, 60] });
    await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-30', delays: [10, 299] });
    await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-30', delays: [0, 600] });
    await refresh(testDb);

    const totals = await reader.lineRunTotals('2026-10-30');
    expect(totals).toEqual([
      {
        lineCode: 'C1',
        name: 'C1 Príncipe Pío',
        serviceType: 'cercanias',
        hubCode: 'madrid',
        runs: 3,
        onTimeRuns: 2,
        totalFinalSeconds: 60 + 299 + 600,
      },
    ]);
  });

  it('leaves out cancelled Runs, Runs without a Line and Runs before the window', async () => {
    await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-30', delays: [60] });
    await run(testDb, {
      lineCode: 'C1',
      serviceDate: '2026-10-30',
      delays: [60],
      status: 'cancelled',
    });
    await run(testDb, { lineCode: null, serviceDate: '2026-10-30', delays: [60] });
    await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-29', delays: [60] });
    await refresh(testDb);

    const totals = await reader.lineRunTotals('2026-10-30');
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ lineCode: 'C1', runs: 1, onTimeRuns: 1 });
  });

  it('counts a Run that crosses midnight once, by its last Delay', async () => {
    const train = await run(testDb, { lineCode: 'C1', serviceDate: '2026-10-30', delays: [60] });
    await testDb.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
      VALUES (${train}, '2026-10-30', 'gtfsrt_ld', '2026-10-31T00:30:00Z', 700)`;
    await refresh(testDb);

    const [line] = await reader.lineRunTotals('2026-10-30');
    expect(line).toMatchObject({ runs: 1, onTimeRuns: 0, totalFinalSeconds: 700 });
  });

  it('omits hubCode for Lines without a Hub', async () => {
    await run(testDb, { lineCode: 'AVE-MS', serviceDate: '2026-10-30', delays: [120] });
    await refresh(testDb);

    const [line] = await reader.lineRunTotals('2026-10-30');
    expect(line).toEqual({
      lineCode: 'AVE-MS',
      name: 'AVE Madrid-Sevilla',
      serviceType: 'ave',
      runs: 1,
      onTimeRuns: 1,
      totalFinalSeconds: 120,
    });
  });
});
