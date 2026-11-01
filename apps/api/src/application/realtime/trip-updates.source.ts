import type { Delay, Run } from '../../domain/movement/index.js';
import type { PositionFeed } from './realtime-positions.source.js';

/** What a trip-updates feed says: the Delay of each running Run, and Run facts (status, accessibility). */
export interface TripUpdates {
  /** One Delay per Run that is running. Cancelled Runs have none. */
  readonly delays: Delay[];
  /** One Run per entity whose Run can be identified and typed. */
  readonly runs: Run[];
}

/** Reads the current trip updates of an Official feed. */
export abstract class TripUpdatesSource {
  /** Rejects if the feed fails. */
  abstract fetchTripUpdates(feed: PositionFeed): Promise<TripUpdates>;
}
