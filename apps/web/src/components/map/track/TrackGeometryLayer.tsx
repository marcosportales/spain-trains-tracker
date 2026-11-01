'use client';

import type { TrackFeatureCollection } from '@stt/contracts';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';

const SOURCE_ID = 'track-geometry';
const LAYER_ID = 'track-geometry-lines';
/** Track geometry sits under Stations and Runs; whichever of them exists first is the anchor. */
const ABOVE_LAYER_IDS = ['stations-circles', 'live-runs-circles'];

function addLayer(map: MapLibreMap) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  const before = ABOVE_LAYER_IDS.find((id) => map.getLayer(id));
  map.addLayer(
    {
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#64748b',
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 12, 2.5],
      },
    },
    before,
  );
}

/** Draws every Line's Track geometry on `map`, beneath Stations and Runs. */
export function TrackGeometryLayer({
  map,
  track,
}: {
  map: MapLibreMap | null;
  track: TrackFeatureCollection | undefined;
}) {
  useEffect(() => {
    if (!map || !track) return;
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayer(map);
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(track);
    };
    if (map.getSource(SOURCE_ID) || map.isStyleLoaded()) sync();
    else map.once('load', sync);
    return () => {
      map.off('load', sync);
    };
  }, [map, track]);

  return null;
}
