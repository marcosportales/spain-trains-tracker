import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TrainHistory } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetTrainHistory } from '../../application/train-history/get-train-history.use-case.js';
import { DrizzleTrainHistoryReader } from '../db/drizzle-train-history.reader.js';
import { TrainHistoryController } from './train-history.controller.js';

const NOW = new Date('2026-10-31T12:00:00Z');

/** One Run of `trainNumber` on `serviceDate`, with one Delay observation per entry of `delays`. */
async function observe(
  db: TestDatabase,
  trainNumber: string,
  serviceDate: string,
  delays: number[],
): Promise<void> {
  await db.sql`
    INSERT INTO runs (train_number, service_date, service_type, last_seen_at)
    VALUES (${trainNumber}, ${serviceDate}, 'ave', now())`;
  for (const [i, seconds] of delays.entries()) {
    const observedAt = new Date(`${serviceDate}T08:00:00Z`).getTime() + i * 60_000;
    await db.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
      VALUES (${trainNumber}, ${serviceDate}, 'gtfsrt_ld', ${new Date(observedAt).toISOString()}, ${seconds})`;
  }
}

describe('GET /trains/:trainNumber/history', () => {
  let testDb: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      controllers: [TrainHistoryController],
      providers: [
        {
          provide: GetTrainHistory,
          useValue: new GetTrainHistory(new DrizzleTrainHistoryReader(testDb.db), () => NOW),
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
    await testDb.sql.unsafe('TRUNCATE delays, runs CASCADE');
  });

  it('lists the Runs of a Train number newest first, with a typical Delay', async () => {
    await observe(testDb, '03063', '2026-10-29', [0, 120]); // avg 60, max 120: on time
    await observe(testDb, '03063', '2026-10-30', [600, 1200]); // avg 900, max 1200: late
    await observe(testDb, '03063', '2026-10-31', [300, 600, 900]); // avg 600, max 900: late
    await observe(testDb, '03064', '2026-10-30', [5000]); // another Train number

    const res = await request(app.getHttpServer()).get('/trains/03063/history').expect(200);
    const body = TrainHistory.parse(res.body);

    expect(body).toMatchObject({ trainNumber: '03063', days: 30 });
    expect(body.runs).toEqual([
      { serviceDate: '2026-10-31', observations: 3, avgSeconds: 600, maxSeconds: 900 },
      { serviceDate: '2026-10-30', observations: 2, avgSeconds: 900, maxSeconds: 1200 },
      { serviceDate: '2026-10-29', observations: 2, avgSeconds: 60, maxSeconds: 120 },
    ]);
    expect(body.summary).toEqual({ runs: 3, typicalSeconds: 600, onTimePct: (100 * 1) / 3 });
  });

  it('accepts a Train number without its leading zeros', async () => {
    await observe(testDb, '03063', '2026-10-30', [60]);
    const res = await request(app.getHttpServer()).get('/trains/3063/history').expect(200);
    expect(res.body.trainNumber).toBe('03063');
    expect(res.body.runs).toHaveLength(1);
  });

  it('only counts Runs inside the requested window', async () => {
    await observe(testDb, '03063', '2026-10-30', [60]);
    await observe(testDb, '03063', '2026-09-01', [900]);

    const month = await request(app.getHttpServer()).get('/trains/03063/history').expect(200);
    expect(month.body.runs).toHaveLength(1);
    const quarter = await request(app.getHttpServer())
      .get('/trains/03063/history?days=90')
      .expect(200);
    expect(quarter.body).toMatchObject({ days: 90 });
    expect(quarter.body.runs).toHaveLength(2);
  });

  it('has no summary when the Train number was never observed', async () => {
    const res = await request(app.getHttpServer()).get('/trains/03063/history').expect(200);
    expect(res.body).toEqual({ trainNumber: '03063', days: 30, runs: [] });
  });

  it.each(['abc', '1234567', '123456', '000'])(
    'rejects Train number %s with 400',
    async (number) => {
      await request(app.getHttpServer()).get(`/trains/${number}/history`).expect(400);
    },
  );

  it.each(['days=0', 'days=91', 'days=abc', 'foo=1'])('rejects ?%s with 400', async (qs) => {
    await request(app.getHttpServer()).get(`/trains/03063/history?${qs}`).expect(400);
  });
});
