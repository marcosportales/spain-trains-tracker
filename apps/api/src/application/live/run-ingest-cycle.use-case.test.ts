import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import {
  createDelay,
  createRun,
  createRunId,
  createServiceAlert,
  createSighting,
  type SightingStatus,
} from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../../infrastructure/db/drizzle-movement.repository.js';
import { PostgresLiveUpdatesPublisher } from '../../infrastructure/db/postgres-live-updates.publisher.js';
import { GtfsRtPositionsSource } from '../../infrastructure/renfe/gtfs-rt/gtfs-rt-positions.source.js';
import { RunIngestCycle } from './run-ingest-cycle.use-case.js';

const runId = createRunId('3063', '2026-10-31');
const at = (iso: string) => new Date(iso);

const sighting = (observedAt: string, lat = 40.4) =>
  createSighting({
    runId,
    source: 'gtfsrt_ld',
    observedAt: at(observedAt),
    lat,
    lon: -3.7,
    status: 'IN_TRANSIT_TO',
    stationCode: '60000',
  });
const run = createRun({ id: runId, serviceType: 'ave', lineCode: 'AVE-MAD-SEV' });
const delay = (observedAt: string, seconds = 120) =>
  createDelay({ runId, source: 'gtfsrt_ld', observedAt: at(observedAt), seconds });
const alert = createServiceAlert({
  id: 'a1',
  header: 'Obras',
  description: 'Obras en la línea',
  activePeriods: [],
  lineCodes: ['AVE-MAD-SEV'],
  stationCodes: [],
  source: 'gtfsrt_ld',
});

