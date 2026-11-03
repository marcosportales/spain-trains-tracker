'use client';

import type { RunId } from '@stt/contracts';
import { type Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouter } from '@/i18n/navigation';
import { useTheme } from '@/theme/use-theme';
import { applyMapTheme, createMap } from '../map/create-map';
import { LiveRunsLayer } from '../map/live/LiveRunsLayer';
import { TrackGeometryLayer } from '../map/track/TrackGeometryLayer';
import { useTrackGeometry } from '../map/track/use-track-geometry';
import { formatMadridDateTime, runDetailPath } from '../run/run-detail-view';
import {
  advance,
  DEFAULT_SPEED,
  defaultWindowStart,
  fromMadridInputValue,
  indexSightings,
  LOOKBACK_HOURS,
  replayRuns,
  SPEEDS,
  toMadridInputValue,
  WINDOW_MS,
} from './replay-view';
import { useLatestWindow } from './use-latest-window';
import { useSightingWindow } from './use-sighting-window';

setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

const SCRUB_STEP_MS = 60_000;

/** Replays a past hour of Sightings on the map, with a play/pause button, speed and a scrubber. */
export function ReplayMap({ label }: { label: string }) {
  const t = useTranslations('Replay');
  const locale = useLocale();
  const router = useRouter();
  const container = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const track = useTrackGeometry();
  const latest = useLatestWindow();
  const [picked, setPicked] = useState<Date | null>(null);
  // The hour picked by hand wins; otherwise the latest hour with data (none until it is found).
  const from = picked ?? (latest.status === 'found' ? latest.from : null);
  const pickerValue = from ?? defaultWindowStart();
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const state = useSightingWindow(from, latest.status === 'found' ? latest : undefined);

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
  const clock = formatMadridDateTime(instant, locale);

  return (
    <>
      <section ref={container} aria-label={label} className="h-full w-full" />
      <TrackGeometryLayer map={map} track={track.collection} />
      <LiveRunsLayer map={map} runs={runs} paths={track.paths} onSelect={openRun} />
      <section
        aria-label={t('controls')}
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 space-y-2 border-t bg-white p-3 shadow-lg md:inset-x-auto md:bottom-3 md:left-3 md:w-[28rem] md:rounded-xl md:border"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            {t('start')}
            <input
              type="datetime-local"
              step={3600}
              value={toMadridInputValue(pickerValue)}
              max={toMadridInputValue(new Date())}
              onChange={(e) => {
                const next = fromMadridInputValue(e.target.value);
                if (next) setPicked(next);
              }}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            {t('speed')}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded border px-2 py-1"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {t('speedOption', { speed: s })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={state.status !== 'ready'}
            className="rounded-full border px-4 py-1 text-sm font-medium disabled:opacity-50"
          >
            {playing ? t('pause') : t('play')}
          </button>
          <input
            type="range"
            aria-label={t('scrubber')}
            aria-valuetext={clock}
            min={0}
            max={WINDOW_MS}
            step={SCRUB_STEP_MS}
            value={position}
            disabled={state.status !== 'ready'}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="min-w-0 flex-1"
          />
        </div>
        <p className="text-sm tabular-nums" aria-live="off">
          {latest.status === 'searching' && t('loading')}
          {latest.status === 'error' && !picked && t('error')}
          {latest.status === 'none' && !picked && t('noRecentData', { hours: LOOKBACK_HOURS })}
          {(latest.status === 'found' || picked) && state.status === 'loading' && t('loading')}
          {(latest.status === 'found' || picked) && state.status === 'error' && t('error')}
          {(latest.status === 'found' || picked) &&
            state.status === 'ready' &&
            (state.window.sightings.length === 0
              ? t('empty')
              : `${clock} · ${t('runs', { count: runs.size })}`)}
        </p>
      </section>
    </>
  );
}
