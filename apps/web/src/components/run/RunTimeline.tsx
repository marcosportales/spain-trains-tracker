import type { RunDetail } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import type { StationNames } from '@/lib/station-names';
import { EmptyState } from '../ui/EmptyState';
import { stopTimeline } from './run-detail-view';

const STATE_CLASSES = { past: 'text-ink-3', current: 'font-medium text-ink', future: 'text-ink' };

/** The stops as a vertical rail: past ones dimmed, the train marker where the train is. */
export function RunTimeline({ detail, names }: { detail: RunDetail; names: StationNames }) {
  const t = useTranslations('RunDetail');
  const { stops, marker } = stopTimeline(detail, names);
  if (stops.length === 0) return <EmptyState message={t('noStops')} />;

  const here = <span className="sr-only">{t('trainHere')}</span>;
  return (
    <ol className="relative mt-2 text-sm before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
      {stops.map((stop, i) => {
        const onStop = marker && marker.atIndex === i;
        return (
          // The sequence is unique within a Run; the index is its position in sequence order.
          // biome-ignore lint/suspicious/noArrayIndexKey: stops have no id of their own
          <li key={i} className="relative">
            {onStop && marker.between && (
              <div className="relative h-5 pl-6">
                <span className="absolute top-1 left-0 size-3 rounded-full bg-accent ring-4 ring-surface" />
                {here}
              </div>
            )}
            <div
              aria-current={onStop ? 'step' : undefined}
              className={`relative flex justify-between gap-2 py-2 pl-6 ${STATE_CLASSES[stop.state]}`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-3.5 left-[1px] size-2 rounded-full ${
                  stop.state === 'current' ? 'bg-accent' : 'bg-line ring-2 ring-surface'
                }`}
              />
              {stop.state === 'current' && here}
              <span>{stop.station}</span>
              <span className="tabular-nums">
                {stop.times.changed ? (
                  <>
                    <s className="text-ink-3">{stop.times.scheduled}</s> {stop.times.estimated}
                  </>
                ) : (
                  (stop.times.estimated ?? stop.times.scheduled)
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
