import type { StationList } from '@stt/contracts';
import type { Feature, FeatureCollection, Point } from 'geojson';

/** Stations are hidden below this zoom so the overview stays readable and Runs stay cheap to draw. */
export const STATIONS_MIN_ZOOM = 8;
/** Station names join the dots from here. */
export const STATION_LABELS_MIN_ZOOM = 11;

export type StationProperties = { code: string; name: string };

export function toStationFeatures(
  stations: StationList,
): FeatureCollection<Point, StationProperties> {
  const features: Feature<Point, StationProperties>[] = stations.map((s) => ({
    type: 'Feature',
    id: s.code,
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    properties: { code: s.code, name: s.name },
  }));
  return { type: 'FeatureCollection', features };
}
