import type { Delay, Run, RunStopEstimate, Sighting } from '../../domain/movement/index.js';

/** Which visor fleet file to read. */
export const VISOR_FLEET_FEEDS = ['larga-distancia', 'cercanias'] as const;
export type VisorFleetFeed = (typeof VISOR_FLEET_FEEDS)[number];

/** What one visor fleet file says about the Runs currently running. */
export interface VisorFleet {
  readonly sightings: Sighting[];
  readonly delays: Delay[];
  /** Runs with their Rolling stock and accessibility; only Runs whose Service type is known. */
  readonly runs: Run[];
}

/**
 * Reads the bodies of Renfe's undocumented visor JSON (the Visor feed, ADR 0005). Entities with
 * missing or malformed fields are left out; a body that is not a visor file at all is rejected.
 */
export abstract class VisorFeed {
  abstract readFleet(feed: VisorFleetFeed, body: Uint8Array): Promise<VisorFleet>;
  /**
   * The Station estimates of the long-distance Runs in a stops file. Only Runs with one of the
   * given Delays get estimates: an estimate is the timetable plus the Delay.
   */
  abstract readStopEstimates(
    body: Uint8Array,
    delays: readonly Delay[],
  ): Promise<RunStopEstimate[]>;
}
