import type { RunDetail, RunId, RunStop } from '@stt/contracts';
import { type DelayBand, delayBandFor } from '../delay/delay-band';

export function delayBand(detail: RunDetail): DelayBand {
  return delayBandFor(detail.delaySeconds, detail.serviceStatus);
}

/** A Scheduled Run: known from the timetable only, with no live position yet. */
export const isScheduledRun = (detail: RunDetail): boolean => detail.position === undefined;

/** Whether the panel says "no live position yet" instead of a Delay badge (cancelled and known Delays win). */
export const showsNoPositionBadge = (detail: RunDetail): boolean =>
  isScheduledRun(detail) &&
  detail.serviceStatus !== 'cancelled' &&
  detail.delaySeconds === undefined;

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
