import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FeedFetch, GtfsFeed, GtfsSource } from '../../application/network/static-feeds.js';
import { StaticFeeds } from '../../application/network/static-feeds.js';
import { readGtfsRows } from './gtfs-static/gtfs-static.js';
import { parseStationsCsv, type StationRecord } from './stations-csv/stations-csv.js';

export const RENFE_STATIC_URLS = {
  cercanias: 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip',
  'larga-distancia': 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
  estaciones: 'https://ssl.renfe.com/ftransit/Fichero_estaciones/estaciones.csv',
} as const;

export type StaticUrls = Readonly<Record<keyof typeof RENFE_STATIC_URLS, string>>;

export interface HttpStaticFeedsOptions {
  readonly urls?: StaticUrls;
  readonly fetch?: typeof fetch;
  readonly onMalformedStationRow?: (problem: { line: number; reason: string }) => void;
}

/** Downloads Renfe's static datasets over HTTP with `If-None-Match`; GTFS zips go to a temp file. */
export class HttpStaticFeeds extends StaticFeeds {
  private readonly urls: StaticUrls;
  private readonly fetchFn: typeof fetch;
  private readonly onMalformedStationRow: (problem: { line: number; reason: string }) => void;

  constructor(options: HttpStaticFeedsOptions = {}) {
    super();
    this.urls = options.urls ?? RENFE_STATIC_URLS;
    this.fetchFn = options.fetch ?? fetch;
    this.onMalformedStationRow = options.onMalformedStationRow ?? (() => {});
  }

  async fetchGtfs(source: GtfsSource, previousEtag?: string): Promise<FeedFetch<GtfsFeed>> {
    const response = await this.request(this.urls[source], previousEtag);
    if (response === undefined) return { status: 'not-modified' };
    const directory = await mkdtemp(join(tmpdir(), `gtfs-${source}-`));
    const zipPath = join(directory, `${source}.zip`);
    try {
      if (!response.body) throw new Error(`${this.urls[source]} returned no body`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(zipPath));
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
    const etag = response.headers.get('etag') ?? undefined;
    return {
      status: 'modified',
      ...(etag !== undefined && { etag }),
      content: { rows: (file) => readGtfsRows(zipPath, file) },
      release: () => rm(directory, { recursive: true, force: true }),
    };
  }

  async fetchStations(previousEtag?: string): Promise<FeedFetch<StationRecord[]>> {
    const response = await this.request(this.urls.estaciones, previousEtag);
    if (response === undefined) return { status: 'not-modified' };
    const bytes = new Uint8Array(await response.arrayBuffer());
    const etag = response.headers.get('etag') ?? undefined;
    return {
      status: 'modified',
      ...(etag !== undefined && { etag }),
      content: parseStationsCsv(bytes, { onMalformedRow: this.onMalformedStationRow }),
      release: async () => {},
    };
  }

  /** The response, or undefined on `304 Not Modified`. */
  private async request(
    url: string,
    previousEtag: string | undefined,
  ): Promise<Response | undefined> {
    const response = await this.fetchFn(url, {
      headers: previousEtag ? { 'If-None-Match': previousEtag } : {},
    });
    if (response.status === 304) return undefined;
    if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
    return response;
  }
}
