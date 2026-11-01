import gtfsRealtime from 'gtfs-realtime-bindings';
import {
  type PositionFeed,
  RealtimePositionsSource,
} from '../../../application/realtime/realtime-positions.source.js';
import {
  createSighting,
  InvalidMovementValueError,
  parseVehicleLabel,
  type Sighting,
  type SightingStatus,
} from '../../../domain/movement/index.js';
import type { ScheduledRun } from '../../../domain/network/index.js';
import {
  fallbackObservedAt,
  runIdAt,
  type ScheduledRunLookup,
  type SkippedEntity,
  SOURCE_OF,
  scheduledRunsByTripId,
  secondsToDate,
  trimmedOrUndefined,
} from './gtfs-rt-common.js';

export type { ScheduledRunLookup, SkippedEntity };

const { transit_realtime: rt } = gtfsRealtime;

export const RENFE_POSITION_URLS: Readonly<Record<PositionFeed, string>> = {
  cercanias: 'https://gtfsrt.renfe.com/vehicle_positions.pb',
  'larga-distancia': 'https://gtfsrt.renfe.com/vehicle_positions_LD.pb',
};

const STATUS_OF: Readonly<Record<number, SightingStatus>> = {
  [rt.VehiclePosition.VehicleStopStatus.INCOMING_AT]: 'INCOMING_AT',
  [rt.VehiclePosition.VehicleStopStatus.STOPPED_AT]: 'STOPPED_AT',
  [rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO]: 'IN_TRANSIT_TO',
};

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

    const fallback = fallbackObservedAt(feed, message, response, this.now);
    const vehicles = message.entity.flatMap((entity) =>
      entity.vehicle ? [{ id: entity.id, vehicle: entity.vehicle }] : [],
    );
    const scheduled = await scheduledRunsByTripId(
      this.timetable,
      vehicles.map((v) => tripIdOf(v.vehicle)),
    );

    const sightings: Sighting[] = [];
    for (const { id, vehicle } of vehicles) {
      try {
        const sighting = await this.toSighting(feed, vehicle, scheduled, fallback);
        if (sighting) sightings.push(sighting);
        else this.onSkipped({ entityId: id, reason: 'Run could not be identified' });
      } catch (error) {
        if (!(error instanceof InvalidMovementValueError)) throw error;
        this.onSkipped({ entityId: id, reason: error.message });
      }
    }
    return sightings;
  }

  private async toSighting(
    feed: PositionFeed,
    vehicle: gtfsRealtime.transit_realtime.IVehiclePosition,
    scheduled: Map<string, ScheduledRun>,
    fallback: Date,
  ): Promise<Sighting | undefined> {
    const tripId = tripIdOf(vehicle);
    const label = parseVehicleLabel(vehicle.vehicle?.label);
    const scheduledRun = tripId === undefined ? undefined : scheduled.get(tripId);
    const trainNumber = scheduledRun?.trainNumber ?? label.trainNumber;
    if (trainNumber === undefined) return undefined;

    const observedAt = secondsToDate(vehicle.timestamp) ?? fallback;
    const runId = await runIdAt(this.timetable, trainNumber, observedAt, scheduledRun);
    const stationCode = trimmedOrUndefined(vehicle.stopId);
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
}

function tripIdOf(vehicle: gtfsRealtime.transit_realtime.IVehiclePosition): string | undefined {
  return trimmedOrUndefined(vehicle.trip?.tripId);
}
