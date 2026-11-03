import type { StationBoardEntry } from '@stt/contracts';
import { type DelayBand, delayBandFor } from '../delay/delay-band';
import { formatMadridTime } from '../run/run-detail-view';

export const entryBand = (entry: StationBoardEntry): DelayBand =>
  delayBandFor(entry.delaySeconds, entry.serviceStatus);

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

export type Tab = 'departures' | 'arrivals';

export type BoardHeadline =
  | { kind: 'empty'; tab: Tab }
  | { kind: 'next'; tab: Tab; time: string; station: string; lateCount: number };

/** One-sentence summary of a tab: its next non-cancelled row and how many rows are late. */
export function boardHeadline(
  entries: readonly StationBoardEntry[],
  tab: Tab,
  names: (code: string) => string,
): BoardHeadline {
  const next = entries.find((entry) => entry.serviceStatus !== 'cancelled');
  if (!next) return { kind: 'empty', tab };
  const times = entryTimes(next);
  const lateCount = entries.filter((entry) => {
    const band = entryBand(entry);
    return band === 'late' || band === 'severely_late';
  }).length;
  return {
    kind: 'next',
    tab,
    time: times.estimated ?? times.scheduled,
    station: names(next.counterpartStationCode),
    lateCount,
  };
}

export type UpdatedAgo = { unit: 's' | 'min'; value: number };

/** How long ago the board was refreshed: seconds under a minute, whole minutes after. */
export function updatedAgo(now: number, updatedAt: number): UpdatedAgo {
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  return seconds < 60
    ? { unit: 's', value: seconds }
    : { unit: 'min', value: Math.floor(seconds / 60) };
}
