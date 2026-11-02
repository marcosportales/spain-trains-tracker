'use client';

import type { LiveRun, RunId } from '@stt/contracts';
import { type Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTheme } from '@/theme/use-theme';
import { runDetailPath } from '../run/run-detail-view';
import { stationBoardPath } from '../station/station-board-view';
import { AlertsChip } from './alerts/AlertsChip';
import { affectedLineCodes } from './alerts/alerts-view';
import { useServiceAlerts } from './alerts/use-service-alerts';
import { applyMapTheme, createMap } from './create-map';
import { FilterPanel } from './filters/FilterPanel';
import { matchesServiceTypes, toStreamFilters } from './filters/map-filters';
import { useMapFilters } from './filters/use-map-filters';
import { Legend } from './legend/Legend';
import { serviceTypeCounts } from './legend/legend-view';
import { LiveIndicator } from './live/LiveIndicator';
import { LiveRunsLayer } from './live/LiveRunsLayer';
import { liveIndicator } from './live/live-indicator';
import { runKey } from './live/live-runs';
import { useLiveRuns } from './live/use-live-runs';
import { SELECTED_ZOOM } from './map-config';
import { StationsLayer } from './stations/StationsLayer';
import { useStations } from './stations/use-stations';
import { TrackGeometryLayer } from './track/TrackGeometryLayer';
import { useTrackGeometry } from './track/use-track-geometry';

// MapLibre derives its worker URL from its own `import.meta.url`, which the bundler rewrites to a
// non-http URL, leaving the worker (and with it every GeoJSON layer) unable to start.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

type Props = {
  label: string;
  /** Describes the Stations layer for assistive tech (zoom in, select a Station to open its board). */
  stationsHint: string;
  /** The Run whose detail is open: the map centres on it and follows it. */
  selected?: RunId;
  /** Server-known position of `selected`, used until the live stream delivers it. */
  selectedFallback?: LiveRun | undefined;
  /** Station to centre on when `selected` has no live position (a Scheduled Run's origin). */
  fallbackStationCode?: string | undefined;
};

export function TrainMap({
  label,
  stationsHint,
  selected,
  selectedFallback,
  fallbackStationCode,
}: Props) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const container = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [filters, setFilters] = useMapFilters();
  const stations = useStations();
  const track = useTrackGeometry();
  const alerts = useServiceAlerts();
  const [highlightedAlertId, setHighlightedAlertId] = useState<string>();
  const highlighted = useMemo(
    () => affectedLineCodes(alerts.filter((a) => a.id === highlightedAlertId)),
    [alerts, highlightedAlertId],
  );
  const { runs: streamed, lastEventAt, openedAt } = useLiveRuns(toStreamFilters(filters));
  const runs = useMemo(
    () =>
      new Map(
        [...streamed].filter(([, run]) =>
          matchesServiceTypes(filters.serviceTypes, run.serviceType),
        ),
      ),
    [streamed, filters.serviceTypes],
  );
  const counts = useMemo(() => serviceTypeCounts(streamed), [streamed]);
  const lineOptions = useMemo(
    () => [...new Set([...runs.values()].flatMap((r) => (r.lineCode ? [r.lineCode] : [])))].sort(),
    [runs],
  );

  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const check = () =>
      setOffline(liveIndicator({ now: Date.now(), lastEventAt, openedAt }).state === 'offline');
    check();
    const id = setInterval(check, 1_000);
    return () => clearInterval(id);
  }, [lastEventAt, openedAt]);

  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (!container.current) return;
    const instance = createMap(container.current, themeRef.current);
    setMap(instance);
    return () => {
      setMap(null);
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (map) applyMapTheme(map, theme);
  }, [map, theme]);

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

  const fallbackStation = selectedRun
    ? undefined
    : stations.find((station) => station.code === fallbackStationCode);
  const stationLon = fallbackStation?.lon;
  const stationLat = fallbackStation?.lat;

  useEffect(() => {
    if (!map || stationLon === undefined || stationLat === undefined) return;
    map.flyTo({ center: [stationLon, stationLat], zoom: Math.max(map.getZoom(), SELECTED_ZOOM) });
  }, [map, stationLon, stationLat]);

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
      <TrackGeometryLayer map={map} track={track.collection} highlighted={highlighted} />
      <StationsLayer map={map} stations={stations} onSelect={openStation} />
      <LiveRunsLayer
        map={map}
        runs={runs}
        paths={track.paths}
        onSelect={openRun}
        dimmed={offline}
      />
      {!selected && (
        <>
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex flex-col items-start gap-2 md:right-auto">
            <Legend filters={filters} counts={counts} onChange={setFilters} />
            <div className="flex flex-wrap items-center gap-2">
              <LiveIndicator count={streamed.size} lastEventAt={lastEventAt} openedAt={openedAt} />
              <AlertsChip
                alerts={alerts}
                highlightedId={highlightedAlertId}
                onHighlight={setHighlightedAlertId}
              />
            </div>
          </div>
          <FilterPanel filters={filters} lineOptions={lineOptions} onChange={setFilters} />
        </>
      )}
    </>
  );
}
