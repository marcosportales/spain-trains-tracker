import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import {
  createDelay,
  createRun,
  createRunId,
  createServiceAlert,
  createSighting,
} from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../../infrastructure/db/drizzle-movement.repository.js';
import { PostgresLiveUpdatesPublisher } from '../../infrastructure/db/postgres-live-updates.publisher.js';
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
});
