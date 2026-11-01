import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StationBoard, StationList } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetStationBoard } from '../../application/station/get-station-board.use-case.js';
import { ListStations } from '../../application/station/list-stations.use-case.js';
import {
  createDelay,
  createRun,
  createRunId,
  createRunStopEstimate,
} from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { DrizzleStationBoardReader } from '../db/drizzle-station-board.reader.js';
import { StationsController } from './stations.controller.js';

// 2026-10-31 is CET (UTC+1): 08:00 local = 07:00Z.
const NOW = new Date('2026-10-31T07:00:00Z');

const stop = (tripId: string, sequence: number, stationCode: string, seconds: number) => ({
  tripId,
  sequence,
  stationCode,
  arrivalSeconds: seconds,
  departureSeconds: seconds + 60,
});
const trip = (tripId: string, trainNumber: string, serviceId = 'DAILY') => ({
  tripId,
  trainNumber,
  lineCode: 'C1',
  serviceType: 'cercanias' as const,
  serviceId,
});

describe('GET /stations/:code/board', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let movement: DrizzleMovementRepository;
  let network: DrizzleNetworkRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    movement = new DrizzleMovementRepository(testDb.db);
    network = new DrizzleNetworkRepository(testDb.db);
    const moduleRef = await Test.createTestingModule({
      controllers: [StationsController],
      providers: [
        {
          provide: GetStationBoard,
          useValue: new GetStationBoard(
            new DrizzleStationBoardReader(testDb.db),
            network,
            () => NOW,
          ),
        },
        { provide: ListStations, useValue: new ListStations(network) },
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
        hubs: [],
        stations: ['A', 'B', 'C'].map((code) => ({
          code,
          name: `Station ${code}`,
          lat: 40,
          lon: -3,
          serviceTypes: ['cercanias'],
        })),
        lines: [{ code: 'C1', name: 'C1', serviceType: 'cercanias' }],
        calendars: [
          {
            serviceId: 'DAILY',
            weekdays: [true, true, true, true, true, true, true],
            startDate: '2026-10-01',
            endDate: '2026-12-31',
            exceptions: [{ date: '2026-10-31', added: true }],
          },
          {
            serviceId: 'NOT_TODAY',
            weekdays: [true, true, true, true, true, true, true],
            startDate: '2026-10-01',
            endDate: '2026-12-31',
            exceptions: [{ date: '2026-10-31', added: false }],
          },
          {
            serviceId: 'NIGHT',
            weekdays: [true, true, true, true, true, true, true],
            startDate: '2026-10-01',
            endDate: '2026-12-31',
            exceptions: [],
          },
        ],
        runs: [
          trip('T1', '10001'), // A -> B -> C, through B at 08:30
          trip('T2', '10002'), // B -> C only: starts at B at 09:00
          trip('T3', '10003'), // C -> B: arrives at B 08:03, terminates there
          trip('T4', '10004'), // through B at 11:00: outside the 2h window
          trip('T5', '10005', 'NOT_TODAY'), // not running on 2026-10-31
          trip('T6', '10006', 'NIGHT'), // yesterday's service, past midnight: at B 08:10 on the 31st
        ],
        stops: [
          stop('T1', 0, 'A', 28_800 - 600),
          stop('T1', 1, 'B', 30_600),
          stop('T1', 2, 'C', 32_400),
          stop('T2', 0, 'B', 32_400),
          stop('T2', 1, 'C', 34_200),
          stop('T3', 0, 'C', 27_000),
          stop('T3', 1, 'B', 29_000),
          stop('T4', 0, 'A', 36_000),
          stop('T4', 1, 'B', 39_600),
          stop('T4', 2, 'C', 41_000),
          stop('T5', 0, 'B', 30_000),
          stop('T5', 1, 'C', 31_000),
          stop('T6', 0, 'A', 80_000),
          stop('T6', 1, 'B', 115_800), // 86_400 + 29_400: 08:10 local on the 31st
          stop('T6', 2, 'C', 120_000),
        ],
        geometries: [],
      },
      { source: 'test', importedAt: NOW },
    );
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const board = async (path: string) => StationBoard.parse((await get(path).expect(200)).body);

  it('lists every Station with its coordinates', async () => {
    const result = StationList.parse((await get('/stations').expect(200)).body);
    expect(result).toEqual(
      ['A', 'B', 'C'].map((code) => ({ code, name: `Station ${code}`, lat: 40, lon: -3 })),
    );
  });

  it('answers 404 for an unknown Station', async () => {
    await get('/stations/ZZZ/board').expect(404);
  });

  it.each([
    '/stations/B/board?type=sideways',
    '/stations/B/board?from=yesterday',
    '/stations/B/board?extra=1',
  ])('answers 400 to %s', async (path) => {
    await get(path).expect(400);
  });

  it('lists the next 2 hours of departures and arrivals in order', async () => {
    const result = await board('/stations/B/board');

    expect(result.stationName).toBe('Station B');
    expect(result.departures.map((e) => e.trainNumber)).toEqual(['10006', '10001', '10002']);
    expect(result.arrivals.map((e) => e.trainNumber)).toEqual(['10003', '10006', '10001']);
    expect(result.departures[1]).toMatchObject({
      trainNumber: '10001',
      serviceDate: '2026-10-31',
      lineCode: 'C1',
      serviceType: 'cercanias',
      counterpartStationCode: 'C',
      scheduledAt: '2026-10-31T07:31:00.000Z',
    });
    expect(result.arrivals[2]).toMatchObject({
      counterpartStationCode: 'A',
      scheduledAt: '2026-10-31T07:30:00.000Z',
    });
  });

  it('leaves out terminating Runs from departures and originating Runs from arrivals', async () => {
    const result = await board('/stations/B/board');
    expect(result.departures.map((e) => e.trainNumber)).not.toContain('10003');
    expect(result.arrivals.map((e) => e.trainNumber)).not.toContain('10002');
  });

  it('skips Runs whose service does not operate on that date', async () => {
    const result = await board('/stations/B/board');
    const all = [...result.departures, ...result.arrivals].map((e) => e.trainNumber);
    expect(all).not.toContain('10005');
    expect(all).not.toContain('10004');
  });

  it('honours type and from', async () => {
    const departures = await board('/stations/B/board?type=departures');
    expect(departures.arrivals).toEqual([]);
    expect(departures.departures).not.toHaveLength(0);

    const later = await board('/stations/B/board?type=departures&from=2026-10-31T09:30:00%2B01:00');
    expect(later.departures.map((e) => e.trainNumber)).toEqual(['10004']);
  });

  it('adds the current Delay to estimated times', async () => {
    await movement.touchRuns(
      [
        createRun({
          id: createRunId('10001', '2026-10-31'),
          serviceType: 'cercanias',
          lineCode: 'C1',
        }),
      ],
      NOW,
    );
    await movement.saveDelays([
      createDelay({
        runId: createRunId('10001', '2026-10-31'),
        source: 'gtfsrt_cercanias',
        observedAt: NOW,
        seconds: 300,
      }),
    ]);
    const result = await board('/stations/B/board?type=departures');
    const entry = result.departures.find((e) => e.trainNumber === '10001');
    expect(entry).toMatchObject({
      delaySeconds: 300,
      scheduledAt: '2026-10-31T07:31:00.000Z',
      estimatedAt: '2026-10-31T07:36:00.000Z',
    });
    expect(result.departures.find((e) => e.trainNumber === '10002')?.delaySeconds).toBeUndefined();
  });

  it('prefers stored Visor estimates for the Station', async () => {
    const runId = createRunId('10002', '2026-10-31');
    await movement.replaceStopEstimates([
      createRunStopEstimate({
        runId,
        sequence: 0,
        stationCode: 'B',
        scheduledArrival: new Date('2026-10-31T08:00:00Z'),
        scheduledDeparture: new Date('2026-10-31T08:01:00Z'),
        estimatedArrival: new Date('2026-10-31T08:10:00Z'),
        estimatedDeparture: new Date('2026-10-31T08:11:00Z'),
      }),
    ]);
    const result = await board('/stations/B/board?type=departures');
    expect(result.departures.find((e) => e.trainNumber === '10002')?.estimatedAt).toBe(
      '2026-10-31T08:11:00.000Z',
    );
  });

  it('flags cancelled Runs', async () => {
    await movement.touchRuns(
      [
        createRun({
          id: createRunId('10001', '2026-10-31'),
          serviceType: 'cercanias',
          lineCode: 'C1',
          status: 'cancelled',
        }),
      ],
      NOW,
    );
    const result = await board('/stations/B/board');
    expect(result.departures.find((e) => e.trainNumber === '10001')?.serviceStatus).toBe(
      'cancelled',
    );
    expect(result.departures.find((e) => e.trainNumber === '10002')?.serviceStatus).toBeUndefined();
  });
});
