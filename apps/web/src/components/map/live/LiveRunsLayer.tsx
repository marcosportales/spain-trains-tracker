'use client';

import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';
import { SERVICE_TYPE_COLORS, toFeatureCollection } from './live-runs';
import { type LiveRunFilters, useLiveRuns } from './use-live-runs';

const SOURCE_ID = 'live-runs';
const CIRCLE_LAYER_ID = 'live-runs-circles';
const LABEL_LAYER_ID = 'live-runs-labels';
const LABEL_MIN_ZOOM = 9;

const colorExpression = [
  'match',
  ['get', 'serviceType'],
  ...Object.entries(SERVICE_TYPE_COLORS).flat(),
  '#6b7280',
] as unknown as string;

function addLayers(map: MapLibreMap) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: CIRCLE_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 12, 8],
      'circle-color': colorExpression,
      // Snapped positions (not real GPS) are drawn hollow.
      'circle-opacity': ['case', ['get', 'snapped'], 0, 1],
      'circle-stroke-color': colorExpression,
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: LABEL_MIN_ZOOM,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-allow-overlap': false,
    },
    paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  });
}

/** Renders live Runs on `map`, updating the GeoJSON source in place on every diff. */
export function LiveRunsLayer({
  map,
  filters,
}: {
  map: MapLibreMap | null;
  filters?: LiveRunFilters;
}) {
  const runs = useLiveRuns(filters);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayers(map);
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(toFeatureCollection(runs));
    };
    // `isStyleLoaded()` dips to false while a source reloads, so once the layers exist
    // we push data straight away instead of waiting for a `load` that will not fire again.
    if (map.getSource(SOURCE_ID) || map.isStyleLoaded()) sync();
    else map.once('load', sync);
    return () => {
      map.off('load', sync);
    };
  }, [map, runs]);

  return null;
}
