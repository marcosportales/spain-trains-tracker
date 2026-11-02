'use client';

import type { TrackFeatureCollection } from '@stt/contracts';
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';
import { COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { syncOnStyle } from '../sync-on-style';

const SOURCE_ID = 'track-geometry';
const LAYER_ID = 'track-geometry-lines';
const ALERT_LAYER_ID = 'track-geometry-alerts';
/** Track geometry sits under Stations and Runs; whichever of them exists first is the anchor. */
const ABOVE_LAYER_IDS = ['stations-circles', 'live-runs-circles'];

function addLayer(map: MapLibreMap, theme: Theme) {
  const colors = COLORS[theme];
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
        'line-color': colors['ink-3'],
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 12, 2.5],
      },
    },
    before,
  );
  // Lines hit by a Service alert are redrawn on top in the accent colour (amber is reserved for
  // Delay bands); the filter picks which.
  map.addLayer(
    {
      id: ALERT_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: highlightFilter([]),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.accent,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 12, 5],
      },
    },
    before,
  );
}

const highlightFilter = (lineCodes: readonly string[]) =>
  ['in', ['get', 'lineCode'], ['literal', [...lineCodes]]] as unknown as FilterSpecification;

/** Draws every Line's Track geometry on `map`, beneath Stations and Runs, with `highlighted` Lines emphasised. */
export function TrackGeometryLayer({
  map,
  track,
  highlighted = [],
}: {
  map: MapLibreMap | null;
  track: TrackFeatureCollection | undefined;
  /** Line codes to emphasise, e.g. those affected by a Service alert. */
  highlighted?: readonly string[];
}) {
  const { theme } = useTheme();
  const highlightKey = highlighted.join(',');
  useEffect(() => {
    if (!map || !track) return;
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayer(map, theme);
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(track);
      map.setFilter(ALERT_LAYER_ID, highlightFilter(highlightKey ? highlightKey.split(',') : []));
    };
    return syncOnStyle(map, SOURCE_ID, sync);
  }, [map, track, highlightKey, theme]);

  return null;
}
