import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DelayByHour, PunctualityRanking } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withRefreshRetry } from '../../../test/support/refresh-aggregate.js';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import {
  GetDelayByHour,
  GetPunctualityRanking,
} from '../../application/punctuality/get-punctuality.use-case.js';
import { DrizzlePunctualityReader } from '../db/drizzle-punctuality.reader.js';
import { PunctualityController } from './punctuality.controller.js';

// 2026-10-31 is CET (UTC+1) after the clock change on the 25th.
const NOW = new Date('2026-10-31T12:00:00Z');

let nextTrain = 1000;
/** One Run on `lineCode` with a Delay per entry of `delays`, all observed at `observedAt`. */
async function observe(
  db: TestDatabase,
  lineCode: string,
  observedAt: string,
  delays: number[],
): Promise<void> {
  for (const seconds of delays) {
    const trainNumber = String(nextTrain++);
    const serviceDate = observedAt.slice(0, 10);
    await db.sql`
      INSERT INTO runs (train_number, service_date, service_type, line_code, last_seen_at)
      VALUES (${trainNumber}, ${serviceDate}, 'cercanias', ${lineCode}, now())`;
    await db.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
      VALUES (${trainNumber}, ${serviceDate}, 'gtfsrt_ld', ${observedAt}, ${seconds})`;
  }
}

/** One Run on `lineCode` observed at `observedAt` with `delays` in order; the last is its final Delay. */
async function runWithDelays(
  db: TestDatabase,
  lineCode: string,
  observedAt: string,
  delays: number[],
  status: string | null = null,
): Promise<void> {
  const trainNumber = String(nextTrain++);
  const serviceDate = observedAt.slice(0, 10);
  await db.sql`
    INSERT INTO runs (train_number, service_date, service_type, line_code, status, last_seen_at)
    VALUES (${trainNumber}, ${serviceDate}, 'cercanias', ${lineCode}, ${status}, now())`;
  for (const [index, seconds] of delays.entries()) {
    const at = new Date(Date.parse(observedAt) + index * 60_000).toISOString();
    await db.sql`
      INSERT INTO delays (train_number, service_date, source, observed_at, seconds)
      VALUES (${trainNumber}, ${serviceDate}, 'gtfsrt_ld', ${at}, ${seconds})`;
  }
}

describe('punctuality endpoints', () => {
  let testDb: TestDatabase;

  const refresh = async () => {
    for (const aggregate of ['delay_stats_hourly', 'run_final_delays']) {
      await withRefreshRetry(() =>
        testDb.sql.unsafe(
          `CALL refresh_continuous_aggregate('${aggregate}', '2026-10-01', '2026-11-30')`,
        ),
      );
    }
  };
  let app: INestApplication;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const reader = new DrizzlePunctualityReader(testDb.db);
    const moduleRef = await Test.createTestingModule({
      controllers: [PunctualityController],
      providers: [
        {
          provide: GetPunctualityRanking,
          useValue: new GetPunctualityRanking(reader, () => NOW, 3),
        },
        { provide: GetDelayByHour, useValue: new GetDelayByHour(reader, () => NOW) },
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
    await testDb.sql.unsafe('TRUNCATE delays, runs, lines, hubs CASCADE');
    await testDb.sql`INSERT INTO hubs (code, name) VALUES ('madrid', 'Madrid')`;
    await testDb.sql`
      INSERT INTO lines (code, name, service_type, hub_code) VALUES
        ('C1', 'C1 Príncipe Pío', 'cercanias', 'madrid'),
        ('C2', 'C2 Guadalajara', 'cercanias', 'madrid'),
        ('C3', 'C3 Rarely seen', 'cercanias', 'madrid')`;
    nextTrain = 1000;
    // The aggregate keeps earlier tests' buckets until refreshed over the emptied table.
    await refresh();
  });

  describe('GET /stats/punctuality', () => {
    it('ranks Lines by Runs, each counted once by its final Delay, and leaves out Lines with too few Runs', async () => {
      // C1: 3 of 4 Runs finish on time; C2: 1 of 3; C3: 2 Runs only. Early observations do not matter.
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [900, 400, 0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [60]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [-120]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0, 900]);
      await runWithDelays(testDb, 'C2', '2026-10-30T08:10:00Z', [600]);
      await runWithDelays(testDb, 'C2', '2026-10-30T08:10:00Z', [900]);
      await runWithDelays(testDb, 'C2', '2026-10-30T08:10:00Z', [120]);
      await runWithDelays(testDb, 'C3', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C3', '2026-10-30T08:10:00Z', [0]);
      await refresh();

      const res = await request(app.getHttpServer()).get('/stats/punctuality').expect(200);
      const body = PunctualityRanking.parse(res.body);

      expect(body.days).toBe(7);
      expect(body.lines.map((l) => l.lineCode)).toEqual(['C2', 'C1']);
      expect(body.lines[0]).toMatchObject({
        lineCode: 'C2',
        name: 'C2 Guadalajara',
        serviceType: 'cercanias',
        hubCode: 'madrid',
        runs: 3,
      });
      expect(body.lines[0]?.onTimePct).toBeCloseTo(33.3, 1);
      expect(body.lines[0]?.avgSeconds).toBeCloseTo(540, 5);
      expect(body.lines[1]).toMatchObject({ runs: 4, onTimePct: 75 });
      expect(body.overall?.runs).toBe(7);
      expect(body.overall?.onTimePct).toBeCloseTo((100 * 4) / 7, 5);
    });

    it('leaves out cancelled Runs', async () => {
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [900], 'cancelled');
      await refresh();

      const res = await request(app.getHttpServer()).get('/stats/punctuality').expect(200);
      expect(res.body.lines[0]).toMatchObject({ runs: 3, onTimePct: 100 });
    });

    it('only counts Runs whose Service date is inside the requested window', async () => {
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-30T08:10:00Z', [0]);
      await runWithDelays(testDb, 'C1', '2026-10-10T08:10:00Z', [900]);
      await runWithDelays(testDb, 'C1', '2026-10-10T08:10:00Z', [900]);
      await runWithDelays(testDb, 'C1', '2026-10-10T08:10:00Z', [900]);
      await refresh();

      const week = await request(app.getHttpServer()).get('/stats/punctuality').expect(200);
      expect(week.body.lines[0]).toMatchObject({ runs: 3, onTimePct: 100 });
      const month = await request(app.getHttpServer())
        .get('/stats/punctuality?days=30')
        .expect(200);
      expect(month.body).toMatchObject({ days: 30 });
      expect(month.body.lines[0]).toMatchObject({ runs: 6, onTimePct: 50 });
    });

    it('is empty when nothing was observed', async () => {
      const res = await request(app.getHttpServer()).get('/stats/punctuality').expect(200);
      expect(res.body).toEqual({ days: 7, overall: null, lines: [] });
    });

    it.each(['days=0', 'days=91', 'days=abc', 'foo=1'])('rejects ?%s with 400', async (qs) => {
      await request(app.getHttpServer()).get(`/stats/punctuality?${qs}`).expect(400);
    });
  });

  describe('GET /stats/delay-by-hour', () => {
    it('pools Delays by Madrid hour of day, with all 24 hours present', async () => {
      // 08:10Z = 09:10 Madrid (CET); 07:30Z = 08:30 Madrid.
      await observe(testDb, 'C1', '2026-10-30T08:10:00Z', [0, 600]);
      await observe(testDb, 'C2', '2026-10-29T08:40:00Z', [1200]);
      await observe(testDb, 'C1', '2026-10-30T07:30:00Z', [60]);
      await refresh();

      const res = await request(app.getHttpServer()).get('/stats/delay-by-hour').expect(200);
      const body = DelayByHour.parse(res.body);

      expect(body.days).toBe(7);
      expect(body.lineCode).toBeUndefined();
      expect(body.hours.map((h) => h.hour)).toEqual([...Array(24).keys()]);
      expect(body.hours[8]).toEqual({ hour: 8, observations: 1, avgSeconds: 60, onTimePct: 100 });
      expect(body.hours[9]?.observations).toBe(3);
      expect(body.hours[9]?.avgSeconds).toBeCloseTo(600, 5);
      expect(body.hours[9]?.onTimePct).toBeCloseTo(33.3, 1);
      expect(body.hours[3]).toEqual({
        hour: 3,
        observations: 0,
        avgSeconds: null,
        onTimePct: null,
      });
    });

    it('can be narrowed to one Line', async () => {
      await observe(testDb, 'C1', '2026-10-30T08:10:00Z', [0, 0]);
      await observe(testDb, 'C2', '2026-10-30T08:10:00Z', [1200]);
      await refresh();

      const res = await request(app.getHttpServer())
        .get('/stats/delay-by-hour?line=C1')
        .expect(200);
      expect(res.body.lineCode).toBe('C1');
      expect(res.body.hours[9]).toMatchObject({ observations: 2, avgSeconds: 0, onTimePct: 100 });
    });

    it.each(['days=0', 'line=', 'foo=1'])('rejects ?%s with 400', async (qs) => {
      await request(app.getHttpServer()).get(`/stats/delay-by-hour?${qs}`).expect(400);
    });
  });
});
