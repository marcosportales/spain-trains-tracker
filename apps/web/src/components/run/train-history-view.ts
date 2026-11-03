import type { TrainHistory } from '@stt/contracts';
import { type DelayBand, delayBandFor, delayMinutes, ON_TIME_BELOW_S } from '../delay/delay-band';

export type TypicalDelay =
  | { kind: 'on_time'; runs: number }
  | { kind: 'late'; runs: number; minutes: number };

/** The headline of the history: usually on time or X min late. Undefined without data. */
export function typicalDelay(history: TrainHistory): TypicalDelay | undefined {
  const { summary } = history;
  if (!summary) return undefined;
  const { typicalSeconds, runs } = summary;
  if (typicalSeconds < ON_TIME_BELOW_S) return { kind: 'on_time', runs };
  return { kind: 'late', runs, minutes: delayMinutes(typicalSeconds) };
}

export type HistoryRow = {
  serviceDate: string;
  /** Average Delay of the Run in whole minutes; negative when early. */
  minutes: number;
  maxMinutes: number;
};

/** The most recent `limit` Runs, newest first. */
export function recentRuns(history: TrainHistory, limit = 7): HistoryRow[] {
  return history.runs.slice(0, limit).map((run) => ({
    serviceDate: run.serviceDate,
    minutes: delayMinutes(run.avgSeconds),
    maxMinutes: delayMinutes(run.maxSeconds),
  }));
}

/** Tallest a history bar gets (the worst Run), and the sliver kept so an on-time Run stays visible. */
export const BAR_MAX_PX = 40;
export const BAR_FLOOR_PX = 2;

export type HistoryBar = HistoryRow & {
  band: DelayBand;
  heightPx: number;
};

/** The recent Runs as chart bars, oldest first; height is proportional to the minutes late. */
export function historyBars(history: TrainHistory, limit = 7): HistoryBar[] {
  const runs = history.runs.slice(0, limit).reverse();
  const worst = Math.max(0, ...runs.map((run) => delayMinutes(run.avgSeconds)));
  return runs.map((run) => {
    const minutes = delayMinutes(run.avgSeconds);
    return {
      serviceDate: run.serviceDate,
      minutes,
      maxMinutes: delayMinutes(run.maxSeconds),
      band: delayBandFor(run.avgSeconds),
      heightPx:
        worst === 0
          ? BAR_FLOOR_PX
          : Math.max(BAR_FLOOR_PX, (BAR_MAX_PX * Math.max(0, minutes)) / worst),
    };
  });
}

/** "30 oct": a Service date as a short day and month. */
export const formatServiceDate = (serviceDate: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${serviceDate}T00:00:00Z`))
    .replace('.', '');
