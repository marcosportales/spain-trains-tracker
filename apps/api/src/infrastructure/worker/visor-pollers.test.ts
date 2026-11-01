import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import type { LiveUpdate } from '../../application/live/live-updates.publisher.js';
import { RunIngestCycle } from '../../application/live/run-ingest-cycle.use-case.js';
import { createRun, createRunId, createSighting } from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import type { ScheduledRunLookup } from '../renfe/gtfs-rt/gtfs-rt-common.js';
import { RENFE_VISOR_URLS, RenfeVisorFeed } from '../renfe/visor/visor-feed.js';
import { createVisorPollers } from './visor-pollers.js';

const fixtureDir = join(import.meta.dirname, '../../../test/fixtures/2026-10-31');
const FIXTURE_OF: Record<string, string> = {
  [RENFE_VISOR_URLS['larga-distancia']]: 'flotaLD.json',
  [RENFE_VISOR_URLS.cercanias]: 'flota.json',
  [RENFE_VISOR_URLS.stops]: 'trenesConEstacionesLD.json',
};
const fixtureFetch = vi.fn(async (url: string | URL | Request) => {
  const name = FIXTURE_OF[String(url)];
  if (!name) return new Response('not found', { status: 404 });
  return new Response(readFileSync(join(fixtureDir, name)), { status: 200 });
});

/** Every long-distance Run is an AVE; no Cercanías trip is known. */
const timetable: ScheduledRunLookup = {
  findScheduledRunsByTripIds: async () => [],
  findScheduledRuns: async (trainNumber) => [
    {
      tripId: `t${trainNumber}`,
      trainNumber,
      lineCode: 'AVE-X',
      serviceType: 'ave',
      serviceId: 's',
    },
  ],
};
const logger = { log: vi.fn(), warn: vi.fn() };

describe('createVisorPollers', () => {
  let testDb: TestDatabase;
  let repo: DrizzleMovementRepository;
  let published: LiveUpdate[];
  let cycle: RunIngestCycle;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repo = new DrizzleMovementRepository(testDb.db);
  });
  afterAll(async () => {
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE sightings, delays, runs, service_alerts, run_stop_estimates');
    fixtureFetch.mockClear();
    logger.warn.mockClear();
    published = [];
    cycle = new RunIngestCycle(repo, { publish: async (u) => void published.push(u) });
  });

  const build = (enabled: boolean, fetch: typeof globalThis.fetch = fixtureFetch as never) =>
    createVisorPollers({
      enabled,
      intervalMs: 20_000,
      fetch,
      logger,
      feed: new RenfeVisorFeed({ timetable, onSkipped: (p) => logger.warn(p.reason) }),
      cycle,
      repository: repo,
    });
  const count = async (table: string) =>
    Number((await testDb.sql.unsafe(`SELECT count(*) FROM ${table}`))[0]?.count);

  it('creates no poller when the flag is off, so the visor is never fetched', async () => {
    const pollers = build(false);
    expect(pollers).toEqual([]);
    expect(fixtureFetch).not.toHaveBeenCalled();
  });

  it('creates one poller per visor file when the flag is on', () => {
    expect(build(true).map((p) => p.health().feed)).toEqual([
      'visor-larga-distancia',
      'visor-cercanias',
      'visor-stops',
    ]);
  });

  it('merges visor Sightings into Runs already known from an Official feed, by train number', async () => {
    const runId = createRunId('15064', '2026-10-31');
    await cycle.execute({
      sightings: [
        createSighting({
          runId,
          source: 'gtfsrt_ld',
          observedAt: new Date('2026-10-31T22:35:00Z'),
          lat: 41.39,
          lon: 2.16,
          status: 'IN_TRANSIT_TO',
          stationCode: '71802',
        }),
      ],
      delays: [],
      runs: [createRun({ id: runId, serviceType: 'ave', lineCode: 'AVE-X' })],
    });
    published = [];

    const [longDistance] = build(true);
    await longDistance?.pollOnce();

    expect(longDistance?.health().consecutiveFailures).toBe(0);
    const live = published.flatMap((u) => u.upserted).find((r) => r.runId.trainNumber === '15064');
    expect(live).toMatchObject({
      sources: ['gtfsrt_ld', 'visor_ld'],
      status: 'stopped_at',
      delaySeconds: 18 * 60,
    });
    const stored = await repo.findRun('15064', '2026-10-31');
    expect(stored).toMatchObject({ serviceType: 'ave', rollingStock: '470119' });
    expect(await count('sightings')).toBe(17);
  });

  it('stores the Station estimates of the stops file once the fleet gave the Delays', async () => {
    const [longDistance, , stops] = build(true);
    await stops?.pollOnce();
    expect(await count('run_stop_estimates')).toBe(0);

    await longDistance?.pollOnce();
    await stops?.pollOnce();

    const estimates = await repo.listStopEstimates('13073', '2026-10-31');
    expect(estimates).toHaveLength(13);
    expect(estimates[0]?.estimatedArrival).toEqual(new Date('2026-10-31T21:07:00Z'));
  });

  it('keeps failures to the visor poller: no throw, health reports it, nothing stored', async () => {
    const failing = vi.fn(async () => new Response('down', { status: 503 }));
    const [longDistance] = build(true, failing as never);

    await expect(longDistance?.pollOnce()).resolves.toBeUndefined();

    expect(longDistance?.health()).toMatchObject({ consecutiveFailures: 1 });
    expect(await count('sightings')).toBe(0);
  });

  it('treats a body that is not a visor file as a failed poll', async () => {
    const html = vi.fn(async () => new Response('<html>', { status: 200 }));
    const [longDistance] = build(true, html as never);
    await longDistance?.pollOnce();
    expect(longDistance?.health().lastError).toMatch(/visor/i);
  });
});
