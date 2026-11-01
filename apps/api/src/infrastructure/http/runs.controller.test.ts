import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RunDetail } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetRunDetail } from '../../application/run/get-run-detail.use-case.js';
import {
  createDelay,
  createRun,
  createRunId,
  createRunStopEstimate,
  createSighting,
} from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { DrizzleRunDetailReader } from '../db/drizzle-run-detail.reader.js';
import { RunsController } from './runs.controller.js';

const OBSERVED = new Date('2026-10-31T10:00:00Z');
const runId = createRunId('3063', '2026-10-31');

describe('GET /runs/:serviceDate/:trainNumber', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let movement: DrizzleMovementRepository;
  let network: DrizzleNetworkRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    movement = new DrizzleMovementRepository(testDb.db);
    network = new DrizzleNetworkRepository(testDb.db);
    const moduleRef = await Test.createTestingModule({
      controllers: [RunsController],
      providers: [
        {
          provide: GetRunDetail,
          useValue: new GetRunDetail(new DrizzleRunDetailReader(testDb.db), network),
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
        hubs: [],
        stations: ['60000', '51003', '71801'].map((code) => ({
          code,
          name: `Station ${code}`,
          lat: 40,
          lon: -3,
          serviceTypes: ['ave'],
        })),
        lines: [{ code: 'AVE-MS', name: 'AVE Madrid-Sevilla', serviceType: 'ave' }],
        calendars: [
          {
            serviceId: 'DAILY',
            weekdays: [true, true, true, true, true, true, true],
            startDate: '2026-10-01',
            endDate: '2026-12-31',
            exceptions: [],
          },
        ],
        runs: [
          {
            tripId: 'T1',
            trainNumber: '03063',
            lineCode: 'AVE-MS',
            serviceType: 'ave',
            serviceId: 'DAILY',
          },
        ],
        stops: [
          {
            tripId: 'T1',
            sequence: 0,
            stationCode: '60000',
            arrivalSeconds: 28_800,
            departureSeconds: 28_800,
          },
          {
            tripId: 'T1',
            sequence: 1,
            stationCode: '51003',
            arrivalSeconds: 36_000,
            departureSeconds: 36_300,
          },
          {
            tripId: 'T1',
            sequence: 2,
            stationCode: '71801',
            arrivalSeconds: 43_200,
            departureSeconds: 43_200,
          },
        ],
        geometries: [],
      },
      { source: 'test', importedAt: OBSERVED },
    );
  });

  async function seedRun() {
    await movement.touchRuns(
      [
        createRun({
          id: runId,
          serviceType: 'ave',
          lineCode: 'AVE-MS',
          wheelchairAccessible: true,
          rollingStock: '449013',
        }),
      ],
      OBSERVED,
    );
    await movement.saveSightings([
      createSighting({
        runId,
        source: 'gtfsrt_ld',
        observedAt: OBSERVED,
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
        stationCode: '51003',
      }),
    ]);
  }

  const get = (path: string) => request(app.getHttpServer()).get(path);

  it('answers 404 for an unknown Run', async () => {
    await get('/runs/2026-10-31/03063').expect(404);
  });

  it('answers 404 for a Run on another Service date', async () => {
    await seedRun();
    await get('/runs/2026-10-30/03063').expect(404);
  });

  it.each([
    '/runs/2026-13-45/03063',
    '/runs/yesterday/03063',
    '/runs/2026-10-31/abc',
    '/runs/2026-10-31/1234567',
  ])('answers 400 to %s', async (path) => {
    await get(path).expect(400);
  });

  it('estimates stop times from the schedule plus the Delay for a fixture Run', async () => {
    await seedRun();
    await movement.saveDelays([
      createDelay({ runId, source: 'gtfsrt_ld', observedAt: OBSERVED, seconds: 300 }),
    ]);

    const res = await get('/runs/2026-10-31/03063').expect(200);
    const detail = RunDetail.parse(res.body);

    expect(detail).toMatchObject({
      delaySeconds: 300,
      rollingStock: '449013',
      wheelchairAccessible: true,
      originStationCode: '60000',
      destinationStationCode: '71801',
      run: { trainNumber: '03063', lineCode: 'AVE-MS', nextStationCode: '51003' },
    });
    // 2026-10-31 is CET (UTC+1): 08:00 local = 07:00Z; 10:00 local = 09:00Z, leaving at 10:05.
    expect(detail.stops).toEqual([
      {
        stationCode: '60000',
        sequence: 0,
        scheduledArrival: '2026-10-31T07:00:00.000Z',
        scheduledDeparture: '2026-10-31T07:00:00.000Z',
        estimatedArrival: '2026-10-31T07:05:00.000Z',
        estimatedDeparture: '2026-10-31T07:05:00.000Z',
      },
      {
        stationCode: '51003',
        sequence: 1,
        scheduledArrival: '2026-10-31T09:00:00.000Z',
        scheduledDeparture: '2026-10-31T09:05:00.000Z',
        estimatedArrival: '2026-10-31T09:05:00.000Z',
        estimatedDeparture: '2026-10-31T09:10:00.000Z',
      },
      {
        stationCode: '71801',
        sequence: 2,
        scheduledArrival: '2026-10-31T11:00:00.000Z',
        scheduledDeparture: '2026-10-31T11:00:00.000Z',
        estimatedArrival: '2026-10-31T11:05:00.000Z',
        estimatedDeparture: '2026-10-31T11:05:00.000Z',
      },
    ]);
  });

  it('accepts a Train number without leading zeros', async () => {
    await seedRun();
    const res = await get('/runs/2026-10-31/3063').expect(200);
    expect(res.body.run.trainNumber).toBe('03063');
  });

  it('uses stored Visor estimates when present', async () => {
    await seedRun();
    await movement.replaceStopEstimates([
      createRunStopEstimate({
        runId,
        sequence: 0,
        stationCode: '60000',
        scheduledArrival: new Date('2026-10-31T07:00:00Z'),
        scheduledDeparture: new Date('2026-10-31T07:00:00Z'),
        estimatedArrival: new Date('2026-10-31T07:20:00Z'),
        estimatedDeparture: new Date('2026-10-31T07:20:00Z'),
      }),
    ]);
    const res = await get('/runs/2026-10-31/03063').expect(200);
    expect(res.body.stops).toHaveLength(1);
    expect(res.body.stops[0].estimatedDeparture).toBe('2026-10-31T07:20:00.000Z');
  });
});
