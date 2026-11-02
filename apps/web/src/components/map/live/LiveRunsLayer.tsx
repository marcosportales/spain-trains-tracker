'use client';

import type { RunId } from '@stt/contracts';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { COLORS, DELAY_BAND_COLORS, SERVICE_TYPE_COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { TrackPaths } from '../motion/interpolation';
import { RunMotions } from '../motion/run-motions';
import { syncOnStyle } from '../sync-on-style';
import { type MapRuns, toFeatureCollection } from './live-runs';

const SOURCE_ID = 'live-runs';
const CIRCLE_LAYER_ID = 'live-runs-circles';
const RING_LAYER_ID = 'live-runs-rings';
const LABEL_LAYER_ID = 'live-runs-labels';
const LABEL_MIN_ZOOM = 9;
const DIMMED_OPACITY = 0.4;
const DOT_RADIUS = 4;
const DOT_RADIUS_MOBILE = 4.4;
const MOBILE_QUERY = '(max-width: 767px)';
/** The Delay ring sits this far outside the dot's edge. */
const RING_GAP = 2.6;
const RING_WIDTH = 2.2;

const dotRadius = (): number =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
    ? DOT_RADIUS_MOBILE
    : DOT_RADIUS;

/** Ring stroke by Delay band; only `late` and `severely_late` are ever drawn. */
const ringColorExpression = (theme: Theme) =>
  [
    'match',
    ['get', 'band'],
    'severely_late',
    DELAY_BAND_COLORS[theme].severely_late.strong,
    DELAY_BAND_COLORS[theme].late.strong,
  ] as unknown as string;

/** Dot fill by Service type; a Run with no known type is drawn in muted ink. */
const colorExpression = (theme: Theme) =>
  [
    'match',
    ['get', 'serviceType'],
    ...Object.entries(SERVICE_TYPE_COLORS[theme]).flat(),
    COLORS[theme]['ink-3'],
  ] as unknown as string;

function addLayers(map: MapLibreMap, theme: Theme, dimmed: boolean) {
  const colors = COLORS[theme];
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  // Under the dots, and only for late Runs: on time and unknown ones get no ring.
  map.addLayer({
    id: RING_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['in', ['get', 'band'], ['literal', ['late', 'severely_late']]],
    paint: {
      'circle-radius': dotRadius() + RING_GAP,
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': ringColorExpression(theme),
      'circle-stroke-width': RING_WIDTH,
      'circle-stroke-opacity': dimmed ? DIMMED_OPACITY : 1,
    },
  });
  map.addLayer({
    id: CIRCLE_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': dotRadius(),
      'circle-color': colorExpression(theme),
      // Snapped positions (not real GPS) are drawn hollow, with a Service type stroke; the
      // others get the 1 px outline that keeps every dot legible on the basemap.
      'circle-opacity': ['case', ['get', 'snapped'], 0, dimmed ? DIMMED_OPACITY : 1],
      'circle-stroke-color': [
        'case',
        ['get', 'snapped'],
        colorExpression(theme),
        colors['dot-outline'],
      ],
      'circle-stroke-width': ['case', ['get', 'snapped'], 2, 1],
      'circle-stroke-opacity': dimmed ? DIMMED_OPACITY : 1,
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
    paint: {
      'text-color': colors.ink,
      'text-halo-color': colors.surface,
      'text-halo-width': 1.5,
      'text-opacity': dimmed ? DIMMED_OPACITY : 1,
    },
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
  dimmed = false,
}: {
  map: MapLibreMap | null;
  runs: MapRuns;
  paths?: ReadonlyMap<string, TrackPaths>;
  onSelect?: (id: RunId) => void;
  /** Draws dots and labels at 40 % opacity: the positions are stale (the stream is offline). */
  dimmed?: boolean;
}) {
  // Rebuilt when the Track geometry arrives; Runs then restart from their reported positions.
  const motions = useMemo(
    () => new RunMotions({ ...(paths && { paths }), reducedMotion: prefersReducedMotion() }),
    [paths],
  );
  const { theme } = useTheme();
  const dimmedRef = useRef(dimmed);
  dimmedRef.current = dimmed;
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
    // A ring is part of its Run: clicking it opens the Run like clicking the dot.
    const layers = [CIRCLE_LAYER_ID, RING_LAYER_ID];
    for (const layer of layers) {
      map.on('click', layer, onClick);
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, reset);
    }
    return () => {
      for (const layer of layers) {
        map.off('click', layer, onClick);
        map.off('mouseenter', layer, pointer);
        map.off('mouseleave', layer, reset);
      }
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
      if (!map.getSource(SOURCE_ID)) addLayers(map, theme, dimmedRef.current);
      motions.update(runs, performance.now());
      draw(performance.now());
    };
    const unsubscribe = syncOnStyle(map, SOURCE_ID, sync);
    return () => {
      unsubscribe();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map, runs, motions, theme]);

  useEffect(() => {
    if (!map?.getLayer(CIRCLE_LAYER_ID)) return;
    const opacity = dimmed ? DIMMED_OPACITY : 1;
    map.setPaintProperty(CIRCLE_LAYER_ID, 'circle-opacity', [
      'case',
      ['get', 'snapped'],
      0,
      opacity,
    ]);
    map.setPaintProperty(CIRCLE_LAYER_ID, 'circle-stroke-opacity', opacity);
    map.setPaintProperty(RING_LAYER_ID, 'circle-stroke-opacity', opacity);
    map.setPaintProperty(LABEL_LAYER_ID, 'text-opacity', opacity);
  }, [map, dimmed]);

  // Dots grow slightly on narrow viewports.
  useEffect(() => {
    if (!map) return;
    const query = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      if (!map.getLayer(CIRCLE_LAYER_ID)) return;
      const radius = dotRadius();
      map.setPaintProperty(CIRCLE_LAYER_ID, 'circle-radius', radius);
      map.setPaintProperty(RING_LAYER_ID, 'circle-radius', radius + RING_GAP);
    };
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [map]);

  return null;
}
