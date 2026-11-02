import type { ServiceType } from '../../domain/network/index.js';

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

/** Read side of the punctuality statistics, over the Delay aggregates: Runs by final Delay, observations by hour. */
export abstract class PunctualityReader {
  /** Per-Line Run counts for Runs whose Service date is `sinceServiceDate` (`YYYY-MM-DD`) or later. Lines with no Runs are absent. */
  abstract lineRunTotals(sinceServiceDate: string): Promise<LineRunTotals[]>;

  /** Sums per Madrid hour of day, over buckets at or after `since`; only hours with data are present. */
  abstract hourTotals(since: Date, lineCode?: string): Promise<HourDelayTotals[]>;
}
