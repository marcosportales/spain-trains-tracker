import { useTranslations } from 'next-intl';
import { type DelayBand, delayMinutes } from './delay-band';

/**
 * The one band → pill colour map of the web app: the soft background with `ink` text (Cancelled
 * is solid, with its own text colour). Class names are written out so Tailwind finds them.
 */
export const BAND_CLASSES: Record<DelayBand, string> = {
  on_time: 'bg-band-on-time-soft text-ink',
  late: 'bg-band-late-soft text-ink',
  severely_late: 'bg-band-severely-late-soft text-ink',
  cancelled: 'bg-band-cancelled-soft text-band-cancelled-text',
  unknown: 'bg-band-unknown-soft text-ink',
};

/** The leading 8 px dot in the strong colour, so colour is never the only cue. Cancelled has none. */
const DOT_CLASSES: Record<DelayBand, string | undefined> = {
  on_time: 'bg-band-on-time',
  late: 'bg-band-late',
  severely_late: 'bg-band-severely-late',
  cancelled: undefined,
  unknown: 'border-[1.5px] border-band-unknown',
};

const SIZE_CLASSES = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' } as const;

/** The pill for a Delay band, with its localised text. */
export function DelayBadge({
  band,
  delaySeconds,
  size = 'md',
  'data-testid': testId,
}: {
  band: DelayBand;
  delaySeconds?: number | undefined;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}) {
  const t = useTranslations('DelayBand');
  const dot = DOT_CLASSES[band];
  return (
    <span
      data-testid={testId}
      data-badge={band}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums ${SIZE_CLASSES[size]} ${BAND_CLASSES[band]}`}
    >
      {dot && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />}
      {t(band, { minutes: delayMinutes(delaySeconds ?? 0) })}
    </span>
  );
}
