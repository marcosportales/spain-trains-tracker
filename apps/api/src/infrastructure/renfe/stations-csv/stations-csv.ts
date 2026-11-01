import { parse } from 'csv-parse/sync';
import { createStation, type ServiceType, type Station } from '../../../domain/network/index.js';

/** One row of Renfe's `estaciones.csv`: the Station plus the descriptive columns it has no field for. */
export interface StationRecord {
  readonly station: Station;
  readonly address?: string;
  readonly postalCode?: string;
  readonly town: string;
  readonly province: string;
  readonly cercanias: boolean;
  readonly anchoMetrico: boolean;
}

type RawRow = Record<string, string>;

/** A row that could not become a Station. `line` is the 1-based line of the file (header is line 1). */
export interface MalformedRow {
  readonly line: number;
  readonly reason: string;
}

export interface ParseStationsOptions {
  /** Called for each row that is skipped. Parsing continues with the next row. */
  readonly onMalformedRow?: (problem: MalformedRow) => void;
}

/**
 * Parses Renfe's `estaciones.csv` (`;`-separated, Windows-1252). Malformed rows are reported
 * through `onMalformedRow` and skipped; they never abort the parse.
 */
export function parseStationsCsv(
  bytes: Uint8Array,
  { onMalformedRow }: ParseStationsOptions = {},
): StationRecord[] {
  const text = new TextDecoder('windows-1252').decode(bytes);
  const records: StationRecord[] = [];
  const problems = new Map<number, MalformedRow>();
  const report = (problem: MalformedRow): void => {
    // csv-parse can raise several errors for one broken line; keep the first.
    if (!problems.has(problem.line)) problems.set(problem.line, problem);
  };
  const rows = parse(text, {
    delimiter: ';',
    bom: true,
    trim: true,
    skip_empty_lines: true,
    info: true,
    skip_records_with_error: true,
    on_skip: (error: { message: string; lines?: number } | undefined) => {
      report({ line: error?.lines ?? 0, reason: error?.message ?? 'unparseable row' });
    },
    columns: (header: string[]) => header.map((name) => name.trim()),
  }) as { record: RawRow; info: { lines: number } }[];

  for (const { record, info } of rows) {
    try {
      records.push(toRecord(record));
    } catch (error) {
      report({
        line: info.lines,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const problem of [...problems.values()].sort((a, b) => a.line - b.line)) {
    onMalformedRow?.(problem);
  }
  return records;
}

/** `Number('')` is 0, which would silently place a Station in the Gulf of Guinea. */
const coordinate = (value: string | undefined): number => (value ? Number(value) : Number.NaN);

const optional = (value: string | undefined): string | undefined => value || undefined;

function toRecord(row: RawRow): StationRecord {
  const cercanias = row.CERCANIAS === 'SI';
  const anchoMetrico = row['ANCHO MÉTRICO'] === 'SI';
  const address = optional(row.DIRECION);
  const postalCode = optional(row.CP);
  return {
    station: createStation({
      code: row.CODIGO ?? '',
      name: row.DESCRIPCION ?? '',
      lat: coordinate(row.LATITUD),
      lon: coordinate(row.LONGITUD),
      serviceTypes: serviceTypes(cercanias, anchoMetrico),
    }),
    ...(address !== undefined && { address }),
    ...(postalCode !== undefined && { postalCode }),
    town: row.POBLACION ?? '',
    province: row.PROVINCIA ?? '',
    cercanias,
    anchoMetrico,
  };
}

/**
 * The file only flags Cercanías and Ancho métrico. A Station with neither is a mainline station,
 * but AVE / Larga Distancia / Media Distancia can't be told apart here, so it gets the provisional
 * `larga_distancia` until the GTFS routes that call at it say otherwise.
 */
function serviceTypes(cercanias: boolean, anchoMetrico: boolean): ServiceType[] {
  const types: ServiceType[] = [];
  if (cercanias) types.push('cercanias');
  if (anchoMetrico) types.push('ancho_metrico');
  return types.length > 0 ? types : ['larga_distancia'];
}
