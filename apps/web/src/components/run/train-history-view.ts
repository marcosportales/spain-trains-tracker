import type { TrainHistory } from '@stt/contracts';
import { delayMinutes, ON_TIME_BELOW_S } from '../delay/delay-band';

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
