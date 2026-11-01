import type gtfsRealtime from 'gtfs-realtime-bindings';
import type { PositionFeed } from '../../../application/realtime/realtime-positions.source.js';
import {
  createRunId,
  type RunId,
  type Source,
  serviceDateFor,
} from '../../../domain/movement/index.js';
import type { ScheduledRun } from '../../../domain/network/index.js';

/** The part of the timetable needed to identify a Run. */
export interface ScheduledRunLookup {
  findScheduledRunsByTripIds(tripIds: readonly string[]): Promise<ScheduledRun[]>;
  findScheduledRuns(trainNumber: string, serviceDate: string): Promise<ScheduledRun[]>;
}

export interface SkippedEntity {
  readonly entityId: string;
  readonly reason: string;
}

export const SOURCE_OF: Readonly<Record<PositionFeed, Source>> = {
  cercanias: 'gtfsrt_cercanias',
  'larga-distancia': 'gtfsrt_ld',
};

export function secondsToDate(seconds: number | Long | null | undefined): Date | undefined {
  if (seconds === null || seconds === undefined) return undefined;
  const value = Number(seconds);
  return value > 0 ? new Date(value * 1000) : undefined;
}

/**
 * When an entity carries no timestamp of its own: Cercanías uses the header timestamp; the LD
 * header is about an hour off, so LD uses the HTTP `Last-Modified` instead. Last resort: now.
 */
export function fallbackObservedAt(
  feed: PositionFeed,
  message: gtfsRealtime.transit_realtime.FeedMessage,
  response: Response,
  now: () => Date,
): Date {
  if (feed === 'cercanias') {
    const header = secondsToDate(message.header.timestamp);
    if (header) return header;
  }
  const lastModified = Date.parse(response.headers.get('last-modified') ?? '');
  return Number.isNaN(lastModified) ? now() : new Date(lastModified);
}

export function trimmedOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function scheduledRunsByTripId(
  timetable: ScheduledRunLookup,
  tripIds: readonly (string | undefined)[],
): Promise<Map<string, ScheduledRun>> {
  const wanted = [...new Set(tripIds.filter((id): id is string => id !== undefined))];
  if (wanted.length === 0) return new Map();
  const runs = await timetable.findScheduledRunsByTripIds(wanted);
  return new Map(runs.map((run) => [run.tripId, run]));
}

/** Before 04:00 Madrid time a scheduled Run may still belong to the previous Service date. */
export async function runIdAt(
  timetable: ScheduledRunLookup,
  trainNumber: string,
  observedAt: Date,
  scheduledRun: ScheduledRun | undefined,
): Promise<RunId> {
  const calendarDate = serviceDateFor(observedAt);
  const previousDate = serviceDateFor(observedAt, { operatesOn: () => true });
  if (previousDate === calendarDate) return createRunId(trainNumber, calendarDate);

  const previousRuns = await timetable.findScheduledRuns(trainNumber, previousDate);
  const operatesOnPrevious = previousRuns.some(
    (run) => scheduledRun === undefined || run.tripId === scheduledRun.tripId,
  );
  return createRunId(
    trainNumber,
    serviceDateFor(observedAt, { operatesOn: (d) => d === previousDate && operatesOnPrevious }),
  );
}
