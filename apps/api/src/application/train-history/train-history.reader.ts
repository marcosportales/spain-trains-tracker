/** Delay observations of one Run of a Train number, as stored sums. */
export interface RunDelayTotals {
  /** `YYYY-MM-DD` */
  readonly serviceDate: string;
  readonly observations: number;
  readonly totalSeconds: number;
  readonly maxSeconds: number;
}

/** Read side of the per-Train-number history, over the raw Delay observations. */
export abstract class TrainHistoryReader {
  /** One entry per Run of the Train number with Service date from `sinceServiceDate` (inclusive). */
  abstract runTotals(trainNumber: string, sinceServiceDate: string): Promise<RunDelayTotals[]>;
}
