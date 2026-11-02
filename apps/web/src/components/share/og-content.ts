import type { RunDetail, ServiceType, StationBoard } from '@stt/contracts';
import { type DelayBand, delayMinutes } from '../delay/delay-band';
import { delayBand, formatMadridTime } from '../run/run-detail-view';
import { entryBand } from '../station/station-board-view';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_DEPARTURES = 3;

export type RunOgContent = {
  serviceType: ServiceType;
  trainNumber: string;
  lineCode: string | undefined;
  badge: DelayBand;
  delayMinutes: number | undefined;
};

/** What the Run's Open Graph image shows: train number, Line and Delay. */
export function runOgContent(detail: RunDetail): RunOgContent {
  const delay = detail.delaySeconds;
  return {
    serviceType: detail.run.serviceType,
    trainNumber: detail.run.trainNumber,
    lineCode: detail.run.lineCode,
    badge: delayBand(detail),
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
    badge: DelayBand;
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
      badge: entryBand(e),
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
export function badgeText(badge: DelayBand, minutes: number | undefined, l: BadgeLabels): string {
  if (badge === 'late' || badge === 'severely_late') return l.late(minutes ?? 0);
  return l[badge];
}
