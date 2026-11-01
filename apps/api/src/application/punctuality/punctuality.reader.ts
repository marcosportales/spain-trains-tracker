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

  /** Sums per Madrid hour of day, over buckets at or after `since`; only hours with data are present. */
  abstract hourTotals(since: Date, lineCode?: string): Promise<HourDelayTotals[]>;
}
