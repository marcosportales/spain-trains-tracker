import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import {
  createDelay,
  createRun,
  createRunId,
  createRunStopEstimate,
  createServiceAlert,
  createSighting,
} from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from './drizzle-movement.repository.js';

const runId = createRunId('3063', '2026-10-31');
const at = (iso: string) => new Date(iso);

function sighting(
  observedAt: string,
  overrides: Partial<Parameters<typeof createSighting>[0]> = {},
) {
  return createSighting({
    runId,
    source: 'gtfsrt_ld',
    observedAt: at(observedAt),
    lat: 40.4,
    lon: -3.7,
    status: 'IN_TRANSIT_TO',
    stationCode: '60000',
    ...overrides,
  });
}

describe('DrizzleMovementRepository', () => {
  let testDb: TestDatabase;
  let repo: DrizzleMovementRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repo = new DrizzleMovementRepository(testDb.db);
  });
  afterAll(async () => {
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe('TRUNCATE sightings, delays, runs, service_alerts, run_stop_estimates');
  });

  describe('migration', () => {
    it('makes sightings and delays hypertables with 1-day chunks', async () => {
      const rows = await testDb.sql<{ hypertable_name: string; time_interval: string }[]>`
        SELECT h.hypertable_name, d.time_interval::text
        FROM timescaledb_information.hypertables h
        JOIN timescaledb_information.dimensions d USING (hypertable_schema, hypertable_name)
        WHERE h.hypertable_schema = ${testDb.schema} AND d.column_name = 'observed_at'
        ORDER BY h.hypertable_name`;
      expect(rows.map((r) => r.hypertable_name)).toEqual(['delays', 'sightings']);
      expect(rows.every((r) => r.time_interval === '1 day')).toBe(true);
    });

    it('compresses chunks after 7 days, segmented by train_number', async () => {
      const jobs = await testDb.sql<{ hypertable_name: string; compress_after: string }[]>`
        SELECT hypertable_name, config->>'compress_after' AS compress_after
        FROM timescaledb_information.jobs
        WHERE proc_name = 'policy_compression' AND hypertable_schema = ${testDb.schema}
        ORDER BY hypertable_name`;
      expect(jobs).toEqual([
        { hypertable_name: 'delays', compress_after: '7 days' },
        { hypertable_name: 'sightings', compress_after: '7 days' },
      ]);
      const settings = await testDb.sql<{ hypertable_name: string; attname: string }[]>`
        SELECT hypertable_name, attname
        FROM timescaledb_information.compression_settings
        WHERE hypertable_schema = ${testDb.schema} AND segmentby_column_index IS NOT NULL
        ORDER BY hypertable_name`;
      expect(settings).toEqual([
        { hypertable_name: 'delays', attname: 'train_number' },
        { hypertable_name: 'sightings', attname: 'train_number' },
      ]);
    });
  });

  describe('saveSightings', () => {
    it('stores a Sighting with its optional fields', async () => {
      const count = await repo.saveSightings([
        sighting('2026-10-31T10:00:00Z', { platform: '3' }),
        createSighting({
          runId,
          source: 'gtfsrt_ld',
          observedAt: at('2026-10-31T10:00:30Z'),
          status: 'STOPPED_AT',
        }),
      ]);
      expect(count).toBe(2);
      const rows = await testDb.sql`SELECT * FROM sightings ORDER BY observed_at`;
      expect(rows[0]).toMatchObject({
        train_number: '03063',
        service_date: '2026-10-31',
        source: 'gtfsrt_ld',
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
        station_code: '60000',
        platform: '3',
        position_is_snapped: false,
      });
      expect(rows[1]).toMatchObject({ lat: null, lon: null, station_code: null, platform: null });
    });

    it('stores the same batch only once when inserted twice', async () => {
      const batch = [sighting('2026-10-31T10:00:00Z'), sighting('2026-10-31T10:00:30Z')];
      expect(await repo.saveSightings(batch)).toBe(2);
      expect(await repo.saveSightings(batch)).toBe(0);
      const rows = await testDb.sql`SELECT count(*)::int AS count FROM sightings`;
      expect(rows[0]?.count).toBe(2);
    });

    it('ignores duplicates inside one batch and keeps distinct Sources apart', async () => {
      const count = await repo.saveSightings([
        sighting('2026-10-31T10:00:00Z'),
        sighting('2026-10-31T10:00:00Z'),
        sighting('2026-10-31T10:00:00Z', { source: 'visor_ld' }),
      ]);
      expect(count).toBe(2);
    });

    it('accepts an empty batch', async () => {
      expect(await repo.saveSightings([])).toBe(0);
    });

    it('inserts a batch of 500 Sightings in under 200 ms', async () => {
      const base = at('2026-10-31T00:00:00Z').getTime();
      const batch = Array.from({ length: 500 }, (_, i) =>
        sighting(new Date(base + i * 1000).toISOString(), {
          runId: createRunId(String((i % 50) + 1), '2026-10-31'),
        }),
      );
      await repo.saveSightings([sighting('2026-10-30T00:00:00Z')]); // warm up the connection
      const start = performance.now();
      const count = await repo.saveSightings(batch);
      const elapsed = performance.now() - start;
      expect(count).toBe(500);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('saveDelays', () => {
    it('stores Delays once, including negative seconds', async () => {
      const batch = [
        createDelay({
          runId,
          source: 'gtfsrt_ld',
          observedAt: at('2026-10-31T10:00:00Z'),
          seconds: 180,
          atStationCode: '60000',
        }),
        createDelay({
          runId,
          source: 'gtfsrt_ld',
          observedAt: at('2026-10-31T10:05:00Z'),
          seconds: -60,
        }),
      ];
      expect(await repo.saveDelays(batch)).toBe(2);
      expect(await repo.saveDelays(batch)).toBe(0);
      const rows = await testDb.sql`SELECT * FROM delays ORDER BY observed_at`;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ seconds: 180, at_station_code: '60000' });
      expect(rows[1]).toMatchObject({ seconds: -60, at_station_code: null });
    });
  });

  describe('touchRuns', () => {
    it('creates a Run and then updates it, keeping fields the new Run lacks', async () => {
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave', lineCode: 'AVE', status: 'scheduled' })],
        at('2026-10-31T10:00:00Z'),
      );
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave' })],
        at('2026-10-31T10:05:00Z'),
      );
      expect(await repo.findRun('03063', '2026-10-31')).toEqual({
        id: runId,
        serviceType: 'ave',
        lineCode: 'AVE',
        status: 'scheduled',
        lastSeenAt: at('2026-10-31T10:05:00Z'),
      });
    });

    it('overwrites fields the new Run carries and never moves lastSeenAt backwards', async () => {
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave', status: 'scheduled' })],
        at('2026-10-31T10:05:00Z'),
      );
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave', status: 'cancelled' })],
        at('2026-10-31T10:00:00Z'),
      );
      const run = await repo.findRun('03063', '2026-10-31');
      expect(run?.status).toBe('cancelled');
      expect(run?.lastSeenAt).toEqual(at('2026-10-31T10:05:00Z'));
    });

    it('stores the Rolling stock and keeps it when a later Run lacks it', async () => {
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave', rollingStock: '449013' })],
        at('2026-10-31T10:00:00Z'),
      );
      await repo.touchRuns(
        [createRun({ id: runId, serviceType: 'ave' })],
        at('2026-10-31T10:05:00Z'),
      );
      expect((await repo.findRun('03063', '2026-10-31'))?.rollingStock).toBe('449013');
    });

    it('returns undefined for an unknown Run', async () => {
      expect(await repo.findRun('99999', '2026-10-31')).toBeUndefined();
    });
  });

  describe('replaceStopEstimates', () => {
    const estimate = (sequence: number, stationCode: string, estimatedArrival: string) =>
      createRunStopEstimate({
        runId,
        sequence,
        stationCode,
        scheduledArrival: at('2026-10-31T21:00:00Z'),
        scheduledDeparture: at('2026-10-31T21:01:00Z'),
        estimatedArrival: at(estimatedArrival),
        estimatedDeparture: at('2026-10-31T21:20:00Z'),
      });

    it('stores the estimates of a Run in journey order', async () => {
      await repo.replaceStopEstimates([
        estimate(1, '51100', '2026-10-31T21:10:00Z'),
        estimate(0, '51003', '2026-10-31T21:05:00Z'),
      ]);
      expect(
        (await repo.listStopEstimates('03063', '2026-10-31')).map((e) => e.stationCode),
      ).toEqual(['51003', '51100']);
    });

    it('replaces the previous estimates of the Runs it is given and leaves other Runs alone', async () => {
      const other = createRunId('4000', '2026-10-31');
      await repo.replaceStopEstimates([
        estimate(0, '51003', '2026-10-31T21:05:00Z'),
        estimate(1, '51100', '2026-10-31T21:10:00Z'),
        { ...estimate(0, '60000', '2026-10-31T21:05:00Z'), runId: other },
      ]);
      await repo.replaceStopEstimates([estimate(0, '51003', '2026-10-31T21:30:00Z')]);

      const replaced = await repo.listStopEstimates('03063', '2026-10-31');
      expect(replaced).toHaveLength(1);
      expect(replaced[0]?.estimatedArrival).toEqual(at('2026-10-31T21:30:00Z'));
      expect(await repo.listStopEstimates('04000', '2026-10-31')).toHaveLength(1);
    });
  });

  describe('service alerts', () => {
    const alert = createServiceAlert({
      id: 'a1',
      header: 'Obras',
      description: 'Obras en la línea',
      url: 'https://renfe.com/a1',
      activePeriods: [{ start: at('2026-10-31T08:00:00Z'), end: at('2026-10-31T20:00:00Z') }, {}],
      lineCodes: ['10-C1'],
      stationCodes: ['17000'],
      source: 'gtfsrt_cercanias',
    });

    it('round-trips an alert and replaces it by id', async () => {
      await repo.saveServiceAlerts([alert]);
      expect(await repo.listServiceAlerts()).toEqual([alert]);

      const ended = { ...alert, header: 'Fin de obras', endedAt: at('2026-10-31T21:00:00Z') };
      await repo.saveServiceAlerts([ended]);
      expect(await repo.listServiceAlerts()).toEqual([ended]);
    });

    it('filters by Source', async () => {
      await repo.saveServiceAlerts([alert, { ...alert, id: 'a2', source: 'gtfsrt_ld' }]);
      const only = await repo.listServiceAlerts('gtfsrt_ld');
      expect(only.map((a) => a.id)).toEqual(['a2']);
    });
  });
});
