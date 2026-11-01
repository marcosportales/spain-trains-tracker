import type { RunId, Source } from '../../domain/movement/index.js';
import type { ServiceType } from '../../domain/network/index.js';

/** Position of a Run relative to its next Station. */
export type LiveRunStatus = 'incoming_at' | 'stopped_at' | 'in_transit_to';

/** The latest known state of a Run that has a position. */
export interface LiveRun {
  readonly runId: RunId;
  readonly serviceType: ServiceType;
  readonly lineCode?: string;
  readonly lat: number;
  readonly lon: number;
  readonly status: LiveRunStatus;
  readonly delaySeconds?: number;
  readonly nextStationCode?: string;
  readonly sources: readonly Source[];
  readonly observedAt: Date;
}

/** The Runs that changed in one ingest cycle. */
export interface LiveUpdate {
  /** Increases with every cycle, also across worker restarts. */
  readonly cycleId: number;
  readonly upserted: readonly LiveRun[];
}

/** Tells the API that a cycle changed live Runs. Readers fetch the changes from the database. */
export abstract class LiveUpdatesPublisher {
  abstract publish(update: LiveUpdate): Promise<void>;
}
