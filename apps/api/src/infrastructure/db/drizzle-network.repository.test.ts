import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import type { StaticNetwork } from '../../application/network/network.repository.js';
import { DrizzleNetworkRepository } from './drizzle-network.repository.js';

const WEEKDAYS = [true, true, true, true, true, false, false] as const;

function network(overrides: Partial<StaticNetwork> = {}): StaticNetwork {
  return {
    hubs: [{ code: '10', name: 'Madrid' }],
    stations: [
      {
        code: '17000',
        name: 'Madrid Puerta de Atocha',
        lat: 40.4065,
        lon: -3.6892,
        hubCode: '10',
        serviceTypes: ['cercanias', 'ave'],
        wheelchairBoarding: true,
      },
      { code: '60000', name: 'Barcelona Sants', lat: 41.3791, lon: 2.1403, serviceTypes: ['ave'] },
    ],
    lines: [
      {
        code: 'C1',
        name: 'Príncipe Pío–Aeropuerto',
        serviceType: 'cercanias',
        hubCode: '10',
        color: '75B6E0',
      },
    ],
    calendars: [
      {
        serviceId: 'WEEKDAYS',
        weekdays: WEEKDAYS,
        startDate: '2026-11-02',
        endDate: '2026-11-30',
        exceptions: [
          { date: '2026-11-03', added: false },
          { date: '2026-11-07', added: true },
        ],
      },
    ],
    runs: [
      {
        tripId: 'T1',
        trainNumber: '03063',
        lineCode: 'C1',
        serviceType: 'cercanias',
        serviceId: 'WEEKDAYS',
        shapeId: '10_C1',
      },
    ],
    stops: [
      {
        tripId: 'T1',
        sequence: 2,
        stationCode: '60000',
        arrivalSeconds: 90_000,
        departureSeconds: 90_060,
      },
      {
        tripId: 'T1',
        sequence: 1,
        stationCode: '17000',
        arrivalSeconds: 80_000,
        departureSeconds: 80_100,
      },
    ],
    geometries: [
      {
        shapeId: '10_C1',
        lineCode: 'C1',
        path: [
          [-3.6892, 40.4065],
          [-3.7, 40.42],
        ],
      },
    ],
    ...overrides,
  };
}

describe('DrizzleNetworkRepository', () => {
  let database: TestDatabase;
  let repo: DrizzleNetworkRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
    repo = new DrizzleNetworkRepository(database.db);
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.sql.unsafe(
      'TRUNCATE hubs, stations, lines, service_calendars, track_geometries, scheduled_runs, scheduled_stops, static_imports CASCADE',
    );
  });

  const record = { source: 'cercanias', etag: 'abc', importedAt: new Date('2026-11-01T10:00:00Z') };

  it('round-trips Hubs, Lines and Stations', async () => {
    await repo.saveStaticNetwork(network(), record);

    expect(await repo.listHubs()).toEqual([{ code: '10', name: 'Madrid' }]);
    expect(await repo.listLines()).toEqual(network().lines);
    expect(await repo.findStation('17000')).toEqual(
      network().stations.find((s) => s.code === '17000'),
    );
    expect(await repo.findStation('nope')).toBeUndefined();
    expect((await repo.listStations()).map((s) => s.code)).toEqual(['17000', '60000']);
  });

  it('is idempotent and updates changed rows', async () => {
    await repo.saveStaticNetwork(network(), record);
    const renamed = network({
      stations: network().stations.map((s) => (s.code === '17000' ? { ...s, name: 'Atocha' } : s)),
    });
    await repo.saveStaticNetwork(renamed, record);

    expect((await repo.findStation('17000'))?.name).toBe('Atocha');
    expect(await repo.listStations()).toHaveLength(2);
    expect(await repo.getScheduledStops('T1')).toHaveLength(2);
  });

  it('finds Stations near a point, nearest first', async () => {
    await repo.saveStaticNetwork(network(), record);

    const near = await repo.findStationsNear(40.41, -3.69, 2_000);
    expect(near.map((s) => s.code)).toEqual(['17000']);
    const wide = await repo.findStationsNear(40.41, -3.69, 700_000);
    expect(wide.map((s) => s.code)).toEqual(['17000', '60000']);
  });

  it('returns scheduled stops in sequence order', async () => {
    await repo.saveStaticNetwork(network(), record);

    const stops = await repo.getScheduledStops('T1');
    expect(stops.map((s) => [s.sequence, s.stationCode])).toEqual([
      [1, '17000'],
      [2, '60000'],
    ]);
    expect(stops[1]).toMatchObject({ arrivalSeconds: 90_000, departureSeconds: 90_060 });
  });

  it('resolves scheduled Runs for a Service date through the calendar', async () => {
    await repo.saveStaticNetwork(network(), record);
    const ids = async (date: string) =>
      (await repo.findScheduledRuns('03063', date)).map((r) => r.tripId);

    expect(await ids('2026-11-02')).toEqual(['T1']); // Monday in range
    expect(await ids('2026-11-03')).toEqual([]); // removed exception
    expect(await ids('2026-11-07')).toEqual(['T1']); // added Saturday
    expect(await ids('2026-11-08')).toEqual([]); // Sunday, not in pattern
    expect(await ids('2026-12-01')).toEqual([]); // out of range
    expect(await repo.findScheduledRuns('99999', '2026-11-02')).toEqual([]);
  });

  it('round-trips the Track geometry', async () => {
    await repo.saveStaticNetwork(network(), record);

    const geometry = await repo.getTrackGeometry('10_C1');
    expect(geometry?.lineCode).toBe('C1');
    expect(geometry?.path).toHaveLength(2);
    expect(geometry?.path[0]?.[0]).toBeCloseTo(-3.6892, 5);
    expect(geometry?.path[0]?.[1]).toBeCloseTo(40.4065, 5);
    expect(await repo.getTrackGeometry('missing')).toBeUndefined();
  });

  it('records imports and returns the latest per source', async () => {
    await repo.saveStaticNetwork(network(), record);
    const later = {
      source: 'cercanias',
      etag: 'def',
      importedAt: new Date('2026-11-02T10:00:00Z'),
    };
    await repo.saveStaticNetwork(network(), later);

    expect(await repo.lastStaticImport('cercanias')).toEqual(later);
    expect(await repo.lastStaticImport('larga-distancia')).toBeUndefined();
  });

  it('rolls everything back when part of the import is invalid', async () => {
    const broken = network({
      stops: [
        {
          tripId: 'T1',
          sequence: 1,
          stationCode: 'UNKNOWN',
          arrivalSeconds: 0,
          departureSeconds: 0,
        },
      ],
    });

    await expect(repo.saveStaticNetwork(broken, record)).rejects.toThrow();
    expect(await repo.listStations()).toEqual([]);
    expect(await repo.lastStaticImport('cercanias')).toBeUndefined();
  });

  it('writes large timetables in batches', async () => {
    const stops = Array.from({ length: 30_000 }, (_, i) => ({
      tripId: 'T1',
      sequence: i + 1,
      stationCode: '17000',
      arrivalSeconds: i,
      departureSeconds: i,
    }));
    await repo.saveStaticNetwork(network({ stops }), record);

    expect(await repo.getScheduledStops('T1')).toHaveLength(30_000);
  });
});
