/**
 * Records a set of Renfe feed fixtures into apps/api/test/fixtures/<date>/.
 *
 * Usage: node scripts/record-fixtures.ts [--rows=50]
 * Requires the `unzip` binary (static GTFS zips are large; only the first rows are kept).
 */
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildManifestEntry,
  fixtureDirName,
  type ManifestEntry,
  trimDelimitedText,
} from './fixtures.ts';

const execFileAsync = promisify(execFile);

const GTFSRT = 'https://gtfsrt.renfe.com';
const REALTIME_FEEDS: Record<string, string> = {
  'vehicle_positions.pb': `${GTFSRT}/vehicle_positions.pb`,
  'vehicle_positions_LD.pb': `${GTFSRT}/vehicle_positions_LD.pb`,
  'trip_updates.pb': `${GTFSRT}/trip_updates.pb`,
  'trip_updates_LD.pb': `${GTFSRT}/trip_updates_LD.pb`,
  'alerts.pb': `${GTFSRT}/alerts.pb`,
  'flotaLD.json': 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json',
  'flota.json': 'https://tiempo-real.renfe.com/renfe-visor/flota.json',
  'trenesConEstacionesLD.json':
    'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json',
};

const STATIC_ZIPS: Record<string, string> = {
  cercanias: 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip',
  'larga-distancia': 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
};
const STATIONS_URL = 'https://ssl.renfe.com/ftransit/Fichero_estaciones/estaciones.csv';

const outRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/api/test/fixtures');

async function download(url: string): Promise<{ response: Response; body: Buffer }> {
  const response = await fetch(url, { headers: { 'user-agent': 'spain-trains-tracker-fixtures' } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return { response, body: Buffer.from(await response.arrayBuffer()) };
}

async function listZip(zipPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], { maxBuffer: 1 << 20 });
  return stdout.split('\n').filter((name) => name.endsWith('.txt'));
}

/** Stream one zip entry and stop reading once enough lines for `rows` data rows arrived. */
async function readZipHead(zipPath: string, entry: string, rows: number): Promise<string> {
  const child = spawn('unzip', ['-p', zipPath, entry], { stdio: ['ignore', 'pipe', 'ignore'] });
  const chunks: Buffer[] = [];
  let newlines = 0;
  for await (const chunk of child.stdout) {
    const buf = chunk as Buffer;
    chunks.push(buf);
    for (const byte of buf) if (byte === 0x0a) newlines++;
    if (newlines > rows) {
      child.kill();
      break;
    }
  }
  return trimDelimitedText(Buffer.concat(chunks).toString('latin1'), rows);
}

async function main() {
  const rowsArg = process.argv.find((arg) => arg.startsWith('--rows='));
  const rows = rowsArg ? Number(rowsArg.slice('--rows='.length)) : 50;
  if (!Number.isInteger(rows) || rows < 0) throw new Error('--rows must be a non-negative integer');

  const now = new Date();
  const dir = join(outRoot, fixtureDirName(now));
  await mkdir(dir, { recursive: true });
  const entries: ManifestEntry[] = [];
  const failures: string[] = [];

  async function save(
    file: string,
    url: string,
    fetchedAt: Date,
    response: Response,
    body: Buffer | string,
    rowLimit?: number,
  ) {
    const path = join(dir, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    const bytes = typeof body === 'string' ? Buffer.byteLength(body, 'latin1') : body.length;
    entries.push(buildManifestEntry({ file, url, response, fetchedAt, bytes, rowLimit }));
    console.log(`ok   ${file} (${bytes} B)`);
  }

  for (const [file, url] of Object.entries(REALTIME_FEEDS)) {
    try {
      const fetchedAt = new Date();
      const { response, body } = await download(url);
      await save(file, url, fetchedAt, response, body);
    } catch (error) {
      failures.push(`${file}: ${error}`);
      console.error(`FAIL ${file}: ${error}`);
    }
  }

  try {
    const fetchedAt = new Date();
    const { response, body } = await download(STATIONS_URL);
    const trimmed = trimDelimitedText(body.toString('latin1'), rows);
    await save(
      'static/estaciones.csv',
      STATIONS_URL,
      fetchedAt,
      response,
      Buffer.from(trimmed, 'latin1'),
      rows,
    );
  } catch (error) {
    failures.push(`estaciones.csv: ${error}`);
    console.error(`FAIL estaciones.csv: ${error}`);
  }

  const tmp = await mkdtemp(join(tmpdir(), 'stt-fixtures-'));
  try {
    for (const [name, url] of Object.entries(STATIC_ZIPS)) {
      try {
        const fetchedAt = new Date();
        const { response, body } = await download(url);
        const zipPath = join(tmp, `${name}.zip`);
        await writeFile(zipPath, body);
        for (const entry of await listZip(zipPath)) {
          const head = await readZipHead(zipPath, entry, rows);
          await save(
            `static/${name}/${entry}`,
            url,
            fetchedAt,
            response,
            Buffer.from(head, 'latin1'),
            rows,
          );
        }
      } catch (error) {
        failures.push(`${name}: ${error}`);
        console.error(`FAIL ${name}: ${error}`);
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(
    join(dir, 'manifest.json'),
    `${JSON.stringify({ recordedAt: now.toISOString(), entries }, null, 2)}\n`,
  );
  console.log(`\nWrote ${entries.length} files to ${dir}`);
  if (failures.length > 0) {
    console.error(`${failures.length} download(s) failed`);
    process.exitCode = 1;
  }
}

await main();
