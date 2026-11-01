import type { Delay } from '../../domain/movement/index.js';
import type { MovementRepository } from '../movement/movement.repository.js';
import type { VisorFeed, VisorFleetFeed } from '../realtime/visor-feed.js';
import type { RunIngestCycle } from './run-ingest-cycle.use-case.js';

/**
 * Feeds the Visor feed into the same ingest cycle as the Official feeds: its Sightings merge into
 * the Runs the Official feeds already report, by Train number. Station estimates are the stops
 * file's timetable plus the Delays the long-distance fleet file gave most recently.
 */
export class IngestVisorFeed {
  private longDistanceDelays: readonly Delay[] = [];

  constructor(
    private readonly feed: VisorFeed,
    private readonly cycle: RunIngestCycle,
    private readonly repository: MovementRepository,
  ) {}

  async fleet(feed: VisorFleetFeed, body: Uint8Array): Promise<void> {
    const { sightings, delays, runs } = await this.feed.readFleet(feed, body);
    await this.cycle.execute({ sightings, delays, runs });
    if (feed === 'larga-distancia') this.longDistanceDelays = delays;
  }

  async stops(body: Uint8Array): Promise<void> {
    const estimates = await this.feed.readStopEstimates(body, this.longDistanceDelays);
    await this.repository.replaceStopEstimates(estimates);
  }
}
