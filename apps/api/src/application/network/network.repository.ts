import type {
  Hub,
  Line,
  ScheduledRun,
  ScheduledStop,
  ServiceCalendar,
  StaticImport,
  Station,
  TrackGeometry,
} from '../../domain/network/index.js';

/** Everything one static import brings in. Parents must be included before they are referenced. */
export interface StaticNetwork {
  readonly hubs: readonly Hub[];
  readonly stations: readonly Station[];
  readonly lines: readonly Line[];
  readonly calendars: readonly ServiceCalendar[];
  readonly runs: readonly ScheduledRun[];
  readonly stops: readonly ScheduledStop[];
  readonly geometries: readonly TrackGeometry[];
}

/** Storage for the static network: Stations, Lines, Hubs, the timetable and Track geometry. */
export abstract class NetworkRepository {
  /** Upserts the whole network and records the import, all in one transaction. */
  abstract saveStaticNetwork(network: StaticNetwork, record: StaticImport): Promise<void>;
  /** The most recent import of `source`, or undefined when there is none. */
  abstract lastStaticImport(source: string): Promise<StaticImport | undefined>;

  abstract listHubs(): Promise<Hub[]>;
  abstract listLines(): Promise<Line[]>;
  abstract listStations(): Promise<Station[]>;
  abstract findStation(code: string): Promise<Station | undefined>;
  /** Stations within `radiusMeters` of the point, nearest first. */
  abstract findStationsNear(lat: number, lon: number, radiusMeters: number): Promise<Station[]>;

  /** Scheduled Runs of a Train number that operate on `serviceDate` (`YYYY-MM-DD`). */
  abstract findScheduledRuns(trainNumber: string, serviceDate: string): Promise<ScheduledRun[]>;
  /** Stops of a scheduled Run, in sequence order. */
  abstract getScheduledStops(tripId: string): Promise<ScheduledStop[]>;
  abstract getTrackGeometry(shapeId: string): Promise<TrackGeometry | undefined>;
}
