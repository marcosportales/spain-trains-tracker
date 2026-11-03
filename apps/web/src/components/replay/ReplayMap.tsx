'use client';

import type { RunId } from '@stt/contracts';
import { type Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouter } from '@/i18n/navigation';
import { useTheme } from '@/theme/use-theme';
import { applyMapTheme, createMap } from '../map/create-map';
import { LiveRunsLayer } from '../map/live/LiveRunsLayer';
import { TrackGeometryLayer } from '../map/track/TrackGeometryLayer';
import { useTrackGeometry } from '../map/track/use-track-geometry';
import {
  formatMadridClock,
  formatMadridDateTime,
  formatMadridHourMinute,
  runDetailPath,
} from '../run/run-detail-view';
import { ReplayControls, type ReplayControlsView } from './ReplayControls';
import {
  advance,
  DEFAULT_SPEED,
  defaultWindowStart,
  fromMadridInputValue,
  indexSightings,
  LOOKBACK_HOURS,
  replayRuns,
  toMadridInputValue,
  WINDOW_MS,
} from './replay-view';
import { useLatestWindow } from './use-latest-window';
import { useSightingWindow } from './use-sighting-window';

setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

/** Replays a past hour of Sightings on the map, with a play/pause button, speed and a scrubber. */
export function ReplayMap({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const container = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const track = useTrackGeometry();
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [windowAttempt, setWindowAttempt] = useState(0);
  const latest = useLatestWindow(searchAttempt);
  const [picked, setPicked] = useState<Date | null>(null);
  // The hour picked by hand wins; otherwise the latest hour with data (none until it is found).
  const from = picked ?? (latest.status === 'found' ? latest.from : null);
  const pickerValue = from ?? defaultWindowStart();
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const state = useSightingWindow(
    from,
    latest.status === 'found' ? latest : undefined,
    windowAttempt,
  );

  const index = useMemo(
    () => (state.status === 'ready' ? indexSightings(state.window) : undefined),
    [state],
  );
  const instant = (from?.getTime() ?? 0) + position;
  const runs = useMemo(() => (index ? replayRuns(index, instant) : new Map()), [index, instant]);

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

  // A new window starts again from its beginning, paused.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the window changes
  useEffect(() => {
    setPosition(0);
    setPlaying(false);
  }, [from?.getTime()]);

  const positionRef = useRef(0);
  positionRef.current = position;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const next = advance({
        position: positionRef.current,
        elapsedMs: now - last,
        speed,
        length: WINDOW_MS,
      });
      last = now;
      positionRef.current = next.position;
      setPosition(next.position);
      if (next.ended) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const togglePlay = () => {
    if (!playing && position >= WINDOW_MS) setPosition(0);
    setPlaying((p) => !p);
  };
  const openRun = (id: RunId) => router.push(runDetailPath(id));
  const picking = latest.status === 'found' || picked !== null;
  const view: ReplayControlsView =
    latest.status === 'searching'
      ? 'loading'
      : !picking
        ? latest.status === 'error'
          ? 'error'
          : 'none'
        : state.status === 'loading'
          ? 'loading'
          : state.status === 'error'
            ? 'error'
            : state.window.sightings.length === 0
              ? 'empty'
              : 'ready';
  const earlier = () => setPicked(new Date((from ?? pickerValue).getTime() - WINDOW_MS));
  // A failed search starts over; a failed hour is fetched again, without searching.
  const retry = () => (picking ? setWindowAttempt : setSearchAttempt)((n) => n + 1);

  return (
    <>
      <section ref={container} aria-label={label} className="h-full w-full" />
      <TrackGeometryLayer map={map} track={track.collection} />
      <LiveRunsLayer map={map} runs={runs} paths={track.paths} onSelect={openRun} />
      <ReplayControls
        view={view}
        hours={LOOKBACK_HOURS}
        onEarlier={earlier}
        onRetry={retry}
        playing={playing}
        onTogglePlay={togglePlay}
        position={position}
        onScrub={setPosition}
        clock={formatMadridClock(instant, locale)}
        clockText={formatMadridDateTime(instant, locale)}
        startLabel={from ? formatMadridHourMinute(from, locale) : ''}
        endLabel={from ? formatMadridHourMinute(from.getTime() + WINDOW_MS, locale) : ''}
        disabled={view !== 'ready'}
        speed={speed}
        onSpeed={setSpeed}
        pickerValue={toMadridInputValue(pickerValue)}
        pickerMax={toMadridInputValue(new Date())}
        onPick={(value) => {
          const next = fromMadridInputValue(value);
          if (next) setPicked(next);
        }}
        runCount={state.status === 'ready' && index ? runs.size : undefined}
      />
    </>
  );
}
