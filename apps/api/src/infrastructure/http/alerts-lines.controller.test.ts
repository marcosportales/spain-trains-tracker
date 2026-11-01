import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LineDto, ServiceAlertDto, TrackFeatureCollection } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { ListServiceAlerts } from '../../application/alert/list-service-alerts.use-case.js';
import { GetLinesGeometry, ListLines } from '../../application/line/lines.js';
import { createServiceAlert } from '../../domain/movement/index.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { AlertsController } from './alerts.controller.js';
import { LinesController } from './lines.controller.js';

const NOW = new Date('2026-10-31T12:00:00Z');
/** A winding path of about `points` vertices, ~15 m apart, with sub-metre GPS jitter. */
function windingPath(points: number, lat0: number, lon0: number): [number, number][] {
  return Array.from({ length: points }, (_, i) => [
    lon0 + i * 0.00015 + Math.sin(i * 12.9898) * 0.000002,
    lat0 + 0.05 * Math.sin(i / 700) + Math.sin(i * 78.233) * 0.000002,
  ]);
}

describe('GET /alerts and GET /lines', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let movement: DrizzleMovementRepository;
  let rawMadridPoints: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    movement = new DrizzleMovementRepository(testDb.db);
    const network = new DrizzleNetworkRepository(testDb.db);

    const madridLines = Array.from({ length: 10 }, (_, i) => `10-C${i + 1}`);
    await network.saveStaticNetwork(
      {
        hubs: [
          { code: '10', name: 'Madrid' },
          { code: '40', name: 'Valencia' },
        ],
        stations: [],
        lines: [
          ...madridLines.map((code) => ({
            code,
            name: code,
            serviceType: 'cercanias' as const,
            hubCode: '10',
          })),
          { code: '40-C6', name: 'C6', serviceType: 'cercanias' as const, hubCode: '40' },
          { code: 'AVE-1', name: 'AVE Madrid–Sevilla', serviceType: 'ave' as const },
        ],
        calendars: [],
        runs: [],
        stops: [],
        // A dense Madrid network: raw, it is far above 2 MB.
        geometries: [
          ...madridLines.flatMap((lineCode, l) =>
            [0, 1, 2].map((shape) => ({
              shapeId: `${lineCode}-${shape}`,
              lineCode,
              path: windingPath(6_000, 40.2 + l * 0.01 + shape * 0.003, -3.9),
            })),
          ),
          { shapeId: '40-C6', lineCode: '40-C6', path: windingPath(50, 39.5, -0.5) },
          { shapeId: 'AVE-1', lineCode: 'AVE-1', path: windingPath(50, 38, -5) },
        ],
      },
      { source: 'test', importedAt: NOW },
    );
    rawMadridPoints = 10 * 3 * 6_000;

    const moduleRef = await Test.createTestingModule({
      controllers: [AlertsController, LinesController],
      providers: [
        { provide: ListServiceAlerts, useValue: new ListServiceAlerts(movement, () => NOW) },
        { provide: ListLines, useValue: new ListLines(network) },
        { provide: GetLinesGeometry, useValue: new GetLinesGeometry(network) },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const alert = (id: string, over: Partial<Parameters<typeof createServiceAlert>[0]> = {}) =>
    createServiceAlert({
      id,
      header: `Header ${id}`,
      description: `Description ${id}`,
      activePeriods: [],
      lineCodes: ['C1'],
      stationCodes: [],
      source: 'gtfsrt_cercanias',
      ...over,
    });

  describe('/alerts', () => {
    beforeEach(async () => {
      await testDb.sql.unsafe('TRUNCATE service_alerts');
      await movement.saveServiceAlerts([
        alert('a-open'),
        alert('a-current', {
          lineCodes: ['C1', 'C2'],
          activePeriods: [
            { start: new Date('2026-10-31T08:00:00Z'), end: new Date('2026-10-31T18:00:00Z') },
          ],
        }),
        alert('a-future', {
          lineCodes: ['C2'],
          activePeriods: [{ start: new Date('2026-11-02T08:00:00Z') }],
        }),
        alert('a-past', {
          activePeriods: [
            { start: new Date('2026-10-01T08:00:00Z'), end: new Date('2026-10-02T08:00:00Z') },
          ],
        }),
        alert('a-ended', { endedAt: new Date('2026-10-30T00:00:00Z') }),
        alert('a-stations-only', { lineCodes: [], stationCodes: ['A'] }),
      ]);
    });

    const ids = async (path: string) =>
      ServiceAlertDto.array()
        .parse((await get(path).expect(200)).body)
        .map((a) => a.id);

    it('lists every Service alert that names a Line', async () => {
      expect(await ids('/alerts')).toEqual([
        'a-current',
        'a-ended',
        'a-future',
        'a-open',
        'a-past',
      ]);
    });

    it('keeps only alerts in force now with active=true', async () => {
      expect(await ids('/alerts?active=true')).toEqual(['a-current', 'a-open']);
    });

    it('keeps only the other alerts with active=false', async () => {
      expect(await ids('/alerts?active=false')).toEqual(['a-ended', 'a-future', 'a-past']);
    });

    it('filters by Line', async () => {
      expect(await ids('/alerts?active=true&line=C2')).toEqual(['a-current']);
    });

    it('maps the active periods to activeFrom and activeUntil', async () => {
      const body = ServiceAlertDto.array().parse((await get('/alerts')).body);
      expect(body.find((a) => a.id === 'a-current')).toEqual({
        id: 'a-current',
        lineCodes: ['C1', 'C2'],
        header: 'Header a-current',
        description: 'Description a-current',
        activeFrom: '2026-10-31T08:00:00.000Z',
        activeUntil: '2026-10-31T18:00:00.000Z',
      });
      expect(body.find((a) => a.id === 'a-future')?.activeUntil).toBeUndefined();
    });

    it.each(['/alerts?active=maybe', '/alerts?extra=1', '/alerts?line='])(
      'answers 400 to %s',
      async (path) => {
        await get(path).expect(400);
      },
    );
  });

  describe('/lines', () => {
    const lines = async (path: string) => LineDto.array().parse((await get(path).expect(200)).body);

    it('lists Lines as LineDtos', async () => {
      const all = await lines('/lines');
      expect(all.length).toBeGreaterThan(0);
      expect(all.map((l) => l.lineCode)).toHaveLength(12);
      expect(all.map((l) => l.serviceType)).toEqual(expect.arrayContaining(['cercanias', 'ave']));
    });

    it('filters by Service type and Hub', async () => {
      const ld = await lines('/lines?serviceType=ave');
      expect(ld.length).toBeGreaterThan(0);
      expect(ld.every((l) => l.serviceType === 'ave')).toBe(true);

      const madrid = await lines('/lines?hub=10');
      expect(madrid.length).toBeGreaterThan(0);
      expect(madrid.every((l) => l.hubCode === '10')).toBe(true);
    });

    it.each(['/lines?hub=atlantis', '/lines?hub=NOPE!', '/lines?serviceType=bus', '/lines?x=1'])(
      'answers 400 to %s',
      async (path) => {
        await get(path).expect(400);
      },
    );
  });

  describe('/lines/geometry', () => {
    it('returns the Track geometry of a Hub as a cacheable FeatureCollection', async () => {
      const response = await get('/lines/geometry?hub=10').expect(200);
      expect(response.headers['cache-control']).toBe('public, max-age=86400');
      const collection = TrackFeatureCollection.parse(response.body);
      expect(collection.features.length).toBeGreaterThan(0);

      const madridLines = new Set(
        LineDto.array()
          .parse((await get('/lines?hub=10')).body)
          .map((l) => l.lineCode),
      );
      for (const feature of collection.features) {
        expect(madridLines.has(String(feature.properties.lineCode))).toBe(true);
        expect(feature.properties.shapeId).toEqual(expect.any(String));
      }
    });

    it('stays under 2 MB for the Madrid Hub', async () => {
      const response = await get('/lines/geometry?hub=10').expect(200);
      const bytes = Buffer.byteLength(JSON.stringify(response.body));
      expect(bytes).toBeLessThan(2 * 1024 * 1024);
      // Simplification is what keeps it small: the raw path would have been far bigger.
      expect(rawMadridPoints * 20).toBeGreaterThan(2 * 1024 * 1024);
    });

    it('covers every Line without a hub filter', async () => {
      const all = TrackFeatureCollection.parse((await get('/lines/geometry').expect(200)).body);
      const madrid = TrackFeatureCollection.parse(
        (await get('/lines/geometry?hub=10').expect(200)).body,
      );
      expect(all.features.length).toBeGreaterThan(madrid.features.length);
    });

    it.each(['/lines/geometry?hub=atlantis', '/lines/geometry?serviceType=cercanias'])(
      'answers 400 to %s',
      async (path) => {
        await get(path).expect(400);
      },
    );
  });
});
