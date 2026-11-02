import type { RunDetail, ServiceType, StationBoard } from '@stt/contracts';
import {
  type DelayBadge,
  delayBadge,
  delayMinutes,
  formatMadridTime,
} from '../run/run-detail-view';
import { entryBadge } from '../station/station-board-view';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_DEPARTURES = 3;

export type RunOgContent = {
  serviceType: ServiceType;
  trainNumber: string;
  lineCode: string | undefined;
  badge: DelayBadge;
  delayMinutes: number | undefined;
};

/** What the Run's Open Graph image shows: train number, Line and Delay. */
export function runOgContent(detail: RunDetail): RunOgContent {
  const delay = detail.delaySeconds;
  return {
    serviceType: detail.run.serviceType,
    trainNumber: detail.run.trainNumber,
    lineCode: detail.run.lineCode,
    badge: delayBadge(detail),
    delayMinutes: delay === undefined ? undefined : delayMinutes(delay),
  };
}

export type StationOgContent = {
  stationName: string;
  departures: {
    trainNumber: string;
    serviceType: ServiceType;
    lineCode: string | undefined;
    destinationCode: string;
    time: string;
    badge: DelayBadge;
    delayMinutes: number | undefined;
  }[];
};

/** What the Station's Open Graph image shows: its name and the next departures. */
export function stationOgContent(board: StationBoard): StationOgContent {
  return {
    stationName: board.stationName,
    departures: board.departures.slice(0, OG_DEPARTURES).map((e) => ({
      trainNumber: e.trainNumber,
      serviceType: e.serviceType,
      lineCode: e.lineCode,
      destinationCode: e.counterpartStationCode,
      time: formatMadridTime(e.scheduledAt),
      badge: entryBadge(e),
      delayMinutes: e.delaySeconds === undefined ? undefined : delayMinutes(e.delaySeconds),
    })),
  };
}

export type BadgeLabels = {
  on_time: string;
  cancelled: string;
  unknown: string;
  late: (minutes: number) => string;
};

/** Localised text for a Delay badge. */
export function badgeText(badge: DelayBadge, minutes: number | undefined, l: BadgeLabels): string {
  if (badge === 'on_time' || badge === 'cancelled' || badge === 'unknown') return l[badge];
  return l.late(minutes ?? 0);
}
