import type { RunDetail } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SERVICE_TYPE_COLORS } from '../map/live/live-runs';
import { ShareButton } from '../share/ShareButton';
import { type DelayBadge, delayBadge, delayMinutes, stopTimes } from './run-detail-view';

const BADGE_CLASSES: Record<DelayBadge, string> = {
  on_time: 'bg-green-100 text-green-800',
  minor: 'bg-amber-100 text-amber-800',
  major: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-800 text-white',
  unknown: 'bg-gray-100 text-gray-700',
};

/** Run detail: a side panel on larger screens, a bottom sheet on mobile. Server-renderable. */
export function RunDetailPanel({ detail }: { detail: RunDetail }) {
  const t = useTranslations('RunDetail');
  const { run } = detail;
  const badge = delayBadge(detail);
  const delay = detail.delaySeconds ?? run.delaySeconds;
  const nextStop = run.nextStationCode;

  return (
    <aside
      aria-label={t('title', { trainNumber: run.trainNumber })}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[60dvh] overflow-y-auto rounded-t-xl border bg-white p-4 shadow-lg md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-96 md:rounded-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: SERVICE_TYPE_COLORS[run.serviceType] }}
            />
            {t(`serviceTypes.${run.serviceType}`)} {run.trainNumber}
            {run.lineCode && <span className="text-sm font-normal">· {run.lineCode}</span>}
          </h1>
          <p className="text-sm text-gray-600">
            {detail.originStationCode && detail.destinationStationCode
              ? t('route', {
                  origin: detail.originStationCode,
                  destination: detail.destinationStationCode,
                })
              : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton title={t('title', { trainNumber: run.trainNumber })} />
          <Link href="/" className="rounded border px-2 py-1 text-sm">
            {t('close')}
          </Link>
        </div>
      </div>

      <p
        data-testid="delay-badge"
        data-badge={badge}
        className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${BADGE_CLASSES[badge]}`}
      >
        {badge === 'cancelled' || badge === 'unknown'
          ? t(`badge.${badge}`)
          : badge === 'on_time'
            ? t('badge.on_time')
            : t('badge.late', { minutes: delayMinutes(delay ?? 0) })}
      </p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {nextStop && (
          <>
            <dt className="font-semibold">{t('nextStation')}</dt>
            <dd>{nextStop}</dd>
          </>
        )}
        {detail.wheelchairAccessible !== undefined && (
          <>
            <dt className="font-semibold">{t('accessibility')}</dt>
            <dd>{t(detail.wheelchairAccessible ? 'accessible' : 'notAccessible')}</dd>
          </>
        )}
        {detail.rollingStock && (
          <>
            <dt className="font-semibold">{t('rollingStock')}</dt>
            <dd>{detail.rollingStock}</dd>
          </>
        )}
      </dl>

      <h2 className="mt-4 text-sm font-semibold">{t('stops')}</h2>
      {detail.stops.length === 0 ? (
        <p className="text-sm text-gray-600">{t('noStops')}</p>
      ) : (
        <ol className="mt-1 space-y-1 text-sm">
          {detail.stops.map((stop) => {
            const times = stopTimes(stop);
            return (
              <li
                key={stop.sequence}
                aria-current={stop.stationCode === nextStop ? 'step' : undefined}
                className={`flex justify-between gap-2 rounded px-2 py-1 ${stop.stationCode === nextStop ? 'bg-gray-100 font-medium' : ''}`}
              >
                <span>{stop.stationCode}</span>
                <span className="tabular-nums">
                  {times.changed ? (
                    <>
                      <s className="text-gray-500">{times.scheduled}</s> {times.estimated}
                    </>
                  ) : (
                    (times.estimated ?? times.scheduled)
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
