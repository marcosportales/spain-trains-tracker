'use client';

import type { StationList } from '@stt/contracts';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { syncOnStyle } from '../sync-on-style';
import { STATION_LABELS_MIN_ZOOM, STATIONS_MIN_ZOOM, toStationFeatures } from './stations';

const SOURCE_ID = 'stations';
const CIRCLE_LAYER_ID = 'stations-circles';
const LABEL_LAYER_ID = 'stations-labels';
/** Runs are drawn above Stations, so a click on a Run never reaches the Station underneath. */
const RUNS_LAYER_ID = 'live-runs-circles';
/** Fingertip-sized hit box around a Station dot, in pixels. */
const TOUCH_RADIUS = 12;

function addLayers(map: MapLibreMap, theme: Theme) {
  const colors = COLORS[theme];
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  const before = map.getLayer(RUNS_LAYER_ID) ? RUNS_LAYER_ID : undefined;
  map.addLayer(
    {
      id: CIRCLE_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      minzoom: STATIONS_MIN_ZOOM,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], STATIONS_MIN_ZOOM, 3, 13, 6],
        'circle-color': colors.surface,
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': 2,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: STATION_LABELS_MIN_ZOOM,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, -1.1],
        'text-anchor': 'bottom',
      },
      paint: {
        'text-color': colors.ink,
        'text-halo-color': colors.surface,
        'text-halo-width': 1.5,
      },
    },
    before,
  );
}

/**
 * Renders Stations on `map` from a zoom where they are legible. The source is static (set once),
 * so live Run updates never touch it.
 */
export function StationsLayer({
  map,
  stations,
  onSelect,
}: {
  map: MapLibreMap | null;
  stations: StationList;
  onSelect?: (code: string) => void;
}) {
  const { theme } = useTheme();
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!map) return;
    // One map-wide handler with a padded box, so a fingertip can hit a small dot and a Run on top wins.
    const hits = (point: { x: number; y: number }, layer: string) =>
      map.getLayer(layer)
        ? map.queryRenderedFeatures(
            [
              [point.x - TOUCH_RADIUS, point.y - TOUCH_RADIUS],
              [point.x + TOUCH_RADIUS, point.y + TOUCH_RADIUS],
            ],
            { layers: [layer] },
          )
        : [];
    const onClick = (e: MapLayerMouseEvent) => {
      if (hits(e.point, RUNS_LAYER_ID).length > 0) return;
      const code = hits(e.point, CIRCLE_LAYER_ID)[0]?.properties?.code;
      if (typeof code === 'string') select.current?.(code);
    };
    const onMove = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = hits(e.point, CIRCLE_LAYER_ID).length > 0 ? 'pointer' : '';
    };
    map.on('click', onClick);
    map.on('mousemove', onMove);
    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayers(map, theme);
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(toStationFeatures(stations));
    };
    return syncOnStyle(map, SOURCE_ID, sync);
  }, [map, stations, theme]);

  return null;
}
