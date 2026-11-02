import type { ServiceType } from '../../domain/network/index.js';

/** Delay observations of one Line over a window, as stored sums. */
export interface LineDelayTotals {
  readonly lineCode: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly hubCode?: string;
  readonly observations: number;
  readonly totalSeconds: number;
  /** Observations with a Delay of at most 5 min. */
  readonly onTimeObservations: number;
}

/** Runs of one Line over a window, counted once each by their final Delay (ADR 0007). */
export interface LineRunTotals {
  readonly lineCode: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly hubCode?: string;
  /** Runs with at least one Delay in the window, cancelled Runs excluded. */
  readonly runs: number;
  /** Runs whose final Delay is under 5 min (early counts as On time). */
  readonly onTimeRuns: number;
  readonly totalFinalSeconds: number;
}

/** Delay observations that fell in one hour of the day (Madrid time), as stored sums. */
export interface HourDelayTotals {
  readonly hour: number;
  readonly observations: number;
  readonly totalSeconds: number;
  readonly onTimeObservations: number;
}

/** Read side of the punctuality statistics, over the Delay aggregates (hourly buckets). */
export abstract class PunctualityReader {
  /** Per-Line sums of the hourly buckets starting at or after `since`. Lines with no data are absent. */
  abstract lineTotals(since: Date): Promise<LineDelayTotals[]>;

  /** Per-Line Run counts for Runs whose Service date is `sinceServiceDate` (`YYYY-MM-DD`) or later. Lines with no Runs are absent. */
  abstract lineRunTotals(sinceServiceDate: string): Promise<LineRunTotals[]>;

  /** Sums per Madrid hour of day, over buckets at or after `since`; only hours with data are present. */
  abstract hourTotals(since: Date, lineCode?: string): Promise<HourDelayTotals[]>;
}
