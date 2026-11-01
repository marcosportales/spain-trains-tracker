import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZipFile } from 'yazl';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { DrizzleNetworkRepository } from '../../infrastructure/db/drizzle-network.repository.js';
import {
  HttpStaticFeeds,
  RENFE_STATIC_URLS,
} from '../../infrastructure/renfe/http-static-feeds.js';
import { ImportStaticNetwork } from './import-static-network.use-case.js';

const fixtures = fileURLToPath(
  new URL('../../../test/fixtures/2026-10-31/static/', import.meta.url),
);

async function zipDirectory(directory: string, zipPath: string): Promise<void> {
  const zip = new ZipFile();
  for (const name of await readdir(directory)) zip.addFile(join(directory, name), name);
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(zipPath));
}

const silent = { log() {}, warn() {}, error: (m: string) => console.error(m.slice(0, 80)) };

/** A fake Renfe server: serves the fixtures with ETags and honours `If-None-Match`. */
function fakeRenfe(files: Record<string, { body: Buffer; etag: string }>) {
  const requests: { url: string; ifNoneMatch: string | null }[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const file = files[url];
    const ifNoneMatch = new Headers(init?.headers).get('if-none-match');
    requests.push({ url, ifNoneMatch });
    if (!file) return new Response('not found', { status: 404 });
    if (ifNoneMatch === file.etag) return new Response(null, { status: 304 });
    return new Response(new Uint8Array(file.body), { headers: { ETag: file.etag } });
  }) as typeof fetch;
  return { fetchFn, requests };
}

let workDir: string;
let renfeFiles: Record<string, { body: Buffer; etag: string }>;
let testDb: TestDatabase;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'import-static-'));
  await zipDirectory(join(fixtures, 'cercanias'), join(workDir, 'cercanias.zip'));
  await zipDirectory(join(fixtures, 'larga-distancia'), join(workDir, 'larga-distancia.zip'));
  renfeFiles = {
    [RENFE_STATIC_URLS.cercanias]: {
      body: await readFile(join(workDir, 'cercanias.zip')),
      etag: '"cer-1"',
    },
    [RENFE_STATIC_URLS['larga-distancia']]: {
      body: await readFile(join(workDir, 'larga-distancia.zip')),
      etag: '"ld-1"',
    },
    [RENFE_STATIC_URLS.estaciones]: {
      body: await readFile(join(fixtures, 'estaciones.csv')),
      etag: '"est-1"',
    },
  };
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb?.close();
  await rm(workDir, { recursive: true, force: true });
});

describe('ImportStaticNetwork', () => {
  let repository: DrizzleNetworkRepository;
  let requests: ReturnType<typeof fakeRenfe>['requests'];
  let useCase: ImportStaticNetwork;

  beforeEach(async () => {
    for (const table of [
      'static_imports',
      'scheduled_stops',
      'scheduled_runs',
      'track_geometries',
      'service_calendar_dates',
      'service_calendars',
      'lines',
      'stations',
      'hubs',
    ]) {
      await testDb.sql.unsafe(`TRUNCATE ${table} CASCADE`);
    }
    repository = new DrizzleNetworkRepository(testDb.db);
    const renfe = fakeRenfe(renfeFiles);
    requests = renfe.requests;
    useCase = new ImportStaticNetwork(
      new HttpStaticFeeds({ fetch: renfe.fetchFn }),
      repository,
      silent,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('imports stations, Lines, scheduled Runs and stops from every source', async () => {
    const reports = await useCase.execute();

    expect(reports.map((r) => [r.source, r.status])).toEqual([
      ['estaciones', 'imported'],
      ['cercanias', 'imported'],
      ['larga-distancia', 'imported'],
    ]);
    const lines = await repository.listLines();
    expect(lines.map((l) => l.serviceType)).toEqual(
      expect.arrayContaining(['cercanias', 'larga_distancia']),
    );
    expect(await repository.listHubs()).not.toHaveLength(0);

    // Cercanías trip 1003S19799C1 is train number 19799 (service 1003S runs on 2026-10-31);
    // LD trips carry their Train number in trip_short_name.
    const [cercanias] = await repository.findScheduledRuns('19799', '2026-10-31');
    expect(cercanias).toMatchObject({
      tripId: '1003S19799C1',
      serviceType: 'cercanias',
      lineCode: '10-C1',
    });
    const [ld] = await repository.getScheduledStops('0019012026-11-03');
    expect(ld).toMatchObject({ sequence: 1, stationCode: '17000', arrivalSeconds: 8.5 * 3600 });
    // The same Train number can have several trip variants on a date (001901, 001902).
    const runs = await repository.findScheduledRuns('00190', '2026-11-03');
    expect(runs.map((run) => run.tripId)).toContain('0019012026-11-03');
  });

  it('writes nothing on a second run when every ETag is unchanged', async () => {
    await useCase.execute();
    const save = vi.spyOn(repository, 'saveStaticNetwork');
    requests.length = 0;

    const reports = await useCase.execute();

    expect(reports.every((r) => r.status === 'unchanged')).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(requests.map((r) => r.ifNoneMatch).sort()).toEqual(['"cer-1"', '"est-1"', '"ld-1"']);
  });

  it('re-imports only the source whose ETag changed', async () => {
    await useCase.execute();
    const save = vi.spyOn(repository, 'saveStaticNetwork');
    const key = RENFE_STATIC_URLS['larga-distancia'];
    const original = renfeFiles[key];
    if (!original) throw new Error('fixture missing');
    renfeFiles[key] = { ...original, etag: '"ld-2"' };
    try {
      const reports = await useCase.execute();
      expect(reports.map((r) => [r.source, r.status])).toEqual([
        ['estaciones', 'unchanged'],
        ['cercanias', 'unchanged'],
        ['larga-distancia', 'imported'],
      ]);
      expect(save).toHaveBeenCalledTimes(1);
      expect((await repository.lastStaticImport('larga-distancia'))?.etag).toBe('"ld-2"');
    } finally {
      renfeFiles[key] = original;
    }
  });

  it('reports a failing source and still imports the others', async () => {
    const broken = new HttpStaticFeeds({
      fetch: (async (input: string | URL | Request) =>
        String(input) === RENFE_STATIC_URLS.cercanias
          ? new Response('boom', { status: 500 })
          : fakeRenfe(renfeFiles).fetchFn(input)) as typeof fetch,
    });
    const reports = await new ImportStaticNetwork(broken, repository, silent).execute();

    expect(reports.map((r) => [r.source, r.status])).toEqual([
      ['estaciones', 'imported'],
      ['cercanias', 'failed'],
      ['larga-distancia', 'imported'],
    ]);
    expect(await repository.lastStaticImport('cercanias')).toBeUndefined();
  });

  it('knows whether any source was never imported', async () => {
    expect(await useCase.isMissingData()).toBe(true);
    await useCase.execute();
    expect(await useCase.isMissingData()).toBe(false);
  });
});
