import gtfsRealtime from 'gtfs-realtime-bindings';
import type { PositionFeed } from '../../../application/realtime/realtime-positions.source.js';
import {
  type TripUpdates,
  TripUpdatesSource,
} from '../../../application/realtime/trip-updates.source.js';
import {
  createDelay,
  createRun,
  createRunId,
  type Delay,
  InvalidMovementValueError,
  type Run,
  type RunId,
  requireServiceDate,
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

const { transit_realtime: rt } = gtfsRealtime;

export const RENFE_TRIP_UPDATE_URLS: Readonly<Record<PositionFeed, string>> = {
  cercanias: 'https://gtfsrt.renfe.com/trip_updates.pb',
  'larga-distancia': 'https://gtfsrt.renfe.com/trip_updates_LD.pb',
};

/** LD trip ids are the 5-digit Train number, one more digit, then the Service date: `0118112026-10-30`. */
const LD_TRIP_ID = /^(\d{5})\d(\d{4}-\d{2}-\d{2})$/;
/** Cercanías trip ids hold the Train number after a 4-digit prefix and a letter: `3003S23578C1`. */
const CERCANIAS_TRIP_ID = /^\d{4}[A-Z](\d{5})/;

export interface GtfsRtTripUpdatesSourceOptions {
  readonly timetable: ScheduledRunLookup;
  readonly urls?: Readonly<Record<PositionFeed, string>>;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  /** Called for each entity left out of the result. */
  readonly onSkipped?: (problem: SkippedEntity) => void;
}

/**
 * Reads Renfe's GTFS-RT `trip_updates*.pb` feeds.
 *
 * - Run: the scheduled Run of the (trimmed) `tripId`, else the Train number (and, for LD, the
 *   Service date) written in the trip id.
 * - Delay: the trip-level `delay`, at the first stop update's Station (usually the next stop).
 *   Entities without one are skipped.
 * - Cancelled trips (`CANCELED`) become a Run with status `cancelled` and no Delay.
 * - Cercanías `vehicle.wheelchairAccessible` becomes the Run's `wheelchairAccessible`.
 * - observedAt: the entity timestamp, else as for vehicle positions (header for Cercanías,
 *   `Last-Modified` for LD).
 * - A Run needs a Service type: from the timetable, else Cercanías for the Cercanías feed. LD Runs
 *   missing from the timetable still yield a Delay but no Run.
 */
export class GtfsRtTripUpdatesSource extends TripUpdatesSource {
  private readonly timetable: ScheduledRunLookup;
  private readonly urls: Readonly<Record<PositionFeed, string>>;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly onSkipped: (problem: SkippedEntity) => void;

  constructor(options: GtfsRtTripUpdatesSourceOptions) {
    super();
    this.timetable = options.timetable;
    this.urls = options.urls ?? RENFE_TRIP_UPDATE_URLS;
    this.fetchFn = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.onSkipped = options.onSkipped ?? (() => {});
  }

  async fetchTripUpdates(feed: PositionFeed): Promise<TripUpdates> {
    const url = this.urls[feed];
    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
    const message = rt.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));

    const fallback = fallbackObservedAt(feed, message, response, this.now);
    const updates = message.entity.flatMap((entity) =>
      entity.tripUpdate ? [{ id: entity.id, update: entity.tripUpdate }] : [],
    );
    const scheduled = await scheduledRunsByTripId(
      this.timetable,
      updates.map((u) => trimmedOrUndefined(u.update.trip?.tripId)),
    );

    const delays: Delay[] = [];
    const runs: Run[] = [];
    for (const { id, update } of updates) {
      try {
        const result = await this.toResult(id, feed, update, scheduled, fallback);
        if (result === undefined) {
          this.onSkipped({ entityId: id, reason: 'Run could not be identified' });
          continue;
        }
        if (result.delay) delays.push(result.delay);
        if (result.run) runs.push(result.run);
      } catch (error) {
        if (!(error instanceof InvalidMovementValueError)) throw error;
        this.onSkipped({ entityId: id, reason: error.message });
      }
    }
    return { delays, runs };
  }

  private async toResult(
    entityId: string,
    feed: PositionFeed,
    update: gtfsRealtime.transit_realtime.ITripUpdate,
    scheduled: Map<string, ScheduledRun>,
    fallback: Date,
  ): Promise<{ delay?: Delay; run?: Run } | undefined> {
    const tripId = trimmedOrUndefined(update.trip?.tripId);
    if (tripId === undefined) return undefined;
    const scheduledRun = scheduled.get(tripId);
    const parsed = parseTripId(tripId);
    const trainNumber = scheduledRun?.trainNumber ?? parsed?.trainNumber;
    if (trainNumber === undefined) return undefined;

    const observedAt = secondsToDate(update.timestamp) ?? fallback;
    const runId: RunId =
      parsed?.serviceDate === undefined
        ? await runIdAt(this.timetable, trainNumber, observedAt, scheduledRun)
        : createRunId(trainNumber, parsed.serviceDate);

    const cancelled =
      update.trip?.scheduleRelationship === rt.TripDescriptor.ScheduleRelationship.CANCELED;
    const source = SOURCE_OF[feed];
    const nextStationCode = trimmedOrUndefined(update.stopTimeUpdate?.[0]?.stopId);
    const delay =
      !cancelled && Object.hasOwn(update, 'delay') && update.delay != null
        ? createDelay({
            runId,
            source,
            observedAt,
            seconds: update.delay,
            ...(nextStationCode && { atStationCode: nextStationCode }),
          })
        : undefined;

    const serviceType =
      scheduledRun?.serviceType ?? (feed === 'cercanias' ? 'cercanias' : undefined);
    const wheelchairAccessible = feed === 'cercanias' ? wheelchairFlag(update) : undefined;
    const run =
      serviceType === undefined
        ? undefined
        : createRun({
            id: runId,
            serviceType,
            ...(scheduledRun && { lineCode: scheduledRun.lineCode }),
            status: cancelled ? 'cancelled' : 'scheduled',
            ...(wheelchairAccessible !== undefined && { wheelchairAccessible }),
          });
    if (!cancelled && !delay) {
      this.onSkipped({ entityId, reason: 'Trip update has no delay' });
    }
    if (!run) {
      this.onSkipped({ entityId, reason: 'Service type unknown, no Run produced' });
    }
    return { ...(delay && { delay }), ...(run && { run }) };
  }
}

function parseTripId(tripId: string): { trainNumber: string; serviceDate?: string } | undefined {
  const ld = LD_TRIP_ID.exec(tripId);
  if (ld?.[1] && ld[2]) {
    try {
      return { trainNumber: ld[1], serviceDate: requireServiceDate(ld[2]) };
    } catch (error) {
      if (!(error instanceof InvalidMovementValueError)) throw error;
      return undefined;
    }
  }
  const cercanias = CERCANIAS_TRIP_ID.exec(tripId);
  return cercanias?.[1] ? { trainNumber: cercanias[1] } : undefined;
}

function wheelchairFlag(update: gtfsRealtime.transit_realtime.ITripUpdate): boolean | undefined {
  const { WheelchairAccessible } = rt.VehicleDescriptor;
  switch (update.vehicle?.wheelchairAccessible) {
    case WheelchairAccessible.WHEELCHAIR_ACCESSIBLE:
      return true;
    case WheelchairAccessible.WHEELCHAIR_INACCESSIBLE:
      return false;
    default:
      return undefined;
  }
}
