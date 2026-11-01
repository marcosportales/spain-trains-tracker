import { pipeline } from 'node:stream';
import { parse } from 'csv-parse';
import yauzl from 'yauzl';
import type { GtfsFileName, GtfsRows } from './gtfs-static.types.js';

export type * from './gtfs-static.types.js';

type RawRow = Record<string, string>;

/** Files a feed may legitimately omit (Larga Distancia has no shapes, Cercanías no calendar_dates). */
const OPTIONAL_FILES: ReadonlySet<GtfsFileName> = new Set(['calendar', 'calendar_dates', 'shapes']);

const text = (row: RawRow, key: string): string => row[key] ?? '';
const optText = (row: RawRow, key: string): string | undefined => row[key] || undefined;
const num = (row: RawRow, key: string): number => Number(row[key]);
const optNum = (row: RawRow, key: string): number | undefined =>
  row[key] ? Number(row[key]) : undefined;
const flag = (row: RawRow, key: string): boolean => row[key] === '1';

const MAPPERS: { [F in GtfsFileName]: (row: RawRow) => GtfsRows[F] } = {
  agency: (r) => ({
    agency_id: optText(r, 'agency_id'),
    agency_name: text(r, 'agency_name'),
    agency_url: text(r, 'agency_url'),
    agency_timezone: text(r, 'agency_timezone'),
    agency_lang: optText(r, 'agency_lang'),
    agency_phone: optText(r, 'agency_phone'),
  }),
  routes: (r) => ({
    route_id: text(r, 'route_id'),
    agency_id: optText(r, 'agency_id'),
    route_short_name: text(r, 'route_short_name'),
    route_long_name: text(r, 'route_long_name'),
    route_desc: optText(r, 'route_desc'),
    route_type: num(r, 'route_type'),
    route_url: optText(r, 'route_url'),
    route_color: optText(r, 'route_color'),
    route_text_color: optText(r, 'route_text_color'),
  }),
  stops: (r) => ({
    stop_id: text(r, 'stop_id'),
    stop_code: optText(r, 'stop_code'),
    stop_name: text(r, 'stop_name'),
    stop_desc: optText(r, 'stop_desc'),
    stop_lat: num(r, 'stop_lat'),
    stop_lon: num(r, 'stop_lon'),
    zone_id: optText(r, 'zone_id'),
    stop_url: optText(r, 'stop_url'),
    location_type: optNum(r, 'location_type'),
    parent_station: optText(r, 'parent_station'),
    stop_timezone: optText(r, 'stop_timezone'),
    wheelchair_boarding: optNum(r, 'wheelchair_boarding'),
  }),
  trips: (r) => ({
    route_id: text(r, 'route_id'),
    service_id: text(r, 'service_id'),
    trip_id: text(r, 'trip_id'),
    trip_headsign: optText(r, 'trip_headsign'),
    trip_short_name: optText(r, 'trip_short_name'),
    direction_id: optNum(r, 'direction_id'),
    block_id: optText(r, 'block_id'),
    shape_id: optText(r, 'shape_id'),
    wheelchair_accessible: optNum(r, 'wheelchair_accessible'),
  }),
  stop_times: (r) => ({
    trip_id: text(r, 'trip_id'),
    arrival_time: text(r, 'arrival_time'),
    departure_time: text(r, 'departure_time'),
    stop_id: text(r, 'stop_id'),
    stop_sequence: num(r, 'stop_sequence'),
    stop_headsign: optText(r, 'stop_headsign'),
    pickup_type: optNum(r, 'pickup_type'),
    drop_off_type: optNum(r, 'drop_off_type'),
    shape_dist_traveled: optNum(r, 'shape_dist_traveled'),
  }),
  calendar: (r) => ({
    service_id: text(r, 'service_id'),
    monday: flag(r, 'monday'),
    tuesday: flag(r, 'tuesday'),
    wednesday: flag(r, 'wednesday'),
    thursday: flag(r, 'thursday'),
    friday: flag(r, 'friday'),
    saturday: flag(r, 'saturday'),
    sunday: flag(r, 'sunday'),
    start_date: text(r, 'start_date'),
    end_date: text(r, 'end_date'),
  }),
  calendar_dates: (r) => ({
    service_id: text(r, 'service_id'),
    date: text(r, 'date'),
    exception_type: num(r, 'exception_type'),
  }),
  shapes: (r) => ({
    shape_id: text(r, 'shape_id'),
    shape_pt_lat: num(r, 'shape_pt_lat'),
    shape_pt_lon: num(r, 'shape_pt_lon'),
    shape_pt_sequence: num(r, 'shape_pt_sequence'),
    shape_dist_traveled: optNum(r, 'shape_dist_traveled'),
  }),
};

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
      if (error) reject(error);
      else resolve(zipFile);
    });
  });
}

function findEntry(zipFile: yauzl.ZipFile, entryName: string): Promise<yauzl.Entry | undefined> {
  return new Promise((resolve, reject) => {
    zipFile.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName === entryName) resolve(entry);
      else zipFile.readEntry();
    });
    zipFile.once('end', () => resolve(undefined));
    zipFile.once('error', reject);
    zipFile.readEntry();
  });
}

function openEntryStream(zipFile: yauzl.ZipFile, entry: yauzl.Entry) {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) reject(error);
      else resolve(stream);
    });
  });
}

/**
 * Streams one file of a GTFS static zip as typed rows. Memory use is bounded by the stream
 * buffers, so `stop_times.txt` (288 MB for Cercanías) is never held in memory.
 *
 * Renfe pads headers and values with spaces; every header and value is trimmed.
 * Optional files absent from the zip yield no rows; required ones throw.
 */
export async function* readGtfsRows<F extends GtfsFileName>(
  zipPath: string,
  file: F,
): AsyncGenerator<GtfsRows[F]> {
  const entryName = `${file}.txt`;
  const zipFile = await openZip(zipPath);
  try {
    const entry = await findEntry(zipFile, entryName);
    if (!entry) {
      if (OPTIONAL_FILES.has(file)) return;
      throw new Error(`${entryName} not found in ${zipPath}`);
    }

    const source = await openEntryStream(zipFile, entry);
    const parser = parse({
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      columns: (header: string[]) => header.map((name) => name.trim()),
    });
    pipeline(source, parser, () => {});

    const map = MAPPERS[file];
    for await (const row of parser) {
      yield map(row as RawRow);
    }
  } finally {
    zipFile.close();
  }
}
