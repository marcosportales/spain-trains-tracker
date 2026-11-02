'use client';

import type { RunId } from '@stt/contracts';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { COLORS, SERVICE_TYPE_COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { TrackPaths } from '../motion/interpolation';
import { RunMotions } from '../motion/run-motions';
import { syncOnStyle } from '../sync-on-style';
import { type MapRuns, toFeatureCollection } from './live-runs';

const SOURCE_ID = 'live-runs';
const CIRCLE_LAYER_ID = 'live-runs-circles';
const LABEL_LAYER_ID = 'live-runs-labels';
const LABEL_MIN_ZOOM = 9;

/** Dot fill by Service type; a Run with no known type is drawn in muted ink. */
const colorExpression = (theme: Theme) =>
  [
    'match',
    ['get', 'serviceType'],
    ...Object.entries(SERVICE_TYPE_COLORS[theme]).flat(),
    COLORS[theme]['ink-3'],
  ] as unknown as string;

function addLayers(map: MapLibreMap, theme: Theme) {
  const colors = COLORS[theme];
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
      'circle-color': colorExpression(theme),
      // Snapped positions (not real GPS) are drawn hollow, with a Service type stroke; the
      // others get the 1 px outline that keeps every dot legible on the basemap.
      'circle-opacity': ['case', ['get', 'snapped'], 0, 1],
      'circle-stroke-color': [
        'case',
        ['get', 'snapped'],
        colorExpression(theme),
        colors['dot-outline'],
      ],
      'circle-stroke-width': ['case', ['get', 'snapped'], 2, 1],
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
    paint: { 'text-color': colors.ink, 'text-halo-color': colors.surface, 'text-halo-width': 1.5 },
  });
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Renders live Runs on `map`, updating the GeoJSON source in place on every diff. Runs glide
 * between consecutive positions (along `paths`, the Track geometry by Line code, when they have
 * one), unless the user prefers reduced motion.
 */
export function LiveRunsLayer({
  map,
  runs,
  paths,
  onSelect,
}: {
  map: MapLibreMap | null;
  runs: MapRuns;
  paths?: ReadonlyMap<string, TrackPaths>;
  onSelect?: (id: RunId) => void;
}) {
  // Rebuilt when the Track geometry arrives; Runs then restart from their reported positions.
  const motions = useMemo(
    () => new RunMotions({ ...(paths && { paths }), reducedMotion: prefersReducedMotion() }),
    [paths],
  );
  const { theme } = useTheme();
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties;
      if (props)
        select.current?.({ serviceDate: props.serviceDate, trainNumber: props.trainNumber });
    };
    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const reset = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', CIRCLE_LAYER_ID, onClick);
    map.on('mouseenter', CIRCLE_LAYER_ID, pointer);
    map.on('mouseleave', CIRCLE_LAYER_ID, reset);
    return () => {
      map.off('click', CIRCLE_LAYER_ID, onClick);
      map.off('mouseenter', CIRCLE_LAYER_ID, pointer);
      map.off('mouseleave', CIRCLE_LAYER_ID, reset);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    let frame: number | undefined;
    const draw = (now: number) => {
      // Gone while a style change is loading; the `style.load` sync draws again.
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) return;
      source.setData(toFeatureCollection(runs, motions.positionsAt(now)));
      frame = motions.isAnimating(now) ? requestAnimationFrame(draw) : undefined;
    };
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayers(map, theme);
      motions.update(runs, performance.now());
      draw(performance.now());
    };
    const unsubscribe = syncOnStyle(map, SOURCE_ID, sync);
    return () => {
      unsubscribe();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map, runs, motions, theme]);

  return null;
}
