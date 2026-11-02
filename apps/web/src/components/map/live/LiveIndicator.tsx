'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { type LiveIndicatorState, liveIndicator } from './live-indicator';

const DOT: Record<LiveIndicatorState, string | undefined> = {
  connecting: undefined,
  live: 'bg-band-on-time',
  reconnecting: 'bg-band-late',
  offline: 'bg-band-severely-late',
};

/**
 * Whether the live stream is fresh. The dot colour is only a cue; the copy carries the meaning.
 * Re-evaluated every second, but the status announces state changes only: the ticking seconds
 * are `aria-hidden` and the accessible text omits them.
 */
export function LiveIndicator({
  count,
  lastEventAt,
  openedAt,
}: {
  count: number;
  lastEventAt: number | undefined;
  openedAt: number;
}) {
  const t = useTranslations('Live');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const { state, ageSeconds = 0 } = liveIndicator({ now, lastEventAt, openedAt });
  const dot = DOT[state];
  const text =
    state === 'live'
      ? t('live', { count })
      : state === 'offline'
        ? t('offline', { minutes: Math.floor(ageSeconds / 60) })
        : t(state);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink shadow-2"
    >
      {dot && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />}
      <span>{text}</span>
      {state === 'live' && (
        <span aria-hidden="true" className="text-ink-2">
          · {t('ago', { seconds: ageSeconds })}
        </span>
      )}
    </div>
  );
}
