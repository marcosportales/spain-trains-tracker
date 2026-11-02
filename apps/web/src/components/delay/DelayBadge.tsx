import { useTranslations } from 'next-intl';
import { type DelayBand, delayMinutes } from './delay-band';

/** The one band → pill colour map of the web app. */
export const BAND_CLASSES: Record<DelayBand, string> = {
  on_time: 'bg-green-100 text-green-800',
  late: 'bg-amber-100 text-amber-800',
  severely_late: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-800 text-white',
  unknown: 'bg-gray-100 text-gray-700',
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
  return (
    <span
      data-testid={testId}
      data-badge={band}
      className={`inline-block rounded-full font-medium ${SIZE_CLASSES[size]} ${BAND_CLASSES[band]}`}
    >
      {t(band, { minutes: delayMinutes(delaySeconds ?? 0) })}
    </span>
  );
}
