import type { ServiceType, TrackFeatureCollection } from '@stt/contracts';
import { along } from '@turf/along';
import { lineString } from '@turf/helpers';
import { nearestPointOnLine } from '@turf/nearest-point-on-line';
import type { Feature, LineString } from 'geojson';

export type LngLat = [number, number];
/** Position of a Run for a progress `t` in `[0, 1]`. */
export type Motion = (t: number) => LngLat;
/** The Track geometry of one Line, as separate paths. */
export type TrackPaths = readonly Feature<LineString>[];

/** A position further than this from the Track geometry is not on it, so we do not snap to it. */
const MAX_SNAP_KM = 1;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Slow start and finish, so straight-line moves do not read as teleports. */
export function easeInOut(t: number): number {
  const p = clamp01(t);
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

export function lerp(from: LngLat, to: LngLat, t: number): LngLat {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/** Track geometry grouped by Line code; MultiLineStrings are flattened into one path per part. */
export function trackPathsByLine(track: TrackFeatureCollection): Map<string, TrackPaths> {
  const byLine = new Map<string, Feature<LineString>[]>();
  for (const feature of track.features) {
    const lineCode = feature.properties.lineCode;
    if (typeof lineCode !== 'string') continue;
    const parts =
      feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    const paths = byLine.get(lineCode) ?? [];
    for (const part of parts) paths.push(lineString(part));
    byLine.set(lineCode, paths);
  }
  return byLine;
}

type Projection = { distanceKm: number; offTrackKm: number };

const project = (path: Feature<LineString>, point: LngLat): Projection => {
  const { properties } = nearestPointOnLine(path, point, { units: 'kilometers' });
  return { distanceKm: properties.location, offTrackKm: properties.dist };
};

/** The path both positions sit on (the closest pair), with where each sits along it. */
function bestPath(paths: TrackPaths, from: LngLat, to: LngLat) {
  let best: { path: Feature<LineString>; start: number; end: number } | undefined;
  let bestOffTrack = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    const a = project(path, from);
    const b = project(path, to);
    if (a.offTrackKm > MAX_SNAP_KM || b.offTrackKm > MAX_SNAP_KM) continue;
    const offTrack = a.offTrackKm + b.offTrackKm;
    if (offTrack < bestOffTrack) {
      bestOffTrack = offTrack;
      best = { path, start: a.distanceKm, end: b.distanceKm };
    }
  }
  return best;
}

type MotionInput = {
  from: LngLat;
  to: LngLat;
  serviceType: ServiceType | undefined;
  /** Track geometry of the Run's Line, if known. */
  paths?: TrackPaths | undefined;
};

/**
 * How a Run travels between two consecutive positions. Cercanías Runs follow their Line's Track
 * geometry (projected onto it, interpolated by distance); every other Service type, or a Cercanías
 * Run that is not on its Track geometry, eases along a straight line.
 */
export function makeMotion({ from, to, serviceType, paths }: MotionInput): Motion {
  const straight: Motion = (t) => (t <= 0 ? from : t >= 1 ? to : lerp(from, to, easeInOut(t)));
  if (serviceType !== 'cercanias' || !paths?.length) return straight;
  if (from[0] === to[0] && from[1] === to[1]) return straight;

  const onTrack = bestPath(paths, from, to);
  if (!onTrack) return straight;
  const { path, start, end } = onTrack;
  return (t) => {
    if (t <= 0) return from;
    if (t >= 1) return to;
    const km = start + (end - start) * t;
    return along(path, km, { units: 'kilometers' }).geometry.coordinates as LngLat;
  };
}
