import type { Sighting } from '../../domain/movement/index.js';

/** Which official vehicle-positions feed to read. */
export const POSITION_FEEDS = ['cercanias', 'larga-distancia'] as const;
export type PositionFeed = (typeof POSITION_FEEDS)[number];

/** Reads the current vehicle positions of an Official feed as Sightings. */
export abstract class RealtimePositionsSource {
  /** One Sighting per vehicle in the feed whose Run can be identified. Rejects if the feed fails. */
  abstract fetchSightings(feed: PositionFeed): Promise<Sighting[]>;
}
