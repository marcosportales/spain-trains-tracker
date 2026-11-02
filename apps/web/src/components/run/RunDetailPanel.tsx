import type { RunDetail, TrainHistory } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BAND_CLASSES, DelayBadge } from '../delay/DelayBadge';
import { SERVICE_TYPE_COLORS } from '../map/live/live-runs';
import { ShareButton } from '../share/ShareButton';
import { delayBand, showsNoPositionBadge, stopTimes } from './run-detail-view';
import { recentRuns, typicalDelay } from './train-history-view';

/** Run detail: a side panel on larger screens, a bottom sheet on mobile. Server-renderable. */
export function RunDetailPanel({
  detail,
  history,
}: {
  detail: RunDetail;
  /** Delay history of the Train number; leave out when it could not be loaded. */
  history?: TrainHistory | undefined;
}) {
  const t = useTranslations('RunDetail');
  const { run } = detail;
  const band = delayBand(detail);
  const nextStop = detail.position?.nextStationCode;
  const typical = history && typicalDelay(history);

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

      {showsNoPositionBadge(detail) ? (
        <p
          data-testid="no-position-badge"
          className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${BAND_CLASSES.unknown}`}
        >
          {t('badge.noPosition')}
        </p>
      ) : (
        <div className="mt-3">
          <DelayBadge band={band} delaySeconds={detail.delaySeconds} data-testid="delay-badge" />
        </div>
      )}

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

      {history && (
        <section data-testid="train-history" aria-labelledby="train-history-title">
          <h2 id="train-history-title" className="mt-4 text-sm font-semibold">
            {t('history')}
          </h2>
          {typical ? (
            <>
              <p className="text-sm">
                {typical.kind === 'on_time'
                  ? t('historyOnTime', { runs: typical.runs })
                  : t(typical.kind === 'late' ? 'historyLate' : 'historyEarly', {
                      minutes: typical.minutes,
                      runs: typical.runs,
                    })}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-gray-600">
                {recentRuns(history).map((row) => (
                  <li key={row.serviceDate} className="tabular-nums">
                    {t('historyRun', {
                      date: row.serviceDate,
                      minutes: row.minutes,
                      maxMinutes: row.maxMinutes,
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-600">{t('historyNone')}</p>
          )}
        </section>
      )}
    </aside>
  );
}
