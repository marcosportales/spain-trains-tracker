import type { TrainHistory } from '@stt/contracts';
import { delayMinutes } from '../delay/delay-band';

/** Typical Delay under this many seconds reads as "usually on time". */
const ON_TIME_BELOW_S = 60;

export type TypicalDelay =
  | { kind: 'on_time'; runs: number }
  | { kind: 'late'; runs: number; minutes: number }
  | { kind: 'early'; runs: number; minutes: number };

/** The headline of the history: usually on time, X min late, or X min early. Undefined without data. */
export function typicalDelay(history: TrainHistory): TypicalDelay | undefined {
  const { summary } = history;
  if (!summary) return undefined;
  const { typicalSeconds, runs } = summary;
  if (Math.abs(typicalSeconds) < ON_TIME_BELOW_S) return { kind: 'on_time', runs };
  const minutes = Math.abs(delayMinutes(typicalSeconds));
  return typicalSeconds > 0 ? { kind: 'late', runs, minutes } : { kind: 'early', runs, minutes };
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
