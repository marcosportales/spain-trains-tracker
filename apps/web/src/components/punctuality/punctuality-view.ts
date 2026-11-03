import type { HourPunctuality, LinePunctuality, PunctualityRanking } from '@stt/contracts';
import { delayMinutes } from '../delay/delay-band';

export const punctualityPath = '/punctuality';

export type PunctualityHeadline = { kind: 'per_run'; pct: number } | { kind: 'none' };

/** The network-wide On time share (0-1) for the page headline; none when no Line is ranked. */
export function punctualityHeadline(ranking: PunctualityRanking): PunctualityHeadline {
  return ranking.overall === null
    ? { kind: 'none' }
    : { kind: 'per_run', pct: ranking.overall.onTimePct / 100 };
}

export type SortKey = 'lineCode' | 'onTimePct' | 'avgSeconds' | 'runs';
export type SortDirection = 'asc' | 'desc';

/** The ranking sorted by a column. Ties keep Line code order. */
export function sortLines(
  lines: readonly LinePunctuality[],
  key: SortKey,
  direction: SortDirection,
): LinePunctuality[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...lines].sort((a, b) => {
    const diff = key === 'lineCode' ? a.lineCode.localeCompare(b.lineCode) : a[key] - b[key];
    return sign * diff || a.lineCode.localeCompare(b.lineCode);
  });
}

export type HourBar = {
  hour: number;
  /** Two-digit hour label, `00`–`23`. */
  label: string;
  /** Average Delay in whole minutes; undefined when the hour has no observations. */
  minutes: number | undefined;
  /** Bar height as a share of the worst hour, 0–100. Early hours (negative Delay) have no bar. */
  heightPct: number;
};

/** One bar per hour of the day, scaled to the hour with the largest average Delay. */
export function hourBars(hours: readonly HourPunctuality[]): HourBar[] {
  const worst = Math.max(0, ...hours.map((h) => h.avgSeconds ?? 0));
  return hours.map((h) => ({
    hour: h.hour,
    label: String(h.hour).padStart(2, '0'),
    minutes: h.avgSeconds === null ? undefined : delayMinutes(h.avgSeconds),
    heightPct: h.avgSeconds === null || worst === 0 ? 0 : (Math.max(0, h.avgSeconds) / worst) * 100,
  }));
}
