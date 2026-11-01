import type { WindowSighting } from '@stt/contracts';

export interface SightingWindowQuery {
  readonly from: Date;
  readonly to: Date;
  readonly stepSeconds: number;
  /** Restrict to one Train number (normalized). */
  readonly trainNumber?: string;
}

/** Read side of historical replay, over the stored Sightings. */
export abstract class SightingWindowReader {
  /**
   * Sightings with a position observed in `[from, to)`, oldest first. At most one (the earliest)
   * per Run, Source and `stepSeconds` bucket of time.
   */
  abstract sightings(query: SightingWindowQuery): Promise<WindowSighting[]>;
}
