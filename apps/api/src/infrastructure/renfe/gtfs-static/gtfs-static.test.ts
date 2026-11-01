import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { readGtfsRows } from './gtfs-static.js';

const fixtures = fileURLToPath(
  new URL('../../../../test/fixtures/2026-10-31/static/', import.meta.url),
);

async function zipDirectory(directory: string, zipPath: string): Promise<void> {
  const zip = new ZipFile();
  for (const name of await readdir(directory)) {
    zip.addFile(join(directory, name), name);
  }
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(zipPath));
}

async function collect<T>(rows: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const row of rows) all.push(row);
  return all;
}

let workDir: string;
let cercanias: string;
let largaDistancia: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'gtfs-static-'));
  cercanias = join(workDir, 'cercanias.zip');
  largaDistancia = join(workDir, 'larga-distancia.zip');
  await zipDirectory(join(fixtures, 'cercanias'), cercanias);
  await zipDirectory(join(fixtures, 'larga-distancia'), largaDistancia);
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe.each([
  ['Cercanías', () => cercanias],
  ['Larga Distancia', () => largaDistancia],
])('%s feed', (_name, zipPath) => {
  it('trims padded values so trips join to their routes', async () => {
    const routes = await collect(readGtfsRows(zipPath(), 'routes'));
    const trips = await collect(readGtfsRows(zipPath(), 'trips'));

    const routeIds = new Set(routes.map((route) => route.route_id));
    expect(trips.length).toBeGreaterThan(0);
    for (const trip of trips) {
      expect(routeIds).toContain(trip.route_id);
    }
  });

  it('leaves no value with surrounding whitespace in any file', async () => {
    const files = ['agency', 'routes', 'stops', 'trips', 'stop_times'] as const;
    for (const file of files) {
      const rows = await collect(readGtfsRows(zipPath(), file));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string') expect(value).toBe(value.trim());
        }
      }
    }
  });
});

describe('typed rows', () => {
  it('trims the padding around Cercanías route fields', async () => {
    const [first] = await collect(readGtfsRows(cercanias, 'routes'));
    expect(first).toMatchObject({
      route_id: '10T0001C1',
      route_short_name: 'C1',
      route_long_name: 'Principe Pio                            -Aeropuerto-T4',
      route_type: 2,
    });
  });

  it('converts numeric fields and leaves empty optional fields undefined', async () => {
    const [first] = await collect(readGtfsRows(largaDistancia, 'stops'));
    expect(first?.stop_lat).toBeCloseTo(40.4711789);
    expect(first?.stop_lon).toBeCloseTo(-3.6829524);
    expect(first?.stop_code).toBeUndefined();
    expect(first?.wheelchair_boarding).toBe(1);
  });

  it('parses stop_sequence as a number and keeps times as strings', async () => {
    const [first] = await collect(readGtfsRows(largaDistancia, 'stop_times'));
    expect(first).toMatchObject({
      arrival_time: '8:30:00',
      stop_sequence: 1,
    });
  });

  it('parses calendar flags as booleans', async () => {
    const [first] = await collect(readGtfsRows(cercanias, 'calendar'));
    expect(first).toMatchObject({
      service_id: '1003S',
      saturday: true,
      monday: false,
      start_date: '20261031',
    });
  });

  it('parses shapes and calendar_dates where the feed has them', async () => {
    const [shape] = await collect(readGtfsRows(cercanias, 'shapes'));
    expect(shape).toMatchObject({ shape_id: '40_C6', shape_pt_sequence: 1 });
    const [exception] = await collect(readGtfsRows(largaDistancia, 'calendar_dates'));
    expect(exception).toMatchObject({ date: '20261107', exception_type: 2 });
  });
});

describe('missing files', () => {
  it('yields no rows for optional files absent from the zip', async () => {
    expect(await collect(readGtfsRows(largaDistancia, 'shapes'))).toEqual([]);
    expect(await collect(readGtfsRows(cercanias, 'calendar_dates'))).toEqual([]);
  });

  it('throws for required files absent from the zip', async () => {
    const empty = join(workDir, 'empty.zip');
    const zip = new ZipFile();
    zip.end();
    await pipeline(zip.outputStream, createWriteStream(empty));
    await expect(collect(readGtfsRows(empty, 'routes'))).rejects.toThrow(/routes\.txt/);
  });
});
