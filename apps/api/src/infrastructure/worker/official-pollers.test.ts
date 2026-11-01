import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import type { LiveUpdate } from '../../application/live/live-updates.publisher.js';
import { RunIngestCycle } from '../../application/live/run-ingest-cycle.use-case.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { RENFE_ALERTS_URL } from '../renfe/gtfs-rt/gtfs-rt-alerts.source.js';
import type { ScheduledRunLookup } from '../renfe/gtfs-rt/gtfs-rt-common.js';
import { RENFE_POSITION_URLS } from '../renfe/gtfs-rt/gtfs-rt-positions.source.js';
import { RENFE_TRIP_UPDATE_URLS } from '../renfe/gtfs-rt/gtfs-rt-trip-updates.source.js';
import { createOfficialPollers } from './official-pollers.js';

const fixtureDir = join(import.meta.dirname, '../../../test/fixtures/2026-10-31');
const FIXTURE_OF: Record<string, string> = {
  [RENFE_POSITION_URLS.cercanias]: 'vehicle_positions.pb',
  [RENFE_POSITION_URLS['larga-distancia']]: 'vehicle_positions_LD.pb',
  [RENFE_TRIP_UPDATE_URLS.cercanias]: 'trip_updates.pb',
  [RENFE_TRIP_UPDATE_URLS['larga-distancia']]: 'trip_updates_LD.pb',
  [RENFE_ALERTS_URL]: 'alerts.pb',
};
const fixtureFetch = vi.fn(async (url: string | URL | Request) => {
  const name = FIXTURE_OF[String(url)];
  if (!name) return new Response('not found', { status: 404 });
  return new Response(readFileSync(join(fixtureDir, name)), {
    status: 200,
    headers: { 'last-modified': 'Sat, 31 Oct 2026 22:35:00 GMT' },
  });
});

const timetable: ScheduledRunLookup = {
  findScheduledRunsByTripIds: async () => [],
  findScheduledRuns: async (trainNumber) => [
    {
      tripId: `t${trainNumber}`,
      trainNumber,
      lineCode: 'X',
      serviceType: 'cercanias',
      serviceId: 's',
    },
  ],
};
const lines = { lineCodesForRouteIds: async () => new Map<string, string>() };
const logger = { log: vi.fn(), warn: vi.fn() };

describe('createOfficialPollers', () => {
  let testDb: TestDatabase;
  let repo: DrizzleMovementRepository;
  let published: LiveUpdate[];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repo = new DrizzleMovementRepository(testDb.db);
  });
  afterAll(async () => {
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE sightings, delays, runs, service_alerts, run_stop_estimates');
    published = [];
  });

  const build = (fetch: typeof globalThis.fetch = fixtureFetch as never) =>
    createOfficialPollers({
      intervalMs: 20_000,
      fetch,
      logger,
      timetable,
      lines,
      cycle: new RunIngestCycle(repo, { publish: async (u) => void published.push(u) }),
    });
  const count = async (table: string) =>
    Number((await testDb.sql.unsafe(`SELECT count(*) FROM ${table}`))[0]?.count);

  it('creates one poller per Official feed file', () => {
    expect(build().map((p) => p.health().feed)).toEqual([
      'gtfsrt-positions-cercanias',
      'gtfsrt-positions-larga-distancia',
      'gtfsrt-trip-updates-cercanias',
      'gtfsrt-trip-updates-larga-distancia',
      'gtfsrt-alerts',
    ]);
  });

  it('ingests positions, trip updates and alerts through the ingest cycle', async () => {
    const pollers = build();
    for (const poller of pollers) await poller.pollOnce();

    expect(pollers.map((p) => p.health().lastError)).toEqual([null, null, null, null, null]);
    expect(await count('sightings')).toBeGreaterThan(0);
    expect(await count('delays')).toBeGreaterThan(0);
    expect(await count('service_alerts')).toBeGreaterThan(0);
    expect(published.flatMap((u) => u.upserted).length).toBeGreaterThan(0);
  });

  it('keeps a failing feed to its own poller health', async () => {
    const failing = vi.fn(async (url: string | URL | Request) =>
      String(url) === RENFE_ALERTS_URL ? new Response('down', { status: 503 }) : fixtureFetch(url),
    );
    const pollers = build(failing as never);
    for (const poller of pollers) await poller.pollOnce();

    expect(pollers.map((p) => p.health().consecutiveFailures)).toEqual([0, 0, 0, 0, 1]);
    expect(await count('sightings')).toBeGreaterThan(0);
  });
});
