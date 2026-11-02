import { nearestPointOnLine } from '@turf/nearest-point-on-line';
import type { LineString, Position } from 'geojson';
import type { LngLat, TrackPaths } from '../motion/interpolation';

export type SplitTrack = {
  /** The part the Run has left behind; absent when there is no way to tell which side that is. */
  travelled?: LineString;
  /** The part still ahead of the Run. */
  remaining: LineString;
};

/** Squared planar distance in degrees, longitude scaled by latitude: enough to tell near from far. */
const distance = (a: Position, b: Position): number =>
  ((a[0] as number) - (b[0] as number)) ** 2 * Math.cos(((a[1] as number) * Math.PI) / 180) ** 2 +
  ((a[1] as number) - (b[1] as number)) ** 2;

const line = (coordinates: Position[]): LineString => ({ type: 'LineString', coordinates });

/**
 * Splits the Track geometry the Run is on at its position: the nearest path, cut at the nearest
 * point on it. The remaining side is the one whose far end is nearer to `towards` (the next
 * Station); without it the whole path is remaining. Undefined when there are no paths.
 */
export function splitTrack(
  paths: TrackPaths,
  position: LngLat,
  towards?: LngLat,
): SplitTrack | undefined {
  let best: { path: LineString; point: Position; index: number } | undefined;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    const nearest = nearestPointOnLine(path, position, { units: 'kilometers' });
    const km = nearest.properties.dist ?? Number.POSITIVE_INFINITY;
    if (km < bestKm) {
      bestKm = km;
      best = {
        path: path.geometry,
        point: nearest.geometry.coordinates,
        index: nearest.properties.index ?? 0,
      };
    }
  }
  if (!best) return undefined;

  const { path, point, index } = best;
  if (!towards) return { remaining: path };

  const first = [...path.coordinates.slice(0, index + 1), point];
  const second = [point, ...path.coordinates.slice(index + 1)];
  // The far end of `first` is the path's start, of `second` its end.
  const startKm = distance(path.coordinates[0] as Position, towards);
  const endKm = distance(path.coordinates.at(-1) as Position, towards);
  const [travelled, remaining] = endKm <= startKm ? [first, second] : [second, first];
  // A piece of a single point (the Run sits on the path's end) has nothing to draw.
  return {
    ...(travelled.length > 1 && { travelled: line(travelled) }),
    remaining: line(remaining.length > 1 ? remaining : [point, point]),
  };
}
