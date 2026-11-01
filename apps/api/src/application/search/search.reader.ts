import type { LineSearchHit, RunSearchHit, StationSearchHit } from '@stt/contracts';

/** Read side of search: one lookup per kind of match. `query` arrives trimmed, with at least SEARCH_MIN_QUERY_LENGTH characters. */
export abstract class SearchReader {
  /** Runs seen at or after `since` whose Train number equals or starts with `query`, newest first. */
  abstract findRuns(query: string, since: Date, limit: number): Promise<RunSearchHit[]>;
  /** Stations whose name matches `query` ignoring case and accents, tolerating small typos, best first. */
  abstract findStations(query: string, limit: number): Promise<StationSearchHit[]>;
  /** Lines whose name or code starts with `query` ignoring case, exact matches first. */
  abstract findLines(query: string, limit: number): Promise<LineSearchHit[]>;
}
