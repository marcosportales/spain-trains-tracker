import type { StationBoardEntry } from '@stt/contracts';
import { badgeForDelay, type DelayBadge, formatMadridTime } from '../run/run-detail-view';

export function entryBadge(entry: StationBoardEntry): DelayBadge {
  if (entry.serviceStatus === 'cancelled') return 'cancelled';
  return badgeForDelay(entry.delaySeconds);
}

export type EntryTimes = {
  scheduled: string;
  estimated: string | undefined;
  /** The estimate differs from the schedule. */
  changed: boolean;
};

/** Scheduled vs estimated time of a board row, in Madrid time. */
export function entryTimes(entry: StationBoardEntry): EntryTimes {
  const scheduled = formatMadridTime(entry.scheduledAt);
  const estimated = entry.estimatedAt && formatMadridTime(entry.estimatedAt);
  return { scheduled, estimated, changed: estimated !== undefined && estimated !== scheduled };
}

export const stationBoardPath = (code: string): string => `/stations/${code}`;
