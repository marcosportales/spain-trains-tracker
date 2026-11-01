import type { LiveRun, RunId, ServiceType } from '@stt/contracts';
import type { Feature, FeatureCollection, Point } from 'geojson';

/** A Run as drawn on the map. Replayed Sightings carry no Service type, so it is optional. */
export type MapRun = Omit<LiveRun, 'serviceType'> & { serviceType?: ServiceType | undefined };

/** Live Runs keyed by `runKey`, so a diff touches only the Runs it names. */
export type LiveRuns = ReadonlyMap<string, LiveRun>;

/** Runs to draw, keyed by `runKey`: live ones or a replayed instant. */
export type MapRuns = ReadonlyMap<string, MapRun>;

export const initialLiveRuns: LiveRuns = new Map();

export type LiveRunsAction =
  | { type: 'snapshot'; runs: readonly LiveRun[] }
  | { type: 'diff'; upserted: readonly LiveRun[]; removed: readonly RunId[] }
  | { type: 'reset' };

export const runKey = (id: RunId): string => `${id.serviceDate}:${id.trainNumber}`;

export function liveRunsReducer(state: LiveRuns, action: LiveRunsAction): LiveRuns {
  switch (action.type) {
    case 'snapshot':
      return new Map(action.runs.map((run) => [runKey(run), run]));
    case 'diff': {
      const next = new Map(state);
      for (const id of action.removed) next.delete(runKey(id));
      for (const run of action.upserted) next.set(runKey(run), run);
      return next;
    }
    case 'reset':
      return initialLiveRuns;
  }
}

/** Cercanías positions at or approaching a Station are snapped to it; only `in_transit_to` is real GPS. */
export const isSnapped = (run: Pick<LiveRun, 'status'>): boolean => run.status !== 'in_transit_to';

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  cercanias: '#e11d48',
  ave: '#7c3aed',
  larga_distancia: '#2563eb',
  media_distancia: '#ea580c',
  ancho_metrico: '#16a34a',
};

export type LiveRunProperties = {
  serviceType?: ServiceType | undefined;
  label: string;
  snapped: boolean;
} & RunId;

/** `positions` overrides where a Run is drawn (its animated position); the reported one is the default. */
export function toFeatureCollection(
  runs: MapRuns,
  positions?: ReadonlyMap<string, readonly [number, number]>,
): FeatureCollection<Point, LiveRunProperties> {
  const features: Feature<Point, LiveRunProperties>[] = [];
  for (const [key, run] of runs) {
    features.push({
      type: 'Feature',
      id: key,
      geometry: { type: 'Point', coordinates: [...(positions?.get(key) ?? [run.lon, run.lat])] },
      properties: {
        serviceType: run.serviceType,
        label: run.lineCode ?? run.trainNumber,
        snapped: isSnapped(run),
        serviceDate: run.serviceDate,
        trainNumber: run.trainNumber,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
