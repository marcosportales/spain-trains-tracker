import type { Delay, RunStopEstimate, Sighting } from '../../domain/movement/index.js';
import type { StoredRun } from '../movement/movement.repository.js';

/** Everything storage knows about one Run, however old. */
export interface StoredRunDetail {
  readonly run: StoredRun;
  /** The Run's newest Sighting with a position from each Source that reported one. */
  readonly sightings: readonly Sighting[];
  /** The Run's newest Delay. */
  readonly delay?: Delay;
  /** Stop times reported by the Visor feed, in journey order. Empty when it never reported any. */
  readonly stopEstimates: readonly RunStopEstimate[];
}

/** Read side of the Run detail page. */
export abstract class RunDetailReader {
  abstract findRunDetail(
    trainNumber: string,
    serviceDate: string,
  ): Promise<StoredRunDetail | undefined>;
}
