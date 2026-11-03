import type { RunDetail, RunId, RunStop } from '@stt/contracts';
import type { StationNames } from '@/lib/station-names';
import { type DelayBand, delayBandFor, delayMinutes } from '../delay/delay-band';

export function delayBand(detail: RunDetail): DelayBand {
  return delayBandFor(detail.delaySeconds, detail.serviceStatus);
}

/** A Scheduled Run: known from the timetable only, with no live position yet. */
export const isScheduledRun = (detail: RunDetail): boolean => detail.position === undefined;

const MADRID_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatMadridTime = (timestamp: string): string =>
  MADRID_TIME.format(new Date(timestamp));

/** Date and time with seconds, in Madrid time, in the reader's language ("3 nov 2026, 10:42:15"). */
export const formatMadridDateTime = (instant: Date | number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Madrid',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(instant);

/** Time of day with seconds, in Madrid time ("10:42:15"). */
export const formatMadridClock = (instant: Date | number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

/** Time of day to the minute, in Madrid time ("10:00"). */
export const formatMadridHourMinute = (instant: Date | number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

export type StopTimes = {
  scheduled: string | undefined;
  estimated: string | undefined;
  /** The estimate differs from the schedule. */
  changed: boolean;
};

/** Scheduled vs estimated time of a stop (departure, else arrival), in Madrid time. */
export function stopTimes(stop: RunStop): StopTimes {
  const scheduled = stop.scheduledDeparture ?? stop.scheduledArrival;
  const estimated = stop.estimatedDeparture ?? stop.estimatedArrival;
  const s = scheduled && formatMadridTime(scheduled);
  const e = estimated && formatMadridTime(estimated);
  return { scheduled: s, estimated: e, changed: s !== undefined && e !== undefined && s !== e };
}

export type TimelineStop = {
  station: string;
  times: StopTimes;
  state: 'past' | 'current' | 'future';
};

export type StopTimeline = {
  stops: TimelineStop[];
  /** Where the train is: on the stop at `atIndex`, or just before it when `between`. */
  marker: { atIndex: number; between: boolean } | undefined;
};

/** The stops in order, which are behind the train, and where to draw the train marker. */
export function stopTimeline(detail: RunDetail, names: StationNames): StopTimeline {
  const ordered = [...detail.stops].sort((a, b) => a.sequence - b.sequence);
  const nextCode = detail.position?.nextStationCode;
  const next = nextCode === undefined ? -1 : ordered.findIndex((s) => s.stationCode === nextCode);
  const stoppedAt = next >= 0 && detail.position?.status === 'stopped_at';

  const stops = ordered.map((stop, i): TimelineStop => {
    const state =
      next < 0 || i > next ? 'future' : i < next ? 'past' : stoppedAt ? 'current' : 'future';
    return { station: names(stop.stationCode), times: stopTimes(stop), state };
  });
  return { stops, marker: next < 0 ? undefined : { atIndex: next, between: !stoppedAt } };
}

export const runDetailPath = (id: RunId): string => `/runs/${id.serviceDate}/${id.trainNumber}`;

export type RunHeadline =
  | { kind: 'cancelled' }
  | { kind: 'not_departed'; origin: string; time?: string }
  | {
      kind: 'running';
      band: Exclude<DelayBand, 'cancelled'>;
      minutes?: number;
      nextStop?: { station: string; time?: string };
    };

const madridTime = (timestamp: string | undefined): string | undefined =>
  timestamp === undefined ? undefined : formatMadridTime(timestamp);

/** The one-sentence answer to "where is my train?" (first match wins; see the Run detail design). */
export function runHeadline(detail: RunDetail, names: StationNames): RunHeadline {
  if (detail.serviceStatus === 'cancelled') return { kind: 'cancelled' };

  if (isScheduledRun(detail)) {
    const first = [...detail.stops].sort((a, b) => a.sequence - b.sequence)[0];
    const origin = first?.stationCode ?? detail.originStationCode;
    // With no Station to name, fall through to the running headline.
    if (origin !== undefined) {
      const time = madridTime(first?.scheduledDeparture);
      return { kind: 'not_departed', origin: names(origin), ...(time && { time }) };
    }
  }

  const band = delayBand(detail) as Exclude<DelayBand, 'cancelled'>;
  const minutes =
    (band === 'late' || band === 'severely_late') && detail.delaySeconds !== undefined
      ? delayMinutes(detail.delaySeconds)
      : undefined;
  const nextCode = detail.position?.nextStationCode;
  const stop = detail.stops.find((s) => s.stationCode === nextCode);
  const time = madridTime(
    stop?.estimatedArrival ??
      stop?.scheduledArrival ??
      stop?.estimatedDeparture ??
      stop?.scheduledDeparture,
  );
  return {
    kind: 'running',
    band,
    ...(minutes !== undefined && { minutes }),
    ...(nextCode !== undefined && {
      nextStop: { station: names(nextCode), ...(time && { time }) },
    }),
  };
}
