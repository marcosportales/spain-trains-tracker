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

/** The ordered Stations one group of scheduled Runs of a Line stop at. */
export interface StopPattern {
  readonly lineCode: string;
  readonly stationCodes: readonly string[];
  readonly tripIds: readonly string[];
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
  /** Scheduled Runs with any of the given trip ids (unknown ids are ignored). */
  abstract findScheduledRunsByTripIds(tripIds: readonly string[]): Promise<ScheduledRun[]>;
  /** Stops of a scheduled Run, in sequence order. */
  abstract getScheduledStops(tripId: string): Promise<ScheduledStop[]>;
  abstract getTrackGeometry(shapeId: string): Promise<TrackGeometry | undefined>;
  /** Every Track geometry drawn for a Line (one per shape), ordered by shape id. */
  abstract trackGeometryFor(lineCode: string): Promise<TrackGeometry[]>;
  /**
   * Like `trackGeometryFor`, but with vertices removed (Douglas–Peucker) so the path stays within
   * `toleranceMeters` (default 5 m) of the original. Meant for the web map.
   */
  abstract simplifiedTrackGeometryFor(
    lineCode: string,
    toleranceMeters?: number,
  ): Promise<TrackGeometry[]>;

  /** Stop patterns of the scheduled Runs of every Line that is not Cercanías, longest first. */
  abstract listLongDistanceStopPatterns(): Promise<StopPattern[]>;
  /** The subset of `shapeIds` that already has a Track geometry. */
  abstract existingShapeIds(shapeIds: readonly string[]): Promise<Set<string>>;
  /** Stores one Track geometry and points the given Runs at it (Runs that already have a shape keep it). */
  abstract saveTrackGeometry(geometry: TrackGeometry, tripIds: readonly string[]): Promise<void>;
  /** Points the given Runs that have no shape yet at `shapeId`. */
  abstract linkRunsToShape(shapeId: string, tripIds: readonly string[]): Promise<void>;
}
