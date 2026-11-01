'use client';

import type { LiveRun, RunId } from '@stt/contracts';
import { AttributionControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { runDetailPath } from '../run/run-detail-view';
import { stationBoardPath } from '../station/station-board-view';
import { FilterPanel } from './filters/FilterPanel';
import { matchesServiceTypes, toStreamFilters } from './filters/map-filters';
import { useMapFilters } from './filters/use-map-filters';
import { LiveRunsLayer } from './live/LiveRunsLayer';
import { runKey } from './live/live-runs';
import { useLiveRuns } from './live/use-live-runs';
import { attributionHtml, MAP_STYLE_URL, SELECTED_ZOOM, SPAIN_VIEW } from './map-config';
import { StationsLayer } from './stations/StationsLayer';
import { useStations } from './stations/use-stations';

type Props = {
  label: string;
  /** Describes the Stations layer for assistive tech (zoom in, select a Station to open its board). */
  stationsHint: string;
  /** The Run whose detail is open: the map centres on it and follows it. */
  selected?: RunId;
  /** Server-known position of `selected`, used until the live stream delivers it. */
  selectedFallback?: LiveRun;
};

export function TrainMap({ label, stationsHint, selected, selectedFallback }: Props) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const container = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [filters, setFilters] = useMapFilters();
  const stations = useStations();
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

  const selectedRun = selected ? (runs.get(runKey(selected)) ?? selectedFallback) : undefined;
  const lon = selectedRun?.lon;
  const lat = selectedRun?.lat;
  const followed = selected && runKey(selected);
  const centred = useRef<string>(undefined);

  useEffect(() => {
    if (!map || lon === undefined || lat === undefined) return;
    // Fly in once per Run, then keep it centred as its position updates.
    if (centred.current !== followed) {
      centred.current = followed;
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), SELECTED_ZOOM) });
    } else {
      map.easeTo({ center: [lon, lat] });
    }
  }, [map, followed, lon, lat]);

  const openRun = (id: RunId) => router.push(`${runDetailPath(id)}${search ? `?${search}` : ''}`);

  const openStation = (code: string) => router.push(stationBoardPath(code));

  return (
    <>
      <section
        ref={container}
        aria-label={label}
        aria-describedby="stations-hint"
        className="h-full w-full"
      />
      <p id="stations-hint" className="sr-only">
        {stationsHint}
      </p>
      <StationsLayer map={map} stations={stations} onSelect={openStation} />
      <LiveRunsLayer map={map} runs={runs} onSelect={openRun} />
      {!selected && (
        <FilterPanel filters={filters} lineOptions={lineOptions} onChange={setFilters} />
      )}
    </>
  );
}
