'use client';

import { AttributionControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FilterPanel } from './filters/FilterPanel';
import { matchesServiceTypes, toStreamFilters } from './filters/map-filters';
import { useMapFilters } from './filters/use-map-filters';
import { LiveRunsLayer } from './live/LiveRunsLayer';
import { useLiveRuns } from './live/use-live-runs';
import { attributionHtml, MAP_STYLE_URL, SPAIN_VIEW } from './map-config';

export function TrainMap({ label }: { label: string }) {
  const container = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [filters, setFilters] = useMapFilters();
  const streamed = useLiveRuns(toStreamFilters(filters));
  const runs = useMemo(
    () =>
      new Map(
        [...streamed].filter(([, run]) =>
          matchesServiceTypes(filters.serviceTypes, run.serviceType),
        ),
      ),
    [streamed, filters.serviceTypes],
  );
  const lineOptions = useMemo(
    () => [...new Set([...runs.values()].flatMap((r) => (r.lineCode ? [r.lineCode] : [])))].sort(),
    [runs],
  );

  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: MAP_STYLE_URL,
      center: SPAIN_VIEW.center,
      zoom: SPAIN_VIEW.zoom,
      attributionControl: false,
      dragRotate: false,
    });
    instance.touchZoomRotate.disableRotation();
    instance.addControl(
      new AttributionControl({ compact: false, customAttribution: attributionHtml() }),
    );
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    setMap(instance);
    return () => {
      setMap(null);
      instance.remove();
    };
  }, []);

  return (
    <>
      <section ref={container} aria-label={label} className="h-full w-full" />
      <LiveRunsLayer map={map} runs={runs} />
      <FilterPanel filters={filters} lineOptions={lineOptions} onChange={setFilters} />
    </>
  );
}
