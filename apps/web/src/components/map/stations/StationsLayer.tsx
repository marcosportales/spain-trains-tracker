'use client';

import type { StationList } from '@stt/contracts';
import type {
  ExpressionSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { ALWAYS_SHOWN, addMarkerImages } from '../icons/marker-icons';
import { RUNS_HALO_LAYER_ID, RUNS_ICON_LAYER_ID } from '../live/LiveRunsLayer';
import { syncOnStyle } from '../sync-on-style';
import { STATION_LABELS_MIN_ZOOM, STATIONS_MIN_ZOOM, toStationFeatures } from './stations';

const SOURCE_ID = 'stations';
/** The Station badges; Track geometry anchors below this id. */
export const STATIONS_ICON_LAYER_ID = 'stations-icons';
const RING_LAYER_ID = 'stations-selected';
const LABEL_LAYER_ID = 'stations-labels';
/** Fingertip-sized hit box around a Station badge, in pixels. */
const TOUCH_RADIUS = 12;
/** Badges grow from a plain square at the first zoom they show to a legible pictogram. */
const ICON_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  STATIONS_MIN_ZOOM,
  0.65,
  13,
  1.15,
];

const ringFilter = (code: string | undefined): ExpressionSpecification => [
  '==',
  ['get', 'code'],
  code ?? '',
];

function addLayers(map: MapLibreMap, theme: Theme, selectedCode: string | undefined) {
  const colors = COLORS[theme];
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  addMarkerImages(map, theme, 'station');
  // Every Run layer (halo, Delay frames, badges) is drawn above Stations, so a Station never
  // covers a Run and a click on a Run never reaches the Station underneath.
  const before = map.getLayer(RUNS_HALO_LAYER_ID) ? RUNS_HALO_LAYER_ID : undefined;
  map.addLayer(
    {
      id: STATIONS_ICON_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: STATIONS_MIN_ZOOM,
      layout: {
        'icon-image': 'station',
        'icon-size': ICON_SIZE,
        ...ALWAYS_SHOWN,
      },
    },
    before,
  );
  // The selected Station: an accent frame just outside the badge.
  map.addLayer(
    {
      id: RING_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: STATIONS_MIN_ZOOM,
      filter: ringFilter(selectedCode),
      layout: {
        'icon-image': 'station-selected',
        'icon-size': ICON_SIZE,
        ...ALWAYS_SHOWN,
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
  selectedCode,
}: {
  map: MapLibreMap | null;
  stations: StationList;
  onSelect?: (code: string) => void;
  /** The Station whose board is open: drawn with an accent frame. */
  selectedCode?: string | undefined;
}) {
  const { theme } = useTheme();
  const select = useRef(onSelect);
  select.current = onSelect;
  const selectedRef = useRef(selectedCode);
  selectedRef.current = selectedCode;

  useEffect(() => {
    if (!map) return;
    // One map-wide handler with a padded box, so a fingertip can hit a small badge and a Run on top wins.
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
      if (hits(e.point, RUNS_ICON_LAYER_ID).length > 0) return;
      const code = hits(e.point, STATIONS_ICON_LAYER_ID)[0]?.properties?.code;
      if (typeof code === 'string') select.current?.(code);
    };
    const onMove = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor =
        hits(e.point, STATIONS_ICON_LAYER_ID).length > 0 ? 'pointer' : '';
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
      if (!map.getSource(SOURCE_ID)) addLayers(map, theme, selectedRef.current);
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(toStationFeatures(stations));
    };
    return syncOnStyle(map, SOURCE_ID, sync);
  }, [map, stations, theme]);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      if (map.getLayer(RING_LAYER_ID)) map.setFilter(RING_LAYER_ID, ringFilter(selectedCode));
    };
    return syncOnStyle(map, SOURCE_ID, sync);
  }, [map, selectedCode]);

  return null;
}
