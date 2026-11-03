import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SearchResult, SearchSuggestions } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { SearchCatalog } from '../../application/search/search-catalog.use-case.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { DrizzleSearchReader } from '../db/drizzle-search.reader.js';
import { SearchController } from './search.controller.js';

const NOW = new Date('2026-10-31T07:00:00Z');

describe('GET /search', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let network: DrizzleNetworkRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    network = new DrizzleNetworkRepository(testDb.db);
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchCatalog,
          useValue: new SearchCatalog(new DrizzleSearchReader(testDb.db), () => NOW),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe(
      'TRUNCATE sightings, delays, runs, run_stop_estimates, hubs, stations, lines, service_calendars, track_geometries, scheduled_runs, scheduled_stops, static_imports CASCADE',
    );
    await network.saveStaticNetwork(
      {
        hubs: [
          { code: 'madrid', name: 'Madrid' },
          { code: 'barcelona', name: 'Rodalies de Catalunya' },
        ],
        stations: [
          ['1', 'Madrid-Puerta de Atocha'],
          ['2', 'Barcelona-Sants'],
          ['3', 'Zaragoza-Delicias'],
        ].map(([code, name]) => ({
          code: code as string,
          name: name as string,
          lat: 40,
          lon: -3,
          serviceTypes: ['cercanias' as const],
        })),
        lines: [
          { code: '10T0001C1', name: 'C1', serviceType: 'cercanias', hubCode: 'madrid' },
          { code: '51T0001C1', name: 'C1', serviceType: 'cercanias', hubCode: 'barcelona' },
          { code: '10T0002C10', name: 'C10', serviceType: 'cercanias', hubCode: 'madrid' },
          { code: '10T0003C2', name: 'C2', serviceType: 'cercanias', hubCode: 'madrid' },
        ],
        calendars: [],
        runs: [],
        stops: [],
        geometries: [],
      },
      { source: 'test', importedAt: NOW },
    );
    await testDb.sql.unsafe(
      `INSERT INTO runs (train_number, service_date, service_type, line_code, last_seen_at) VALUES
       ('23579', '2026-10-31', 'cercanias', '10T0001C1', '2026-10-31T06:59:00Z'),
       ('23580', '2026-10-31', 'cercanias', '10T0001C1', '2026-10-31T06:59:00Z'),
       ('23999', '2026-10-31', 'cercanias', '10T0001C1', '2026-10-30T01:00:00Z')`, // 23999: no longer active
    );
  });

  const search = async (q: string) =>
    SearchResult.parse(
      (await request(app.getHttpServer()).get('/search').query({ q }).expect(200)).body,
    );

  it('finds a Station by unaccented, partial name', async () => {
    const result = await search('atocha');
    expect(result.stations.map((s) => s.name)).toEqual(['Madrid-Puerta de Atocha']);
    expect((await search('ZARAGOZA')).stations).toHaveLength(1);
  });

  it('ignores accents in the query', async () => {
    expect((await search('átocha')).stations.map((x) => x.stationCode)).toEqual(['1']);
  });

  it('matches a Line by code prefix', async () => {
    expect((await search('51T0001')).lines.map((l) => l.lineCode)).toEqual(['51T0001C1']);
  });

  it('tolerates a typo in a Station name', async () => {
    expect((await search('atoxha')).stations.map((s) => s.stationCode)).toEqual(['1']);
  });

  it('finds an active Run by exact Train number', async () => {
    const result = await search('23579');
    expect(result.runs).toEqual([
      {
        trainNumber: '23579',
        serviceDate: '2026-10-31',
        serviceType: 'cercanias',
        lineCode: '10T0001C1',
      },
    ]);
  });

  it('carries origin and destination names on a Run that has them', async () => {
    await testDb.sql.unsafe(
      "UPDATE runs SET origin_station_code = '1', destination_station_code = '2' WHERE train_number = '23579'",
    );
    const [run] = (await search('23579')).runs;
    expect(run).toMatchObject({
      originName: 'Madrid-Puerta de Atocha',
      destinationName: 'Barcelona-Sants',
    });
  });

  it('omits origin and destination names when unknown or unmatched', async () => {
    await testDb.sql.unsafe(
      "UPDATE runs SET origin_station_code = '1', destination_station_code = 'nope' WHERE train_number = '23580'",
    );
    const [plain] = (await search('23579')).runs;
    expect(plain).not.toHaveProperty('originName');
    expect(plain).not.toHaveProperty('destinationName');
    const [partial] = (await search('23580')).runs;
    expect(partial).toHaveProperty('originName', 'Madrid-Puerta de Atocha');
    expect(partial).not.toHaveProperty('destinationName');
  });

  it('matches Train numbers by prefix and skips inactive Runs', async () => {
    expect((await search('235')).runs.map((r) => r.trainNumber)).toEqual(['23579', '23580']);
    expect((await search('239')).runs).toEqual([]);
  });

  it('returns Lines from multiple Hubs for C1, exact name first', async () => {
    const result = await search('c1');
    expect(result.lines.map((l) => l.lineCode)).toEqual(['10T0001C1', '51T0001C1', '10T0002C10']);
  });

  it('caps each group at 10', async () => {
    await testDb.sql.unsafe(
      `INSERT INTO runs (train_number, service_date, service_type, last_seen_at)
       SELECT '70' || lpad(g::text, 3, '0'), '2026-10-31', 'cercanias', '2026-10-31T06:59:00Z'
       FROM generate_series(1, 15) g`,
    );
    expect((await search('70')).runs).toHaveLength(10);
  });

  it('rejects a query shorter than 2 characters', async () => {
    await request(app.getHttpServer()).get('/search').query({ q: 'a' }).expect(400);
    await request(app.getHttpServer()).get('/search').query({ q: ' a ' }).expect(400);
    await request(app.getHttpServer()).get('/search').expect(400);
  });

  it('echoes the trimmed query', async () => {
    expect((await search('  atocha ')).query).toBe('atocha');
  });
});

