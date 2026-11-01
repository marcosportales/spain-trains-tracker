import type { RunDetail, RunId, RunStop } from '@stt/contracts';

/** How a Run's punctuality is shown: on time, under 5 min late, 5+ min late, cancelled. */
export type DelayBadge = 'on_time' | 'minor' | 'major' | 'cancelled' | 'unknown';

const ON_TIME_BELOW_S = 60;
const MAJOR_FROM_S = 300;

/** Badge for a Delay in seconds (undefined = unknown), ignoring Service status. */
export function badgeForDelay(delay: number | undefined): DelayBadge {
  if (delay === undefined) return 'unknown';
  if (delay < ON_TIME_BELOW_S) return 'on_time';
  return delay < MAJOR_FROM_S ? 'minor' : 'major';
}

export function delayBadge(detail: RunDetail): DelayBadge {
  if (detail.serviceStatus === 'cancelled') return 'cancelled';
  return badgeForDelay(detail.delaySeconds ?? detail.run.delaySeconds);
}

export const delayMinutes = (seconds: number): number => Math.round(seconds / 60);

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
