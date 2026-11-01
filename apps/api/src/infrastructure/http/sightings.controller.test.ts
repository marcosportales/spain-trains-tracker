import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SightingWindow } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetSightingWindow } from '../../application/sighting-window/get-sighting-window.use-case.js';
import { DrizzleSightingWindowReader } from '../db/drizzle-sighting-window.reader.js';
import { SightingsController } from './sightings.controller.js';

const DAY = '2026-10-31';
const at = (time: string) => `${DAY}T${time}Z`;
const URL = `/sightings?from=${at('08:00:00')}&to=${at('09:00:00')}`;

async function sight(
  db: TestDatabase,
  trainNumber: string,
  time: string,
  extra: { source?: string; lat?: number | null; lon?: number | null } = {},
): Promise<void> {
  const lat = extra.lat === undefined ? 40.4 : extra.lat;
  const lon = extra.lon === undefined ? -3.7 : extra.lon;
  await db.sql`
    INSERT INTO sightings (train_number, service_date, source, observed_at, lat, lon, status, position_is_snapped)
    VALUES (${trainNumber}, ${DAY}, ${extra.source ?? 'official'}, ${at(time)}, ${lat}, ${lon}, 'in_transit_to', false)`;
}

describe('GET /sightings', () => {
  let testDb: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      controllers: [SightingsController],
      providers: [
        {
          provide: GetSightingWindow,
          useValue: new GetSightingWindow(new DrizzleSightingWindowReader(testDb.db)),
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
    await testDb.sql.unsafe('TRUNCATE sightings CASCADE');
  });

  it('returns the Sightings in the window, oldest first', async () => {
    await sight(testDb, '03063', '08:30:00');
    await sight(testDb, '03064', '08:10:00');
    await sight(testDb, '03063', '07:59:59'); // before the window
    await sight(testDb, '03063', '09:00:00'); // `to` is exclusive

    const res = await request(app.getHttpServer()).get(URL).expect(200);
    const body = SightingWindow.parse(res.body);

    expect(body).toMatchObject({ stepSeconds: 60 });
    expect(body.sightings.map((s) => [s.trainNumber, s.observedAt])).toEqual([
      ['03064', '2026-10-31T08:10:00.000Z'],
      ['03063', '2026-10-31T08:30:00.000Z'],
    ]);
  });

  it('keeps the earliest Sighting per Run and Source in each step', async () => {
    await sight(testDb, '03063', '08:00:05');
    await sight(testDb, '03063', '08:00:40'); // same minute: dropped
    await sight(testDb, '03063', '08:01:10');
    await sight(testDb, '03063', '08:00:20', { source: 'visor' }); // other Source: kept

    const res = await request(app.getHttpServer()).get(URL).expect(200);
    expect(
      res.body.sightings.map((s: { source: string; observedAt: string }) => [
        s.source,
        s.observedAt.slice(11, 19),
      ]),
    ).toEqual([
      ['official', '08:00:05'],
      ['visor', '08:00:20'],
      ['official', '08:01:10'],
    ]);
  });

  it('honours stepSeconds', async () => {
    await sight(testDb, '03063', '08:00:00');
    await sight(testDb, '03063', '08:01:00');
    await sight(testDb, '03063', '08:02:00');
    const res = await request(app.getHttpServer()).get(`${URL}&stepSeconds=600`).expect(200);
    expect(res.body.stepSeconds).toBe(600);
    expect(res.body.sightings).toHaveLength(1);
  });

  it('skips Sightings without a position', async () => {
    await sight(testDb, '03063', '08:00:00', { lat: null, lon: null });
    const res = await request(app.getHttpServer()).get(URL).expect(200);
    expect(res.body.sightings).toEqual([]);
  });

  it('filters by Train number, with or without leading zeros', async () => {
    await sight(testDb, '03063', '08:00:00');
    await sight(testDb, '03064', '08:00:00');
    const res = await request(app.getHttpServer()).get(`${URL}&trainNumber=3063`).expect(200);
    expect(res.body.sightings.map((s: { trainNumber: string }) => s.trainNumber)).toEqual([
      '03063',
    ]);
  });

  it.each([
    ['missing from/to', '/sightings'],
    ['reversed window', `/sightings?from=${at('09:00:00')}&to=${at('08:00:00')}`],
    ['empty window', `/sightings?from=${at('08:00:00')}&to=${at('08:00:00')}`],
    ['window over 6 hours', `/sightings?from=${at('00:00:00')}&to=${at('06:00:01')}`],
    ['bad date', '/sightings?from=yesterday&to=today'],
    ['step too small', `${URL}&stepSeconds=5`],
    ['step too large', `${URL}&stepSeconds=3601`],
    ['bad Train number', `${URL}&trainNumber=abc`],
    ['all-zero Train number', `${URL}&trainNumber=000`],
    ['unknown parameter', `${URL}&foo=1`],
  ])('rejects %s with 400', async (_name, url) => {
    await request(app.getHttpServer()).get(url).expect(400);
  });
});
