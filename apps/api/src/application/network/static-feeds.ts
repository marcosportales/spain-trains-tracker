import type {
  GtfsFileName,
  GtfsRows,
} from '../../infrastructure/renfe/gtfs-static/gtfs-static.types.js';
import type { StationRecord } from '../../infrastructure/renfe/stations-csv/stations-csv.js';

/** Identifies one upstream static dataset. Also the `source` recorded in each static import. */
export const STATIC_SOURCES = ['estaciones', 'cercanias', 'larga-distancia'] as const;
export type StaticSource = (typeof STATIC_SOURCES)[number];
export type GtfsSource = Exclude<StaticSource, 'estaciones'>;

/** A downloaded GTFS zip, read file by file. */
export interface GtfsFeed {
  rows<F extends GtfsFileName>(file: F): AsyncIterable<GtfsRows[F]>;
}

export type FeedFetch<T> =
  | { readonly status: 'not-modified' }
  | {
      readonly status: 'modified';
      readonly etag?: string;
      readonly content: T;
      /** Frees what the download holds (temporary files). Call once the content has been read. */
      release(): Promise<void>;
    };

/** Downloads Renfe's static datasets. Sends `If-None-Match` when `previousEtag` is given. */
export abstract class StaticFeeds {
  abstract fetchGtfs(source: GtfsSource, previousEtag?: string): Promise<FeedFetch<GtfsFeed>>;
  abstract fetchStations(previousEtag?: string): Promise<FeedFetch<StationRecord[]>>;
}
