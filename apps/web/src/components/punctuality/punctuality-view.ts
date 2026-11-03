import type { HourPunctuality, LinePunctuality, PunctualityRanking } from '@stt/contracts';
import { type DelayBand, delayBandFor, delayMinutes, ON_TIME_BELOW_S } from '../delay/delay-band';

export const punctualityPath = '/punctuality';

export type PunctualityHeadline = { kind: 'per_run'; pct: number } | { kind: 'none' };

/** The network-wide On time share (0-1) for the page headline; none when no Line is ranked. */
export function punctualityHeadline(ranking: PunctualityRanking): PunctualityHeadline {
  return ranking.overall === null
    ? { kind: 'none' }
    : { kind: 'per_run', pct: ranking.overall.onTimePct / 100 };
}

export type RankingBar = {
  line: LinePunctuality;
  /** Bar length as a share of the track, 0–100. */
  widthPct: number;
  /** Delay band of the Line's average Delay; it colours the bar. */
  band: DelayBand;
};

/** The ranking worst to best (lowest On time share first); ties keep the API order. */
export function rankingBars(lines: readonly LinePunctuality[]): RankingBar[] {
  return [...lines]
    .sort((a, b) => a.onTimePct - b.onTimePct)
    .map((line) => ({
      line,
      widthPct: line.onTimePct,
      band: delayBandFor(line.avgSeconds),
    }));
}

export type HourBar = {
  hour: number;
  /** Two-digit hour label, `00`–`23`. */
  label: string;
  /** Average Delay in whole minutes; undefined when the hour has no observations. */
  minutes: number | undefined;
  /** Bar height as a share of the worst hour, 0–100. Early hours (negative Delay) have no bar. */
  heightPct: number;
  /** Delay band of the hour's average Delay; it colours the bar. `unknown` when the hour has no data. */
  band: DelayBand;
  /** Number of data points behind the average (0 when the hour has no data). */
  count: number;
};

/** One bar per hour of the day, scaled to the hour with the largest average Delay. */
export function hourBars(hours: readonly HourPunctuality[]): HourBar[] {
  const worst = Math.max(0, ...hours.map((h) => h.avgSeconds ?? 0));
  return hours.map((h) => ({
    hour: h.hour,
    label: String(h.hour).padStart(2, '0'),
    minutes: h.avgSeconds === null ? undefined : delayMinutes(h.avgSeconds),
    heightPct: h.avgSeconds === null || worst === 0 ? 0 : (Math.max(0, h.avgSeconds) / worst) * 100,
    band: delayBandFor(h.avgSeconds ?? undefined),
    count: h.observations,
  }));
}

export type ByHourSummary =
  | { kind: 'none' }
  | { kind: 'calm' }
  | { kind: 'peak'; from: string; to: string };

const hourLabel = (hour: number): string => `${hour % 24}:00`;

/** When delays cluster: the run of late hours around the worst hour, or calm / none. */
export function byHourSummary(hours: readonly HourPunctuality[]): ByHourSummary {
  const avgs = new Map<number, number>();
  for (const h of hours) if (h.avgSeconds !== null) avgs.set(h.hour, h.avgSeconds);
  if (avgs.size === 0) return { kind: 'none' };

  let worstHour = -1;
  for (const [hour, avg] of avgs) {
    if (worstHour === -1 || avg > (avgs.get(worstHour) ?? 0)) worstHour = hour;
  }
  if ((avgs.get(worstHour) ?? 0) < ON_TIME_BELOW_S) return { kind: 'calm' };

  const isLate = (hour: number) => (avgs.get(hour) ?? -Infinity) >= ON_TIME_BELOW_S;
  let first = worstHour;
  while (first > 0 && isLate(first - 1)) first--;
  let last = worstHour;
  while (last < 23 && isLate(last + 1)) last++;
  return { kind: 'peak', from: hourLabel(first), to: hourLabel(last + 1) };
}
