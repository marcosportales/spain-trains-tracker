'use client';

import type { RunId } from '@stt/contracts';
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
} from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { COLORS, type Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { ALWAYS_SHOWN, addMarkerImages } from '../icons/marker-icons';
import type { TrackPaths } from '../motion/interpolation';
import { RunMotions } from '../motion/run-motions';
import { syncOnStyle } from '../sync-on-style';
import { type MapRuns, toFeatureCollection } from './live-runs';

const SOURCE_ID = 'live-runs';
/** The Run badges; other layers anchor to and hit-test against this id. */
export const RUNS_ICON_LAYER_ID = 'live-runs-icons';
const RING_LAYER_ID = 'live-runs-rings';
const LABEL_LAYER_ID = 'live-runs-labels';
const LABEL_MIN_ZOOM = 9;
/** The lowest Run layer: Stations are drawn under it. */
export const RUNS_HALO_LAYER_ID = 'live-runs-halo';
const DIMMED_OPACITY = 0.4;
/** The other Runs while one is selected. */
const UNSELECTED_OPACITY = 0.35;
/** The selected Run's badge is this much bigger, over an accent halo (see `marker-icons.ts`). */
const SELECTED_SCALE = 1.7;
const HALO_OPACITY = 0.35;
const ICON_SIZE = 1;
const ICON_SIZE_MOBILE = 1.1;
const MOBILE_QUERY = '(max-width: 767px)';

const iconSize = (): number =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
    ? ICON_SIZE_MOBILE
    : ICON_SIZE;

/** Whether a feature is the selected Run; never true without one. */
const isSelectedExpression = (selected: RunId | undefined) =>
  selected
    ? [
        'all',
        ['==', ['get', 'serviceDate'], selected.serviceDate],
        ['==', ['get', 'trainNumber'], selected.trainNumber],
      ]
    : ['==', ['get', 'trainNumber'], ''];

type PaintState = { dimmed: boolean; selected: RunId | undefined };

/**
 * Sets everything that depends on the state of the map: stale (dimmed) positions, and the
 * selected Run, which grows over a halo and is drawn on top while the others fade.
 */
function applyPaint(map: MapLibreMap, { dimmed, selected }: PaintState) {
  if (!map.getLayer(RUNS_ICON_LAYER_ID)) return;
  const size = iconSize();
  const base = dimmed ? DIMMED_OPACITY : 1;
  const isSelected = isSelectedExpression(selected);
  const opacity = (value: number): number | ExpressionSpecification =>
    selected
      ? ([
          'case',
          isSelected,
          value,
          Math.min(base, UNSELECTED_OPACITY),
        ] as unknown as ExpressionSpecification)
      : value;
  const scaled = (value: number): number | ExpressionSpecification =>
    selected
      ? (['case', isSelected, value * SELECTED_SCALE, value] as unknown as ExpressionSpecification)
      : value;

  map.setFilter(RUNS_HALO_LAYER_ID, isSelected as unknown as FilterSpecification);
  map.setLayoutProperty(RUNS_HALO_LAYER_ID, 'icon-size', size * SELECTED_SCALE);
  map.setPaintProperty(
    RUNS_HALO_LAYER_ID,
    'icon-opacity',
    dimmed ? Math.min(HALO_OPACITY, DIMMED_OPACITY) : HALO_OPACITY,
  );
  for (const layer of [RUNS_ICON_LAYER_ID, RING_LAYER_ID]) {
    map.setLayoutProperty(layer, 'icon-size', scaled(size));
    map.setLayoutProperty(
      layer,
      'symbol-sort-key',
      selected ? (['case', isSelected, 1, 0] as unknown as ExpressionSpecification) : 0,
    );
    map.setPaintProperty(layer, 'icon-opacity', opacity(base));
  }
  map.setPaintProperty(LABEL_LAYER_ID, 'text-opacity', opacity(base));
}

function addLayers(map: MapLibreMap, theme: Theme, paint: PaintState) {
  const colors = COLORS[theme];
  addMarkerImages(map, theme, 'run-');
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  // Under everything else: the selected Run's halo.
  map.addLayer({
    id: RUNS_HALO_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: { ...ALWAYS_SHOWN, 'icon-image': 'run-halo' },
    paint: { 'icon-opacity': HALO_OPACITY },
  });
  // Under the badges, and only for late Runs: on time and unknown ones get no frame.
  map.addLayer({
    id: RING_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['in', ['get', 'band'], ['literal', ['late', 'severely_late']]],
    layout: { ...ALWAYS_SHOWN, 'icon-image': ['concat', 'run-ring-', ['get', 'band']] },
  });
  // Snapped positions (not real GPS) have their own hollow badge; see `runIconId`.
  map.addLayer({
    id: RUNS_ICON_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: { ...ALWAYS_SHOWN, 'icon-image': ['get', 'icon'] },
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
      // Just below the badge.
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': colors.ink,
      'text-halo-color': colors.surface,
      'text-halo-width': 1.5,
      'text-opacity': 1,
    },
  });
  applyPaint(map, paint);
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
  selected,
}: {
  map: MapLibreMap | null;
  runs: MapRuns;
  paths?: ReadonlyMap<string, TrackPaths>;
  onSelect?: (id: RunId) => void;
  /** Draws badges and labels at 40 % opacity: the positions are stale (the stream is offline). */
  dimmed?: boolean;
  /** The Run whose detail is open: drawn bigger with a halo, while every other Run fades. */
  selected?: RunId | undefined;
}) {
  // Rebuilt when the Track geometry arrives; Runs then restart from their reported positions.
  const motions = useMemo(
    () => new RunMotions({ ...(paths && { paths }), reducedMotion: prefersReducedMotion() }),
    [paths],
  );
  const { theme } = useTheme();
  const paintRef = useRef<PaintState>({ dimmed, selected });
  paintRef.current = { dimmed, selected };
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
    // A frame is part of its Run: clicking it opens the Run like clicking the badge.
    const layers = [RUNS_ICON_LAYER_ID, RING_LAYER_ID];
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
      if (!map.getSource(SOURCE_ID)) addLayers(map, theme, paintRef.current);
      motions.update(runs, performance.now());
      draw(performance.now());
    };
    const unsubscribe = syncOnStyle(map, SOURCE_ID, sync);
    return () => {
      unsubscribe();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map, runs, motions, theme]);

  const selectedKey = selected && `${selected.serviceDate}:${selected.trainNumber}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `selectedKey` stands for `selected`
  useEffect(() => {
    if (map) applyPaint(map, { dimmed, selected });
  }, [map, dimmed, selectedKey]);

  // Badges grow slightly on narrow viewports.
  useEffect(() => {
    if (!map) return;
    const query = window.matchMedia(MOBILE_QUERY);
    const apply = () => applyPaint(map, paintRef.current);
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [map]);

  return null;
}
