import { z } from 'zod';
import { ServiceDate } from './service-date.js';
import { TrainNumber } from './train-number.js';

/** How one Run of a Train number went on one Service date. */
export const TrainHistoryRun = z.object({
  serviceDate: ServiceDate,
  /** Delay observations behind the figures. */
  observations: z.number().int().positive(),
  /** Average Delay in seconds over the Run; negative when it was early on average. */
  avgSeconds: z.number(),
  /** Largest Delay observed on the Run, in seconds. */
  maxSeconds: z.number().int(),
});
export type TrainHistoryRun = z.infer<typeof TrainHistoryRun>;

/** Typical punctuality of a Train number across the Runs in the window. */
export const TrainHistorySummary = z.object({
  /** Runs with at least one Delay observation. */
  runs: z.number().int().positive(),
  /** Median over Runs of the Run's average Delay, in seconds ("usually X min late"). */
  typicalSeconds: z.number(),
  /** Share of Runs whose average Delay was at most 5 min (early counts as on time), 0–100. */
  onTimePct: z.number().min(0).max(100),
});
export type TrainHistorySummary = z.infer<typeof TrainHistorySummary>;

/** Delay history of a Train number over the last `days` days. `summary` is absent without data. */
export const TrainHistory = z.object({
  trainNumber: TrainNumber,
  days: z.number().int().positive(),
  summary: TrainHistorySummary.optional(),
  /** Newest Service date first. */
  runs: z.array(TrainHistoryRun),
});
export type TrainHistory = z.infer<typeof TrainHistory>;
