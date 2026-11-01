import gtfsRealtime from 'gtfs-realtime-bindings';
import {
  type PositionFeed,
  RealtimePositionsSource,
} from '../../../application/realtime/realtime-positions.source.js';
import {
  createRunId,
  createSighting,
  InvalidMovementValueError,
  parseVehicleLabel,
  type RunId,
  type Sighting,
  type SightingStatus,
  type Source,
  serviceDateFor,
} from '../../../domain/movement/index.js';
import type { ScheduledRun } from '../../../domain/network/index.js';

const { transit_realtime: rt } = gtfsRealtime;

export const RENFE_POSITION_URLS: Readonly<Record<PositionFeed, string>> = {
  cercanias: 'https://gtfsrt.renfe.com/vehicle_positions.pb',
  'larga-distancia': 'https://gtfsrt.renfe.com/vehicle_positions_LD.pb',
};

const SOURCE_OF: Readonly<Record<PositionFeed, Source>> = {
  cercanias: 'gtfsrt_cercanias',
  'larga-distancia': 'gtfsrt_ld',
};

const STATUS_OF: Readonly<Record<number, SightingStatus>> = {
  [rt.VehiclePosition.VehicleStopStatus.INCOMING_AT]: 'INCOMING_AT',
  [rt.VehiclePosition.VehicleStopStatus.STOPPED_AT]: 'STOPPED_AT',
  [rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO]: 'IN_TRANSIT_TO',
};

/** The part of the timetable needed to identify a Run. */
export interface ScheduledRunLookup {
  findScheduledRunsByTripIds(tripIds: readonly string[]): Promise<ScheduledRun[]>;
  findScheduledRuns(trainNumber: string, serviceDate: string): Promise<ScheduledRun[]>;
}

export interface SkippedEntity {
  readonly entityId: string;
  readonly reason: string;
}

export interface GtfsRtPositionsSourceOptions {
  readonly timetable: ScheduledRunLookup;
  readonly urls?: Readonly<Record<PositionFeed, string>>;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  /** Called for each entity left out of the result. */
  readonly onSkipped?: (problem: SkippedEntity) => void;
}

/**
 * Reads Renfe's GTFS-RT `vehicle_positions*.pb` feeds.
 *
 * - Run: the scheduled Run of the (trimmed) `tripId`, else the Train number in the vehicle label.
 * - observedAt: the entity timestamp. Without one, Cercanías uses the header timestamp; the LD
 *   header is about an hour off, so LD uses the HTTP `Last-Modified` instead. Last resort: now.
 * - Entities without a position are kept, without lat/lon.
 */
export class GtfsRtPositionsSource extends RealtimePositionsSource {
  private readonly timetable: ScheduledRunLookup;
  private readonly urls: Readonly<Record<PositionFeed, string>>;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly onSkipped: (problem: SkippedEntity) => void;

  constructor(options: GtfsRtPositionsSourceOptions) {
    super();
    this.timetable = options.timetable;
    this.urls = options.urls ?? RENFE_POSITION_URLS;
    this.fetchFn = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.onSkipped = options.onSkipped ?? (() => {});
  }

  async fetchSightings(feed: PositionFeed): Promise<Sighting[]> {
    const url = this.urls[feed];
    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
    const message = rt.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));

    const fallbackObservedAt = this.fallbackObservedAt(feed, message, response);
    const vehicles = message.entity.flatMap((entity) =>
      entity.vehicle ? [{ id: entity.id, vehicle: entity.vehicle }] : [],
    );
    const scheduled = await this.scheduledRunsByTripId(vehicles.map((v) => tripIdOf(v.vehicle)));

    const sightings: Sighting[] = [];
    for (const { id, vehicle } of vehicles) {
      try {
        const sighting = await this.toSighting(feed, vehicle, scheduled, fallbackObservedAt);
        if (sighting) sightings.push(sighting);
        else this.onSkipped({ entityId: id, reason: 'Run could not be identified' });
      } catch (error) {
        if (!(error instanceof InvalidMovementValueError)) throw error;
        this.onSkipped({ entityId: id, reason: error.message });
      }
    }
    return sightings;
  }

  private fallbackObservedAt(
    feed: PositionFeed,
    message: gtfsRealtime.transit_realtime.FeedMessage,
    response: Response,
  ): Date {
    if (feed === 'cercanias') {
      const header = secondsToDate(message.header.timestamp);
      if (header) return header;
    }
    const lastModified = Date.parse(response.headers.get('last-modified') ?? '');
    return Number.isNaN(lastModified) ? this.now() : new Date(lastModified);
  }

  private async scheduledRunsByTripId(
    tripIds: (string | undefined)[],
  ): Promise<Map<string, ScheduledRun>> {
    const wanted = [...new Set(tripIds.filter((id): id is string => id !== undefined))];
    if (wanted.length === 0) return new Map();
    const runs = await this.timetable.findScheduledRunsByTripIds(wanted);
    return new Map(runs.map((run) => [run.tripId, run]));
  }

  private async toSighting(
    feed: PositionFeed,
    vehicle: gtfsRealtime.transit_realtime.IVehiclePosition,
    scheduled: Map<string, ScheduledRun>,
    fallbackObservedAt: Date,
  ): Promise<Sighting | undefined> {
    const tripId = tripIdOf(vehicle);
    const label = parseVehicleLabel(vehicle.vehicle?.label);
    const scheduledRun = tripId === undefined ? undefined : scheduled.get(tripId);
    const trainNumber = scheduledRun?.trainNumber ?? label.trainNumber;
    if (trainNumber === undefined) return undefined;

    const observedAt = secondsToDate(vehicle.timestamp) ?? fallbackObservedAt;
    const runId = await this.runIdFor(trainNumber, observedAt, scheduledRun);
    const stationCode = vehicle.stopId?.trim();
    const position = vehicle.position;

    return createSighting({
      runId,
      source: SOURCE_OF[feed],
      observedAt,
      ...(position && { lat: position.latitude, lon: position.longitude }),
      status:
        STATUS_OF[vehicle.currentStatus ?? rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO] ??
        'IN_TRANSIT_TO',
      ...(stationCode && { stationCode }),
      ...(label.platform && { platform: label.platform }),
    });
  }

  /** Before 04:00 Madrid time a scheduled Run may still belong to the previous Service date. */
  private async runIdFor(
    trainNumber: string,
    observedAt: Date,
    scheduledRun: ScheduledRun | undefined,
  ): Promise<RunId> {
    const calendarDate = serviceDateFor(observedAt);
    const previousDate = serviceDateFor(observedAt, { operatesOn: () => true });
    if (previousDate === calendarDate) return createRunId(trainNumber, calendarDate);

    const previousRuns = await this.timetable.findScheduledRuns(trainNumber, previousDate);
    const operatesOnPrevious = previousRuns.some(
      (run) => scheduledRun === undefined || run.tripId === scheduledRun.tripId,
    );
    return createRunId(
      trainNumber,
      serviceDateFor(observedAt, { operatesOn: (d) => d === previousDate && operatesOnPrevious }),
    );
  }
}

function tripIdOf(vehicle: gtfsRealtime.transit_realtime.IVehiclePosition): string | undefined {
  const tripId = vehicle.trip?.tripId?.trim();
  return tripId ? tripId : undefined;
}

function secondsToDate(seconds: number | Long | null | undefined): Date | undefined {
  if (seconds === null || seconds === undefined) return undefined;
  const value = Number(seconds);
  return value > 0 ? new Date(value * 1000) : undefined;
}
