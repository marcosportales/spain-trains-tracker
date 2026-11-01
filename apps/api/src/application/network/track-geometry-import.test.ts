import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { DrizzleNetworkRepository } from '../../infrastructure/db/drizzle-network.repository.js';
import type {
  GtfsFileName,
  GtfsRows,
} from '../../infrastructure/renfe/gtfs-static/gtfs-static.types.js';
import { ImportStaticNetwork } from './import-static-network.use-case.js';
import { type FeedFetch, type GtfsFeed, StaticFeeds } from './static-feeds.js';

/**
 * The recorded fixtures are cut to 50 rows per file, so their trips, shapes and stop times do not
 * join. These tests import a small but internally consistent Cercanías feed through the real
 * use case and check the stored Track geometry against the acceptance criteria.
 */

type Row<F extends GtfsFileName> = GtfsRows[F];

const stop = (id: string, name: string, lat: number, lon: number): Row<'stops'> =>
  ({
    stop_id: id,
    stop_name: name,
    stop_lat: lat,
    stop_lon: lon,
  }) as Row<'stops'>;

const route = (id: string, shortName: string, longName: string): Row<'routes'> =>
  ({
    route_id: id,
    route_short_name: shortName,
    route_long_name: longName,
    route_type: 2,
  }) as Row<'routes'>;

const trip = (routeId: string, tripId: string, shapeId: string): Row<'trips'> =>
  ({ route_id: routeId, service_id: 'DAILY', trip_id: tripId, shape_id: shapeId }) as Row<'trips'>;

const stopTime = (tripId: string, stopId: string, sequence: number): Row<'stop_times'> =>
  ({
    trip_id: tripId,
    arrival_time: `${8 + sequence}:00:00`,
    departure_time: `${8 + sequence}:01:00`,
    stop_id: stopId,
    stop_sequence: sequence,
  }) as Row<'stop_times'>;

/** A shape that starts and ends `offset` degrees away from the given Stations, with a bend between. */
const shape = (
  id: string,
  from: readonly [number, number],
  to: readonly [number, number],
  offset = 0.0005,
): Row<'shapes'>[] => {
  const points: [number, number][] = [
    [from[0] + offset, from[1]],
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.01],
    [to[0], to[1] + offset],
  ];
  return points.map(([lat, lon], i) => ({
    shape_id: id,
    shape_pt_lat: lat,
    shape_pt_lon: lon,
    shape_pt_sequence: i + 1,
  })) as Row<'shapes'>[];
};

const PRINCIPE_PIO = [40.4208, -3.7202] as const;
const AEROPUERTO = [40.4916, -3.5936] as const;
const GUADALAJARA = [40.6351, -3.1696] as const;
const CHAMARTIN = [40.4727, -3.6823] as const;

function cercanias(
  shapes: Row<'shapes'>[],
  tripShapes: Record<string, string> = { C1: '10_C1', C2: '10_C2' },
): Record<GtfsFileName, unknown[]> {
  const files = {
    stops: [
      stop('18000', 'Príncipe Pío', ...PRINCIPE_PIO),
      stop('18001', 'Aeropuerto T4', ...AEROPUERTO),
      stop('18002', 'Guadalajara', ...GUADALAJARA),
      stop('18003', 'Chamartín', ...CHAMARTIN),
    ],
    routes: [
      route('10T0001C1', 'C1', 'Príncipe Pío-Aeropuerto T4'),
      route('10T0002C1', 'C1', 'Aeropuerto T4-Príncipe Pío'),
      route('10T0005C2', 'C2', 'Guadalajara-Chamartín'),
    ],
    trips: [
      trip('10T0001C1', '1000D10001C1', tripShapes.C1 as string),
      trip('10T0002C1', '1000D10002C1', tripShapes.C1 as string),
      trip('10T0005C2', '1000D10003C2', tripShapes.C2 as string),
    ],
    stop_times: [
      stopTime('1000D10001C1', '18000', 1),
      stopTime('1000D10001C1', '18001', 2),
      stopTime('1000D10002C1', '18001', 1),
      stopTime('1000D10002C1', '18000', 2),
      stopTime('1000D10003C2', '18002', 1),
      stopTime('1000D10003C2', '18003', 2),
    ],
    calendar: [
      {
        service_id: 'DAILY',
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        start_date: '20261101',
        end_date: '20261231',
      },
    ],
    shapes,
  } as Record<string, unknown[]>;
  return files as Record<GtfsFileName, unknown[]>;
}

