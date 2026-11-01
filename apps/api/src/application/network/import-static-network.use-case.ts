import { buildGtfsNetwork } from './gtfs-network.js';
import type { NetworkRepository, StaticNetwork } from './network.repository.js';
import {
  type FeedFetch,
  type GtfsSource,
  STATIC_SOURCES,
  type StaticFeeds,
  type StaticSource,
} from './static-feeds.js';

export type SourceImportReport =
  | { readonly source: StaticSource; readonly status: 'unchanged' }
  | {
      readonly source: StaticSource;
      readonly status: 'imported';
      readonly etag?: string;
      readonly stations: number;
      readonly lines: number;
      readonly runs: number;
      readonly stops: number;
    }
  | { readonly source: StaticSource; readonly status: 'failed'; readonly error: string };

export interface ImportLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Downloads Renfe's static datasets (stations CSV, Cercanías GTFS, AV/LD/MD GTFS) and stores the
 * network. Each source is conditional on its last ETag: an unchanged source writes nothing. Each
 * changed source is saved in one transaction, so a failing source leaves the others untouched.
 */
export class ImportStaticNetwork {
  constructor(
    private readonly feeds: StaticFeeds,
    private readonly repository: NetworkRepository,
    private readonly logger: ImportLogger = console,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** True when at least one source has never been imported. */
  async isMissingData(): Promise<boolean> {
    for (const source of STATIC_SOURCES) {
      if ((await this.repository.lastStaticImport(source)) === undefined) return true;
    }
    return false;
  }

  /** Imports every source. A failing source is reported and does not stop the others. */
  async execute(): Promise<SourceImportReport[]> {
    const reports: SourceImportReport[] = [];
    // Stations first: the GTFS sources reference them.
    for (const source of STATIC_SOURCES) {
      try {
        reports.push(await this.importSource(source));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`static import of ${source} failed: ${message}`);
        reports.push({ source, status: 'failed', error: message });
      }
    }
    return reports;
  }

  private async importSource(source: StaticSource): Promise<SourceImportReport> {
    const previous = (await this.repository.lastStaticImport(source))?.etag;
    if (source === 'estaciones') return this.importStations(previous);
    return this.importGtfs(source as GtfsSource, previous);
  }

  private async importStations(previousEtag: string | undefined): Promise<SourceImportReport> {
    const fetched = await this.feeds.fetchStations(previousEtag);
    return this.saveFetched('estaciones', fetched, async (records) => ({
      ...EMPTY_NETWORK,
      stations: records.map((record) => record.station),
    }));
  }

  private async importGtfs(
    source: GtfsSource,
    previousEtag: string | undefined,
  ): Promise<SourceImportReport> {
    const fetched = await this.feeds.fetchGtfs(source, previousEtag);
    return this.saveFetched(source, fetched, async (feed) => {
      const stored = await this.repository.listStations();
      const result = await buildGtfsNetwork(feed, source, {
        knownStations: new Map(stored.map((station) => [station.code, station])),
        metreGaugeStationCodes: new Set(
          stored
            .filter((station) => station.serviceTypes.every((type) => type === 'ancho_metrico'))
            .map((station) => station.code),
        ),
      });
      if (result.skippedStopTimes > 0) {
        this.logger.warn(`${source}: skipped ${result.skippedStopTimes} stop times`);
      }
      return result.network;
    });
  }

  /** Skips an unchanged download; otherwise builds the network from it, saves it and frees the download. */
  private async saveFetched<T>(
    source: StaticSource,
    fetched: FeedFetch<T>,
    build: (content: T) => Promise<StaticNetwork>,
  ): Promise<SourceImportReport> {
    if (fetched.status === 'not-modified') {
      this.logger.log(`static import of ${source}: unchanged`);
      return { source, status: 'unchanged' };
    }
    try {
      const network = await build(fetched.content);
      await this.repository.saveStaticNetwork(network, {
        source,
        importedAt: this.now(),
        ...(fetched.etag !== undefined && { etag: fetched.etag }),
      });
      const counts = {
        stations: network.stations.length,
        lines: network.lines.length,
        runs: network.runs.length,
        stops: network.stops.length,
      };
      this.logger.log(
        `static import of ${source}: ${counts.stations} stations, ${counts.lines} lines, ${counts.runs} runs, ${counts.stops} stops`,
      );
      return {
        source,
        status: 'imported',
        ...(fetched.etag !== undefined && { etag: fetched.etag }),
        ...counts,
      };
    } finally {
      await fetched.release();
    }
  }
}

const EMPTY_NETWORK: StaticNetwork = {
  hubs: [],
  stations: [],
  lines: [],
  calendars: [],
  runs: [],
  stops: [],
  geometries: [],
};