describe('RunIngestCycle', () => {
  let testDb: TestDatabase;
  let repo: DrizzleMovementRepository;
  let cycle: RunIngestCycle;
  let notifications: string[];
  let stopListening: () => Promise<void>;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repo = new DrizzleMovementRepository(testDb.db);
    const listener = await testDb.sql.listen('live_runs', (payload) => {
      notifications.push(payload);
    });
    stopListening = () => listener.unlisten();
  });
  afterAll(async () => {
    await stopListening();
    await testDb.close();
  });
  beforeEach(async () => {
    notifications = [];
    await testDb.sql.unsafe('TRUNCATE sightings, delays, runs, service_alerts');
    cycle = new RunIngestCycle(repo, new PostgresLiveUpdatesPublisher(testDb.db), {
      now: () => at('2026-10-31T10:00:30Z'),
    });
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const count = async (table: string) =>
    Number((await testDb.sql.unsafe(`SELECT count(*) FROM ${table}`))[0]?.count);

  it('populates runs, sightings, delays and service_alerts and emits one NOTIFY', async () => {
    const report = await cycle.execute({
      sightings: [sighting('2026-10-31T10:00:00Z')],
      delays: [delay('2026-10-31T10:00:00Z')],
      runs: [run],
      alerts: { source: 'gtfsrt_ld', alerts: [alert] },
    });
    await settle();

    expect(await count('runs')).toBe(1);
    expect(await count('sightings')).toBe(1);
    expect(await count('delays')).toBe(1);
    expect(await count('service_alerts')).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toBe(String(report.cycleId));
    expect(report.changedRuns).toBe(1);
  });

  it('publishes the live Run with its delay, line and next Station', async () => {
    const published: unknown[] = [];
    cycle = new RunIngestCycle(
      repo,
      { publish: async (update) => void published.push(update) },
      { now: () => at('2026-10-31T10:00:30Z') },
    );
    await cycle.execute({
      sightings: [sighting('2026-10-31T10:00:00Z')],
      delays: [delay('2026-10-31T10:00:00Z')],
      runs: [run],
    });
    expect(published).toMatchObject([
      {
        upserted: [
          {
            runId,
            serviceType: 'ave',
            lineCode: 'AVE-MAD-SEV',
            lat: 40.4,
            lon: -3.7,
            status: 'in_transit_to',
            delaySeconds: 120,
            nextStationCode: '60000',
            sources: ['gtfsrt_ld'],
            observedAt: at('2026-10-31T10:00:00Z'),
          },
        ],
      },
    ]);
  });

  it('does not notify again when nothing changed, and keeps the delay across position-only cycles', async () => {
    const input = {
      sightings: [sighting('2026-10-31T10:00:00Z')],
      delays: [delay('2026-10-31T10:00:00Z')],
      runs: [run],
    };
    await cycle.execute(input);
    const repeated = await cycle.execute(input);
    expect(repeated.changedRuns).toBe(0);

    const published: { upserted: { delaySeconds?: number }[] }[] = [];
    const next = new RunIngestCycle(
      repo,
      { publish: async (u) => void published.push(u as never) },
      { now: () => at('2026-10-31T10:01:00Z') },
    );
    await next.execute(input);
    await next.execute({
      sightings: [sighting('2026-10-31T10:00:20Z', 40.5)],
      delays: [],
      runs: [],
    });
    await settle();
    expect(notifications).toHaveLength(1);
    expect(published[1]?.upserted[0]?.delaySeconds).toBe(120);
  });

  it('ends stored alerts of the Source that left the feed', async () => {
    await cycle.execute({
      sightings: [],
      delays: [],
      runs: [],
      alerts: { source: 'gtfsrt_ld', alerts: [alert] },
    });
    await cycle.execute({
      sightings: [],
      delays: [],
      runs: [],
      alerts: { source: 'gtfsrt_ld', alerts: [] },
    });
    const [stored] = await repo.listServiceAlerts('gtfsrt_ld');
    expect(stored?.endedAt).toEqual(at('2026-10-31T10:00:30Z'));
  });

  it('stores a Sighting of a Run it cannot type but does not publish it', async () => {
    const report = await cycle.execute({
      sightings: [sighting('2026-10-31T10:00:00Z')],
      delays: [],
      runs: [],
    });
    expect(await count('sightings')).toBe(1);
    expect(await count('runs')).toBe(0);
    expect(report.changedRuns).toBe(0);
  });

  describe('a Run reported by several Sources', () => {
    const regional = createRunId('79123', '2026-10-31');
    const run = createRun({ id: regional, serviceType: 'media_distancia' });
    const fix = (
      source: 'gtfsrt_ld' | 'gtfsrt_cercanias',
      observedAt: string,
      status: SightingStatus = 'IN_TRANSIT_TO',
      lat = 41.4,
    ) =>
      createSighting({
        runId: regional,
        source,
        observedAt: at(observedAt),
        lat,
        lon: 2.1,
        status,
        stationCode: '71801',
      });
    const capture = () => {
      const published: { upserted: { runId: unknown; lat: number; sources: string[] }[] }[] = [];
      const c = new RunIngestCycle(
        repo,
        { publish: async (u) => void published.push(u as never) },
        { now: () => at('2026-10-31T10:00:30Z') },
      );
      return { c, published };
    };

    it('publishes one live Run listing both Sources, with the GPS fix winning over a snapped one', async () => {
      const { c, published } = capture();
      await c.execute({
        sightings: [fix('gtfsrt_ld', '2026-10-31T10:00:00Z', 'IN_TRANSIT_TO', 41.4)],
        delays: [],
        runs: [run],
      });
      await c.execute({
        sightings: [fix('gtfsrt_cercanias', '2026-10-31T10:00:10Z', 'STOPPED_AT', 41.5)],
        delays: [],
        runs: [],
      });

      const last = published.at(-1)?.upserted;
      expect(last).toHaveLength(1);
      expect(last?.[0]).toMatchObject({ lat: 41.4, sources: ['gtfsrt_cercanias', 'gtfsrt_ld'] });
    });

    it('lets a newer GPS fix from the other Source take over', async () => {
      const { c, published } = capture();
      await c.execute({
        sightings: [fix('gtfsrt_ld', '2026-10-31T10:00:00Z', 'IN_TRANSIT_TO', 41.4)],
        delays: [],
        runs: [run],
      });
      await c.execute({
        sightings: [fix('gtfsrt_cercanias', '2026-10-31T10:00:15Z', 'IN_TRANSIT_TO', 41.6)],
        delays: [],
        runs: [],
      });
      expect(published.at(-1)?.upserted[0]).toMatchObject({ lat: 41.6 });
    });

    it('stops counting a Source that went quiet for too long', async () => {
      const { c, published } = capture();
      await c.execute({
        sightings: [fix('gtfsrt_ld', '2026-10-31T10:00:00Z')],
        delays: [],
        runs: [run],
      });
      await c.execute({
        sightings: [fix('gtfsrt_cercanias', '2026-10-31T10:10:00Z', 'IN_TRANSIT_TO', 41.7)],
        delays: [],
        runs: [],
      });
      expect(published.at(-1)?.upserted[0]).toMatchObject({
        lat: 41.7,
        sources: ['gtfsrt_cercanias'],
      });
    });

    it('has no duplicate RunIds when both real feed fixtures are ingested', async () => {
      const dir = join(import.meta.dirname, '../../../test/fixtures/2026-10-31');
      const source = (file: string) =>
        new GtfsRtPositionsSource({
          timetable: {
            findScheduledRunsByTripIds: async () => [],
            findScheduledRuns: async () => [],
          },
          fetch: async () => new Response(new Uint8Array(readFileSync(join(dir, file)))),
          now: () => at('2026-10-31T22:40:00Z'),
        });
      const cercanias = await source('vehicle_positions.pb').fetchSightings('cercanias');
      const ld = await source('vehicle_positions_LD.pb').fetchSightings('larga-distancia');
      // Make one LD Run also appear in the Cercanías feed, as the Catalan regionals do.
      const shared = ld[0];
      if (!shared) throw new Error('LD fixture is empty');
      const twin = createSighting({ ...shared, source: 'gtfsrt_cercanias' });

      const all = [...cercanias, ...ld, twin];
      const runs = [...new Set(all.map((s) => `${s.runId.trainNumber}`))].map((n) =>
        createRun({ id: createRunId(n, '2026-10-31'), serviceType: 'media_distancia' }),
      );
      const { c, published } = capture();
      await c.execute({ sightings: all, delays: [], runs });

      const ids = published.flatMap((p) => p.upserted).map((r) => JSON.stringify(r.runId));
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      const merged = published
        .flatMap((p) => p.upserted)
        .find((r) => (r.runId as { trainNumber: string }).trainNumber === shared.runId.trainNumber);
      expect(merged?.sources).toEqual(['gtfsrt_cercanias', 'gtfsrt_ld']);
    });
  });
});
