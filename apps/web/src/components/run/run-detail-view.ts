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
