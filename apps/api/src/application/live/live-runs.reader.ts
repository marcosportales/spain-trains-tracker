import type { Delay, RunId, Sighting } from '../../domain/movement/index.js';
import type { ServiceType } from '../../domain/network/index.js';

/** Optional filters on live Runs. All given filters must match. */
export interface LiveRunsFilter {
  readonly serviceType?: ServiceType;
  /** Code of a Hub: the Run's Line belongs to it. */
  readonly hubCode?: string;
  readonly lineCode?: string;
}

/** What storage knows about one Run that was seen recently, before a position is chosen. */
export interface RecentRun {
  readonly runId: RunId;
  readonly serviceType: ServiceType;
  readonly lineCode?: string;
  /** The Run's newest Sighting with a position from each Source that reported one since the cutoff. */
  readonly sightings: readonly Sighting[];
  /** The Run's newest Delay since the cutoff. */
  readonly delay?: Delay;
}

/** Read side of the live view: Runs seen recently. */
export abstract class LiveRunsReader {
  /** Runs with a positioned Sighting observed at or after `since`, matching `filter`. */
  abstract listRecentRuns(since: Date, filter: LiveRunsFilter): Promise<RecentRun[]>;
}