class FakeFeeds extends StaticFeeds {
  constructor(private readonly files: Record<GtfsFileName, unknown[]>) {
    super();
  }
  async fetchGtfs(source: string): Promise<FeedFetch<GtfsFeed>> {
    if (source !== 'cercanias') return { status: 'not-modified' };
    const files = this.files;
    const content: GtfsFeed = {
      async *rows(file) {
        for (const row of files[file] ?? []) yield row as never;
      },
    };
    return { status: 'modified', content, release: async () => {} };
  }
  async fetchStations(): Promise<FeedFetch<never[]>> {
    return { status: 'modified', content: [], release: async () => {} };
  }
}

const silent = { log() {}, warn() {}, error() {} };

describe('Cercanías Track geometry import', () => {
  let testDb: TestDatabase;
  let repository: DrizzleNetworkRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repository = new DrizzleNetworkRepository(testDb.db);
  });
  afterAll(async () => {
    await testDb?.close();
  });

  async function importFeed(files: Record<GtfsFileName, unknown[]>) {
    for (const table of [
      'static_imports',
      'scheduled_stops',
      'scheduled_runs',
      'track_geometries',
    ]) {
      await testDb.sql.unsafe(`TRUNCATE ${table} CASCADE`);
    }
    await testDb.sql.unsafe('TRUNCATE lines, stations, hubs, service_calendars CASCADE');
    await new ImportStaticNetwork(new FakeFeeds(files), repository, silent).execute();
  }

  const goodShapes = () => [
    ...shape('10_C1', PRINCIPE_PIO, AEROPUERTO),
    ...shape('10_C2', GUADALAJARA, CHAMARTIN),
  ];

  it('gives every Cercanías Line at least one geometry', async () => {
    await importFeed(cercanias(goodShapes()));

    const lines = (await repository.listLines()).filter((l) => l.serviceType === 'cercanias');
    expect(lines.map((l) => l.code)).toEqual(['10-C1', '10-C2']);
    for (const line of lines) {
      const geometries = await repository.trackGeometryFor(line.code);
      expect(geometries.length, `geometry of ${line.code}`).toBeGreaterThanOrEqual(1);
      expect((await repository.simplifiedTrackGeometryFor(line.code)).length).toBe(
        geometries.length,
      );
    }
  });

  it('links Runs to their geometry through the shape', async () => {
    await importFeed(cercanias(goodShapes()));

    const [run] = await repository.findScheduledRuns('10001', '2026-11-02');
    expect(run?.shapeId).toBe('10_C1');
    expect((await repository.getTrackGeometry('10_C1'))?.lineCode).toBe('10-C1');
  });

  it('ends each geometry within 300 m of the first and last Station of the Line', async () => {
    await importFeed(cercanias(goodShapes()));

    for (const lineCode of ['10-C1', '10-C2']) {
      const runs = await runsOf(lineCode);
      expect(runs.length).toBeGreaterThan(0);
      for (const tripId of runs) {
        const stops = await repository.getScheduledStops(tripId);
        const first = stops[0]?.stationCode as string;
        const last = stops.at(-1)?.stationCode as string;
        const [geometry] = await repository.trackGeometryFor(lineCode);
        const start = geometry?.path[0] as readonly [number, number];
        const end = geometry?.path.at(-1) as readonly [number, number];

        // A geometry may be drawn in either direction: one end must match each Station.
        const near = async ([lon, lat]: readonly [number, number]) =>
          (await repository.findStationsNear(lat, lon, 300)).map((s) => s.code);
        const ends = [await near(start), await near(end)];
        const matches = (a: string, b: string) => ends[0]?.includes(a) && ends[1]?.includes(b);
        expect(matches(first, last) || matches(last, first), `${lineCode} ${tripId}`).toBe(true);
      }
    }
  });

  it('detects a geometry that drifts away from its Stations', async () => {
    await importFeed(
      cercanias([
        ...shape('10_C1', PRINCIPE_PIO, AEROPUERTO, 0.01), // ~1.1 km off
        ...shape('10_C2', GUADALAJARA, CHAMARTIN),
      ]),
    );

    const [geometry] = await repository.trackGeometryFor('10-C1');
    const [lon, lat] = (geometry as NonNullable<typeof geometry>).path[0] as readonly [
      number,
      number,
    ];
    const codes = (await repository.findStationsNear(lat, lon, 300)).map((s) => s.code);
    expect(codes).not.toContain('18000');
  });

  async function runsOf(lineCode: string): Promise<string[]> {
    const rows =
      await testDb.sql`SELECT trip_id FROM scheduled_runs WHERE line_code = ${lineCode} ORDER BY trip_id`;
    return rows.map((r) => r.trip_id as string);
  }
});
