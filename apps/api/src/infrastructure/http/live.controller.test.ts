import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LiveSnapshot } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetLiveSnapshot } from '../../application/live/get-live-snapshot.use-case.js';
import {
  createDelay,
  createRun,
  createRunId,
  createSighting,
  type Source,
} from '../../domain/movement/index.js';
import { DrizzleLiveRunsReader } from '../db/drizzle-live-runs.reader.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import * as t from '../db/schema/index.js';
import { LiveController } from './live.controller.js';

const NOW = new Date('2026-10-31T10:15:30Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('GET /live', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let movement: DrizzleMovementRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    movement = new DrizzleMovementRepository(testDb.db);
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveController],
      providers: [
        {
          provide: GetLiveSnapshot,
          useValue: new GetLiveSnapshot(
            new DrizzleLiveRunsReader(testDb.db),
            new DrizzleNetworkRepository(testDb.db),
            () => NOW,
          ),
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
      'TRUNCATE sightings, delays, runs, lines, hubs RESTART IDENTITY CASCADE',
    );
    await testDb.db.insert(t.hubs).values({ code: '10', name: 'Madrid' });
    await testDb.db.insert(t.lines).values([
      { code: '10-C1', name: 'C1 Madrid', serviceType: 'cercanias', hubCode: '10' },
      { code: 'AVE-MS', name: 'AVE Madrid-Sevilla', serviceType: 'ave' },
    ]);
  });

  async function seedRun(
    trainNumber: string,
    serviceType: 'ave' | 'cercanias',
    lineCode: string,
    ageMinutes: number,
    source: Source = 'gtfsrt_ld',
  ) {
    const id = createRunId(trainNumber, '2026-10-31');
    await movement.touchRuns([createRun({ id, serviceType, lineCode })], NOW);
    await movement.saveSightings([
      createSighting({
        runId: id,
        source,
        observedAt: minutesAgo(ageMinutes),
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
        stationCode: '60000',
      }),
    ]);
    return id;
  }

  async function seed() {
    const ave = await seedRun('3063', 'ave', 'AVE-MS', 1);
    await seedRun('100', 'cercanias', '10-C1', 2, 'gtfsrt_cercanias');
    await seedRun('200', 'cercanias', '10-C1', 10); // too old
    await movement.saveDelays([
      createDelay({ runId: ave, source: 'gtfsrt_ld', observedAt: minutesAgo(1), seconds: 90 }),
    ]);
  }

  const get = (query = '') => request(app.getHttpServer()).get(`/live${query}`);

  it('returns the Runs seen in the last 3 minutes, valid against the contract', async () => {
    await seed();
    const res = await get().expect(200);
    const snapshot = LiveSnapshot.parse(res.body);
    expect(snapshot.runs.map((r) => r.trainNumber)).toEqual(['00100', '03063']);
    expect(snapshot.runs.find((r) => r.trainNumber === '03063')).toMatchObject({
      serviceType: 'ave',
      lineCode: 'AVE-MS',
      delaySeconds: 90,
      sources: ['official'],
    });
  });

  it('returns an empty snapshot when nothing is live', async () => {
    const res = await get().expect(200);
    expect(res.body.runs).toEqual([]);
  });

  it('keeps one Run when two Sources report it', async () => {
    await seedRun('3063', 'ave', 'AVE-MS', 1, 'gtfsrt_ld');
    await seedRun('3063', 'ave', 'AVE-MS', 2, 'visor_ld');
    const res = await get().expect(200);
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0].sources).toEqual(['official', 'visor']);
  });

  it('filters by serviceType, hub and line, combined with AND', async () => {
    await seed();
    const trains = async (q: string) =>
      (await get(q).expect(200)).body.runs.map((r: { trainNumber: string }) => r.trainNumber);
    expect(await trains('?serviceType=ave')).toEqual(['03063']);
    expect(await trains('?hub=10')).toEqual(['00100']);
    expect(await trains('?line=AVE-MS')).toEqual(['03063']);
    expect(await trains('?serviceType=cercanias&hub=10&line=10-C1')).toEqual(['00100']);
    expect(await trains('?serviceType=ave&hub=10')).toEqual([]);
  });

  it.each(['?serviceType=tram', '?hub=99', '?hub=Not%20A%20Slug', '?line=NOPE', '?colour=red'])(
    'answers 400 to %s',
    async (query) => {
      await get(query).expect(400);
    },
  );
});
