import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import type { OsmWay } from '../../domain/network/index.js';
import { DrizzleNetworkRepository } from '../../infrastructure/db/drizzle-network.repository.js';
import { ImportOsmTrackGeometry } from './import-osm-track-geometry.use-case.js';
import { type BoundingBox, OsmRailways } from './osm-railways.js';

const silent = { log() {}, warn() {}, error() {} };

// A straight track from Madrid (-3.70) to Zaragoza-ish (-0.88) at lat 41.
const track: OsmWay = Array.from({ length: 29 }, (_, i) => [-3.7 + i * 0.1, 41] as const);

class FakeRailways extends OsmRailways {
  boxes: BoundingBox[] = [];
  constructor(private ways: OsmWay[] | Error) {
    super();
  }
  async mainLinesWithin(box: BoundingBox): Promise<OsmWay[]> {
    this.boxes.push(box);
    if (this.ways instanceof Error) throw this.ways;
    return this.ways;
  }
}

describe('ImportOsmTrackGeometry', () => {
  let testDb: TestDatabase;
  let repository: DrizzleNetworkRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repository = new DrizzleNetworkRepository(testDb.db);
  });
  afterAll(async () => {
    await testDb?.close();
  });

  beforeEach(async () => {
    await testDb.sql.unsafe(
      'TRUNCATE scheduled_stops, scheduled_runs, track_geometries, lines, stations, hubs, service_calendars CASCADE',
    );
    await testDb.sql.unsafe(`
      INSERT INTO stations (code, name, location, service_types) VALUES
        ('A', 'Alpha', ST_GeogFromText('SRID=4326;POINT(-3.7 41.0005)'), '{ave}'),
        ('B', 'Bravo', ST_GeogFromText('SRID=4326;POINT(-2.3 41)'), '{ave}'),
        ('C', 'Charlie', ST_GeogFromText('SRID=4326;POINT(-0.9 41)'), '{ave}'),
        ('Z', 'Zulu', ST_GeogFromText('SRID=4326;POINT(10 10)'), '{media_distancia}');
      INSERT INTO lines (code, name, service_type) VALUES ('AVE', 'AVE', 'ave'), ('MD', 'MD', 'media_distancia');
      INSERT INTO service_calendars (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
        VALUES ('D', true, true, true, true, true, true, true, '2026-01-01', '2026-12-31');
      INSERT INTO scheduled_runs (trip_id, train_number, line_code, service_type, service_id) VALUES
        ('t1', '1', 'AVE', 'ave', 'D'), ('t2', '2', 'AVE', 'ave', 'D'), ('t3', '3', 'MD', 'media_distancia', 'D');
      INSERT INTO scheduled_stops (trip_id, seq, station_code, arrival_seconds, departure_seconds) VALUES
        ('t1', 1, 'A', 0, 0), ('t1', 2, 'B', 1, 1), ('t1', 3, 'C', 2, 2),
        ('t2', 1, 'A', 0, 0), ('t2', 2, 'B', 1, 1), ('t2', 3, 'C', 2, 2),
        ('t3', 1, 'A', 0, 0), ('t3', 2, 'Z', 1, 1);`);
  });

  const shapeOf = async (tripId: string) =>
    (await repository.findScheduledRunsByTripIds([tripId]))[0]?.shapeId;

  it('draws one geometry per stop pattern and links its Runs', async () => {
    const report = await new ImportOsmTrackGeometry(
      repository,
      new FakeRailways([track]),
      silent,
    ).execute();

    expect(report).toMatchObject({ patterns: 2, drawn: 1, skipped: 1 });
    const shapeId = await shapeOf('t1');
    expect(shapeId).toMatch(/^osm:AVE:A-C-/);
    expect(await shapeOf('t2')).toBe(shapeId);
    expect(await shapeOf('t3')).toBeUndefined(); // Zulu is nowhere near the track
    const geometry = await repository.getTrackGeometry(shapeId as string);
    expect(geometry?.lineCode).toBe('AVE');
    expect(geometry?.path[0]?.[0]).toBeCloseTo(-3.7);
    expect(geometry?.path.at(-1)?.[0]).toBeCloseTo(-0.9);
  });

  it('draws nothing when most Stations of the pattern are not on the track found', async () => {
    const partial: OsmWay = track.slice(0, 5); // covers Alpha only; Bravo and Charlie are off it
    const report = await new ImportOsmTrackGeometry(
      repository,
      new FakeRailways([partial]),
      silent,
    ).execute();
    expect(report.drawn).toBe(0);
    expect(await shapeOf('t1')).toBeUndefined();
  });

  it('searches OpenStreetMap in a box around the Stations', async () => {
    const railways = new FakeRailways([track]);
    await new ImportOsmTrackGeometry(repository, railways, silent).execute();
    const box = railways.boxes[0] as BoundingBox;
    expect(box.west).toBeLessThan(-3.7);
    expect(box.east).toBeGreaterThan(-0.9);
    expect(box.south).toBeLessThan(41);
    expect(box.north).toBeGreaterThan(41.0005);
  });

  it('does not download again for a pattern already drawn, but links new Runs', async () => {
    await new ImportOsmTrackGeometry(repository, new FakeRailways([track]), silent).execute();
    await testDb.sql`INSERT INTO scheduled_runs (trip_id, train_number, line_code, service_type, service_id) VALUES ('t4', '4', 'AVE', 'ave', 'D')`;
    await testDb.sql`INSERT INTO scheduled_stops (trip_id, seq, station_code, arrival_seconds, departure_seconds) VALUES ('t4', 1, 'A', 0, 0), ('t4', 2, 'B', 1, 1), ('t4', 3, 'C', 2, 2)`;

    const railways = new FakeRailways([track]);
    const report = await new ImportOsmTrackGeometry(repository, railways, silent).execute();

    expect(report.alreadyDrawn).toBe(1);
    expect(railways.boxes).toHaveLength(1); // only the undrawable MD pattern is searched again
    expect(await shapeOf('t4')).toBe(await shapeOf('t1'));
  });

  it('leaves a pattern undrawn when OpenStreetMap fails, and carries on', async () => {
    const report = await new ImportOsmTrackGeometry(
      repository,
      new FakeRailways(new Error('Overpass answered 429')),
      silent,
    ).execute();
    expect(report).toMatchObject({ drawn: 0, skipped: 2 });
    expect(await shapeOf('t1')).toBeUndefined();
  });

  it('keeps the geometry link when the static import upserts the Run without a shape', async () => {
    await new ImportOsmTrackGeometry(repository, new FakeRailways([track]), silent).execute();
    const before = await shapeOf('t1');
    await repository.saveStaticNetwork(
      {
        hubs: [],
        stations: [],
        lines: [],
        calendars: [],
        stops: [],
        geometries: [],
        runs: [
          { tripId: 't1', trainNumber: '1', lineCode: 'AVE', serviceType: 'ave', serviceId: 'D' },
        ],
      },
      { source: 'larga-distancia', importedAt: new Date() },
    );
    expect(await shapeOf('t1')).toBe(before);
  });
});