describe('GET /search/suggestions', () => {
  let testDb: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchCatalog,
          useValue: new SearchCatalog(new DrizzleSearchReader(testDb.db), () => NOW),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe(
      'TRUNCATE sightings, delays, runs, run_stop_estimates, stations CASCADE',
    );
  });

  const addRun = (trainNumber: string, lastSeenAt = '2026-10-31T06:59:00Z') =>
    testDb.sql.unsafe(
      `INSERT INTO runs (train_number, service_date, service_type, last_seen_at)
       VALUES ('${trainNumber}', '2026-10-31', 'cercanias', '${lastSeenAt}')`,
    );
  const addDelay = (trainNumber: string, seconds: number, observedAt = '2026-10-31T06:50:00Z') =>
    testDb.sql.unsafe(
      `INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
       VALUES ('${trainNumber}', '2026-10-31', 'test', '${observedAt}', ${seconds})`,
    );
  const suggestions = async () =>
    SearchSuggestions.parse(
      (await request(app.getHttpServer()).get('/search/suggestions').expect(200)).body,
    );
  const trains = async () => (await suggestions()).runs.map((r) => r.trainNumber);

  it('returns an empty list when there are no Tracked Runs', async () => {
    expect(await suggestions()).toEqual({ runs: [] });
  });

  it('orders Runs by Delay, largest first', async () => {
    for (const [n, s] of [
      ['10001', 300],
      ['10002', 1800],
      ['10003', 900],
    ] as const) {
      await addRun(n);
      await addDelay(n, s);
    }
    expect(await trains()).toEqual(['10002', '10003', '10001']);
  });

  it('caps the list at 4', async () => {
    for (let i = 1; i <= 6; i++) {
      await addRun(`1000${i}`);
      await addDelay(`1000${i}`, i * 100);
    }
    expect(await trains()).toEqual(['10006', '10005', '10004', '10003']);
  });

  it('ranks Runs with no known Delay after those with one', async () => {
    await addRun('10001');
    await addRun('10002');
    await addDelay('10002', -60);
    expect(await trains()).toEqual(['10002', '10001']);
  });

  it('uses the latest Delay of a Run', async () => {
    await addRun('10001');
    await addDelay('10001', 3000, '2026-10-31T06:00:00Z');
    await addDelay('10001', 60, '2026-10-31T06:50:00Z');
    await addRun('10002');
    await addDelay('10002', 600);
    expect(await trains()).toEqual(['10002', '10001']);
  });

  it('skips Runs no longer active', async () => {
    await addRun('10001', '2026-10-30T01:00:00Z');
    await addDelay('10001', 3000);
    expect(await trains()).toEqual([]);
  });

  it('carries origin and destination names', async () => {
    await testDb.sql.unsafe(
      `INSERT INTO stations (code, name, location, service_types) VALUES
       ('1', 'Madrid-Puerta de Atocha', 'POINT(-3 40)', '{cercanias}'),
       ('2', 'Barcelona-Sants', 'POINT(2 41)', '{cercanias}')`,
    );
    await addRun('10001');
    await testDb.sql.unsafe(
      "UPDATE runs SET origin_station_code = '1', destination_station_code = '2'",
    );
    const [run] = (await suggestions()).runs;
    expect(run).toMatchObject({
      originName: 'Madrid-Puerta de Atocha',
      destinationName: 'Barcelona-Sants',
    });
  });
});
