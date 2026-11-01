import type { LineSearchHit, RunSearchHit, SearchResult, StationSearchHit } from '@stt/contracts';
import { runDetailPath } from '../run/run-detail-view';
import { stationBoardPath } from '../station/station-board-view';

/** Mirrors the API's minimum query length (`SEARCH_MIN_QUERY_LENGTH`). */
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 200;

export function normaliseQuery(raw: string): { query: string; searchable: boolean } {
  const query = raw.trim();
  return { query, searchable: query.length >= SEARCH_MIN_QUERY_LENGTH };
}

export type SearchOption =
  | { kind: 'line'; id: string; hit: LineSearchHit }
  | { kind: 'station'; id: string; hit: StationSearchHit }
  | { kind: 'run'; id: string; hit: RunSearchHit };

/** The flat, keyboard-navigable list: Lines, then Stations, then Runs. */
export function searchOptions(result: SearchResult): SearchOption[] {
  return [
    ...result.lines.map((hit): SearchOption => ({ kind: 'line', id: `line:${hit.lineCode}`, hit })),
    ...result.stations.map(
      (hit): SearchOption => ({ kind: 'station', id: `station:${hit.stationCode}`, hit }),
    ),
    ...result.runs.map(
      (hit): SearchOption => ({
        kind: 'run',
        id: `run:${hit.serviceDate}:${hit.trainNumber}`,
        hit,
      }),
    ),
  ];
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
