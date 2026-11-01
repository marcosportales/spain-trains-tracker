import type { SearchResult } from '@stt/contracts';
import type { SearchReader } from './search.reader.js';

/** A Run is searchable while it was seen within this long. */
export const SEARCH_ACTIVE_WINDOW_MS = 60 * 60 * 1000;
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_GROUP_LIMIT = 10;

/** Finds active Runs by Train number, Stations by name and Lines by name or code. */
export class SearchCatalog {
  constructor(
    private readonly reader: SearchReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(rawQuery: string): Promise<SearchResult> {
    const query = rawQuery.trim();
    const since = new Date(this.now().getTime() - SEARCH_ACTIVE_WINDOW_MS);
    const [runs, stations, lines] = await Promise.all([
      this.reader.findRuns(query, since, SEARCH_GROUP_LIMIT),
      this.reader.findStations(query, SEARCH_GROUP_LIMIT),
      this.reader.findLines(query, SEARCH_GROUP_LIMIT),
    ]);
    return { query, runs, stations, lines };
  }
}
