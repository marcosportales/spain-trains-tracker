'use client';

import type { TrackFeatureCollection } from '@stt/contracts';
import type { FeatureCollection } from 'geojson';
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';
import { COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { RUNS_HALO_LAYER_ID } from '../live/LiveRunsLayer';
import { STATIONS_ICON_LAYER_ID } from '../stations/StationsLayer';
import { syncOnStyle } from '../sync-on-style';
import type { SplitTrack } from './split-track';

const SOURCE_ID = 'track-geometry';
const LAYER_ID = 'track-geometry-lines';
const ALERT_LAYER_ID = 'track-geometry-alerts';
const SELECTED_SOURCE_ID = 'track-selected';
const TRAVELLED_LAYER_ID = 'track-selected-travelled';
const REMAINING_LAYER_ID = 'track-selected-remaining';
const SELECTED_WIDTH = 4;
const TRAVELLED_OPACITY = 0.4;
/** Track geometry sits under Stations and Runs; whichever of them exists first is the anchor. */
const ABOVE_LAYER_IDS = [STATIONS_ICON_LAYER_ID, RUNS_HALO_LAYER_ID];

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

/** The selected Run's Line: the part behind it dimmed, the part ahead in the accent colour. */
function addSelectedLayers(map: MapLibreMap, theme: Theme) {
  const colors = COLORS[theme];
  map.addSource(SELECTED_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  const before = ABOVE_LAYER_IDS.find((id) => map.getLayer(id));
  const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
  map.addLayer(
    {
      id: TRAVELLED_LAYER_ID,
      type: 'line',
      source: SELECTED_SOURCE_ID,
      filter: ['==', ['get', 'part'], 'travelled'],
      layout,
      paint: {
        'line-color': colors['ink-3'],
        'line-opacity': TRAVELLED_OPACITY,
        'line-width': SELECTED_WIDTH,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: REMAINING_LAYER_ID,
      type: 'line',
      source: SELECTED_SOURCE_ID,
      filter: ['==', ['get', 'part'], 'remaining'],
      layout,
      paint: { 'line-color': colors.accent, 'line-width': SELECTED_WIDTH },
    },
    before,
  );
}

const selectedData = (split: SplitTrack | undefined): FeatureCollection => ({
  type: 'FeatureCollection',
  features: split
    ? [
        ...(split.travelled
          ? [
              {
                type: 'Feature' as const,
                properties: { part: 'travelled' },
                geometry: split.travelled,
              },
            ]
          : []),
        { type: 'Feature' as const, properties: { part: 'remaining' }, geometry: split.remaining },
      ]
    : [],
});

const highlightFilter = (lineCodes: readonly string[]) =>
  ['in', ['get', 'lineCode'], ['literal', [...lineCodes]]] as unknown as FilterSpecification;

/** Draws every Line's Track geometry on `map`, beneath Stations and Runs, with `highlighted` Lines emphasised. */
export function TrackGeometryLayer({
  map,
  track,
  highlighted = [],
  selectedTrack,
}: {
  map: MapLibreMap | null;
  track: TrackFeatureCollection | undefined;
  /** Line codes to emphasise, e.g. those affected by a Service alert. */
  highlighted?: readonly string[];
  /** The selected Run's Line, split at the Run; drawn above the base track. */
  selectedTrack?: SplitTrack | undefined;
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

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      if (!map.getSource(SELECTED_SOURCE_ID)) addSelectedLayers(map, theme);
      (map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource).setData(selectedData(selectedTrack));
    };
    return syncOnStyle(map, SELECTED_SOURCE_ID, sync);
  }, [map, selectedTrack, theme]);

  return null;
}
