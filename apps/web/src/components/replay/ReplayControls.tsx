'use client';

import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SPEEDS, WINDOW_MS } from './replay-view';

const SCRUB_STEP_MS = 60_000;

/** The floating panel under the Replay map: explanation, play/pause, scrubber, speed and hour picker. */
export function ReplayControls({
  status,
  playing,
  onTogglePlay,
  position,
  onScrub,
  clock,
  clockText,
  startLabel,
  endLabel,
  disabled,
  speed,
  onSpeed,
  pickerValue,
  pickerMax,
  onPick,
  runCount,
}: {
  /** A sentence about the window (loading, empty, error…), shown under the explanation. */
  status?: string | undefined;
  playing: boolean;
  onTogglePlay: () => void;
  position: number;
  onScrub: (position: number) => void;
  /** Time of day shown beside the scrubber ("10:42:15"). */
  clock: string;
  /** The full date and time, read by assistive technology. */
  clockText: string;
  startLabel: string;
  endLabel: string;
  disabled: boolean;
  speed: number;
  onSpeed: (speed: number) => void;
  pickerValue: string;
  pickerMax: string;
  onPick: (value: string) => void;
  runCount: number | undefined;
}) {
  const t = useTranslations('Replay');
  const progress = `${(position / WINDOW_MS) * 100}%`;

  return (
    <section
      aria-label={t('controls')}
      className="pointer-events-auto absolute inset-x-2.5 bottom-2.5 z-10 space-y-2 rounded-lg bg-surface p-3 shadow-2 md:inset-x-auto md:bottom-3 md:left-3 md:w-[26.25rem]"
    >
      <p className="text-[13px] text-ink-2">{t('explainer')}</p>
      {status && (
        <p role="status" className="text-[13px] text-ink">
          {status}
        </p>
      )}
      <div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            icon={playing ? Pause : Play}
            aria-label={playing ? t('pause') : t('play')}
            onClick={onTogglePlay}
            disabled={disabled}
          />
          <input
            type="range"
            aria-label={t('scrubber')}
            aria-valuetext={clockText}
            min={0}
            max={WINDOW_MS}
            step={SCRUB_STEP_MS}
            value={position}
            disabled={disabled}
            onChange={(e) => onScrub(Number(e.target.value))}
            style={{ '--progress': progress } as React.CSSProperties}
            className="replay-range min-w-0 flex-1"
          />
          <span
            className="w-[4.5rem] text-right text-sm font-medium tabular-nums"
            aria-hidden="true"
          >
            {clock}
          </span>
        </div>
        <div className="flex justify-between pl-14 pr-[5.25rem] text-xs tabular-nums text-ink-3">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <SegmentedControl
          aria-label={t('speed')}
          value={String(speed)}
          onChange={(value) => onSpeed(Number(value))}
          options={SPEEDS.map((s) => ({ value: String(s), label: t('speedOption', { speed: s }) }))}
        />
        <label className="flex items-center gap-2 text-ink-2">
          {t('start')}
          <input
            type="datetime-local"
            step={3600}
            value={pickerValue}
            max={pickerMax}
            onChange={(e) => onPick(e.target.value)}
            className="min-h-9 rounded-md bg-surface-2 px-2 text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        {runCount !== undefined && (
          <span className="text-ink-3">{t('runs', { count: runCount })}</span>
        )}
      </div>
    </section>
  );
}
