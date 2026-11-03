import type {
  LineSearchHit,
  RunSearchHit,
  SearchResult,
  SearchSuggestions,
  StationSearchHit,
} from '@stt/contracts';
import { runDetailPath } from '../run/run-detail-view';
import { stationBoardPath } from '../station/station-board-view';

/** Mirrors the API's minimum query length (`SEARCH_MIN_QUERY_LENGTH`). */
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 200;
/** Most rows shown per group. */
export const SEARCH_GROUP_LIMIT = 4;

export function normaliseQuery(raw: string): { query: string; searchable: boolean } {
  const query = raw.trim();
  return { query, searchable: query.length >= SEARCH_MIN_QUERY_LENGTH };
}

export type SearchOption =
  | { kind: 'line'; id: string; hit: LineSearchHit }
  | { kind: 'station'; id: string; hit: StationSearchHit }
  | { kind: 'run'; id: string; hit: RunSearchHit };

/** The flat, keyboard-navigable list: Runs, then Stations, then Lines, each group capped. */
export function searchOptions(result: SearchResult): SearchOption[] {
  return [
    ...result.runs.slice(0, SEARCH_GROUP_LIMIT).map(
      (hit): SearchOption => ({
        kind: 'run',
        id: `run:${hit.serviceDate}:${hit.trainNumber}`,
        hit,
      }),
    ),
    ...result.stations
      .slice(0, SEARCH_GROUP_LIMIT)
      .map((hit): SearchOption => ({ kind: 'station', id: `station:${hit.stationCode}`, hit })),
    ...result.lines
      .slice(0, SEARCH_GROUP_LIMIT)
      .map((hit): SearchOption => ({ kind: 'line', id: `line:${hit.lineCode}`, hit })),
  ];
}

/** The four main Stations offered as Suggestions before the user types. */
export const FIXED_STATIONS: readonly StationSearchHit[] = [
  { stationCode: '60000', name: 'Madrid Atocha' },
  { stationCode: '17000', name: 'Madrid Chamartín' },
  { stationCode: '71801', name: 'Barcelona Sants' },
  { stationCode: '51003', name: 'Sevilla-Santa Justa' },
];

/** The empty-state list: the suggested Runs (none yet if loading or failed), then the fixed Stations. */
export function suggestionOptions(suggestions: SearchSuggestions | undefined): SearchOption[] {
  return [
    ...(suggestions?.runs.slice(0, SEARCH_GROUP_LIMIT) ?? []).map(
      (hit): SearchOption => ({
        kind: 'run',
        id: `run:${hit.serviceDate}:${hit.trainNumber}`,
        hit,
      }),
    ),
    ...FIXED_STATIONS.map(
      (hit): SearchOption => ({ kind: 'station', id: `station:${hit.stationCode}`, hit }),
    ),
  ];
}

/** "Origen → Destino" when both ends are known, else the Line, else nothing. */
export function runRouteText(hit: RunSearchHit): string | undefined {
  if (hit.originName && hit.destinationName) return `${hit.originName} → ${hit.destinationName}`;
  return hit.lineCode;
}

/** Where selecting an option goes: a Line filters the map, the others open their page. */
export function optionHref(option: SearchOption): string {
  switch (option.kind) {
    case 'line':
      return `/?${new URLSearchParams({ line: option.hit.lineCode })}`;
    case 'station':
      return stationBoardPath(option.hit.stationCode);
    case 'run':
      return runDetailPath(option.hit);
  }
}

/** Next active index for arrow keys, wrapping; -1 means none active. */
export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}
