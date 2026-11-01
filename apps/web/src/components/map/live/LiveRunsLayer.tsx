'use client';

import type { RunId } from '@stt/contracts';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import type { TrackPaths } from '../motion/interpolation';
import { RunMotions } from '../motion/run-motions';
import { type LiveRuns, SERVICE_TYPE_COLORS, toFeatureCollection } from './live-runs';

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
  runs: LiveRuns;
  paths?: ReadonlyMap<string, TrackPaths>;
  onSelect?: (id: RunId) => void;
}) {
  // Rebuilt when the Track geometry arrives; Runs then restart from their reported positions.
  const motions = useMemo(
    () => new RunMotions({ ...(paths && { paths }), reducedMotion: prefersReducedMotion() }),
    [paths],
  );
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
      const source = map.getSource(SOURCE_ID) as GeoJSONSource;
      source.setData(toFeatureCollection(runs, motions.positionsAt(now)));
      frame = motions.isAnimating(now) ? requestAnimationFrame(draw) : undefined;
    };
    const sync = () => {
      if (!map.getSource(SOURCE_ID)) addLayers(map);
      motions.update(runs, performance.now());
      draw(performance.now());
    };
    // `isStyleLoaded()` dips to false while a source reloads, so once the layers exist
    // we push data straight away instead of waiting for a `load` that will not fire again.
    if (map.getSource(SOURCE_ID) || map.isStyleLoaded()) sync();
    else map.once('load', sync);
    return () => {
      map.off('load', sync);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map, runs, motions]);

  return null;
}
