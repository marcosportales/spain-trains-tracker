import type { Sighting } from './sighting.js';
import type { Source } from './source.js';

export interface LivePosition {
  /** The Sighting whose position the live Run shows. */
  readonly sighting: Sighting;
  /** Every Source that reported a position for the Run, each once, in a stable order. */
  readonly sources: readonly Source[];
}

/**
 * Picks the position of a Run reported by several Sources (a Catalan regional is in both the
 * Cercanías and the LD feed). A real GPS fix beats a snapped one; between equals the newest wins.
 * Sightings without a position are ignored.
 */
export function chooseLivePosition(sightings: readonly Sighting[]): LivePosition | undefined {
  const positioned = sightings.filter((s) => s.lat !== undefined && s.lon !== undefined);
  let best: Sighting | undefined;
  for (const s of positioned) {
    if (!best || beats(s, best)) best = s;
  }
  if (!best) return undefined;
  const sources = [...new Set(positioned.map((s) => s.source))].sort();
  return { sighting: best, sources };
}

function beats(candidate: Sighting, current: Sighting): boolean {
  if (candidate.positionIsSnapped !== current.positionIsSnapped)
    return !candidate.positionIsSnapped;
  return candidate.observedAt.getTime() > current.observedAt.getTime();
}
