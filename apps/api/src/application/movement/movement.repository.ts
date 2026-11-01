import type {
  Delay,
  Run,
  RunStopEstimate,
  ServiceAlert,
  Sighting,
  Source,
} from '../../domain/movement/index.js';

/** Storage for the history of Runs: Sightings, Delays and Service alerts. */
export abstract class MovementRepository {
  /**
   * Stores Sightings in one batch. A Sighting of the same Run, Source and `observedAt` as a stored
   * one is ignored. Returns how many were new.
   */
  abstract saveSightings(sightings: readonly Sighting[]): Promise<number>;
  /** Same as `saveSightings`, for Delays. */
  abstract saveDelays(delays: readonly Delay[]): Promise<number>;
  /**
   * Creates the Runs that are unknown and updates the others, setting `lastSeenAt`. Optional fields
   * the Run does not carry keep their stored value.
   */
  abstract touchRuns(runs: readonly Run[], seenAt: Date): Promise<void>;
  abstract findRun(trainNumber: string, serviceDate: string): Promise<StoredRun | undefined>;

  /**
   * For every Run that appears in `estimates`, replaces all its stored estimates with the given
   * ones. Runs not in `estimates` are untouched.
   */
  abstract replaceStopEstimates(estimates: readonly RunStopEstimate[]): Promise<void>;
  /** The stored estimates of a Run, in journey order. */
  abstract listStopEstimates(trainNumber: string, serviceDate: string): Promise<RunStopEstimate[]>;

  /** Inserts or replaces Service alerts by id. */
  abstract saveServiceAlerts(alerts: readonly ServiceAlert[]): Promise<void>;
  /** Service alerts of a Source, or all of them. */
  abstract listServiceAlerts(source?: Source): Promise<ServiceAlert[]>;
}

export interface StoredRun extends Run {
  readonly lastSeenAt: Date;
}
